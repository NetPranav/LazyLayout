/**
 * ROADMAP Phase 113: 24 blend-and-mask references, drawn on the canvas and read back as pixels. A rectangle has a red
 * fill and, over it, a blue fill with one of four blend modes and one of six masks. At sample points the colour must
 * be red mixed toward "blue blended over red" by exactly the mask's opacity there.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type RGB = [number, number, number];

const RED: RGB = [255, 0, 0];
/** Blue blended over red, per mode (the CSS blend formulas for these two colours). */
const BLENDED: Record<string, RGB> = { normal: [0, 0, 255], multiply: [0, 0, 0], screen: [255, 0, 255], overlay: [255, 0, 0] };

/** The masks, and how opaque each is at a point (u, v are fractions of the 200 × 100 box). */
const MASKS: { name: string; mask: Record<string, unknown>; at: (u: number, v: number) => number; points: [number, number][] }[] = [
  { name: "linear down", mask: { type: "linear", start: 0, end: 1, angle: 0 }, at: (_u, v) => 1 - v, points: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]] },
  { name: "linear right, 20–80%", mask: { type: "linear", start: 0.2, end: 0.8, angle: 90 }, at: (u) => (u <= 0.2 ? 1 : u >= 0.8 ? 0 : 1 - (u - 0.2) / 0.6), points: [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]] },
  {
    name: "radial",
    mask: { type: "radial", start: 0, end: 1, angle: 0 },
    at: (u, v) => 1 - Math.min(1, Math.hypot((u - 0.5) * 200, (v - 0.5) * 100) / (Math.hypot(200, 100) / 2)),
    points: [[0.5, 0.5], [0.75, 0.5], [0.95, 0.9]],
  },
  {
    name: "conic",
    mask: { type: "conic", start: 0, end: 1, angle: 0 },
    at: (u, v) => {
      let a = Math.atan2((v - 0.5) * 100, (u - 0.5) * 200) + Math.PI / 2;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return 1 - a / (2 * Math.PI);
    },
    points: [[0.9, 0.5], [0.5, 0.9], [0.1, 0.5]],
  },
  { name: "layer inside", mask: { type: "layer", id: "@ellipse" }, at: (u, v) => (Math.hypot(u * 200 - 50, v * 100 - 50) < 50 ? 1 : 0), points: [[0.25, 0.5], [0.75, 0.5], [0.9, 0.2]] },
  { name: "layer outside", mask: { type: "layer", id: "@ellipse", invert: true }, at: (u, v) => (Math.hypot(u * 200 - 50, v * 100 - 50) < 50 ? 0 : 1), points: [[0.25, 0.5], [0.75, 0.5], [0.9, 0.2]] },
];

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  return page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    // the ellipse is the mask for the layer masks: a circle of 100 px over the rectangle's left half; it draws nothing itself
    const ellipse = doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 100, "frame.height": 100, "svg.fill": "none", "paint.fills": "[]" } });
    const rect = doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 200, "frame.height": 100, "svg.stroke": "none" } });
    return { rect, ellipse };
  });
}

test("24 blend-and-mask references: the drawn colour is red mixed toward the blend by the mask", async ({ page }) => {
  const { rect, ellipse } = await setup(page);
  const results: string[] = [];
  let worst = 0;
  for (const m of MASKS) {
    for (const blend of Object.keys(BLENDED)) {
      const mask = m.mask.id === "@ellipse" ? { ...m.mask, id: ellipse } : m.mask;
      const fills = JSON.stringify([{ type: "solid", color: "#0000ff", ...(blend !== "normal" ? { blend } : {}), mask }, { type: "solid", color: "#ff0000" }]);
      await page.evaluate(({ id, fills }) => (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: unknown) => void } } }).__LL_DOC__.commands.updateProps(id, { "paint.fills": fills }), { id: rect, fills });
      const el = page.locator(`[data-stage=artboard] svg[data-element-id="${rect}"], [data-stage=artboard] [data-element-id="${rect}"] svg`).first();
      await expect(el.locator("mask")).toHaveCount(1);
      const box = (await el.boundingBox())!;
      const png = PNG.sync.read(await page.screenshot({ clip: box, animations: "disabled" }));
      for (const [u, v] of m.points) {
        const x = Math.min(png.width - 1, Math.round(u * png.width));
        const y = Math.min(png.height - 1, Math.round(v * png.height));
        const k = (y * png.width + x) * 4;
        const got: RGB = [png.data[k], png.data[k + 1], png.data[k + 2]];
        const a = m.at(u, v);
        const want = RED.map((r, c) => Math.round(r + (BLENDED[blend][c] - r) * a)) as RGB;
        const off = Math.max(...got.map((g, c) => Math.abs(g - want[c])));
        worst = Math.max(worst, off);
        if (off > 10) results.push(`${m.name} / ${blend} at (${u}, ${v}): got ${got.join(",")}, want ${want.join(",")}`);
      }
    }
  }
  console.log(`24 references, 72 points: worst channel difference ${worst}`);
  expect(results).toEqual([]);
});

test("the export carries the masks and the blend", async ({ page }) => {
  const { rect } = await setup(page);
  const fills = JSON.stringify([{ type: "solid", color: "#0000ff", blend: "multiply", mask: { type: "linear", start: 0, end: 1, angle: 0 } }, { type: "solid", color: "#ff0000" }]);
  await page.evaluate(({ id, fills }) => (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: unknown) => void } } }).__LL_DOC__.commands.updateProps(id, { "paint.fills": fills }), { id: rect, fills });
  const html = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => f.text ?? "").join("\n");
  });
  // the export moves inline styles into classes: the mask's class must make it an alpha mask
  const cls = /<mask [^>]*class="([^"]+)"/.exec(html)?.[1];
  expect(cls, "the export draws the mask").toBeTruthy();
  expect(html).toMatch(new RegExp(`\\.${cls}\\s*\\{[^}]*mask-type:\\s*alpha`));
  expect(html).toMatch(/mix-blend-mode:\s*multiply/);
});
