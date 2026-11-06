/**
 * Cut a subject out of a picture and use only that: a mountain picture on a flat sky is cut out in the editor (Auto finds
 * the mountain from the sky), added as its own layer over a separate background picture, and the saved picture really has
 * a see-through sky and a solid mountain.
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const images = async (page: Page) => Object.values(await layers(page)).filter((l) => l.archetype === "image");

test.use({ viewport: { width: 1600, height: 1000 } });

async function addPicture(page: Page, file: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await (await chooser).setFiles(path.join(__dirname, "fixtures", file));
}

/** Reads an asset back through the browser and reports the alpha at some points (0 to 1 of width and height). */
async function alphaAt(page: Page, src: string, points: Array<[number, number]>) {
  return page.evaluate(
    async ({ src, points }) => {
      const id = src.replace(/^asset:/, "");
      const store = (window as unknown as { __LL_ASSETS__: { urlFor: (id: string) => Promise<string | null> } }).__LL_ASSETS__;
      const url = await store.urlFor(id);
      const img = new Image();
      img.src = url as string;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      return { w: img.naturalWidth, h: img.naturalHeight, alpha: points.map(([fx, fy]) => ctx.getImageData(Math.floor(fx * (c.width - 1)), Math.floor(fy * (c.height - 1)), 1, 1).data[3]) };
    },
    { src, points },
  );
}

test("cut a mountain out of its picture and place it over another background", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }

  // the background picture, then the mountain picture on top of it
  await addPicture(page, "adventure-bg.svg");
  await expect.poll(async () => (await images(page)).length).toBe(1);
  await addPicture(page, "mountain-subject.svg");
  await expect.poll(async () => (await images(page)).length).toBe(2);
  const mountain = (await images(page)).find((l) => String(l.name).includes("mountain-subject"))!;
  await page.getByText(mountain.name, { exact: true }).first().click();

  await page.getByRole("button", { name: "Cut out", exact: true }).click();
  const dialog = page.getByTestId("cutout-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("cutout-canvas")).toBeVisible();

  // Auto: the mountain is kept, the sky is cut (about 40% of this picture is mountain)
  await dialog.getByRole("button", { name: "Auto", exact: true }).click();
  await expect.poll(async () => Number((await page.getByTestId("cutout-kept").textContent())?.match(/(\d+)%/)?.[1])).toBeGreaterThan(25);
  const kept = Number((await page.getByTestId("cutout-kept").textContent())?.match(/(\d+)%/)?.[1]);
  expect(kept).toBeLessThan(65);

  const before = (await images(page)).length;
  await dialog.getByRole("button", { name: "Add as new layer" }).click();
  await expect(dialog).toHaveCount(0);

  // a new picture layer with its own asset; the original is untouched
  await expect.poll(async () => (await images(page)).length).toBe(before + 1);
  const cut = (await images(page)).find((l) => String(l.name).includes("cutout"))!;
  expect(cut, "a cutout layer").toBeTruthy();
  const cutSrc = String(cut.properties["media.src"]);
  const original = (await layers(page))[mountain.id];
  expect(String(original.properties["media.src"])).not.toBe(cutSrc);

  // and the saved picture is really cut: sky see-through (top corners), rock solid (bottom middle)
  const a = await alphaAt(page, cutSrc, [[0.02, 0.02], [0.98, 0.02], [0.5, 0.97]]);
  expect(a.alpha[0], "top-left corner is see-through").toBe(0);
  expect(a.alpha[1], "top-right corner is see-through").toBe(0);
  expect(a.alpha[2], "the foot of the mountain is solid").toBe(255);
  expect(a.w).toBeLessThanOrEqual(600);
  expect(Number(cut.properties["frame.width"])).toBeGreaterThan(0);
});

test("Escape closes the cutout dialog without changing anything", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  await addPicture(page, "mountain-subject.svg");
  await expect.poll(async () => (await images(page)).length).toBe(1);
  const [pic] = await images(page);
  await page.getByText(pic.name, { exact: true }).first().click();
  await page.getByRole("button", { name: "Cut out", exact: true }).click();
  await expect(page.getByTestId("cutout-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cutout-dialog")).toHaveCount(0);
  expect(String((await layers(page))[pic.id].properties["media.src"])).toBe(String(pic.properties["media.src"]));
});

test("Apply to this image swaps the picture for its cutout", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  await addPicture(page, "mountain-subject.svg");
  await expect.poll(async () => (await images(page)).length).toBe(1);
  const [pic] = await images(page);
  await page.getByText(pic.name, { exact: true }).first().click();
  await page.getByRole("button", { name: "Cut out", exact: true }).click();
  const dialog = page.getByTestId("cutout-dialog");
  await dialog.getByRole("button", { name: "Auto", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply to this image" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => String((await layers(page))[pic.id].properties["media.src"])).not.toBe(String(pic.properties["media.src"]));
  expect((await images(page)).length).toBe(1);
  const src = String((await layers(page))[pic.id].properties["media.src"]);
  const a = await alphaAt(page, src, [[0.02, 0.02], [0.5, 0.97]]);
  expect(a.alpha).toEqual([0, 255]);
});
