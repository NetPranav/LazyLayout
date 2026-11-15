/**
 * ROADMAP Phase 118: 30 stroke references (6 kinds of layer × 5 stroke set-ups: one centre stroke, outside and inside,
 * a gradient stroke, three stacked strokes, and a dashed stroke with arrowheads on open paths) match between the canvas
 * and the exported site, each within 1% of its pixels. Each layer has its own width, so it can be found in the export.
 * And in the inspector, a second stroke row is kept (it used to be dropped).
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } };

test.use({ viewport: { width: 1600, height: 1000 } });

const GRAD = { type: "linear", stops: [{ at: 0, color: "#ff3366" }, { at: 1, color: "#3366ff" }], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
const SETUPS: { strokes: unknown[]; extra?: Record<string, unknown> }[] = [
  { strokes: [{ type: "solid", color: "#111111", weight: 4, align: "center" }] },
  { strokes: [{ type: "solid", color: "#ff0000", weight: 6, align: "outside" }, { type: "solid", color: "#0000ff", weight: 3, align: "inside" }] },
  { strokes: [{ ...GRAD, weight: 5, align: "center" }] },
  { strokes: [{ type: "solid", color: "#ffffff", weight: 2, align: "inside" }, { type: "solid", color: "#111111", weight: 3, align: "center" }, { type: "solid", color: "#ff9900", weight: 8, align: "outside" }] },
  { strokes: [{ type: "solid", color: "#226622", weight: 3 }], extra: { "svg.strokeWidth": 3, "svg.strokeDasharray": "8 4", "shape.startCap": "triangleArrow", "shape.endCap": "circleFilled" } },
];
const KINDS: { archetype: string; extra?: Record<string, unknown> }[] = [
  { archetype: "rectangle" },
  { archetype: "ellipse" },
  { archetype: "star" },
  { archetype: "polygon" },
  { archetype: "line" },
  { archetype: "svgPath", extra: { "svg.path": "M10 180 C60 20 140 20 190 180", "svg.fill": "none" } },
];

async function exportedSite(page: Page, browser: import("@playwright/test").Browser) {
  const files = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
  const site = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  await site.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
    return f ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body: f.text }) : route.fulfill({ status: 404, body: "" });
  });
  await site.goto(`http://export.test/${files.find((f) => f.path.endsWith("index.html"))!.path}`);
  await site.waitForTimeout(300);
  return site;
}

const crop = (p: PNG, w: number, h: number) => {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) p.data.copy(out.data, y * w * 4, y * p.width * 4, y * p.width * 4 + w * 4);
  return out;
};

test("30 stroke references match between the canvas and the exported site", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  // clear the starter page, so the references have it to themselves
  await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc & { commands: { removeLayer: (id: string) => void } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
  });
  const refs = await page.evaluate(({ kinds, setups }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const out: { id: string; w: number; h: number; name: string }[] = [];
    kinds.forEach((k, ki) =>
      setups.forEach((s, si) => {
        const i = ki * setups.length + si;
        const w = 90 + i;
        const h = 56;
        const id = doc.commands.addLayer({
          archetype: k.archetype,
          parentId: frame.id,
          properties: { positioning: "absolute", "frame.x": 30 + si * 170, "frame.y": 30 + ki * 110, "frame.width": w, "frame.height": h, "svg.fill": "#dddddd", "svg.stroke": "#111111", "svg.strokeWidth": 3, ...(k.extra ?? {}), "paint.strokes": JSON.stringify(s.strokes), ...(s.extra ?? {}) },
        });
        out.push({ id, w, h, name: `${k.archetype} / set-up ${si + 1}` });
      }),
    );
    return out;
  }, { kinds: KINDS, setups: SETUPS });

  // 100%, and the references in view
  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  const first = page.locator(`[data-stage=artboard] [data-element-id="${refs[0].id}"]`).first();
  await expect.poll(async () => Math.round((await first.boundingBox())?.width ?? 0)).toBe(refs[0].w);
  const at = (await first.boundingBox())!;
  await page.mouse.move(800, 500);
  await page.mouse.wheel(at.x - 430, at.y - 160);
  await page.waitForTimeout(400);
  await page.mouse.move(5, 5);

  const site = await exportedSite(page, browser);
  const PAD = 14;
  const failures: string[] = [];
  let worst = 0;
  for (const r of refs) {
    const a = (await page.locator(`[data-stage=artboard] [data-element-id="${r.id}"]`).first().boundingBox())!;
    const shot = (pg: Page, b: { x: number; y: number; width: number; height: number }) => pg.screenshot({ clip: { x: b.x - PAD, y: b.y - PAD, width: b.width + 2 * PAD, height: b.height + 2 * PAD }, animations: "disabled" });
    const onCanvas = PNG.sync.read(await shot(page, a));
    const b = await site.evaluate(({ w, h }) => {
      const el = [...document.querySelectorAll("body *")].find((e) => {
        const r = e.getBoundingClientRect();
        return Math.abs(r.width - w) < 0.5 && Math.abs(r.height - h) < 0.5;
      });
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, { w: r.w, h: r.h });
    if (!b) {
      failures.push(`${r.name}: not found in the export`);
      continue;
    }
    const exported = PNG.sync.read(await shot(site, b));
    const w = Math.min(onCanvas.width, exported.width);
    const h = Math.min(onCanvas.height, exported.height);
    const diff = pixelmatch(crop(onCanvas, w, h).data, crop(exported, w, h).data, undefined, w, h, { threshold: 0.1 });
    const share = diff / (w * h);
    worst = Math.max(worst, share);
    if (share >= 0.01) failures.push(`${r.name}: ${(share * 100).toFixed(2)}% of pixels differ`);
  }
  console.log(`30 stroke references: worst ${(worst * 100).toFixed(2)}% of pixels differ`);
  expect(failures).toEqual([]);
  await site.close();
});

test("a second stroke row is kept, with its own width and position", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 120, "frame.height": 80, "svg.strokeWidth": 0 } });
  });
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);
  await page.getByRole("button", { name: "Add stroke", exact: true }).click();
  await page.getByRole("button", { name: "Add stroke", exact: true }).click();
  await page.getByRole("button", { name: "Stroke 2 settings" }).click();
  await page.getByLabel("Stroke width", { exact: true }).last().fill("7");
  await page.getByLabel("Stroke width", { exact: true }).last().press("Tab");
  await page.getByRole("combobox", { name: "Stroke position" }).last().click();
  await page.getByRole("option", { name: /Outside/ }).click();
  const strokes = async () => JSON.parse(String((await page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties["paint.strokes"], id)) || "[]"));
  await expect.poll(async () => (await strokes()).map((s: { weight: number }) => s.weight)).toEqual([1, 7]);
  expect((await strokes())[1].align).toBe("outside");
});
