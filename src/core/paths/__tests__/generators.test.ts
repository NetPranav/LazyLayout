/**
 * ROADMAP Phase 112: shape generators. The gate: seeded results repeat exactly; 2,000 generated shapes stay editable
 * at 60 fps (here: generating them takes well under a 16 ms frame).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BezPath, ellipsePath, splitSubpaths, type Pt } from "../../geometry/bezpath";
import { polylines } from "../../geometry/measure";
import { applyModifiers, newModifier, type Modifier, type ModifierType } from "../modifiers";
import { delaunay, seeded } from "../generators";

const rect = (x: number, y: number, w: number, h: number): BezPath =>
  new BezPath().moveTo({ x, y }).lineTo({ x: x + w, y }).lineTo({ x: x + w, y: y + h }).lineTo({ x, y: y + h }).closePath();
const mod = (type: ModifierType, params: Record<string, number | string> = {}): Modifier => {
  const m = newModifier(type, `m-${type}`);
  return { ...m, params: { ...m.params, ...params } };
};
const gen = (path: BezPath, m: Modifier, closed = true) => applyModifiers({ path, closed }, [m], { w: 300, h: 300 });
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)}, expected ${want.toFixed(3)}`);
const centre = (p: BezPath): Pt => {
  const b = p.boundingBox();
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
};
const area = (p: BezPath) => splitSubpaths(p).reduce((s, sp) => s + Math.abs(sp.area()), 0);
const circle = ellipsePath({ x: 150, y: 150 }, { x: 120, y: 120 });
const CIRCLE = Math.abs(circle.area());

describe("Phase 112: every generator repeats exactly for a seed", () => {
  for (const [type, params] of [
    ["scatter", { count: 60, shape: "star", size: 10 }],
    ["cells", { count: 30 }],
    ["cells", { count: 30, mode: "triangles" }],
    ["flow", { count: 30 }],
  ] as [ModifierType, Record<string, number | string>][]) {
    it(`${type} ${JSON.stringify(params)}: the same seed, the same shapes; another seed, others`, () => {
      const a = gen(circle, mod(type, { ...params, seed: 5 })).path.toSvg(6);
      assert.equal(gen(circle, mod(type, { ...params, seed: 5 })).path.toSvg(6), a);
      assert.notEqual(gen(circle, mod(type, { ...params, seed: 6 })).path.toSvg(6), a);
    });
  }
  it("the seeded generator is the same sequence every time", () => {
    const a = seeded(9);
    const b = seeded(9);
    for (let i = 0; i < 100; i++) assert.equal(a(), b());
  });
});

describe("Phase 112: scatter", () => {
  it("fills a circle with 200 stars, every one inside, none bigger than the size", () => {
    const out = gen(circle, mod("scatter", { count: 200, shape: "star", size: 12, variety: 60, seed: 3 }));
    const stars = splitSubpaths(out.path);
    assert.equal(stars.length, 200);
    for (const s of stars) {
      const c = centre(s);
      assert.ok(Math.hypot(c.x - 150, c.y - 150) <= 120, "inside the circle");
      const b = s.boundingBox();
      assert.ok(b.x1 - b.x0 <= 12 + 1e-6 && b.y1 - b.y0 <= 12 + 1e-6, "no bigger than the size");
    }
  });

  it("along an outline: evenly spaced round it, turned to follow it", () => {
    const out = gen(circle, mod("scatter", { count: 24, shape: "triangle", size: 8, place: "along", variety: 0 }));
    const pieces = splitSubpaths(out.path);
    assert.equal(pieces.length, 24);
    for (const s of pieces) near(Math.hypot(centre(s).x - 150, centre(s).y - 150), 120, 2.5, "on the outline");
  });
});

describe("Phase 112: cells", () => {
  it("Voronoi cells with no gap tile the circle exactly; a gap cracks them apart", () => {
    const whole = gen(circle, mod("cells", { count: 40, gap: 0, seed: 2 }));
    near(area(whole.path), CIRCLE, CIRCLE * 0.005, "tiles the circle");
    assert.ok(splitSubpaths(whole.path).length >= 30);
    const cracked = gen(circle, mod("cells", { count: 40, gap: 4, seed: 2 }));
    assert.ok(area(cracked.path) < area(whole.path) * 0.97, "the gap takes area away");
  });

  it("Delaunay triangles: no site lies inside another triangle's circumcircle", () => {
    const rand = seeded(11);
    const pts = Array.from({ length: 120 }, () => ({ x: rand() * 300, y: rand() * 300 }));
    const tris = delaunay(pts);
    assert.ok(tris.length >= 200, `${tris.length} triangles`);
    for (const [a, b, c] of tris) {
      const A = pts[a];
      const B = pts[b];
      const C = pts[c];
      const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      const ux = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / D;
      const uy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / D;
      const r2 = (A.x - ux) ** 2 + (A.y - uy) ** 2;
      for (let i = 0; i < pts.length; i++) {
        if (i === a || i === b || i === c) continue;
        assert.ok((pts[i].x - ux) ** 2 + (pts[i].y - uy) ** 2 >= r2 * (1 - 1e-9), "empty circumcircle");
      }
    }
  });
});

describe("Phase 112: grid, rings and flow lines", () => {
  it("a square grid of 20 px cells over a 100 × 60 card is 15 squares that cover it", () => {
    const out = gen(rect(0, 0, 100, 60), mod("grid", { kind: "square", size: 20, gap: 0 }));
    assert.equal(splitSubpaths(out.path).length, 15);
    near(area(out.path), 6000, 0.5, "area");
    const hex = gen(circle, mod("grid", { kind: "hex", size: 30, gap: 0 }));
    near(area(hex.path), CIRCLE, CIRCLE * 0.005, "hex cells cover the circle");
  });

  it("rings: concentric copies scaled evenly down to the smallest", () => {
    const out = gen(rect(50, 50, 200, 200), mod("rings", { count: 5, inner: 20 }));
    const widths = splitSubpaths(out.path).map((s) => s.boundingBox().x1 - s.boundingBox().x0);
    assert.deepEqual(widths.map((w) => Math.round(w)), [200, 160, 120, 80, 40]);
  });

  it("flow lines stay inside the outline and no longer than their length", () => {
    const out = gen(circle, mod("flow", { count: 50, length: 60, seed: 4 }));
    const lines = splitSubpaths(out.path);
    assert.ok(lines.length > 30 && lines.length <= 50, `${lines.length} lines`);
    for (const l of lines) {
      const pts = (polylines(l, 50_000, 0.05) ?? []).flatMap((x) => x.points);
      for (const q of pts) assert.ok(Math.hypot(q.x - 150, q.y - 150) <= 120.5, "inside");
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      assert.ok(len <= 60 + 3, `${len.toFixed(1)} px`);
    }
  });
});

describe("Phase 112: 2,000 shapes", () => {
  it("scattering 2,000 stars in a circle takes well under a 16 ms frame", () => {
    const m = mod("scatter", { count: 2000, shape: "star", size: 6, seed: 1 });
    gen(circle, m);
    const times: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t0 = performance.now();
      const out = gen(circle, { ...m, params: { ...m.params, seed: k } });
      times.push(performance.now() - t0);
      assert.equal(splitSubpaths(out.path).length, 2000);
    }
    times.sort((a, b) => a - b);
    assert.ok(times[0] < 16, `fastest ${times[0].toFixed(1)} ms, median ${times[10].toFixed(1)} ms`);
  });
});
