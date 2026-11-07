/**
 * Reference: the glossy "inflated" Get Started button (https://cdn.collectui.com/amplify_video/2108820482267152384/vid/avc1/720x720/upeVKqkB7rTIFolU-optimized.mp4).
 * It is built here from GENERIC properties only (a rounded rectangle, layered gradient fills with blend modes, inner and drop
 * shadows, a text layer): the editor has no "bubble" property. The test records what the generic set can and cannot do.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Doc = { get: () => { layers: Record<string, { id: string; archetype: string }> }; commands: { updateProps: (id: string, p: Record<string, unknown>) => void } };

async function makeButton(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Rectangle/ }).click();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.55, { steps: 4 });
  await page.mouse.up();
  const id = await page.evaluate(() => Object.values((window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers).find((l) => l.archetype === "rectangle")!.id);
  const stops = (list: Array<[number, string]>) => list.map(([at, color]) => ({ at, color }));
  const fills = [
    // a soft white sheen across the upper middle, added with Screen so black does nothing
    { type: "radial", center: { x: 0.5, y: 0.18 }, radius: { x: 0.5, y: 0.45 }, stops: stops([[0, "#FFFFFF"], [1, "#000000"]]), opacity: 0.4, visible: true, blend: "screen" },
    // the body: a lit top edge falling to near black, with a little bounce light at the bottom
    { type: "linear", from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 }, stops: stops([[0, "#454545"], [0.3, "#161616"], [0.72, "#070707"], [1, "#222222"]]), opacity: 1, visible: true },
  ];
  const shadows = [
    { kind: "inner", x: 0, y: 3, blur: 4, spread: 0, color: "#FFFFFF", visible: true },
    { kind: "inner", x: 0, y: -8, blur: 14, spread: 0, color: "#000000", visible: true },
    { kind: "drop", x: 0, y: 16, blur: 26, spread: -6, color: "rgba(0,0,0,0.45)", visible: true },
  ];
  await page.evaluate(([i, f, s]) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.commands.updateProps(i as string, { "frame.x": 520, "frame.y": 330, "frame.width": 360, "frame.height": 140, "shape.cornerRadius": 38, "paint.fills": JSON.stringify(f), "paint.shadows": JSON.stringify(s) }), [id, fills, shadows] as const);
  await page.waitForTimeout(500);
  return id;
}

test("a glossy inflated button from generic properties: lit top edge, dark body, a soft shadow below", async ({ page }) => {
  const id = await makeButton(page);
  const node = page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);
  await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
  const box = (await node.boundingBox())!;
  const area = { x: box.x - 30, y: box.y - 20, width: box.width + 60, height: box.height + 80 };
  const png = PNG.sync.read(await page.screenshot({ clip: area }));
  if (process.env.OUT) (await import("node:fs")).writeFileSync(`${process.env.OUT}/puffy-recipe.png`, PNG.sync.write(png));
  const lum = (x: number, y: number) => { const i = (Math.round(y) * png.width + Math.round(x)) * 4; return (png.data[i] * 0.299 + png.data[i + 1] * 0.587 + png.data[i + 2] * 0.114); };
  const mid = 30 + box.width / 2;
  const topEdge = lum(mid, 20 + 7), body = lum(mid, 20 + box.height * 0.8), shadowBelow = lum(mid, 20 + box.height + 9), page0 = lum(4, 4);
  expect(topEdge, "the top edge catches light: brighter than the body").toBeGreaterThan(body + 25);
  expect(body, "the body is nearly black").toBeLessThan(45);
  expect(shadowBelow, "a soft shadow under it: darker than the page").toBeLessThan(page0 - 4);
});
