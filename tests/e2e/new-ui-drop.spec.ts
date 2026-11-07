/** Dropping pictures: onto the canvas they are stored in the assets and placed where they are dropped; onto the Assets panel they are stored. */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Doc = { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> }>; assets?: Record<string, unknown> } };
const state = (page: Page) => page.evaluate(() => { const d = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get(); return { images: Object.values(d.layers).filter((l) => l.archetype === "image"), assets: Object.keys(d.assets ?? {}).length }; });

/** Drops a file from disk on the element at (x, y), the way a file dragged from the desktop arrives. */
async function drop(page: Page, file: string, selector: string, x: number, y: number) {
  const svg = fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8");
  await page.evaluate(([svgText, name, sel, px, py]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([svgText], name, { type: "image/svg+xml" }));
    const target = document.querySelector(sel) as Element;
    for (const type of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: px as number, clientY: py as number, dataTransfer: dt }));
  }, [svg, file, selector, x, y] as const);
}

test("a picture dropped on the canvas is stored in the assets and placed where it was dropped", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = await state(page);
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const at = { x: b.x + b.width * 0.7, y: b.y + b.height * 0.6 };
  await drop(page, "mountain-subject.svg", '[data-stage="workspace"]', at.x, at.y);
  await expect.poll(async () => (await state(page)).images.length).toBe(before.images.length + 1);
  const after = await state(page);
  expect(after.assets, "stored in the assets").toBe(before.assets + 1);
  const img = after.images[after.images.length - 1];
  const el = (await page.locator(`[data-testid="stage-element"][data-element-id="${img.id}"]`).boundingBox())!;
  expect(Math.abs(el.x + el.width / 2 - at.x), "centred on the drop point").toBeLessThan(8);
  expect(Math.abs(el.y + el.height / 2 - at.y)).toBeLessThan(8);
  await expect(page.locator(`[data-testid="stage-element"][data-element-id="${img.id}"]`)).toHaveAttribute("data-selected", "true");

  // the same picture dropped on the Assets panel is stored and nothing is placed
  await drop(page, "adventure-bg.svg", "#p-assets", 100, 900);
  await expect.poll(async () => (await state(page)).assets).toBe(after.assets + 1);
  expect((await state(page)).images.length, "no layer from a panel drop").toBe(after.images.length);
});
