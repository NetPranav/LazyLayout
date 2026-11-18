import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lensTransform } from "../liveLens";

const parse = (t: string) => {
  const m = t.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/)!;
  return { tx: Number(m[1]), ty: Number(m[2]), s: Number(m[3]) };
};
/** Where a source point (source px) lands on screen when drawn inside the lens with this transform. */
const landsAt = (t: ReturnType<typeof parse>, box: { left: number; top: number }, kb: number, q: { x: number; y: number }) => ({ x: box.left + kb * (t.tx + t.s * q.x), y: box.top + kb * (t.ty + t.s * q.y) });

describe("lensTransform", () => {
  const lens = { left: 300, top: 200, width: 100, height: 100 };
  const box = { left: 300, top: 200 };
  const source = { left: 100, top: 150 };

  it("at 100% the copy lies exactly on the source", () => {
    const t = parse(lensTransform(lens, box, 1, source, 1, 1));
    const p = landsAt(t, box, 1, { x: 220, y: 90 });
    assert.deepEqual(p, { x: 100 + 220, y: 150 + 90 });
  });

  it("magnifies about the lens's centre: the centre stays put, the rest moves out", () => {
    const m = 2;
    const t = parse(lensTransform(lens, box, 1, source, 1, m));
    // the source point under the centre (350, 250) is (250, 100)
    assert.deepEqual(landsAt(t, box, 1, { x: 250, y: 100 }), { x: 350, y: 250 });
    // a point 10 px right of it lands 20 px right of the centre
    assert.deepEqual(landsAt(t, box, 1, { x: 260, y: 100 }), { x: 370, y: 250 });
  });

  it("allows for zoom and a stretched drawing box", () => {
    // canvas at 50%: everything on screen is half size; the lens draws in a box twice as fine as the screen
    const t = parse(lensTransform({ left: 150, top: 100, width: 50, height: 50 }, { left: 150, top: 100 }, 0.25, { left: 50, top: 75 }, 0.5, 1));
    const p = landsAt(t, { left: 150, top: 100 }, 0.25, { x: 220, y: 90 });
    assert.ok(Math.abs(p.x - (50 + 0.5 * 220)) < 0.05 && Math.abs(p.y - (75 + 0.5 * 90)) < 0.05, JSON.stringify(p));
  });
});
