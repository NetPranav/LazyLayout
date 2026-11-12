/**
 * ============================================================================
 * UNIT TESTS: RING BOOLEANS (ROADMAP Phase 3D-027)
 * ============================================================================
 * Tests union, intersect, difference, and XOR of 2D rings with fill rules.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRings, ringArea, ringOrientation, type Ring } from "../flatten";
import {
  differenceRings,
  intersectRings,
  unionRings,
  xorRings,
} from "../booleans";

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

const makeSquare = (s: number, ox = 0, oy = 0): Ring => [
  [ox, oy],
  [ox + s, oy],
  [ox + s, oy + s],
  [ox, oy + s],
  [ox, oy],
];

describe("booleans: set operations on rings", () => {
  // A: [0, 20] x [0, 20], Area = 400
  // B: [10, 30] x [0, 20], Area = 400
  // Overlap: [10, 20] x [0, 20], Area = 200
  const sqA = makeSquare(20, 0, 0);
  const sqB = makeSquare(20, 10, 0);

  it("computes exact union area", () => {
    // Union: [0, 30] x [0, 20], Area = 600
    const res = unionRings([sqA], [sqB]);
    approx(shapeTotalArea(res), 600, 1e-3);
    const norm = normalizeRings(res);
    assert.equal(norm.length, 1);
    assert.equal(ringOrientation(norm[0].outer), "ccw");
  });

  it("computes exact intersection area", () => {
    // Intersection: [10, 20] x [0, 20], Area = 200
    const res = intersectRings([sqA], [sqB]);
    approx(shapeTotalArea(res), 200, 1e-3);
    const norm = normalizeRings(res);
    assert.equal(norm.length, 1);
    assert.equal(ringOrientation(norm[0].outer), "ccw");
  });

  it("computes exact difference area (A minus B)", () => {
    // Difference: [0, 10] x [0, 20], Area = 200
    const res = differenceRings([sqA], [sqB]);
    approx(shapeTotalArea(res), 200, 1e-3);
    const norm = normalizeRings(res);
    assert.equal(norm.length, 1);
    assert.equal(ringOrientation(norm[0].outer), "ccw");
  });

  it("computes exact symmetric difference (XOR)", () => {
    // XOR: Two disjoint rectangles [0, 10] x [0, 20] and [20, 30] x [0, 20], Total Area = 400
    const res = xorRings([sqA], [sqB]);
    approx(shapeTotalArea(res), 400, 1e-3);
    const norm = normalizeRings(res);
    assert.equal(norm.length, 2);
  });

  it("subtracts a smaller shape to form a hole", () => {
    const big = makeSquare(40, 0, 0);
    const small = makeSquare(20, 10, 10);
    const res = differenceRings([big], [small]);

    approx(shapeTotalArea(res), 1600 - 400, 1e-3);
    const norm = normalizeRings(res);
    assert.equal(norm.length, 1);
    assert.equal(norm[0].holes.length, 1);
    assert.equal(ringOrientation(norm[0].outer), "ccw");
    assert.equal(ringOrientation(norm[0].holes[0]), "cw");
  });
});
