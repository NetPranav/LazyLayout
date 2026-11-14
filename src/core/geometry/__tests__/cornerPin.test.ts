import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPin, isConvex, mapUnit, parsePin, pinMatrix3d, type Quad } from "../cornerPin";

const apply = (matrix: string, x: number, y: number): [number, number] => {
  const m = matrix.slice(9, -1).split(",").map(Number); // column-major 4x4
  const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], W = m[3] * x + m[7] * y + m[15];
  return [X / W, Y / W];
};
const near = (a: [number, number], b: [number, number]) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3, `${a} vs ${b}`);

describe("corner pin", () => {
  const road: Quad = [[40, 300], [520, 250], [700, 480], [10, 520]];
  it("maps the four corners of the layer onto the four points", () => {
    const m = pinMatrix3d(400, 90, road);
    near(apply(m, 0, 0), road[0]);
    near(apply(m, 400, 0), road[1]);
    near(apply(m, 400, 90), road[2]);
    near(apply(m, 0, 90), road[3]);
  });
  it("a plain rectangle gives a plain move (no perspective)", () => {
    const m = pinMatrix3d(100, 50, [[10, 20], [110, 20], [110, 70], [10, 70]]);
    near(apply(m, 50, 25), [60, 45]);
    assert.ok(m.endsWith(",0,0,1,0,10,20,0,1)") || m.includes(",0,0,1,0,10,20,0,1"));
  });
  it("things shrink toward the far side: the far half is squeezed (perspective, not a straight blend)", () => {
    const q: Quad = [[100, 0], [300, 0], [400, 200], [0, 200]]; // narrow at the top (far), wide at the bottom (near)
    const m = pinMatrix3d(200, 200, q);
    const midTop = apply(m, 100, 0), midBottom = apply(m, 100, 200);
    assert.ok(midBottom[0] - midTop[0] === 0 || Math.abs(midBottom[0] - midTop[0]) < 1e-6, "the centre line stays centred");
    const halfway = apply(m, 100, 100)[1];
    assert.ok(halfway < 100, `the far half is squeezed: the layer's halfway line sits toward the far edge (${halfway.toFixed(1)})`);
  });
  it("the grid points land on the surface", () => {
    near(mapUnit(road, 0, 0), road[0]);
    near(mapUnit(road, 1, 1), road[2]);
    const c = mapUnit(road, 0.5, 0.5);
    assert.ok(c[0] > 100 && c[0] < 600 && c[1] > 250 && c[1] < 520);
  });
  it("reads and writes the stored form, and refuses what is not four points", () => {
    assert.deepEqual(parsePin(formatPin(road)), road);
    assert.equal(parsePin(""), null);
    assert.equal(parsePin("1,2,3"), null);
    assert.equal(parsePin("a,b,c,d,e,f,g,h"), null);
  });
  it("a folded or flat quad is not convex", () => {
    assert.equal(isConvex(road), true);
    assert.equal(isConvex([[0, 0], [100, 100], [100, 0], [0, 100]]), false, "a bow tie");
    assert.equal(isConvex([[0, 0], [10, 0], [20, 0], [30, 0]]), false, "a line");
  });
});

describe("corner pin Done-when (D16): the four points are hit within 0.01 px, at five sizes", () => {
  /** What the browser does with `matrix3d(...)`: a point (x, y) of the layer goes to (X / W, Y / W). */
  const apply = (matrix: string, x: number, y: number): [number, number] => {
    const m = matrix.slice(9, -1).split(",").map(Number); // column-major
    const w = m[3] * x + m[7] * y + m[15];
    return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
  };
  const SIZES: [number, number][] = [[1, 1], [24, 24], [320, 180], [1280, 720], [4000, 3000]];
  // quads of every kind: a plain move, a trapezoid (a road), a strong perspective (a billboard), a skew, a tiny and a huge one
  const QUADS: Quad[] = [
    [[10, 10], [110, 10], [110, 70], [10, 70]],
    [[40, 0], [160, 0], [200, 120], [0, 120]],
    [[120.5, 33.25], [480.75, 61.5], [431.125, 402.875], [97.25, 350.5]],
    [[0, 0], [300, 40], [340, 200], [30, 160]],
    [[1000, 1000], [1000.5, 1000], [1000.5, 1000.5], [1000, 1000.5]],
    [[-200, -50], [3000, 100], [2800, 2400], [-150, 2000]],
  ];
  for (const [w, h] of SIZES) {
    it(`at ${w} x ${h}: every quad's corners land on its points`, () => {
      for (const q of QUADS) {
        const matrix = pinMatrix3d(w, h, q);
        const corners: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
        corners.forEach((c, i) => {
          const [x, y] = apply(matrix, c[0], c[1]);
          assert.ok(Math.hypot(x - q[i][0], y - q[i][1]) < 0.01, `${w}x${h} corner ${i} of ${JSON.stringify(q)}: landed at ${x}, ${y}`);
        });
      }
    });
  }
  it("a point in the middle of the layer lands where the surface's own centre is (a perspective, not a blend)", () => {
    const q = QUADS[1];
    const [x, y] = apply(pinMatrix3d(200, 100, q), 100, 50);
    const [mx, my] = mapUnit(q, 0.5, 0.5);
    assert.ok(Math.hypot(x - mx, y - my) < 0.01);
  });
  it("the stored form survives a round trip with two-decimal rounding: the points come back within 0.005 px", () => {
    for (const q of QUADS.slice(0, 4)) {
      const back = parsePin(formatPin(q))!;
      back.forEach((p, i) => assert.ok(Math.hypot(p[0] - q[i][0], p[1] - q[i][1]) <= 0.0071, `corner ${i}`));
    }
  });
});
