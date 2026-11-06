import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMask, autoSubject, featherMask, fillHoles, growMask, invertMask, maskArea, maskBounds, removeSpecks, selectBorderBackground, wandSelect, type Pixels } from "../cutout";

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
