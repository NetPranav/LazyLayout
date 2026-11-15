/**
 * ROADMAP Phase 115: a mesh gradient on the canvas and in the exported site (opened in a second page) match within
 * 1% of pixels; and with "Edit points on canvas" on, dragging a mesh point moves its colour, as one undo step.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };

test.use({ viewport: { width: 1600, height: 1000 } });

const MESH = { type: "mesh", cols: 3, rows: 3, smooth: true, points: [
  { x: 0, y: 0, color: "#ff7a59" }, { x: 0.5, y: 0, color: "#f59e0b" }, { x: 1, y: 0, color: "#ec4899" },
  { x: 0, y: 0.5, color: "#10b981" }, { x: 0.35, y: 0.6, color: "#ffffff" }, { x: 1, y: 0.5, color: "#7c3aed" },
  { x: 0, y: 1, color: "#0ea5e9" }, { x: 0.5, y: 1, color: "#4f46e5" }, { x: 1, y: 1, color: "#111827" },
] };
const FILLS = JSON.stringify([MESH]);

async function exportedPage(page: Page, browser: import("@playwright/test").Browser, zoom: number) {
  const files = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
  const site = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await site.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
    if (!f) return route.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
    return route.fulfill({ status: 200, contentType: type, body: f.text });
  });
  const index = files.find((f) => f.path.endsWith("index.html"))!;
  await site.goto(`http://export.test/${index.path}`);
  await site.evaluate((z) => ((document.documentElement.style as unknown as { zoom: string }).zoom = String(z)), zoom);
  await site.waitForTimeout(300);
  return site;
}

test("a mesh gradient: the canvas and the exported site match within 1% of pixels", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate((fills) => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 240, "frame.height": 120, "svg.stroke": "none", "paint.fills": fills } });
  }, FILLS);
  const onCanvas = page.locator(`[data-stage=artboard] svg[data-element-id="${id}"], [data-stage=artboard] [data-element-id="${id}"] svg`).first();
  await expect(onCanvas.locator("pattern")).toHaveCount(1);
  // compare at 100%: grain a pixel or two across aliases differently under the canvas's scaling and a page zoom
  await page.evaluate(() => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    reg.all().find((c) => c.id === "view.zoom100")!.run();
  });
  await expect.poll(async () => Math.round(((await onCanvas.boundingBox())?.width ?? 0) * 10) / 10).toBe(240);
  // pan the canvas (wheel) so the rectangle sits in the middle, clear of the side panels
  const at = (await onCanvas.boundingBox())!;
  await page.mouse.move(800, 500);
  await page.mouse.wheel(at.x + at.width / 2 - 800, at.y + at.height / 2 - 500);
  await expect.poll(async () => Math.abs(((await onCanvas.boundingBox())?.x ?? 0) + 120 - 800)).toBeLessThan(40);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  const box = (await onCanvas.boundingBox())!;
  const zoom = box.width / 240;
  const a = PNG.sync.read(await page.screenshot({ clip: box, animations: "disabled" }));

  const site = await exportedPage(page, browser, zoom);
  const exported = site.locator("svg").filter({ has: site.locator("pattern") }).first();
  await expect(exported).toBeVisible();
  const ebox = (await exported.boundingBox())!;
  const b = PNG.sync.read(await site.screenshot({ clip: ebox, animations: "disabled" }));
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (p: PNG) => {
    const out = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) p.data.copy(out.data, y * w * 4, y * p.width * 4, y * p.width * 4 + w * 4);
    return out;
  };
  const diff = pixelmatch(crop(a).data, crop(b).data, undefined, w, h, { threshold: 0.1 });
  const share = diff / (w * h);
  console.log(`canvas ${a.width}×${a.height}, export ${b.width}×${b.height}, zoom ${zoom.toFixed(3)}: ${(share * 100).toFixed(2)}% of pixels differ`);
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
  expect(share).toBeLessThan(0.01);
  await site.close();
});

test("Edit points on canvas: dragging a mesh point moves its colour, one undo step", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate((fills) => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 240, "frame.height": 120, "svg.stroke": "none", "paint.fills": fills } });
  }, FILLS);
  await page.evaluate((id) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    reg.all().find((c) => c.id === "selection.set")!.run({ ids: [id] });
  }, id);
  // open the fill's settings and switch on editing the points
  const settings = page.getByRole("button", { name: "Fill 1 settings" });
  await settings.click();
  await page.getByLabel("Edit mesh points on canvas", { exact: true }).click();
  const point = page.getByRole("button", { name: "Mesh point 5" });
  await expect(point).toBeVisible();
  const b = (await point.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 - 10, { steps: 5 });
  await page.mouse.up();
  const fills = async () => JSON.parse(String((await page.evaluate((id) => (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers[id].properties["paint.fills"], id)) || "[]"));
  await expect.poll(async () => (await fills())[0].points[4].x).toBeGreaterThan(0.45);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect.poll(async () => (await fills())[0].points[4].x).toBeCloseTo(0.35, 2);
});
