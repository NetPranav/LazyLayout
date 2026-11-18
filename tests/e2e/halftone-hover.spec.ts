/**
 * The Halftone effect: added from the inspector's effect stack, it breaks a layer into a grid of dots round the
 * pointer in Motion and Preview, trailing after it, and leaves the layer whole when the pointer goes away.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
test.use({ viewport: { width: 1600, height: 1000 } });

async function rectangle(page: Page): Promise<string> {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 200, "frame.y": 200, "frame.width": 400, "frame.height": 300, "svg.fill": "#4285F4", "svg.stroke": "none" } });
  });
  await page.evaluate((id) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    reg.all().find((c) => c.id === "selection.set")!.run({ ids: [id] });
  }, id);
  return id;
}

const halftone = (page: Page) =>
  page.evaluate(() => {
    const image = document.querySelector("svg[data-fx-defs] feImage[data-ll-halftone]");
    const composite = image?.parentElement?.querySelector("feComposite[data-ll-halftone-k]");
    return image && composite ? { x: Number(image.getAttribute("x")), y: Number(image.getAttribute("y")), w: Number(image.getAttribute("width")), k3: Number(composite.getAttribute("k3") ?? 0), k: Number(composite.getAttribute("data-ll-halftone-k")) } : null;
  });

test("Halftone from the effect stack spreads dots round the pointer in Preview and goes when it leaves", async ({ page }) => {
  const id = await rectangle(page);
  // added from the inspector, like a person would
  await page.getByRole("combobox", { name: "Add stack effect" }).scrollIntoViewIfNeeded();
  await page.getByRole("combobox", { name: "Add stack effect" }).click();
  await page.getByRole("option", { name: /^Halftone/ }).click();
  await expect(page.getByLabel(/Halftone \(follows the pointer\) 1 dot spacing/i)).toBeVisible();

  // Motion shows the page live
  await page.getByRole("tab", { name: "Motion" }).click();
  const drawn = page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);
  await expect(drawn).toBeVisible();
  await expect.poll(() => halftone(page)).not.toBeNull();
  await expect(drawn).toHaveCSS("filter", /url\(/);

  // at rest nothing is cut away
  expect((await halftone(page))!.k3).toBe(0);

  const box = (await drawn.boundingBox())!;
  const scale = box.width / 400;
  const at = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 };
  await page.mouse.move(at.x, at.y, { steps: 6 });
  // the dots fade in and the spot settles under the pointer, in the layer's own pixels
  await expect.poll(async () => (await halftone(page))!.k3).toBeLessThan(-2.5);
  await expect.poll(async () => { const h = (await halftone(page))!; return Math.abs(h.x + h.w / 2 - 100) + Math.abs(h.y + h.w / 2 - 150); }).toBeLessThan(6);
  expect(scale).toBeGreaterThan(0);

  // it trails: right after a jump the spot is still on its way
  await page.mouse.move(box.x + box.width * 0.75, at.y);
  const mid = (await halftone(page))!;
  expect(mid.x + mid.w / 2).toBeLessThan(300);
  await expect.poll(async () => { const h = (await halftone(page))!; return Math.abs(h.x + h.w / 2 - 300); }).toBeLessThan(6);

  // far away, the layer is whole again
  await page.mouse.move(box.x + box.width + 600, box.y + box.height + 300, { steps: 4 });
  await expect.poll(async () => (await halftone(page))!.k3, { timeout: 5000 }).toBeGreaterThan(-0.05);
});
