/**
 * Cut a subject out of a picture and use only that: a mountain picture on a flat sky is cut out in the editor (Auto finds
 * the mountain from the sky), added as its own layer over a separate background picture, and the saved picture really has
 * a see-through sky and a solid mountain.
 */
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
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
  await dialog.getByRole("button", { name: "Select", exact: true }).click();
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
  await dialog.getByRole("button", { name: "Select", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply to this image" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => String((await layers(page))[pic.id].properties["media.src"])).not.toBe(String(pic.properties["media.src"]));
  expect((await images(page)).length).toBe(1);
  const src = String((await layers(page))[pic.id].properties["media.src"]);
  const a = await alphaAt(page, src, [[0.02, 0.02], [0.5, 0.97]]);
  expect(a.alpha).toEqual([0, 255]);
});

test("a frame's picture fill: a piece cut from it lines up exactly, and text goes behind it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const docLayers = async () => Object.values(await layers(page));

  // a tall frame, so the wide picture is cropped by its fill: the case that needs real placement
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.getByRole("button", { name: /^Frame/ }).first().click();
  await page.mouse.move(art.x + art.width * 0.1, art.y + art.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width * 0.3, art.y + art.height * 0.5, { steps: 3 });
  await page.mouse.move(art.x + art.width * 0.45, art.y + art.height * 0.9, { steps: 3 });
  await page.mouse.up();
  const frame = (await docLayers()).find((l) => l.archetype === "container" && l.parentId !== null)!;

  // fill it with the picture, through the Fill section
  const settings = page.getByRole("button", { name: "Fill 1 settings" });
  if (!(await settings.isVisible().catch(() => false))) await page.getByRole("button", { name: /Add fill/ }).click();
  await settings.click();
  await page.getByRole("combobox", { name: "Paint type" }).click();
  await page.getByRole("option", { name: "Image" }).click();
  await page.getByLabel("Fill picture").first().setInputFiles(path.join(__dirname, "fixtures", "mountain-subject.svg"));
  await expect(page.getByRole("button", { name: "Cut out", exact: true })).toBeVisible();

  const pageShot = async () => {
    await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    return PNG.sync.read(await page.locator('[data-testid="stage-page"]').screenshot());
  };
  const before = await pageShot();

  // draw around part of the picture and add it as a layer
  await page.getByText(frame.name, { exact: true }).first().click();
  await settings.click();
  await page.getByRole("button", { name: "Cut out", exact: true }).click();
  const dialog = page.getByTestId("cutout-dialog");
  await expect(page.getByTestId("cutout-canvas")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Apply to this image" }), "the fill itself is not replaced").toHaveCount(0);
  await dialog.getByRole("radio", { name: "Draw" }).click();
  const c = (await page.getByTestId("cutout-canvas").boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: c.x + c.width * fx, y: c.y + c.height * fy });
  const corners = [at(0.3, 0.2), at(0.7, 0.2), at(0.7, 0.8), at(0.3, 0.8)];
  await page.mouse.move(corners[0].x, corners[0].y);
  await page.mouse.down();
  for (const q of corners.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Select", exact: true }).click();
  await dialog.getByRole("button", { name: "Add as new layer" }).click();
  await expect(dialog).toHaveCount(0);

  const cut = (await docLayers()).find((l) => String(l.name).includes("cutout"))!;
  expect(cut.parentId, "the piece goes in the frame, above what it already holds").toBe(frame.id);
  await page.waitForTimeout(600); // the picture loads

  // the piece sits on its own pixels: with it on top the page looks the same
  const after = await pageShot();
  expect(after.width).toBe(before.width);
  const changed = pixelmatch(before.data, after.data, undefined, before.width, before.height, { threshold: 0.12 });
  expect(changed, "pixels that moved").toBeLessThan(before.width * before.height * 0.002);
  await expect.poll(() => page.evaluate((id) => {
    const l = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, { children: string[] }> } } }).__LL_DOC__.get().layers[id];
    return l.children.at(-1);
  }, frame.id)).toBe(cut.id);
});


/** Opens the Cut out dialog on a mountain picture on an emptied page. */
async function openMountain(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  await addPicture(page, "mountain-subject.svg");
  await expect.poll(async () => (await images(page)).length).toBe(1);
  const mountain = (await images(page))[0];
  await page.getByText(mountain.name, { exact: true }).first().click();
  await page.getByRole("button", { name: "Cut out", exact: true }).click();
  await expect(page.getByTestId("cutout-canvas")).toBeVisible();
  return { dialog: page.getByTestId("cutout-dialog"), mountain };
}
const keptPercent = async (page: Page) => Number((await page.getByTestId("cutout-kept").textContent())?.match(/(\d+)%/)?.[1]);

test("a loose shape drawn around the mountain settles onto its edge with Snap to edges, and does not with it off", async ({ page }) => {
  test.setTimeout(120_000);
  const { dialog } = await openMountain(page);
  await dialog.getByRole("radio", { name: "Draw", exact: true }).click();
  // about 20px outside the mountain all the way round (the mountain is 46% of the picture), so Reach is widened to cover it
  const loose: Array<[number, number]> = [[0, 1], [0.29, 0.345], [0.5, 0.1], [0.727, 0.395], [1, 0.96], [1, 1]];
  await dialog.getByRole("slider", { name: "Reach" }).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight"); // 14 to 26
  const draw = async () => {
    const c = (await page.getByTestId("cutout-canvas").boundingBox())!;
    const at = ([fx, fy]: [number, number]) => ({ x: c.x + c.width * Math.min(0.999, fx), y: c.y + c.height * Math.min(0.999, fy) });
    await page.mouse.move(at(loose[0]).x, at(loose[0]).y);
    await page.mouse.down();
    for (const p of loose.slice(1)) await page.mouse.move(at(p).x, at(p).y, { steps: 5 });
    await page.mouse.up();
  };

  // marking comes first: nothing can be applied until the area is selected
  await expect(dialog.getByRole("button", { name: "Add as new layer" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Select", exact: true })).toBeDisabled();
  await dialog.getByLabel("Snap to edges").uncheck();
  await draw();
  await expect(dialog.getByRole("button", { name: "Select", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Add as new layer" }), "still marking").toBeDisabled();
  await expect.poll(() => keptPercent(page), "as drawn, the shape keeps the strip of sky around the mountain").toBeGreaterThanOrEqual(50);

  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await dialog.getByLabel("Snap to edges").check();
  await draw();
  await expect.poll(() => keptPercent(page), "snapped, it keeps the mountain and no more").toBeLessThanOrEqual(49);
  expect(await keptPercent(page)).toBeGreaterThanOrEqual(43);

  // and the same smartness removes: draw a loose shape round the sky with Cut
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await dialog.getByRole("radio", { name: "Cut", exact: true }).click();
  const sky: Array<[number, number]> = [[0, 0], [1, 0], [1, 0.9], [0.713, 0.41], [0.5, 0.12], [0.303, 0.36], [0, 0.9]];
  const c = (await page.getByTestId("cutout-canvas").boundingBox())!;
  const at = ([fx, fy]: [number, number]) => ({ x: c.x + c.width * Math.min(0.999, fx), y: c.y + c.height * Math.max(0.001, Math.min(0.999, fy)) });
  await page.mouse.move(at(sky[0]).x, at(sky[0]).y);
  await page.mouse.down();
  for (const p of sky.slice(1)) await page.mouse.move(at(p).x, at(p).y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => keptPercent(page), "cutting the sky leaves the mountain").toBeLessThanOrEqual(50);
  expect(await keptPercent(page)).toBeGreaterThanOrEqual(40);
});

test("Depth: the picture's depth is estimated, shown, picked from, and split into depth layers placed exactly over it", async ({ page }) => {
  test.setTimeout(180_000);
  const { dialog, mountain } = await openMountain(page);
  await dialog.getByLabel("Show depth").check();
  await expect(dialog.getByText(/estimating/), "the estimate finishes").toHaveCount(0, { timeout: 20_000 });

  // pick everything at about the depth of the foot of the mountain
  await dialog.getByRole("radio", { name: "Depth", exact: true }).click();
  const c = (await page.getByTestId("cutout-canvas").boundingBox())!;
  await page.mouse.click(c.x + c.width * 0.5, c.y + c.height * 0.93);
  await expect.poll(() => keptPercent(page), "something near is picked, not everything and not nothing").toBeGreaterThan(3);
  expect(await keptPercent(page)).toBeLessThan(95);
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();

  // depth layers: the picture stays as the farthest; two nearer ones are added, aligned with it
  await dialog.getByRole("button", { name: "Make depth layers" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await images(page)).length).toBe(3);
  const all = await layers(page);
  const made = Object.values(all).filter((l) => /depth \d of 3/.test(String(l.name))).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  expect(made.map((l) => l.name)).toEqual([`${mountain.name} depth 2 of 3`, `${mountain.name} depth 3 of 3`]);
  expect(made[0].parentId).toBe(mountain.parentId);
  // a depth layer sits where its part of the picture is, at the picture's own scale
  const origin = all[mountain.id].properties;
  for (const l of made) {
    expect(Number(l.properties["frame.x"])).toBeGreaterThanOrEqual(Number(origin["frame.x"]) - 1);
    expect(Number(l.properties["frame.x"]) + Number(l.properties["frame.width"])).toBeLessThanOrEqual(Number(origin["frame.x"]) + Number(origin["frame.width"]) + 1);
    expect(Number(l.properties["frame.y"]) + Number(l.properties["frame.height"])).toBeLessThanOrEqual(Number(origin["frame.y"]) + Number(origin["frame.height"]) + 1);
  }
  // each nearer layer shows less, and the nearest does not show the far sky in its corner
  const area = (l: L) => Number(l.properties["frame.width"]) * Number(l.properties["frame.height"]);
  expect(area(made[1])).toBeLessThanOrEqual(area(made[0]));
  const a = await alphaAt(page, String(made[1].properties["media.src"]), [[0.5, 0.97]]);
  expect(a.alpha[0], "the nearest layer is solid at the foot of the picture").toBe(255);
  // the original is untouched and is still the farthest (first) in the parent
  const parent = all[mountain.parentId as string] as unknown as { children: string[] };
  expect(parent.children.indexOf(mountain.id)).toBeLessThan(parent.children.indexOf(made[0].id));
  expect(parent.children.indexOf(made[0].id)).toBeLessThan(parent.children.indexOf(made[1].id));
});
