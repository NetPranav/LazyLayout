/**
 * ROADMAP Phase 106: path operations. The gate asks for 20 reference shapes per operation within 0.25 px. The
 * references here are geometric facts rather than stored copies of our own output: an outward offset's edge is
 * exactly the offset distance from the shape, a knife's pieces add up to the shape, a simplified path stays within
 * its tolerance, and so on, for 20 seeded shapes each.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BezPath, ellipsePath, type Pt } from "../../geometry/bezpath";
import { polylines, winding } from "../../geometry/measure";
import { defaultStroke, strokeOutline } from "../strokes";
import { dividePaths, joinPaths, knifeCut, offsetPath, reversePath, simplifyCurves, simplifyTolerance, smoothCurves } from "../pathTools";
import { booleanPaths } from "../pathOps";

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

/** A smooth closed blob through `n` points round a centre. */
function blob(cx: number, cy: number, r: number, n: number, rand: () => number): BezPath {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.75 + 0.4 * rand());
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  const p = new BezPath().moveTo(pts[0]);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const d = pts[(i + 2) % n];
    p.curveTo({ x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 }, { x: c.x - (d.x - b.x) / 6, y: c.y - (d.y - b.y) / 6 }, c);
  }
  return p.closePath();
}

/** 20 closed reference shapes: ellipses, rectangles and blobs. */
function shapes(seed: number): BezPath[] {
  const rand = rng(seed);
  return Array.from({ length: 20 }, (_, i) => {
    const cx = 150 + rand() * 50;
    const cy = 150 + rand() * 50;
    if (i % 3 === 0) return ellipsePath({ x: cx, y: cy }, { x: 30 + rand() * 40, y: 30 + rand() * 40 });
    if (i % 3 === 1) return rect(cx - 50, cy - 40, 50 + rand() * 50, 40 + rand() * 40);
    return blob(cx, cy, 40 + rand() * 20, 5 + Math.floor(rand() * 4), rand);
  });
}

const points = (p: BezPath, tol = 0.05): Pt[] => (polylines(p, 400_000, tol) ?? []).flatMap((l) => l.points);

/** Distance from `q` to the outline of `path` (finely flattened). */
function outlineDistance(segs: readonly [Pt, Pt][], q: Pt): number {
  let best = Infinity;
  for (const [a, b] of segs) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + u * dx - q.x, a.y + u * dy - q.y));
  }
  return best;
}
const edges = (p: BezPath): [Pt, Pt][] =>
  (polylines(p, 400_000, 0.01) ?? []).flatMap((l) => l.points.slice(1).map((b, i) => [l.points[i], b] as [Pt, Pt]));

const area = (p: BezPath): number => Math.abs(p.area());
const near = (got: number, want: number, tol: number, what: string): void =>
  assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)}, expected ${want.toFixed(3)}`);

describe("Phase 106: offset", () => {
  it("a rectangle grown by 10 with round, mitre and bevel corners has the exact area of each", () => {
    const r = rect(0, 0, 100, 60);
    near(area(offsetPath(r, 10, "round")), 6000 + 320 * 10 + Math.PI * 100, 0.02 * (320 + 20 * Math.PI), "round");
    near(area(offsetPath(r, 10, "miter")), 120 * 80, 1, "mitre");
    near(area(offsetPath(r, 10, "bevel")), 120 * 80 - 4 * 50, 1, "bevel");
    near(area(offsetPath(r, -10)), 80 * 40, 1, "shrunk");
    assert.equal(offsetPath(r, -40).isEmpty(), true, "shrinking past the middle leaves nothing");
  });

  it("a circle grown by 10 is a circle of radius 50, and keeps curves", () => {
    const c = offsetPath(ellipsePath({ x: 0, y: 0 }, { x: 40, y: 40 }), 10);
    near(area(c), Math.PI * 2500, 0.05 * 2 * Math.PI * 50, "area");
    for (const q of points(c)) near(Math.hypot(q.x, q.y), 50, 0.25, "radius");
    assert.ok(c.els.some((e) => e.t === "C"));
  });

  for (const d of [8, -6]) {
    it(`20 reference shapes offset by ${d}: every point of the result is ${Math.abs(d)} px from the shape, within 0.25 px`, () => {
      for (const [i, s] of shapes(106 + d).entries()) {
        const o = offsetPath(s, d, "round");
        assert.ok(!o.isEmpty(), `shape ${i}`);
        const segs = edges(s);
        let worst = 0;
        for (const q of points(o, 0.1)) worst = Math.max(worst, Math.abs(outlineDistance(segs, q) - Math.abs(d)));
        assert.ok(worst <= 0.25, `shape ${i}: off by ${worst.toFixed(3)} px`);
        if (d > 0) assert.ok(area(o) > area(s));
        else assert.ok(area(o) < area(s));
      }
    });
  }
});

describe("Phase 106: outline stroke", () => {
  it("20 open curves outlined at 6 px: every edge point is within 3 px of the line, and the area is length × width", () => {
    const rand = rng(1061);
    for (let i = 0; i < 20; i++) {
      const p = new BezPath().moveTo({ x: 0, y: 0 });
      let x = 0;
      for (let k = 0; k < 3; k++) {
        const nx = x + 60 + rand() * 40;
        p.curveTo({ x: x + 20, y: (rand() - 0.5) * 60 }, { x: nx - 20, y: (rand() - 0.5) * 60 }, { x: nx, y: (rand() - 0.5) * 30 });
        x = nx;
      }
      const out = strokeOutline(p, { ...defaultStroke(), weight: 6, align: "center", join: "round" }, false);
      const segs = edges(p);
      for (const q of points(out, 0.1)) assert.ok(outlineDistance(segs, q) <= 3 + 0.25, `curve ${i}`);
      const length = segs.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.y - a.y), 0);
      near(area(out), length * 6, length * 6 * 0.03, `curve ${i} area`);
    }
  });
});

describe("Phase 106: simplify and smooth", () => {
  /** A shape traced as many short straight pieces, as a scanned or hand-drawn path is. */
  const traced = (s: BezPath): BezPath => {
    const pts = points(s, 0.02);
    const p = new BezPath().moveTo(pts[0]);
    for (const q of pts.slice(1)) p.lineTo(q);
    return p.closePath();
  };

  it("20 traced shapes simplified at half strength: far fewer points, and every point within the tolerance", () => {
    const tol = simplifyTolerance(0.5);
    for (const [i, s] of shapes(1062).entries()) {
      const t = traced(s);
      const out = simplifyCurves(t, 0.5);
      const before = t.els.length;
      const after = out.els.length;
      if (before > 40) assert.ok(after * 4 < before, `shape ${i}: ${before} → ${after}`);
      const segs = edges(t);
      let worst = 0;
      for (const q of points(out, 0.05)) worst = Math.max(worst, outlineDistance(segs, q));
      assert.ok(worst <= tol + 0.25, `shape ${i}: ${worst.toFixed(3)} px from the original (tolerance ${tol.toFixed(2)})`);
      // no point strays more than the tolerance, so the area can change by at most perimeter × tolerance
      const perimeter = segs.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.y - a.y), 0);
      near(area(out), area(t), perimeter * tol, `shape ${i} area`);
    }
  });

  it("at strength 0 a simplified path stays within 0.25 px; a rectangle keeps its four corners", () => {
    for (const [i, s] of shapes(1063).entries()) {
      const out = simplifyCurves(s, 0);
      const segs = edges(s);
      for (const q of points(out, 0.05)) assert.ok(outlineDistance(segs, q) <= 0.25, `shape ${i}`);
    }
    const r = simplifyCurves(rect(0, 0, 100, 50), 1);
    near(area(r), 5000, 0.5, "rectangle");
    assert.equal(r.els.filter((e) => e.t === "L").length, 4);
  });

  it("smoothing rounds a square's corners more as the strength grows", () => {
    const sq = rect(0, 0, 100, 100);
    const weak = smoothCurves(sq, 0);
    const strong = smoothCurves(sq, 1);
    near(area(weak), 10_000, 1, "strength 0 keeps the square");
    assert.ok(area(strong) < 9_900, `a strong smooth cuts the corners: ${area(strong).toFixed(1)}`);
    assert.ok(area(strong) > 7_000);
    assert.ok(strong.els.some((e) => e.t === "C"));
  });
});

describe("Phase 106: divide", () => {
  it("20 pairs of shapes divided: the pieces cover the union exactly, and the shared piece is the intersection", () => {
    const list = shapes(1064);
    for (let i = 0; i < 20; i++) {
      const a = list[i];
      const b = list[(i + 7) % 20].map((p) => ({ x: p.x + 25, y: p.y + 15 }));
      const pieces = dividePaths([{ path: a }, { path: b }])!;
      const sum = pieces.reduce((s, p) => s + area(p.path), 0);
      const union = area(booleanPaths(a, b, "union"));
      near(sum, union, Math.max(1, union * 0.002), `pair ${i}`);
      const shared = pieces.filter((p) => p.cover.length === 2).reduce((s, p) => s + area(p.path), 0);
      near(shared, area(booleanPaths(a, b, "intersect")), Math.max(1, union * 0.002), `pair ${i} overlap`);
    }
  });
});

describe("Phase 106: knife", () => {
  it("20 shapes cut through the middle: two pieces that add up to the shape, one on each side", () => {
    const rand = rng(1065);
    for (const [i, s] of shapes(1066).entries()) {
      const bb = s.boundingBox();
      const cx = (bb.x0 + bb.x1) / 2;
      const cy = (bb.y0 + bb.y1) / 2;
      const a = rand() * Math.PI;
      const r = 400;
      const line = [{ x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r }, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }];
      const pieces = knifeCut(s, line)!;
      assert.ok(pieces && pieces.length >= 2, `shape ${i}`);
      near(pieces.reduce((t, p) => t + area(p), 0), area(s), Math.max(0.5, area(s) * 0.001), `shape ${i}`);
      // no piece crosses the line: every piece lies on one side of it
      // signed distance from the line; points on the cut itself (within 0.01 px) belong to both sides
      const side = (q: Pt) => {
        const d = ((line[1].x - line[0].x) * (q.y - line[0].y) - (line[1].y - line[0].y) * (q.x - line[0].x)) / Math.hypot(line[1].x - line[0].x, line[1].y - line[0].y);
        return Math.abs(d) < 0.01 ? 0 : Math.sign(d);
      };
      for (const p of pieces) {
        const sides = new Set(points(p, 0.1).map(side).filter((x) => x !== 0));
        assert.ok(sides.size <= 1, `shape ${i}: a piece crosses the knife`);
      }
    }
  });

  it("a bent knife cuts along its own line; a knife that misses or starts inside does nothing", () => {
    const sq = rect(0, 0, 100, 100);
    const bent = knifeCut(sq, [{ x: -20, y: 30 }, { x: 50, y: 70 }, { x: 120, y: 30 }])!;
    assert.equal(bent.length, 2);
    near(bent.reduce((t, p) => t + area(p), 0), 10_000, 1, "bent");
    // the piece below the bend holds the point (50, 90), the one above holds (50, 10)
    assert.ok(bent.some((p) => winding(p, { x: 50, y: 90 }) !== 0) && bent.some((p) => winding(p, { x: 50, y: 10 }) !== 0));
    assert.equal(knifeCut(sq, [{ x: -20, y: -20 }, { x: 120, y: -10 }]), null, "misses");
    assert.equal(knifeCut(sq, [{ x: 50, y: 50 }, { x: 150, y: 50 }]), null, "starts inside");
  });
});

describe("Phase 106: join and reverse", () => {
  const open = (a: Pt, b: Pt): BezPath => new BezPath().moveTo(a).curveTo({ x: a.x, y: a.y - 20 }, { x: b.x, y: b.y - 20 }, b);

  it("two open paths join at their nearest ends, and close when the other ends meet", () => {
    const j = joinPaths(open({ x: 0, y: 0 }, { x: 50, y: 0 }), open({ x: 60, y: 0 }, { x: 100, y: 0 }))!;
    assert.equal(j.els.filter((e) => e.t === "M").length, 1);
    assert.equal(j.els.filter((e) => e.t === "L").length, 1, "a straight join across the gap");
    assert.equal(j.els.some((e) => e.t === "Z"), false);
    const loop = joinPaths(open({ x: 0, y: 0 }, { x: 50, y: 0 }), open({ x: 0, y: 0 }, { x: 50, y: 0 }))!;
    assert.equal(loop.els.some((e) => e.t === "Z"), true, "the far ends meet: closed");
    assert.equal(joinPaths(rect(0, 0, 10, 10), open({ x: 0, y: 0 }, { x: 1, y: 1 })), null, "a closed path doesn't join");
  });

  it("reversing turns the winding round, twice gives the path back", () => {
    for (const s of shapes(1067)) {
      near(reversePath(s).area(), -s.area(), 1e-6, "signed area");
      const back = reversePath(reversePath(s));
      near(back.area(), s.area(), 1e-6, "twice");
      const segs = edges(s);
      // the reference outline is itself flattened to 0.01 px
      for (const q of points(back, 0.1)) assert.ok(outlineDistance(segs, q) < 0.02);
    }
  });
});
