import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { centreOf, explodeOffsets, partProgress, type Part } from "../explode";

const watch: Part[] = [
  { id: "case", at: [0, 0, 0] },
  { id: "dial", at: [0, 0, 0.2], axis: [0, 0, 1] },
  { id: "gear1", at: [0.5, 0, -0.1], axis: [0, 0, -1] },
  { id: "gear2", at: [-0.4, 0.3, -0.1], axis: [0, 0, -1] },
  { id: "crown", at: [1, 0, 0], axis: [1, 0, 0] },
];

describe("explode (D19)", () => {
  it("at progress 0 every part is exactly in its place, in every mode and with stagger", () => {
    for (const mode of ["radial", "axis", "path"] as const) {
      const off = explodeOffsets(watch, 0, { mode, distance: 2, stagger: 0.5, path: [[0, 0, 0], [1, 1, 0], [2, 0, 0]] });
      for (const [, v] of off) assert.deepEqual(v, [0, 0, 0]);
    }
  });

  it("radial: each part moves away from the centre by the distance at 1", () => {
    const c = centreOf(watch);
    const off = explodeOffsets(watch, 1, { mode: "radial", distance: 3 });
    for (const p of watch) {
      const v = off.get(p.id)!;
      assert.ok(Math.abs(Math.hypot(...v) - 3) < 1e-9, p.id);
      const away = [p.at[0] - c[0], p.at[1] - c[1], p.at[2] - c[2]];
      assert.ok(v[0] * away[0] + v[1] * away[1] + v[2] * away[2] >= 0, `${p.id} moves outward`);
    }
  });

  it("axis: along each part's own axis, or a shared one", () => {
    const own = explodeOffsets(watch, 1, { mode: "axis", distance: 2 });
    assert.deepEqual(own.get("crown"), [2, 0, 0]);
    assert.deepEqual(own.get("gear1"), [0, 0, -2]);
    const shared = explodeOffsets(watch, 1, { mode: "axis", distance: 2, axis: [0, 3, 0] });
    for (const [, v] of shared) assert.deepEqual(v, [0, 2, 0]);
  });

  it("path: parts follow the polyline's shape, ending the distance along it", () => {
    const off = explodeOffsets([{ id: "a", at: [5, 5, 5] }], 1, { mode: "path", distance: 2, path: [[0, 0, 0], [0, 1, 0], [1, 1, 0]] });
    const v = off.get("a")!;
    assert.ok(Math.abs(v[0] - 1) < 1e-9 && Math.abs(v[1] - 1) < 1e-9, JSON.stringify(v)); // the path is 2 long and the distance is 2: the part ends at the path's end
  });

  it("stagger: parts start one after another and all arrive at 1; progress is monotonic", () => {
    assert.equal(partProgress(0, 5, 0.1, 0.6), 0.25);
    assert.equal(partProgress(4, 5, 0.1, 0.6), 0);
    assert.equal(partProgress(4, 5, 1, 0.6), 1);
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = partProgress(2, 5, p, 0.6);
      assert.ok(v >= prev);
      prev = v;
    }
  });

  it("outer parts first when asked", () => {
    const off = explodeOffsets(watch, 0.15, { mode: "radial", distance: 1, stagger: 0.8, outerFirst: true });
    assert.ok(Math.hypot(...off.get("crown")!) > 0);
    assert.equal(Math.hypot(...off.get("dial")!), 0);
  });
});
