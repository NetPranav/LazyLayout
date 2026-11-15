/**
 * ROADMAP Phase 122: image adjustments and filters. Each adjustment drawn by the browser in the exported site (the
 * seven, a curve, a duotone, a gradient map, sharpen and blur; the canvas draws the same filter) matches the reference
 * worked out pixel by pixel (`referenceImage`) within 1% of its pixels, each channel within 8 levels; the picture's
 * file stays the same. In the inspector a duotone is
 * switched on, then "Show original" shows the picture as it is and keeps the duotone.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";
import { referenceImage, type ImageLook } from "../../src/core/paint/imageLook";
import { NO_ADJUSTMENTS, type ImageAdjustments } from "../../src/core/paint/color";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const W = 120;
const H = 90;
/** A test picture: red across, green down, blue in waves, and a checkered patch (detail for sharpen and blur to change). */
function picture(): PNG {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      p.data[i] = Math.round((x / (W - 1)) * 255);
      p.data[i + 1] = Math.round((y / (H - 1)) * 255);
      p.data[i + 2] = Math.round(128 + 100 * Math.sin(x / 14 + y / 19));
      p.data[i + 3] = 255;
      if (x >= 40 && x < 80 && y >= 30 && y < 60) {
        const on = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
        p.data[i] = p.data[i + 1] = p.data[i + 2] = on ? 230 : 30;
      }
    }
  return p;
}

const A = (patch: Partial<ImageAdjustments>): ImageAdjustments => ({ ...NO_ADJUSTMENTS, ...patch });
const CASES: { name: string; adjust?: ImageAdjustments; look?: ImageLook }[] = [
  { name: "exposure", adjust: A({ exposure: 0.3 }) },
  { name: "contrast", adjust: A({ contrast: 0.4 }) },
  { name: "saturation", adjust: A({ saturation: -0.6 }) },
  { name: "temperature", adjust: A({ temperature: 0.6 }) },
  { name: "tint", adjust: A({ tint: -0.5 }) },
  { name: "highlights", adjust: A({ highlights: -0.7 }) },
  { name: "shadows", adjust: A({ shadows: 0.7 }) },
  { name: "curve", look: { curve: [0, 0.18, 0.5, 0.82, 1] } },
  { name: "duotone", look: { map: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ff5c8a" }] } },
  { name: "gradient map", look: { map: [{ at: 0, color: "#2b1d0e" }, { at: 0.55, color: "#a67c52" }, { at: 1, color: "#f5e6c8" }] } },
  { name: "sharpen", look: { sharpen: 0.6 } },
  { name: "blur", look: { blur: 2 } },
];

/** Pixels at least this far from a picture's edge are compared (a blur reads past the edge, which browsers treat differently). */
const INSET = 8;
const inner = (data: Uint8Array | Uint8ClampedArray, w: number, h: number) => {
  const out = new Uint8ClampedArray((w - 2 * INSET) * (h - 2 * INSET) * 4);
  for (let y = INSET; y < h - INSET; y++) out.set(data.subarray((y * w + INSET) * 4, (y * w + w - INSET) * 4), (y - INSET) * (w - 2 * INSET) * 4);
  return out;
};

/** The share of pixels where any channel is more than 8 levels (of 255) off: strict, so a subtle adjustment counts. */
function differing(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) n++;
  return n / (a.length / 4);
}

test("every adjustment matches its reference within 1%; the picture's file stays the same", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const src = `data:image/png;base64,${PNG.sync.write(picture()).toString("base64")}`;
  const ids = await page.evaluate(({ cases, src, W, H }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
    return cases.map((c, i) =>
      doc.commands.addLayer({
        archetype: "image",
        parentId: frame.id,
        properties: {
          positioning: "absolute", "frame.x": 40 + (i % 6) * 150, "frame.y": 40 + Math.floor(i / 6) * 130, "frame.width": W, "frame.height": H, "media.src": src, "media.objectFit": "fill",
          ...(c.adjust ? { "media.adjust": JSON.stringify(c.adjust) } : {}), ...(c.look ? { "media.look": JSON.stringify(c.look) } : {}),
        },
      }),
    );
  }, { cases: CASES, src, W, H });

  // the exported site: the page as it ships, laid out on whole pixels (the canvas is zoomed and panned, so it resamples)
  const files = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
  const site = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await site.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
    return f ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body: f.text }) : route.fulfill({ status: 404, body: "" });
  });
  await site.goto(`http://export.test/${files.find((f) => f.path.endsWith("index.html"))!.path}`);
  await site.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await site.waitForTimeout(200);
  // the pictures in reading order (as they were laid out: rows of six)
  const boxes = await site.evaluate(() =>
    [...document.images]
      .map((i) => i.getBoundingClientRect())
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
      .sort((a, b) => Math.round(a.y - b.y) || a.x - b.x),
  );
  expect(boxes).toHaveLength(CASES.length);
  expect(boxes.every((b) => Number.isInteger(b.x) && Number.isInteger(b.y))).toBe(true);

  const source = picture();
  const failures: string[] = [];
  const shares: string[] = [];
  for (const [i, c] of CASES.entries()) {
    const b = boxes[i];
    const want = referenceImage(source.data, W, H, c.adjust ?? null, c.look ?? null);
    const shot = PNG.sync.read(await site.screenshot({ clip: { x: b.x, y: b.y, width: W, height: H }, animations: "disabled" }));
    const share = differing(inner(shot.data, W, H), inner(want, W, H));
    // the control: the adjustment really changes the picture, so matching it means something
    const change = differing(inner(source.data, W, H), inner(want, W, H));
    if (change < 0.05) failures.push(`${c.name}: the reference barely differs from the picture (${(change * 100).toFixed(2)}%)`);
    shares.push(`${c.name} ${(share * 100).toFixed(2)}%`);
    if (share >= 0.01) failures.push(`${c.name}: ${(share * 100).toFixed(2)}% of pixels differ`);
  }
  console.log(`image adjustments: ${shares.join(", ")}`);
  expect(failures).toEqual([]);
  await site.close();
  const after = await page.evaluate((ids) => ids.map((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties["media.src"]), ids);
  expect(after.every((s) => s === src)).toBe(true);
});

test("in the inspector: a duotone, then Show original, which keeps it", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const src = `data:image/png;base64,${PNG.sync.write(picture()).toString("base64")}`;
  const id = await page.evaluate(({ src, W, H }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "image", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 60, "frame.y": 60, "frame.width": W, "frame.height": H, "media.src": src } });
  }, { src, W, H });
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);
  const props = () => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, id);
  const img = page.locator(`[data-stage=artboard] [data-element-id="${id}"] img`);

  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  await page.getByRole("switch", { name: "Duotone" }).click();
  await expect.poll(async () => JSON.parse(String((await props())["media.look"] ?? "{}")).map?.length).toBe(2);
  await expect.poll(() => img.evaluate((e) => getComputedStyle(e).filter)).toContain("url(");

  await page.getByRole("switch", { name: "Show original" }).click();
  await expect.poll(() => img.evaluate((e) => getComputedStyle(e).filter)).toBe("none");
  const look = JSON.parse(String((await props())["media.look"]));
  expect(look.bypass).toBe(true);
  expect(look.map).toHaveLength(2);
  expect((await props())["media.src"]).toBe(src);
  await page.getByRole("switch", { name: "Show original" }).click();
  await expect.poll(() => img.evaluate((e) => getComputedStyle(e).filter)).toContain("url(");
});
