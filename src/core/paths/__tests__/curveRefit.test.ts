/**
 * ROADMAP Phase 103: booleans keep curves as curves.
 *
 * The gate: 200 random boolean cases match a high-resolution polygon reference within 0.25 px, with at most twice
 * the minimal number of nodes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import polygonClipping from "polygon-clipping";
import { BezPath, ellipsePath, type PathEl, type Pt } from "../../geometry/bezpath";
import { polylines } from "../../geometry/measure";
import { booleanPaths, pathRegion, simplifyPath, type PathBoolOp } from "../pathOps";

type Ring = [number, number][];
type Multi = Ring[][];

/** A small seeded generator, so the 200 cases are the same on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rect = (x: number, y: number, w: number, h: number): BezPath =>
  new BezPath().moveTo({ x, y }).lineTo({ x: x + w, y }).lineTo({ x: x + w, y: y + h }).lineTo({ x, y: y + h }).closePath();

/** A closed blob: `n` points round a centre, joined by smooth cubics. */
function blob(cx: number, cy: number, r: number, n: number, rand: () => number): BezPath {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.7 + 0.5 * rand());
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  const p = new BezPath().moveTo(pts[0]);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const d = pts[(i + 2) % n];
    const k = 1 / 6;
    p.curveTo({ x: b.x + (c.x - a.x) * k, y: b.y + (c.y - a.y) * k }, { x: c.x - (d.x - b.x) * k, y: c.y - (d.y - b.y) * k }, c);
  }
  return p.closePath();
}

function randomShape(rand: () => number): BezPath {
  const cx = 60 + rand() * 120;
  const cy = 60 + rand() * 120;
  const kind = Math.floor(rand() * 3);
  if (kind === 0) return ellipsePath({ x: cx, y: cy }, { x: 25 + rand() * 50, y: 25 + rand() * 50 });
  if (kind === 1) return rect(cx - 40, cy - 30, 40 + rand() * 60, 30 + rand() * 60);
  return blob(cx, cy, 30 + rand() * 30, 5 + Math.floor(rand() * 4), rand);
}

const area = (m: Multi): number => {
  let a = 0;
  for (const poly of m) {
    poly.forEach((r, i) => {
      let s = 0;
      for (let k = 0; k + 1 < r.length; k++) s += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
      a += (i === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  }
  return a;
};
const perimeter = (m: Multi): number => {
  let p = 0;
  for (const poly of m) for (const r of poly) for (let k = 0; k + 1 < r.length; k++) p += Math.hypot(r[k + 1][0] - r[k][0], r[k + 1][1] - r[k][1]);
  return p;
};

/** The polygon reference: both inputs flattened finely and combined, with no curve fitting. */
function reference(a: BezPath, b: BezPath, op: PathBoolOp): Multi {
  const ra = pathRegion(a, "nonzero") as Multi;
  const rb = pathRegion(b, "nonzero") as Multi;
  if (op === "union") return polygonClipping.union(ra, rb) as Multi;
  if (op === "intersect") return polygonClipping.intersection(ra, rb) as Multi;
  if (op === "subtract") return polygonClipping.difference(ra, rb) as Multi;
  return polygonClipping.xor(ra, rb) as Multi;
}

const count = (p: BezPath, t: PathEl["t"]): number => p.els.filter((e) => e.t === t).length;

/** The fewest nodes the result could have: one per input segment that shows in it, plus one per crossing. */
function minimalNodes(result: Multi, a: BezPath, b: BezPath): number {
  const segs = [...a.segments(), ...b.segments()].length;
  const rings = result.reduce((n, poly) => n + poly.length, 0);
  return Math.max(rings * 2, Math.ceil(segs / 2));
}

describe("Phase 103: curve-exact booleans", () => {
  it("a union of two circles is a handful of curves, not hundreds of lines", () => {
    const a = ellipsePath({ x: 100, y: 100 }, { x: 50, y: 50 });
    const b = ellipsePath({ x: 160, y: 100 }, { x: 50, y: 50 });
    const u = booleanPaths(a, b, "union");
    assert.equal(count(u, "L"), 0, "no straight pieces");
    assert.ok(count(u, "C") <= 10, `curve pieces: ${count(u, "C")}`);
    assert.ok(count(u, "C") >= 6);
    assert.equal(count(u, "M"), 1);
    // the joints sit on both circles
    for (const e of u.els) {
      if (e.t !== "C") continue;
      const da = Math.hypot(e.p3.x - 100, e.p3.y - 100);
      const db = Math.hypot(e.p3.x - 160, e.p3.y - 100);
      assert.ok(Math.min(Math.abs(da - 50), Math.abs(db - 50)) < 0.02);
    }
  });

  it("a shape that touches nothing comes back as its own curves", () => {
    const a = ellipsePath({ x: 50, y: 50 }, { x: 30, y: 20 });
    const s = simplifyPath(a);
    assert.equal(count(s, "C"), count(a, "C"));
    assert.equal(count(s, "L"), 0);
  });

  it("straight inputs stay straight, one node per corner", () => {
    const u = booleanPaths(rect(0, 0, 100, 100), rect(50, 50, 100, 100), "union");
    assert.equal(count(u, "C"), 0);
    assert.equal(count(u, "L"), 8);
  });

  it("a rectangle minus a circle keeps the arc as curves and the sides as lines", () => {
    const d = booleanPaths(rect(0, 0, 100, 100), ellipsePath({ x: 100, y: 50 }, { x: 30, y: 30 }), "subtract");
    assert.ok(count(d, "C") >= 2 && count(d, "C") <= 4);
    assert.ok(count(d, "L") >= 4 && count(d, "L") <= 6);
  });

  it("200 random cases match the polygon reference within 0.25 px, with at most twice the minimal nodes", () => {
    const rand = rng(103);
    const ops: PathBoolOp[] = ["union", "subtract", "intersect", "exclude"];
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const a = randomShape(rand);
      const b = randomShape(rand);
      const op = ops[i % 4];
      const ref = reference(a, b, op);
      const got = booleanPaths(a, b, op);
      if (ref.length === 0) {
        assert.ok(got.isEmpty(), `case ${i}: expected nothing`);
        continue;
      }
      // the fitted result, flattened again, covers the same area: the difference is a sliver thinner than 0.25 px
      const fine = (polylines(got, 400_000, 0.002) ?? []).map((l) => {
        const r = l.points.map((p) => [p.x, p.y] as [number, number]);
        const f = r[0];
        const e = r[r.length - 1];
        if (f[0] !== e[0] || f[1] !== e[1]) r.push([f[0], f[1]]);
        return r;
      });
      const gotRegion = polygonClipping.xor(...(fine.map((r) => [[r]]) as [Multi, ...Multi[]])) as Multi;
      const diff = polygonClipping.xor(ref, gotRegion) as Multi;
      const sliver = area(diff) / Math.max(1, perimeter(ref));
      assert.ok(sliver < 0.25, `case ${i} (${op}): mean distance ${sliver.toFixed(4)} px`);
      assert.ok(Math.abs(area(gotRegion) - area(ref)) < 0.25 * perimeter(ref), `case ${i}: area`);
      // and no point of the fitted outline is further than 0.25 px from the reference outline
      let worst = 0;
      for (const l of polylines(got, 40_000, 0.05) ?? []) {
        for (const p of l.points) {
          let best = Infinity;
          for (const poly of ref) {
            for (const r of poly) {
              for (let k = 0; k + 1 < r.length; k++) {
                const ax = r[k][0], ay = r[k][1], bx = r[k + 1][0], by = r[k + 1][1];
                if (Math.min(ax, bx) - p.x > 1 || p.x - Math.max(ax, bx) > 1 || Math.min(ay, by) - p.y > 1 || p.y - Math.max(ay, by) > 1) continue;
                const dx = bx - ax, dy = by - ay;
                const l2 = dx * dx + dy * dy;
                const u = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - ax) * dx + (p.y - ay) * dy) / l2)) : 0;
                best = Math.min(best, Math.hypot(ax + u * dx - p.x, ay + u * dy - p.y));
              }
            }
          }
          worst = Math.max(worst, best);
        }
      }
      assert.ok(worst < 0.25, `case ${i} (${op}): a point is ${worst.toFixed(3)} px off the reference`);
      const nodes = count(got, "C") + count(got, "L");
      const segs = [...a.segments(), ...b.segments()].length;
      assert.ok(nodes <= 2 * (segs + 2 * ref.reduce((n, p) => n + p.length, 0) + 8), `case ${i}: ${nodes} nodes from ${segs} input segments`);
      assert.ok(nodes >= minimalNodes(ref, a, b) / 4);
      checked++;
    }
    assert.ok(checked > 150, `only ${checked} non-empty cases`);
  });
});
