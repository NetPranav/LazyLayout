/**
 * ROADMAP Phase 121: layer effects II. Each effect (outer glow, inner glow, a progressive background blur stronger at
 * the top, a progressive layer blur, grain, frosted glass) matches between the canvas and the exported site within 1%
 * of its pixels, over a busy backdrop. The export carries the fallback for browsers without `backdrop-filter`. In the
 * inspector, an effect row becomes an outer glow, a background blur turns progressive, and the frosted-glass preset
 * makes its rows.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const glow = (inner: boolean, color: string, blur: number, spread = 0) => ({ kind: inner ? "inner" : "drop", x: 0, y: 0, blur, spread, color, glow: true });
const REFS: { name: string; props: Record<string, unknown> }[] = [
  { name: "outer glow", props: { "appearance.background.color": "#1e293b", "appearance.radius": 12, "paint.shadows": JSON.stringify([glow(false, "rgba(255, 210, 74, 0.8)", 16, 2)]) } },
  { name: "inner glow", props: { "appearance.background.color": "#1e293b", "appearance.radius": 12, "paint.shadows": JSON.stringify([glow(true, "rgba(56, 189, 248, 0.9)", 12, 1)]) } },
  { name: "progressive background blur", props: { "appearance.background.color": "rgba(255, 255, 255, 0.15)", "paint.effects": JSON.stringify([{ type: "backgroundBlur", blurType: "progressive", radius: 16, startRadius: 0, start: [0.5, 1], end: [0.5, 0] }]) } },
  { name: "progressive layer blur", props: { "appearance.background.color": "#f97316", "paint.effects": JSON.stringify([{ type: "layerBlur", blurType: "progressive", radius: 8, startRadius: 0, start: [0, 0.5], end: [1, 0.5] }]) } },
  { name: "grain", props: { "appearance.background.color": "#e2e8f0", "paint.effects": JSON.stringify([{ type: "noise", mode: "mono", size: 0.75, density: 0.5, color: "rgba(0, 0, 0, 0.3)" }]) } },
  { name: "frosted glass", props: { "paint.backgroundBlur": 20, "appearance.background.color": "rgba(255, 255, 255, 0.18)", "appearance.radius": 16, "paint.shadows": JSON.stringify([glow(true, "rgba(255, 255, 255, 0.6)", 2)]), "paint.effects": JSON.stringify([{ type: "noise", mode: "mono", size: 0.5, density: 0.5, color: "rgba(0, 0, 0, 0.06)" }]) } },
];

const crop = (p: PNG, w: number, h: number) => {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) p.data.copy(out.data, y * w * 4, y * p.width * 4, y * p.width * 4 + w * 4);
  return out;
};

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
  await site.waitForTimeout(400);
  return { site, html: files.map((f) => f.text).join("\n") };
}

test("six effect references match between the canvas and the exported site; the export has the fallback", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const refs = await page.evaluate((refs) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
    return refs.map((r, i) => {
      const x = 40 + (i % 3) * 300;
      const y = 40 + Math.floor(i / 3) * 220;
      // a busy backdrop: a striped star under each effect
      doc.commands.addLayer({ archetype: "star", parentId: frame.id, properties: { positioning: "absolute", "frame.x": x + 10, "frame.y": y, "frame.width": 200, "frame.height": 160, "svg.fill": "#2563eb", "svg.stroke": "#ec4899", "svg.strokeWidth": 10, "svg.strokeDasharray": "6 6" } });
      const w = 180 + i;
      const h = 110;
      const id = doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": x + 20, "frame.y": y + 25, "frame.width": w, "frame.height": h, ...r.props } });
      return { id, w, h, name: r.name };
    });
  }, REFS);

  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  const first = page.locator(`[data-stage=artboard] [data-element-id="${refs[0].id}"]`).first();
  await expect.poll(async () => Math.round((await first.boundingBox())?.width ?? 0)).toBe(refs[0].w);
  const at = (await first.boundingBox())!;
  await page.mouse.move(800, 500);
  await page.mouse.wheel(at.x - 430, at.y - 200);
  await page.waitForTimeout(400);
  await page.mouse.move(5, 5);
  await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));

  const { site, html } = await exportedSite(page, browser);
  expect(html).toContain("data-backdrop-fallback");
  expect(html).toContain("@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))");

  const PAD = 24;
  const failures: string[] = [];
  const shares: string[] = [];
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
    const share = pixelmatch(crop(onCanvas, w, h).data, crop(exported, w, h).data, undefined, w, h, { threshold: 0.1 }) / (w * h);
    shares.push(`${r.name} ${(share * 100).toFixed(2)}%`);
    if (share >= 0.01) failures.push(`${r.name}: ${(share * 100).toFixed(2)}% of pixels differ`);
  }
  console.log(`effects II: ${shares.join(", ")}`);
  expect(failures).toEqual([]);
  await site.close();
});

test("in the inspector: an outer glow, a progressive background blur, and the frosted-glass preset", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 60, "frame.y": 60, "frame.width": 300, "frame.height": 90, "appearance.background.color": "#1e293b" } });
  });
  const props = () => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, id);
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);

  await page.getByRole("button", { name: /^Add effect/ }).first().click();
  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("combobox", { name: "Effect type" }).click();
  await page.getByRole("option", { name: "Outer glow" }).click();
  await expect.poll(async () => JSON.parse(String((await props())["paint.shadows"] ?? "[]"))).toEqual([expect.objectContaining({ kind: "drop", x: 0, y: 0, blur: 16, glow: true })]);

  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("combobox", { name: "Effect type" }).click();
  await page.getByRole("option", { name: "Background blur" }).click();
  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("switch", { name: "Progressive blur" }).click();
  await expect.poll(async () => JSON.parse(String((await props())["paint.effects"] ?? "[]"))).toEqual([expect.objectContaining({ type: "backgroundBlur", blurType: "progressive", start: [0.5, 1], end: [0.5, 0] })]);
  await expect(page.locator(`[data-stage=artboard] [data-element-id="${id}"] [data-effect-band="backgroundBlur"]`)).toHaveCount(5);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("combobox", { name: "Effect type" }).click();
  await page.getByRole("option", { name: "Frosted glass (preset)" }).click();
  await expect.poll(async () => (await props())["paint.backgroundBlur"]).toBe(20);
  const p = await props();
  expect(JSON.parse(String(p["paint.shadows"]))).toEqual([expect.objectContaining({ kind: "inner", glow: true })]);
  expect(String(p["paint.effects"])).toContain('"noise"');
  await expect(page.locator(`[data-stage=artboard] [data-element-id="${id}"][data-backdrop-fallback]`)).toHaveCount(1);
});
