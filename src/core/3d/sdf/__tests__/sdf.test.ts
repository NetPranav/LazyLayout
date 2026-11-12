/**
 * ============================================================================
 * UNIT TESTS: SIGNED DISTANCE FIELD & INFLATION (ROADMAP Phase 3D-028)
 * ============================================================================
 * Verifies:
 *   - Felzenszwalb-Huttenlocher EDT 1D and 2D correctness.
 *   - SDF error < 0.5 px on 10 shapes against exact continuous point-to-polygon
 *     distance at 200 random points per shape.
 *   - SDF sign correctness: strictly negative inside, positive outside.
 *   - `sdfToHeight` monotonicity from edge to center and peak depth equality.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closeRing, type Point2D, type Ring } from "../../path/flatten";
import {
  edt1d,
  sampleSdf,
  sdfToHeight,
  signedDistanceField,
} from "../sdf";

function approx(actual: number, expected: number, tol = 1e-2, msg = ""): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} expected ${expected} ± ${tol}, got ${actual} (diff ${diff})`);
}

/** Deterministic pseudo-random number generator for reproducible test runs. */
function makeRng(seed = 123456789) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Exact point-to-segment distance. */
function distToSeg(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Exact point-to-polygon distance to all segments of the rings. */
function exactPointToPolygonDist(px: number, py: number, rings: readonly Ring[]): number {
  let minD = Infinity;
  for (const r of rings) {
    const closed = closeRing(r);
    for (let i = 0; i + 1 < closed.length; i++) {
      const d = distToSeg(px, py, closed[i][0], closed[i][1], closed[i + 1][0], closed[i + 1][1]);
      if (d < minD) minD = d;
    }
  }
  return minD;
}

// 10 test shapes
const makeSquare = (s: number, ox = 10, oy = 10): Ring => [
  [ox, oy],
  [ox + s, oy],
  [ox + s, oy + s],
  [ox, oy + s],
  [ox, oy],
];

const makeRect = (w: number, h: number, ox = 10, oy = 10): Ring => [
  [ox, oy],
  [ox + w, oy],
  [ox + w, oy + h],
  [ox, oy + h],
  [ox, oy],
];

const makeCircle = (r: number, ox = 30, oy = 30, n = 32): Ring => {
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
};

const makeLShape = (): Ring => [
  [10, 10],
  [30, 10],
  [30, 20],
  [20, 20],
  [20, 30],
  [10, 30],
  [10, 10],
];

const makeDonut = (): Ring[] => {
  const outer = makeSquare(30, 10, 10);
  const hole = makeSquare(10, 20, 20).slice().reverse();
  return [outer, hole];
};

const makeStar = (): Ring => {
  const pts: Point2D[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 18 : 8;
    pts.push([30 + r * Math.cos(a), 30 + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
};

const makeCross = (): Ring => [
  [20, 10],
  [30, 10],
  [30, 20],
  [40, 20],
  [40, 30],
  [30, 30],
  [30, 40],
  [20, 40],
  [20, 30],
  [10, 30],
  [10, 20],
  [20, 20],
  [20, 10],
];

const makeTriangle = (): Ring => [
  [10, 10],
  [35, 10],
  [10, 35],
  [10, 10],
];

const makeDiamond = (): Ring => [
  [25, 10],
  [40, 25],
  [25, 40],
  [10, 25],
  [25, 10],
];

const makeStairs = (): Ring => [
  [10, 10],
  [40, 10],
  [40, 20],
  [30, 20],
  [30, 30],
  [20, 30],
  [20, 40],
  [10, 40],
  [10, 10],
];

describe("sdf: Felzenszwalb-Huttenlocher EDT", () => {
  it("computes exact 1D squared distance transform", () => {
    // Array where index 3 is 0, rest Infinity
    const f = new Float64Array([Infinity, Infinity, Infinity, 0, Infinity, Infinity, Infinity]);
    const d = edt1d(f, 7);
    // Distance squared from index 3 should be (i - 3)^2
    for (let i = 0; i < 7; i++) {
      approx(d[i], (i - 3) * (i - 3), 1e-6);
    }
  });
});

describe("sdf: error < 0.5 px on 10 shapes (200 random points each)", () => {
  const shapes: Array<{ name: string; rings: Ring[] }> = [
    { name: "1. Square", rings: [makeSquare(25)] },
    { name: "2. Rectangle", rings: [makeRect(35, 15)] },
    { name: "3. Circle", rings: [makeCircle(18)] },
    { name: "4. L-Shape", rings: [makeLShape()] },
    { name: "5. Donut (Square with Hole)", rings: makeDonut() },
    { name: "6. 5-Pointed Star", rings: [makeStar()] },
    { name: "7. Cross", rings: [makeCross()] },
    { name: "8. Triangle", rings: [makeTriangle()] },
    { name: "9. Diamond", rings: [makeDiamond()] },
    { name: "10. Stepped Staircase", rings: [makeStairs()] },
  ];

  for (const { name, rings } of shapes) {
    it(`evaluates ${name} with maximum continuous error < 0.5 px across 200 points`, () => {
      const field = signedDistanceField(rings, {
        width: 60,
        height: 60,
        cellSize: 1,
        origin: [0, 0],
      });

      const rng = makeRng(name.charCodeAt(0) * 1000 + 42);
      let maxError = 0;

      for (let i = 0; i < 200; i++) {
        // Sample continuous points across domain [5, 45]
        const qx = 5 + rng() * 40;
        const qy = 5 + rng() * 40;

        const exactD = exactPointToPolygonDist(qx, qy, rings);
        const sampledSdf = sampleSdf(field, qx, qy);
        const sampledD = Math.abs(sampledSdf);

        const error = Math.abs(sampledD - exactD);
        if (error > maxError) maxError = error;

        assert.ok(
          error < 0.5,
          `At (${qx.toFixed(2)}, ${qy.toFixed(2)}), error ${error.toFixed(4)} >= 0.5 px (exact: ${exactD.toFixed(3)}, sampled: ${sampledD.toFixed(3)})`
        );
      }

      assert.ok(maxError < 0.5, `${name}: Max error was ${maxError.toFixed(4)} px (must be < 0.5)`);
    });
  }
});

describe("sdf: sign correctness", () => {
  it("assigns strictly negative distances inside and positive outside", () => {
    // Square [10, 30] x [10, 30]
    const sq = makeSquare(20, 10, 10);
    const field = signedDistanceField([sq], {
      width: 40,
      height: 40,
      cellSize: 1,
      origin: [0, 0],
    });

    // Deep interior point: (20, 20) -> should be negative
    const centerVal = sampleSdf(field, 20, 20);
    assert.ok(centerVal < -8, `Interior value should be < -8, got ${centerVal}`);

    // Exterior points: (5, 5), (35, 35) -> should be positive
    assert.ok(sampleSdf(field, 5, 5) > 0, "Exterior (5, 5) should be positive");
    assert.ok(sampleSdf(field, 35, 35) > 0, "Exterior (35, 35) should be positive");

    // Donut hole interior: center of hole at (25, 25)
    const donut = makeDonut();
    const donutField = signedDistanceField(donut, {
      width: 50,
      height: 50,
      cellSize: 1,
      origin: [0, 0],
    });

    // Inside the solid part of donut: (15, 15) -> negative
    assert.ok(sampleSdf(donutField, 15, 15) < 0, "Solid ring interior should be negative");

    // Inside the hole of donut: (25, 25) -> positive (hole is void exterior)
    assert.ok(sampleSdf(donutField, 25, 25) > 0, "Donut hole interior should be positive");
  });
});

describe("sdfToHeight: pillow inflation & monotonicity", () => {
  it("produces strictly monotonic height from edge to center and matches target depth", () => {
    const s = 40;
    const sq = makeSquare(s, 0, 0);
    const field = signedDistanceField([sq], {
      width: 41,
      height: 41,
      cellSize: 1,
      origin: [0, 0],
    });

    const depth = 15;
    const heightField = sdfToHeight(field, { depth, profile: "pillow" });

    // Center of square is at (20, 20)
    const centerIdx = 20 * 41 + 20;
    approx(heightField[centerIdx], depth, 0.2, "Center height should match target depth");

    // Outside the square: (0, 0) is corner, (-1, -1) is outside
    const edgeIdx = 0 * 41 + 20; // on edge (x=20, y=0)
    approx(heightField[edgeIdx], 0, 0.1, "Edge height should be 0");

    // Check monotonicity from edge (20, 0) to center (20, 20)
    let lastH = -1;
    for (let y = 0; y <= 20; y++) {
      const idx = y * 41 + 20;
      const h = heightField[idx];
      assert.ok(
        h >= lastH - 1e-4,
        `Height at y=${y} (${h}) should be >= previous (${lastH})`
      );
      lastH = h;
    }

    assert.ok(lastH > 14.8, "Reached peak depth at center");
  });

  it("handles linear and smooth profiles monotonically", () => {
    const sq = makeSquare(20, 0, 0);
    const field = signedDistanceField([sq], {
      width: 21,
      height: 21,
      cellSize: 1,
      origin: [0, 0],
    });

    for (const profile of ["linear", "smooth"] as const) {
      const hField = sdfToHeight(field, { depth: 10, profile });
      let lastH = -1;
      for (let y = 0; y <= 10; y++) {
        const h = hField[y * 21 + 10];
        assert.ok(h >= lastH - 1e-4, `${profile} height not monotone at y=${y}`);
        lastH = h;
      }
      approx(lastH, 10, 0.1, `${profile} peak depth`);
    }
  });
});
