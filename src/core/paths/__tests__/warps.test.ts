/**
 * ROADMAP Phase 111: twist, bend, wiggle, zig-zag, pucker & bloat, spherize. The gate: every modifier is deterministic
 * for a seed and matches stored references. The references (`fixtures/warps.json`) are this code's output for a fixed
 * set of shapes and settings, checked by hand when they were stored; the geometric facts below are what makes them
 * right: a twisted circle about its centre stays that circle, a bent line keeps its length, a wiggle never strays
 * further than its amount, zig-zag peaks land exactly where they should, pucker and bloat keep the anchors.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BezPath, ellipsePath, segmentArclen, type Pt } from "../../geometry/bezpath";
import { polylines } from "../../geometry/measure";
import { applyModifiers, newModifier, type Modifier, type ModifierType } from "../modifiers";

const rect = (x: number, y: number, w: number, h: number): BezPath =>
  new BezPath().moveTo({ x, y }).lineTo({ x: x + w, y }).lineTo({ x: x + w, y: y + h }).lineTo({ x, y: y + h }).closePath();
const mod = (type: ModifierType, params: Record<string, number | string> = {}): Modifier => {
  const m = newModifier(type, `m-${type}`);
  return { ...m, params: { ...m.params, ...params } };
};
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)}, expected ${want.toFixed(3)}`);
const points = (p: BezPath, tol = 0.05): Pt[] => (polylines(p, 200_000, tol) ?? []).flatMap((l) => l.points);
const run = (path: BezPath, closed: boolean, m: Modifier, box = { w: 100, h: 100 }) => applyModifiers({ path, closed }, [m], box);
function distanceTo(edges: readonly [Pt, Pt][], q: Pt): number {
  let best = Infinity;
  for (const [a, b] of edges) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + u * dx - q.x, a.y + u * dy - q.y));
  }
  return best;
}
const edges = (p: BezPath): [Pt, Pt][] => (polylines(p, 200_000, 0.01) ?? []).flatMap((l) => l.points.slice(1).map((b, i) => [l.points[i], b] as [Pt, Pt]));

const circle = ellipsePath({ x: 50, y: 50 }, { x: 30, y: 30 });
const square = rect(20, 20, 60, 60);
const line = new BezPath().moveTo({ x: 0, y: 50 }).lineTo({ x: 100, y: 50 });

describe("Phase 111: warps", () => {
  it("twist turns each point about the centre: a centred circle stays that circle, a square changes", () => {
    const t = run(circle, true, mod("twist", { angle: 180 }));
    for (const q of points(t.path)) near(Math.hypot(q.x - 50, q.y - 50), 30, 0.15, "radius");
    const s = run(square, true, mod("twist", { angle: 90 }));
    // every point keeps its distance from the centre, so the twisted square stays between the square's inner and outer radius
    for (const q of points(s.path)) {
      const d = Math.hypot(q.x - 50, q.y - 50);
      assert.ok(d >= 30 - 0.15 && d <= 30 * Math.SQRT2 + 0.15, `${d}`);
    }
    assert.notEqual(s.path.toSvg(2), square.toSvg(2));
  });

  it("bend turns a straight line into an arc of the angle, keeping its length", () => {
    const b = run(line, false, mod("bend", { angle: 90 }));
    const len = b.path.segments().reduce((s, seg) => s + segmentArclen(seg, 1e-6), 0);
    near(len, 100, 0.25, "length");
    const R = 100 / (Math.PI / 2);
    for (const q of points(b.path)) near(Math.hypot(q.x - 50, q.y - (50 + R)), R, 0.15, "on the arc");
    assert.equal(run(line, false, mod("bend", { angle: 0 })).path, line, "0° gives the path back");
  });

  it("spherize moves a centred circle out (bulge) or in (pinch) by the rule, and 0 changes nothing", () => {
    const reach = Math.hypot(100, 100) / 2;
    for (const a of [0.5, -0.5]) {
      const d = 30 / reach;
      const want = reach * (d + a * d * (1 - d));
      const s = run(circle, true, mod("spherize", { amount: a * 100 }));
      for (const q of points(s.path)) near(Math.hypot(q.x - 50, q.y - 50), want, 0.15, `amount ${a}`);
    }
    assert.equal(run(circle, true, mod("spherize", { amount: 0 })).path, circle);
  });

  it("wiggle stays within its amount of the outline, closes where it starts, and is the same every time for a seed", () => {
    const m = mod("wiggle", { size: 5, detail: 8, seed: 42 });
    const a = run(circle, true, m);
    const b = run(circle, true, m);
    assert.equal(a.path.toSvg(6), b.path.toSvg(6), "deterministic");
    assert.notEqual(run(circle, true, mod("wiggle", { size: 5, detail: 8, seed: 43 })).path.toSvg(3), a.path.toSvg(3), "another seed, another wobble");
    const e = edges(circle);
    let worst = 0;
    let moved = 0;
    for (const q of points(a.path)) {
      const d = distanceTo(e, q);
      worst = Math.max(worst, d);
      moved += d;
    }
    assert.ok(worst <= 5 + 0.25, `strays ${worst.toFixed(2)}`);
    assert.ok(moved > 0, "it does wobble");
    assert.equal(a.path.els.filter((x) => x.t === "Z").length, 1);
  });

  it("zig-zag puts the peaks half a ridge apart, the amount either side, the ends on the line", () => {
    const z = run(line, false, mod("zigzag", { size: 6, ridges: 5, points: "corner" }));
    const pts = z.path.els.map((e) => (e as { p: Pt }).p);
    assert.equal(pts.length, 7);
    near(pts[0].x, 0, 1e-9, "start");
    near(pts[6].x, 100, 1e-9, "end");
    for (let j = 0; j < 5; j++) {
      near(pts[j + 1].x, 10 + 20 * j, 1e-6, `peak ${j} x`);
      near(Math.abs(pts[j + 1].y - 50), 6, 1e-6, `peak ${j} height`);
      if (j > 0) assert.ok(Math.sign(pts[j + 1].y - 50) !== Math.sign(pts[j].y - 50), "alternating sides");
    }
    const smooth = run(line, false, mod("zigzag", { size: 6, ridges: 5, points: "smooth" }));
    assert.ok(smooth.path.els.every((e) => e.t === "M" || e.t === "C"));
  });

  it("pucker & bloat keep the anchors; bloat puffs the sides out, pucker pinches them in", () => {
    const area = (p: BezPath) => Math.abs(p.area());
    const bloat = run(square, true, mod("pucker", { amount: 50 }));
    const pucker = run(square, true, mod("pucker", { amount: -50 }));
    assert.ok(area(bloat.path) > 3600 && area(pucker.path) < 3600, `${area(bloat.path)} ${area(pucker.path)}`);
    for (const p of [bloat.path, pucker.path]) {
      const anchors = p.els.filter((e) => e.t === "C").map((e) => (e as { p3: Pt }).p3);
      for (const corner of [{ x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }, { x: 20, y: 20 }]) assert.ok(anchors.some((a) => Math.hypot(a.x - corner.x, a.y - corner.y) < 1e-9));
    }
    assert.equal(run(square, true, mod("pucker", { amount: 0 })).path, square);
  });
});

describe("Phase 111: stored references", () => {
  const cases: [string, BezPath, boolean, Modifier][] = [
    ["twist square 90", square, true, mod("twist", { angle: 90 })],
    ["bend square 60", square, true, mod("bend", { angle: 60 })],
    ["spherize square 40", square, true, mod("spherize", { amount: 40 })],
    ["wiggle circle seed 7", circle, true, mod("wiggle", { size: 4, detail: 6, seed: 7 })],
    ["wiggle line seed 7", line, false, mod("wiggle", { size: 4, detail: 6, seed: 7 })],
    ["zigzag circle smooth", circle, true, mod("zigzag", { size: 5, ridges: 3, points: "smooth" })],
    ["zigzag square corner", square, true, mod("zigzag", { size: 4, ridges: 4, points: "corner" })],
    ["pucker square -60", square, true, mod("pucker", { amount: -60 })],
    ["bloat circle 40", circle, true, mod("pucker", { amount: 40 })],
  ];
  const file = join(process.cwd(), "src", "core", "paths", "__tests__", "fixtures", "warps.json");

  it("every case matches its stored result exactly (to a thousandth of a px)", () => {
    const now = Object.fromEntries(cases.map(([name, p, closed, m]) => [name, run(p, closed, m).path.toSvg(3)]));
    if (!existsSync(file) || process.env.LL_UPDATE_REFERENCES === "1") writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const stored = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    for (const [name] of cases) assert.equal(now[name], stored[name], name);
  });
});
