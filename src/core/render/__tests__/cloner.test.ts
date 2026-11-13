import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_CLONES, cloneTransform, clonerCopies, readCloner, type ClonerSettings } from "../cloner";

const box = { x: 100, y: 100, width: 10, height: 10 };
const parent = { width: 400, height: 300 };
const base: ClonerSettings = { mode: "grid", cols: 3, rows: 2, gapX: 5, gapY: 10, count: 4, radius: 100, start: 0, faceOut: false };
const pts = (s: ClonerSettings, b = box, p = parent) => clonerCopies(s, b, p).map((c) => [c.dx, c.dy]);

describe("Cloner (D9)", () => {
  it("off or missing is no cloner; values are read and clamped", () => {
    assert.equal(readCloner(() => undefined), null);
    assert.equal(readCloner((p) => (p === "clone.mode" ? "off" : undefined)), null);
    const s = readCloner((p) => ({ "clone.mode": "grid", "clone.cols": 9999, "clone.rows": 0, "clone.radius": -5, "clone.faceOut": true })[p])!;
    assert.equal(s.cols, 200);
    assert.equal(s.rows, 1);
    assert.equal(s.radius, 0);
    assert.equal(s.faceOut, true);
  });

  it("grid: cols x rows cells, the layer is the first, pitch is size plus gap", () => {
    // pitch 15 x 20; cells (c, r) except (0, 0), row by row
    assert.deepEqual(pts(base), [[15, 0], [30, 0], [0, 20], [15, 20], [30, 20]]);
    assert.equal(clonerCopies({ ...base, cols: 10, rows: 6 }, box, parent).length, 59);
    assert.equal(clonerCopies({ ...base, cols: 1, rows: 1 }, box, parent).length, 0);
  });

  it("grid: indexes count 1, 2, 3 in drawing order", () => {
    assert.deepEqual(clonerCopies(base, box, parent).map((c) => c.index), [1, 2, 3, 4, 5]);
  });

  it("radial: four copies on a ring of 100, the layer is the one at the top", () => {
    // angles 0, 90, 180, 270 from straight up: offsets from the top point (0, -100)
    const p = pts({ ...base, mode: "radial", count: 4, radius: 100 });
    const want = [[100, 100], [0, 200], [-100, 100]];
    p.forEach((q, i) => assert.ok(Math.abs(q[0] - want[i][0]) < 1e-3 && Math.abs(q[1] - want[i][1]) < 1e-3, `copy ${i + 1}: ${q}`));
  });

  it("radial: the start angle moves the layer's place on the ring, face-out turns each copy", () => {
    const c = clonerCopies({ ...base, mode: "radial", count: 4, radius: 100, start: 90, faceOut: true }, box, parent);
    assert.deepEqual(c.map((x) => x.rotate), [90, 180, 270]);
    // starting at 90 the layer is on the right (100, 0); the next copy is at the bottom (0, 100): offset (-100, 100)
    assert.ok(Math.abs(c[0].dx + 100) < 1e-3 && Math.abs(c[0].dy - 100) < 1e-3);
  });

  it("fill: tiles the parent from the layer's own cell, covering the whole area", () => {
    // parent 400 x 300, cell 10 x 10 with gap 0: pitch 10. layer at (100, 100): columns -10..29, rows -10..29
    const s: ClonerSettings = { ...base, mode: "fill", gapX: 0, gapY: 0 };
    const copies = clonerCopies(s, box, parent);
    assert.equal(copies.length, 40 * 30 - 1);
    const xs = copies.map((c) => box.x + c.dx);
    assert.equal(Math.min(...xs), 0);
    assert.equal(Math.max(...xs), 390);
    assert.equal(Math.max(...copies.map((c) => box.y + c.dy)), 290);
  });

  it("fill: a gap leaves room, and no copy lies wholly outside the parent", () => {
    const s: ClonerSettings = { ...base, mode: "fill", gapX: 20, gapY: 20 };
    for (const c of clonerCopies(s, box, parent)) {
      const x = box.x + c.dx;
      const y = box.y + c.dy;
      assert.ok(x + box.width > 0 && x < parent.width && y + box.height > 0 && y < parent.height, `copy ${c.index} at ${x}, ${y}`);
    }
    // pitch 30: 400/30 and 300/30 cells along each side
    assert.equal(clonerCopies(s, { x: 0, y: 0, width: 10, height: 10 }, parent).length, Math.ceil(400 / 30) * Math.ceil(300 / 30) - 1);
  });

  it("fill with no size or pitch makes nothing instead of looping", () => {
    assert.equal(clonerCopies({ ...base, mode: "fill", gapX: 0, gapY: 0 }, { x: 0, y: 0, width: 0, height: 0 }, parent).length, 0);
  });

  it("never makes more than the cap", () => {
    assert.equal(clonerCopies({ ...base, mode: "fill", gapX: 0, gapY: 0 }, { x: 0, y: 0, width: 1, height: 1 }, { width: 100000, height: 100000 }).length, MAX_CLONES);
  });

  it("the CSS is a translation, with a turn only when there is one", () => {
    assert.equal(cloneTransform({ index: 1, dx: 15, dy: -20, rotate: 0 }), "translate(15px, -20px)");
    assert.equal(cloneTransform({ index: 2, dx: 1, dy: 2, rotate: 90 }), "translate(1px, 2px) rotate(90deg)");
  });
});
