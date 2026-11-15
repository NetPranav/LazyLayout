/**
 * ROADMAP Phase 122: image adjustments and filters. Each adjustment drawn by the browser on the canvas (the seven, a
 * curve, a duotone, a gradient map, sharpen and blur) matches the reference worked out pixel by pixel
 * (`referenceImage`) within 1% of its pixels; the picture's file stays the same. In the inspector a duotone is
 * switched on, then "Show original" shows the picture as it is and keeps the duotone.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openEditor } from "./support/editor";
import { referenceImage, type ImageLook } from "../../src/core/paint/imageLook";
import { NO_ADJUSTMENTS, type ImageAdjustments } from "../../src/core/paint/color";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const W = 120;
const H = 90;
/** A smooth test picture: red across, green down, blue in waves. */
function picture(): PNG {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      p.data[i] = Math.round((x / (W - 1)) * 255);
      p.data[i + 1] = Math.round((y / (H - 1)) * 255);
      p.data[i + 2] = Math.round(128 + 100 * Math.sin(x / 14 + y / 19));
      p.data[i + 3] = 255;
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

test("every adjustment matches its reference within 1%; the picture's file stays the same", async ({ page }) => {
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

  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  const el = (id: string) => page.locator(`[data-stage=artboard] [data-element-id="${id}"]`).first();
  await expect.poll(async () => Math.round((await el(ids[0]).boundingBox())?.width ?? 0)).toBe(W);
  const at = (await el(ids[0]).boundingBox())!;
  await page.mouse.move(800, 500);
  await page.mouse.wheel(at.x - 300, at.y - 200);
  await page.waitForTimeout(400);
  await page.mouse.move(5, 5);
  await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));

  const source = picture();
  const failures: string[] = [];
  const shares: string[] = [];
  for (const [i, c] of CASES.entries()) {
    const b = (await el(ids[i]).boundingBox())!;
    const shot = PNG.sync.read(await page.screenshot({ clip: { x: Math.round(b.x), y: Math.round(b.y), width: W, height: H }, animations: "disabled" }));
    const want = referenceImage(source.data, W, H, c.adjust ?? null, c.look ?? null);
    const w = W - 2 * INSET;
    const h = H - 2 * INSET;
    const share = pixelmatch(inner(shot.data, W, H), inner(want, W, H), undefined, w, h, { threshold: 0.1 }) / (w * h);
    shares.push(`${c.name} ${(share * 100).toFixed(2)}%`);
    if (share >= 0.01) failures.push(`${c.name}: ${(share * 100).toFixed(2)}% of pixels differ`);
  }
  console.log(`image adjustments: ${shares.join(", ")}`);
  expect(failures).toEqual([]);
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
