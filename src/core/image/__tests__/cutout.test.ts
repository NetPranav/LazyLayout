import { test } from "node:test";
import assert from "node:assert/strict";
import { polygonMask, applyMask, autoSubject, featherMask, fillHoles, growMask, invertMask, maskArea, maskBounds, removeSpecks, selectBorderBackground, wandSelect, type Pixels } from "../cutout";

/** A picture of `w` x `h` filled with `bg`, with a rectangle `box` of `fg` colour. */
function picture(w: number, h: number, bg: [number, number, number], fg: [number, number, number], box: { x: number; y: number; w: number; h: number }): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
      const c = inside ? fg : bg;
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

const SKY: [number, number, number] = [180, 150, 140];
const ROCK: [number, number, number] = [60, 55, 50];

test("a click on the sky selects the sky and not the mountain", () => {
  const img = picture(40, 40, SKY, ROCK, { x: 10, y: 10, w: 20, h: 20 });
  const sky = wandSelect(img, [{ x: 1, y: 1 }], 20);
  assert.equal(maskArea(sky), 40 * 40 - 20 * 20);
  assert.equal(sky[15 * 40 + 20], 0);
});

test("keeping the subject is the inverse of the background found from the edges", () => {
  const img = picture(40, 40, SKY, ROCK, { x: 10, y: 10, w: 20, h: 20 });
  const subject = invertMask(selectBorderBackground(img, 20));
  assert.equal(maskArea(subject), 400);
  assert.deepEqual(maskBounds(subject, 40, 40), { x: 10, y: 10, width: 20, height: 20 });
});

test("tolerance decides how different a colour may be", () => {
  const img = picture(10, 10, [100, 100, 100], [120, 120, 120], { x: 5, y: 0, w: 5, h: 10 });
  assert.equal(maskArea(wandSelect(img, [{ x: 0, y: 0 }], 1)), 50);
  assert.equal(maskArea(wandSelect(img, [{ x: 0, y: 0 }], 20)), 100);
});

test("a non-contiguous wand also takes matching pixels the click does not touch", () => {
  const img = picture(30, 10, SKY, ROCK, { x: 10, y: 0, w: 10, h: 10 });
  assert.equal(maskArea(wandSelect(img, [{ x: 0, y: 0 }], 10, true)), 100);
  assert.equal(maskArea(wandSelect(img, [{ x: 0, y: 0 }], 10, false)), 200);
});

test("growing and shrinking move the edge, feathering softens it", () => {
  const img = picture(40, 40, SKY, ROCK, { x: 10, y: 10, w: 20, h: 10 });
  const subject = invertMask(selectBorderBackground(img, 20));
  assert.equal(maskArea(growMask(subject, 40, 40, 2)), 24 * 14);
  assert.equal(maskArea(growMask(subject, 40, 40, -2)), 16 * 6);
  const soft = featherMask(subject, 40, 40, 2);
  const edge = soft[15 * 40 + 9];
  assert.ok(edge > 0 && edge < 255, `edge pixel is partly kept (${edge})`);
  assert.equal(soft[15 * 40 + 20], 255);
});

test("specks are dropped and small holes are filled", () => {
  const mask = new Uint8Array(20 * 20);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) mask[y * 20 + x] = 255;
  mask[0] = 255; // a speck
  mask[10 * 20 + 10] = 0; // a pinhole
  const clean = removeSpecks(mask, 20, 20, 4);
  assert.equal(clean[0], 0);
  assert.equal(clean[7 * 20 + 7], 255);
  const filled = fillHoles(clean, 20, 20, 3);
  assert.equal(filled[10 * 20 + 10], 255);
});

test("applying a mask cuts the picture away and can crop to what is kept", () => {
  const img = picture(40, 40, SKY, ROCK, { x: 10, y: 10, w: 20, h: 20 });
  const subject = invertMask(selectBorderBackground(img, 20));
  const full = applyMask(img, subject);
  assert.equal(full.data[3], 0); // a corner is gone
  assert.equal(full.data[(15 * 40 + 20) * 4 + 3], 255);
  const box = maskBounds(subject, 40, 40)!;
  const cropped = applyMask(img, subject, box);
  assert.equal(cropped.width, 20);
  assert.equal(cropped.height, 20);
  assert.equal(cropped.data[3], 255);
  assert.deepEqual([...cropped.data.slice(0, 3)], ROCK);
});

test("auto finds a mountain that stands on the bottom of the picture by looking at the sky", () => {
  const w = 60;
  const h = 40;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const peak = 8 + Math.abs(x - 30) * 0.9; // a triangle whose base is the bottom edge
      const rock = y >= peak;
      data.set(rock ? [60, 55, 50, 255] : [170, 195, 225, 255], (y * w + x) * 4);
    }
  const { mask, sides } = autoSubject({ data, width: w, height: h }, 20);
  assert.equal(sides, "top");
  assert.equal(mask[(h - 2) * w + 30], 255); // the base is kept
  assert.equal(mask[2 * w + 2], 0); // the sky is cut
});

/** A noisy photo-like picture: a sky that fades from deep blue to pale at the horizon, a jagged ridge, textured rock. Returns the picture and the true mountain mask. */
function photoLike(w: number, h: number, seed = 7): { img: Pixels; truth: Uint8Array } {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const data = new Uint8ClampedArray(w * h * 4);
  const truth = new Uint8Array(w * h);
  const ridge = (x: number) => h * 0.35 + Math.sin(x / 9) * 6 + Math.abs(x - w / 2) * 0.55 + Math.sin(x / 3.1) * 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const rock = y >= ridge(x);
      const t = y / h;
      const n = (rnd() - 0.5) * (rock ? 40 : 10);
      const c = rock ? [70 + n, 62 + n, 55 + n] : [60 + 150 * t + n, 100 + 110 * t + n, 170 + 60 * t + n];
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
      truth[y * w + x] = rock ? 255 : 0;
    }
  return { img: { data, width: w, height: h }, truth };
}

test("on a noisy gradient-sky picture, Auto keeps the mountain and drops the sky (overlap with the true outline)", () => {
  const { img, truth } = photoLike(200, 140);
  const { mask } = autoSubject(img, 22);
  let both = 0;
  let either = 0;
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i] > 127;
    const b = truth[i] > 127;
    if (a && b) both++;
    if (a || b) either++;
  }
  const overlap = both / either;
  assert.ok(overlap > 0.9, `kept area overlaps the true mountain by ${(overlap * 100).toFixed(1)}%`);
});

test("a tolerance set too high does not let the sky leak into the mountain", () => {
  const { img, truth } = photoLike(200, 140);
  const { mask } = autoSubject(img, 60);
  let both = 0;
  let either = 0;
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i] > 127;
    const b = truth[i] > 127;
    if (a && b) both++;
    if (a || b) either++;
  }
  assert.ok(both / either > 0.9, `overlap ${((both / either) * 100).toFixed(1)}%`);
});

test("a shape drawn by hand becomes a mask: inside kept, outside not, concave shapes too", () => {
  const m = polygonMask([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 20, y: 18 }, { x: 10, y: 30 }], 40, 40);
  assert.equal(m[12 * 40 + 20], 255); // inside
  assert.equal(m[28 * 40 + 20], 0); // in the notch
  assert.equal(m[28 * 40 + 10], 255); // the left leg
  assert.equal(m[5 * 40 + 5], 0); // outside
  assert.equal(maskArea(polygonMask([{ x: 0, y: 0 }, { x: 1, y: 1 }], 10, 10)), 0);
});

test("the border scan stays fast on a big picture", () => {
  const { img } = photoLike(1400, 860);
  const t0 = Date.now();
  autoSubject(img, 22);
  assert.ok(Date.now() - t0 < 4000, `took ${Date.now() - t0} ms`);
});
