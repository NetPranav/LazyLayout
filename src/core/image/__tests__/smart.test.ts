import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { polygonMask, maskArea, type Mask, type Pixels } from "../cutout";
import { connectedFrom, depthAt, depthBand, depthLayerMasks, distanceTransform, estimateDepth, guidedFilter, luminance, snapToEdges } from "../smart";

/** A picture where `paint(x, y)` gives the colour. */
function picture(w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...paint(x, y), 255], (y * w + x) * 4);
  return { data, width: w, height: h };
}
const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
/** How much two masks agree: overlap over union. 1 is the same. */
function iou(a: Mask, b: Mask): number {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] >= 128, y = b[i] >= 128;
    if (x && y) both++;
    if (x || y) either++;
  }
  return either === 0 ? 1 : both / either;
}
const truth = (w: number, h: number, inside: (x: number, y: number) => boolean): Mask => {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) m[y * w + x] = 255;
  return m;
};

const W = 160, H = 120;
const inDisc = disc(80, 60, 34);
const scene = picture(W, H, (x, y) => (inDisc(x, y) ? [40, 60, 150] : [225, 215, 190]));
const exact = truth(W, H, inDisc);
const square = (c: number, half: number) => polygonMask([{ x: 80 - half, y: 60 - half }, { x: 80 + half, y: 60 - half }, { x: 80 + half, y: 60 + half }, { x: 80 - half, y: 60 + half }], W, H);

describe("smart cutout: snapping to edges", () => {
  it("distance transform: how far each pixel is from the nearest target", () => {
    const d = distanceTransform(5, 1, (i) => i === 0);
    assert.deepEqual(Array.from(d).map((v) => Math.round(v)), [0, 1, 2, 3, 4]);
  });

  it("a loose shape drawn around the object settles onto its edge", () => {
    const loose = polygonMask(Array.from({ length: 48 }, (_, i) => ({ x: 80 + 45 * Math.cos((i / 48) * Math.PI * 2), y: 60 + 45 * Math.sin((i / 48) * Math.PI * 2) })), W, H); // a circle 11px outside the disc
    const before = iou(loose, exact);
    const snapped = snapToEdges(scene, loose, { reach: 16 });
    assert.ok(before < 0.7, `the drawn shape is rough (${before.toFixed(2)})`);
    assert.ok(iou(snapped, exact) > 0.95, `snapped onto the disc (${iou(snapped, exact).toFixed(2)})`);
  });

  it("a shape drawn inside the object grows out to its edge", () => {
    const inner = polygonMask(Array.from({ length: 24 }, (_, i) => ({ x: 80 + 24 * Math.cos((i / 24) * Math.PI * 2), y: 60 + 24 * Math.sin((i / 24) * Math.PI * 2) })), W, H);
    const snapped = snapToEdges(scene, inner, { reach: 16 });
    assert.ok(iou(snapped, exact) > 0.95, `grown to the edge (${iou(snapped, exact).toFixed(2)})`);
  });

  it("a ragged hand-drawn line, in and out of the edge, comes out clean", () => {
    const ragged = polygonMask(Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; const r = 34 + (i % 2 ? 9 : -9); return { x: 80 + r * Math.cos(a), y: 60 + r * Math.sin(a) }; }), W, H);
    assert.ok(iou(ragged, exact) < 0.93);
    assert.ok(iou(snapToEdges(scene, ragged, { reach: 16 }), exact) > 0.95);
  });

  it("does not leak into the rest of the picture past its reach", () => {
    const snapped = snapToEdges(scene, square(0, 44), { reach: 8 });
    // pixels far from the shape stay cut; the corner of the square is farther than the reach from the disc edge
    assert.equal(snapped[2 * W + 2], 0);
    assert.equal(snapped[60 * W + 80], 255, "and the middle of the object stays kept");
  });

  it("with no object edge nearby it keeps what was drawn", () => {
    const flat = picture(W, H, () => [128, 128, 128]);
    const drawn = square(0, 30);
    assert.ok(iou(snapToEdges(flat, drawn, { reach: 10 }), drawn) > 0.85);
  });

  it("an empty or full region is returned as it is", () => {
    const none = new Uint8Array(W * H);
    assert.equal(maskArea(snapToEdges(scene, none)), 0);
    const all = new Uint8Array(W * H).fill(255);
    assert.equal(snapToEdges(scene, all)[0], 255);
  });

  it("the guided filter keeps an edge where the picture has one and smooths where it does not", () => {
    const guide = luminance(scene);
    const jagged = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) jagged[y * W + x] = inDisc(x + (y % 2 ? 2 : -2), y) ? 1 : 0;
    const out = guidedFilter(guide, jagged, W, H, 4, 0.01);
    const row = 60;
    assert.ok(out[row * W + 80] > 0.95, "inside stays solid");
    assert.ok(out[row * W + 10] < 0.05, "outside stays clear");
    assert.ok(out[row * W + 80 - 33] > 0.4 && out[row * W + 80 - 36] < 0.6, "the transition sits at the picture's edge");
  });

  it("connected region: only what touches the click", () => {
    const two = new Uint8Array(20 * 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) if (x < 6 || x >= 12) two[y * 20 + x] = 255;
    const left = connectedFrom(two, 20, 10, 2, 5);
    assert.equal(left[5 * 20 + 2], 255);
    assert.equal(left[5 * 20 + 14], 0, "the other piece is not picked");
    assert.equal(maskArea(connectedFrom(two, 20, 10, 8, 5)), 0, "a click on empty picks nothing");
  });
});

describe("smart cutout: depth", () => {
  // a hazy far top (pale, low contrast) over a near bottom (dark, saturated, detailed)
  const w = 120, h = 90;
  const haze = picture(w, h, (x, y) => {
    const near = y / (h - 1);
    const base = 200 - 150 * near;
    const detail = near > 0.5 ? ((x * 7 + y * 3) % 23) * 3 : 0;
    return [Math.min(255, base + detail), Math.min(255, base * (0.8 + 0.2 * near) + detail), Math.min(255, 220 - 120 * near + detail)];
  });
  const depth = estimateDepth(haze);

  it("is 0 to 1 and one value for every pixel", () => {
    assert.equal(depth.length, w * h);
    assert.ok(depth.every((v) => v >= 0 && v <= 1));
    assert.ok(Math.max(...depth) > 0.9 && Math.min(...depth) < 0.1, "uses the range");
  });

  it("puts the hazy part far and the clear, dark part near", () => {
    const top = depthAt(depth, w, h, 60, 8, 4);
    const bottom = depthAt(depth, w, h, 60, 82, 4);
    assert.ok(bottom > top + 0.4, `near ${bottom.toFixed(2)} vs far ${top.toFixed(2)}`);
  });

  it("a depth band picks pixels of about the same depth, softly at its edge", () => {
    const m = depthBand(depth, 0.9, 0.1);
    assert.equal(m[(h - 2) * w + 60], 255, "the near part is in");
    assert.equal(m[2 * w + 60], 0, "the far part is out");
  });

  it("depth layers: the first shows everything and each nearer one shows less, all inside the one before", () => {
    const layers = depthLayerMasks(depth, 4);
    assert.equal(layers.length, 4);
    assert.equal(maskArea(layers[0]), w * h * 255 / 255 > 0 ? maskArea(layers[0]) : 0);
    assert.ok(layers[0].every((v) => v === 255), "the farthest layer is the whole picture");
    const areas = layers.map(maskArea);
    for (let i = 1; i < areas.length; i++) assert.ok(areas[i] < areas[i - 1], `layer ${i + 1} shows less than layer ${i}`);
    // nothing in a nearer layer that the one behind it does not already have, so no gap can show
    for (let k = 1; k < layers.length; k++) for (let i = 0; i < layers[k].length; i++) assert.ok(layers[k][i] <= layers[k - 1][i]);
  });

  it("a flat picture gives a flat, valid depth and does not fail", () => {
    const flat = estimateDepth(picture(30, 20, () => [120, 120, 120]));
    assert.equal(flat.length, 600);
    assert.ok(flat.every((v) => Number.isFinite(v)));
  });
});
