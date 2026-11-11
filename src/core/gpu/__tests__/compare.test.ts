import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compare, ssim, type Rgba } from "../compare";

/** A hard-edged test picture: a bright rectangle and a ring on a dark ground. */
function scene(w = 96, h = 64, dx = 0, color: [number, number, number] = [230, 60, 60]): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const xs = x - dx;
      let c: [number, number, number] = [20, 22, 30];
      if (xs >= 20 && xs < 60 && y >= 12 && y < 40) c = color;
      const r = Math.hypot(xs - 75, y - 40);
      if (r > 8 && r < 12) c = [240, 240, 240];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  return { width: w, height: h, data };
}

describe("3D-004: comparing GPU pictures", () => {
  it("identical pictures pass with SSIM 1", () => {
    const r = compare(scene(), scene());
    assert.equal(r.pass, true);
    assert.equal(r.ssim, 1);
    assert.equal(r.badFraction, 0);
  });

  it("a one-pixel shift of hard edges passes (SSIM alone would complain; the neighbourhood metric does not)", () => {
    const a = scene();
    const b = scene(96, 64, 1);
    const plainSsim = ssim(a, b);
    assert.ok(plainSsim < 1, `SSIM sees the shift (${plainSsim.toFixed(3)})`);
    const r = compare(a, b);
    assert.equal(r.pass, true, `bad ${r.badFraction}, ssim ${r.ssim}`);
  });

  it("a three-pixel shift fails", () => {
    const r = compare(scene(), scene(96, 64, 3));
    assert.equal(r.pass, false);
  });

  it("a wrong colour fails", () => {
    const r = compare(scene(), scene(96, 64, 0, [60, 60, 230]));
    assert.equal(r.pass, false);
    assert.ok(r.badFraction > 0.1);
  });

  it("a slightly different shade passes (a software and a real GPU differ a little)", () => {
    const r = compare(scene(), scene(96, 64, 0, [226, 63, 58]));
    assert.equal(r.pass, true);
  });

  it("a missing shape fails, and the diff marks where", () => {
    const a = scene();
    const b = scene();
    for (let y = 12; y < 40; y++) for (let x = 20; x < 60; x++) b.data[(y * 96 + x) * 4] = 20, (b.data[(y * 96 + x) * 4 + 1] = 22), (b.data[(y * 96 + x) * 4 + 2] = 30);
    const r = compare(a, b);
    assert.equal(r.pass, false);
    assert.equal(r.diff.data[(25 * 96 + 40) * 4], 255, "red in the missing rectangle");
    assert.notEqual(r.diff.data[(2 * 96 + 2) * 4], 255, "not red on the untouched ground");
  });

  it("different sizes fail", () => {
    assert.equal(compare(scene(96, 64), scene(95, 64)).pass, false);
  });
});
