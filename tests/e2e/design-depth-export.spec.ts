/**
 * ROADMAP Phase 130 gate: the HTML parity gate on a page using every feature of Stage 3 (booleans, corner styles,
 * modifiers and a generator, fill stacks with blend and masks, noise, pattern, mesh and live fills, text strokes,
 * stroke stacks, a variable width and a brush, a glow, a progressive blur, frosted glass and grain, an image look, text
 * on a path, in a shape, in columns and with OpenType, and a 2.5D space arranged in a ring with a depth camera).
 *
 * As Phase 49's gate does: the canvas's own markup for the page is put on a page of its own, and the exported site's
 * page next to it; at 1440, 1024, 768, 480 and 375 px wide the two differ in at most 0.5% of the page's pixels, and of
 * each feature's. The export lists what it can't make exact.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";
import { buildDesignDepthLayers, PAGE } from "../export-harness/design-depth-fixture";

type L = { id: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { removeLayer: (id: string) => void; updateProps: (id: string, p: unknown) => void; insertLayers: (layers: unknown[], clips?: unknown[], label?: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const WIDTHS = [1440, 1024, 768, 480, 375];
const H = 1500;

/** Pixels that differ between two screenshots inside a rectangle. */
function differing(a: PNG, b: PNG, r: { x: number; y: number; w: number; h: number }) {
  let n = 0;
  const x1 = Math.min(a.width, r.x + r.w);
  const y1 = Math.min(a.height, r.y + r.h);
  for (let y = Math.max(0, r.y); y < y1; y++)
    for (let x = Math.max(0, r.x); x < x1; x++) {
      const i = (y * a.width + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
    }
  return { n, area: Math.max(1, (x1 - Math.max(0, r.x)) * (y1 - Math.max(0, r.y))) };
}

async function insertFixture(page: Page): Promise<string> {
  // (passed as text: the layers' full type is too deep for the evaluate call's generics)
  const json = JSON.stringify(Object.values(buildDesignDepthLayers()));
  return page.evaluate(({ json, PAGE }) => {
    const fixture = JSON.parse(json) as L[];
    const d = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(d.get().layers).find((l) => l.parentId && d.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const pageId = frame.parentId!;
    for (const c of [...d.get().layers[pageId].children]) d.commands.removeLayer(c);
    d.commands.updateProps(pageId, { "frame.width": 1440, "frame.height": 1500, "appearance.background.color": "#ffffff" });
    // the fixture's layers, its page's children put on this page
    const layers = fixture.filter((l) => l.id !== PAGE).map((l) => (l.parentId === PAGE ? { ...l, parentId: pageId } : l));
    d.commands.insertLayers(layers, [], "Design-depth fixture");
    return pageId;
  }, { json, PAGE });
}

test("the HTML export of a page using every Stage 3 feature matches the canvas at 5 widths (≤ 0.5%)", async ({ page, context }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const pageId = await insertFixture(page);
  await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));
  await page.waitForTimeout(800);

  // the canvas's own markup for the page, and each feature's box in it
  const drawn = `[data-stage=artboard] [data-archetype][data-element-id="${pageId}"]`;
  await expect(page.locator(drawn).first()).toBeVisible();
  const markup = await page.locator(drawn).first().evaluate((el) => el.outerHTML);
  const site = await page.evaluate(() => (window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[]; warnings: string[] }> } }).__LL_EXPORT__.build({ target: "html", styling: "css" }));
  expect(site.warnings.join("\n")).toContain("progressive blur is drawn in 5 steps");
  expect(site.warnings.join("\n")).toContain("2.5D space is drawn with CSS 3D");

  const byPath = new Map(site.files.map((f) => [f.path, f.text ?? ""]));
  await context.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const body = byPath.get(path);
    return body !== undefined ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body }) : route.fulfill({ status: 404, body: "" });
  });
  const ref = await context.newPage();
  const out = await context.newPage();
  const failures: string[] = [];
  const shares: string[] = [];
  const FEATURES = ["dd_bool", "dd_corner", "dd_mod", "dd_gen", "dd_fills", "dd_noise", "dd_pattern", "dd_mesh", "dd_live", "dd_text_stroke", "dd_strokes", "dd_taper", "dd_brush", "dd_glow", "dd_pblur", "dd_glass", "dd_grain", "dd_image", "dd_tpath", "dd_tshape", "dd_cols", "dd_ot", "dd_space"];
  for (const w of WIDTHS) {
    await ref.setViewportSize({ width: w, height: H });
    await ref.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${markup}</body></html>`);
    await ref.waitForTimeout(400);
    await out.setViewportSize({ width: w, height: H });
    await out.goto("http://export.test/index.html");
    await out.waitForLoadState("load");
    await out.waitForTimeout(400);
    const a = PNG.sync.read(await ref.screenshot({ clip: { x: 0, y: 0, width: w, height: H } }));
    const b = PNG.sync.read(await out.screenshot({ clip: { x: 0, y: 0, width: w, height: H } }));
    const whole = differing(a, b, { x: 0, y: 0, w, h: H });
    shares.push(`${w}px ${((100 * whole.n) / whole.area).toFixed(2)}%`);
    if (whole.n / whole.area > 0.005) failures.push(`${w}px: the page differs in ${((100 * whole.n) / whole.area).toFixed(2)}% of its pixels`);
    // every feature's own box (where it shows at this width)
    const rects = await ref.evaluate((ids) => {
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const id of ids) {
        const el = document.querySelector(`[data-element-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        out[id] = { x: Math.floor(r.left), y: Math.floor(r.top), w: Math.ceil(r.width), h: Math.ceil(r.height) };
      }
      return out;
    }, FEATURES);
    let checked = 0;
    for (const id of FEATURES) {
      const r = rects[id];
      if (!r || r.w === 0 || r.h === 0 || r.x >= w) continue;
      checked++;
      const d = differing(a, b, r);
      if (d.n / d.area > 0.005) failures.push(`${w}px: ${id} differs in ${((100 * d.n) / d.area).toFixed(2)}% of its pixels`);
    }
    expect(checked, `features checked at ${w}`).toBeGreaterThan(5);
  }
  console.log(`design-depth export: ${shares.join(", ")}`);
  expect(failures).toEqual([]);
});
