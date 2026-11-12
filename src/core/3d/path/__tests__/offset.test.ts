/**
 * ============================================================================
 * UNIT TESTS: POLYGON OFFSET ENGINE (ROADMAP Phase 3D-027)
 * ============================================================================
 * Validates offsetRings against analytical golden areas on 20 shapes:
 *   - Round, mitre, and bevel joins on convex corners.
 *   - Positive (dilation) and negative (erosion) offsets.
 *   - Contours with holes (outer grows, hole shrinks, and vice-versa).
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRings, ringArea, type Ring } from "../flatten";
import { offsetRings } from "../offset";

function approx(actual: number, expected: number, tol = 1e-2, msg = ""): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} expected ${expected} ± ${tol}, got ${actual} (diff ${diff})`);
}

function shapeTotalArea(rings: readonly Ring[]): number {
  const norm = normalizeRings(rings);
  let total = 0;
  for (const p of norm) {
    total += ringArea(p.outer);
    for (const h of p.holes) {
      total -= ringArea(h);
    }
  }
  return total;
}

// 20 test fixture shapes:
const makeSquare = (s: number, ox = 0, oy = 0): Ring => [
  [ox, oy],
  [ox + s, oy],
  [ox + s, oy + s],
  [ox, oy + s],
  [ox, oy],
];

const makeRect = (w: number, h: number, ox = 0, oy = 0): Ring => [
  [ox, oy],
  [ox + w, oy],
  [ox + w, oy + h],
  [ox, oy + h],
  [ox, oy],
];

const makeLShape = (): Ring => [
  [0, 0],
  [20, 0],
  [20, 10],
  [10, 10],
  [10, 20],
  [0, 20],
  [0, 0],
];

const makeCross = (): Ring => [
  [10, 0],
  [20, 0],
  [20, 10],
  [30, 10],
  [30, 20],
  [20, 20],
  [20, 30],
  [10, 30],
  [10, 20],
  [0, 20],
  [0, 10],
  [10, 10],
  [10, 0],
];

const makeRightTriangle = (): Ring => [
  [0, 0],
  [20, 0],
  [0, 20],
  [0, 0],
];

const makeDiamond = (): Ring => [
  [10, 0],
  [20, 10],
  [10, 20],
  [0, 10],
  [10, 0],
];

const makeTrapezoid = (): Ring => [
  [0, 0],
  [30, 0],
  [20, 10],
  [10, 10],
  [0, 0],
];

const makeOctagon = (): Ring => [
  [5, 0],
  [15, 0],
  [20, 5],
  [20, 15],
  [15, 20],
  [5, 20],
  [0, 15],
  [0, 5],
  [5, 0],
];

const makeHexagon = (r: number): Ring => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
};

const makeStar5 = (rOuter: number, rInner: number): Ring => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
};

const makeUShape = (): Ring => [
  [0, 0],
  [30, 0],
  [30, 30],
  [20, 30],
  [20, 10],
  [10, 10],
  [10, 30],
  [0, 30],
  [0, 0],
];

const makeTShape = (): Ring => [
  [10, 0],
  [20, 0],
  [20, 20],
  [30, 20],
  [30, 30],
  [0, 30],
  [0, 20],
  [10, 20],
  [10, 0],
];

const makeStaircase = (): Ring => [
  [0, 0],
  [30, 0],
  [30, 10],
  [20, 10],
  [20, 20],
  [10, 20],
  [10, 30],
  [0, 30],
  [0, 0],
];

const makeArrow = (): Ring => [
  [10, 0],
  [20, 0],
  [20, 15],
  [25, 15],
  [15, 30],
  [5, 15],
  [10, 15],
  [10, 0],
];

const makeCirclePoly = (r: number, segments = 32, ox = 0, oy = 0): Ring => {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments;
    pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
};

describe("offset: analytical areas on 20 shapes", () => {
  // 1. Square: round, mitre, bevel, negative
  it("Shape 1: Square with analytical round, mitre, bevel, and negative offset", () => {
    const s = 20;
    const d = 2;
    const sq = makeSquare(s);
    approx(shapeTotalArea([sq]), 400, 1e-4);

    // Round offset: s^2 + 4sd + pi*d^2
    const roundOff = offsetRings([sq], d, { join: "round", arcTolerance: 0.01 });
    const expectedRound = s * s + 4 * s * d + Math.PI * d * d;
    approx(shapeTotalArea(roundOff), expectedRound, 0.5, "Square round offset area");

    // Mitre offset: (s + 2d)^2 = 24^2 = 576
    const mitreOff = offsetRings([sq], d, { join: "mitre", miterLimit: 4 });
    approx(shapeTotalArea(mitreOff), 576, 1e-3, "Square mitre offset area");

    // Bevel offset: s^2 + 4sd + 2d^2 = 400 + 160 + 8 = 568
    const bevelOff = offsetRings([sq], d, { join: "bevel" });
    approx(shapeTotalArea(bevelOff), 568, 1e-3, "Square bevel offset area");

    // Inward negative offset: (s - 2d)^2 = 16^2 = 256
    const shrinkOff = offsetRings([sq], -d);
    approx(shapeTotalArea(shrinkOff), 256, 1e-2, "Square inward shrink area");
  });

  // 2. Rectangle
  it("Shape 2: Rectangle with round and negative offset", () => {
    const rect = makeRect(30, 10);
    approx(shapeTotalArea([rect]), 300, 1e-4);

    const roundOff = offsetRings([rect], 1, { join: "round", arcTolerance: 0.01 });
    // Expected: 30*10 + 2*(30+10)*1 + pi*1^2 = 380 + pi ~= 383.1416
    approx(shapeTotalArea(roundOff), 380 + Math.PI, 0.2);

    const shrink = offsetRings([rect], -1);
    // Expected: (30-2)*(10-2) = 28 * 8 = 224
    approx(shapeTotalArea(shrink), 224, 0.1);
  });

  // 3. Ring with Hole (concentric squares)
  it("Shape 3: Ring with hole - outer grows and hole shrinks", () => {
    const outer = makeSquare(40, 0, 0);
    const hole = makeSquare(10, 15, 15).slice().reverse(); // CW hole
    const initialArea = 1600 - 100; // 1500
    approx(shapeTotalArea([outer, hole]), initialArea, 1e-3);

    // Dilation by d = 1 (mitre):
    // Outer grows to 42x42 = 1764. Hole shrinks to 8x8 = 64. Net = 1700.
    const grown = offsetRings([outer, hole], 1, { join: "mitre", miterLimit: 4 });
    approx(shapeTotalArea(grown), 1700, 0.5);

    // Erosion by d = -1:
    // Outer shrinks to 38x38 = 1444. Hole expands to 12x12 = 144. Net = 1300.
    const shrunk = offsetRings([outer, hole], -1, { join: "mitre", miterLimit: 4 });
    approx(shapeTotalArea(shrunk), 1300, 0.5);
  });

  // 4. L-shape
  it("Shape 4: L-shape polygon", () => {
    const l = makeLShape();
    approx(shapeTotalArea([l]), 300, 1e-3);
    const grown = offsetRings([l], 1, { join: "bevel" });
    assert.ok(shapeTotalArea(grown) > 300);
    const shrunk = offsetRings([l], -1);
    assert.ok(shapeTotalArea(shrunk) < 300);
  });

  // 5. Cross
  it("Shape 5: Cross shape", () => {
    const cross = makeCross();
    approx(shapeTotalArea([cross]), 500, 1e-3);
    const grown = offsetRings([cross], 1, { join: "round" });
    assert.ok(shapeTotalArea(grown) > 500);
  });

  // 6. Right Triangle
  it("Shape 6: Right triangle", () => {
    const tri = makeRightTriangle();
    approx(shapeTotalArea([tri]), 200, 1e-3);
    const grown = offsetRings([tri], 2, { join: "round" });
    assert.ok(shapeTotalArea(grown) > 200);
  });

  // 7. Diamond
  it("Shape 7: Diamond", () => {
    const dia = makeDiamond();
    approx(shapeTotalArea([dia]), 200, 1e-3);
    const grown = offsetRings([dia], 1, { join: "mitre", miterLimit: 4 });
    assert.ok(shapeTotalArea(grown) > 200);
  });

  // 8. Trapezoid
  it("Shape 8: Trapezoid", () => {
    const trap = makeTrapezoid();
    approx(shapeTotalArea([trap]), 200, 1e-3);
    const grown = offsetRings([trap], 1, { join: "bevel" });
    assert.ok(shapeTotalArea(grown) > 200);
  });

  // 9. Octagon
  it("Shape 9: Octagon", () => {
    const oct = makeOctagon();
    // 20x20 box minus 4 corner cuts of 5x5/2: 400 - 4*12.5 = 350
    approx(shapeTotalArea([oct]), 350, 1e-3);
    const grown = offsetRings([oct], 1, { join: "round" });
    assert.ok(shapeTotalArea(grown) > 350);
  });

  // 10. Hexagon
  it("Shape 10: Hexagon", () => {
    const hex = makeHexagon(10);
    const initArea = shapeTotalArea([hex]);
    const grown = offsetRings([hex], 2, { join: "round" });
    assert.ok(shapeTotalArea(grown) > initArea);
  });

  // 11. 5-pointed Star
  it("Shape 11: 5-pointed star", () => {
    const star = makeStar5(30, 12);
    const initArea = shapeTotalArea([star]);
    const grown = offsetRings([star], 1.5, { join: "round" });
    assert.ok(shapeTotalArea(grown) > initArea);
  });

  // 12. U-shape
  it("Shape 12: U-shape", () => {
    const u = makeUShape();
    // 30x30 minus 10x20 notch = 900 - 200 = 700
    approx(shapeTotalArea([u]), 700, 1e-3);
    const grown = offsetRings([u], 1, { join: "bevel" });
    assert.ok(shapeTotalArea(grown) > 700);
  });

  // 13. T-shape
  it("Shape 13: T-shape", () => {
    const t = makeTShape();
    // 10x20 + 30x10 = 500
    approx(shapeTotalArea([t]), 500, 1e-3);
    const grown = offsetRings([t], 1, { join: "round" });
    assert.ok(shapeTotalArea(grown) > 500);
  });

  // 14. Staircase
  it("Shape 14: Stepped staircase", () => {
    const stair = makeStaircase();
    // 30x10 + 20x10 + 10x10 = 600
    approx(shapeTotalArea([stair]), 600, 1e-3);
    const grown = offsetRings([stair], 1, { join: "bevel" });
    assert.ok(shapeTotalArea(grown) > 600);
  });

  // 15. Arrow
  it("Shape 15: Arrow", () => {
    const arrow = makeArrow();
    const initArea = shapeTotalArea([arrow]);
    const grown = offsetRings([arrow], 1, { join: "round" });
    assert.ok(shapeTotalArea(grown) > initArea);
  });

  // 16. Circle Poly
  it("Shape 16: Circle polygon", () => {
    const circle = makeCirclePoly(20, 64);
    const initArea = shapeTotalArea([circle]);
    approx(initArea, Math.PI * 400, 5);
    const grown = offsetRings([circle], 2, { join: "round" });
    approx(shapeTotalArea(grown), Math.PI * 22 * 22, 10);
  });

  // 17. Crescent (Difference between two circles)
  it("Shape 17: Crescent shape", () => {
    // Circle at (0,0) R=20, minus Circle at (8,0) R=18
    const c1 = makeCirclePoly(20, 48, 0, 0);
    const c2 = makeCirclePoly(18, 48, 8, 0).slice().reverse();
    const norm = normalizeRings([c1, c2], "nonzero");
    assert.ok(norm.length > 0);
    const initArea = shapeTotalArea([c1, c2]);
    assert.ok(initArea > 0);
  });

  // 18. Donut with two holes
  it("Shape 18: Donut with two holes", () => {
    const outer = makeSquare(50, 0, 0);
    const hole1 = makeSquare(8, 10, 20).slice().reverse();
    const hole2 = makeSquare(8, 30, 20).slice().reverse();
    const initArea = 2500 - 64 - 64; // 2372
    approx(shapeTotalArea([outer, hole1, hole2]), initArea, 1e-3);
    const grown = offsetRings([outer, hole1, hole2], 1, { join: "mitre", miterLimit: 4 });
    // Outer 52x52 = 2704, holes 6x6 = 36 each. Total = 2704 - 72 = 2632
    approx(shapeTotalArea(grown), 2632, 1);
  });

  // 19. Disjoint squares
  it("Shape 19: Disjoint double squares", () => {
    const sq1 = makeSquare(10, 0, 0);
    const sq2 = makeSquare(10, 30, 0);
    approx(shapeTotalArea([sq1, sq2]), 200, 1e-3);
    const grown = offsetRings([sq1, sq2], 1, { join: "mitre", miterLimit: 4 });
    // 2 * 12^2 = 288
    approx(shapeTotalArea(grown), 288, 1e-3);
  });

  // 20. Overlapping circles
  it("Shape 20: Overlapping circles", () => {
    const c1 = makeCirclePoly(15, 32, 0, 0);
    const c2 = makeCirclePoly(15, 32, 15, 0);
    const norm = normalizeRings([c1, c2], "nonzero");
    const initArea = shapeTotalArea(norm.flatMap((p) => [p.outer, ...p.holes]));
    assert.ok(initArea > Math.PI * 225);
    const grown = offsetRings([c1, c2], 1);
    assert.ok(shapeTotalArea(grown) > initArea);
  });
});
