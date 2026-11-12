/**
 * ============================================================================
 * UNIT TESTS: PATH FLATTENING & RING NORMALIZATION (ROADMAP Phase 3D-027)
 * ============================================================================
 * Verifies:
 *   - Adaptive subdivision error <= tolerance on circles, S-curves, and glyphs.
 *   - Ring area and orientation calculations (CCW vs CW).
 *   - Normalization into { outer, holes } under both even-odd and non-zero rules.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BezPath, cubicEval, type Cubic } from "../../../geometry/bezpath";
import {
  closeRing,
  flattenPath,
  normalizeRings,
  ringArea,
  ringOrientation,
  signedRingArea,
  type Point2D,
  type Ring,
} from "../flatten";

function approx(actual: number, expected: number, tol = 1e-3, msg = ""): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} expected ${expected} ± ${tol}, got ${actual} (diff ${diff})`);
}

function distToPolyline(p: Point2D, ring: readonly Point2D[]): number {
  let minD = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy;
    let d = 0;
    if (l2 < 1e-12) {
      d = Math.hypot(p[0] - x0, p[1] - y0);
    } else {
      const t = Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / l2));
      const qx = x0 + t * dx;
      const qy = y0 + t * dy;
      d = Math.hypot(p[0] - qx, p[1] - qy);
    }
    if (d < minD) minD = d;
  }
  return minD;
}

describe("flatten: ringArea & ringOrientation", () => {
  it("computes exact signed and positive area for simple counter-clockwise square", () => {
    // CCW square: (0,0) -> (10,0) -> (10,10) -> (0,10) -> (0,0)
    const sqCCW: Ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    approx(signedRingArea(sqCCW), 100, 1e-5);
    approx(ringArea(sqCCW), 100, 1e-5);
    assert.equal(ringOrientation(sqCCW), "ccw");
  });

  it("computes negative signed area and clockwise orientation for reversed square", () => {
    // CW square: (0,0) -> (0,10) -> (10,10) -> (10,0) -> (0,0)
    const sqCW: Ring = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ];
    approx(signedRingArea(sqCW), -100, 1e-5);
    approx(ringArea(sqCW), 100, 1e-5);
    assert.equal(ringOrientation(sqCW), "cw");
  });

  it("closes unclosed ring correctly", () => {
    const unclosed: Ring = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    const closed = closeRing(unclosed);
    assert.equal(closed.length, 4);
    assert.deepEqual(closed[0], closed[3]);
  });
});

describe("flatten: adaptive tolerance error bounds", () => {
  it("approximates circle within requested tolerance", () => {
    // 4-cubic approximation of a circle with R = 50 centered at (0, 0)
    const R = 50;
    const k = (4 / 3) * (Math.SQRT2 - 1) * R;
    const path = new BezPath();
    path.moveTo({ x: R, y: 0 });
    path.curveTo({ x: R, y: k }, { x: k, y: R }, { x: 0, y: R });
    path.curveTo({ x: -k, y: R }, { x: -R, y: k }, { x: -R, y: 0 });
    path.curveTo({ x: -R, y: -k }, { x: -k, y: -R }, { x: 0, y: -R });
    path.curveTo({ x: k, y: -R }, { x: R, y: -k }, { x: R, y: 0 });
    path.closePath();

    const tol = 0.05;
    const rings = flattenPath(path, tol);
    assert.ok(rings.length > 0);
    const ring = rings[0];

    // Every flattened vertex on the circle must sit within tolerance of the radius R
    for (const [x, y] of ring) {
      const r = Math.hypot(x, y);
      approx(r, R, tol * 2, "Circle vertex radius deviation");
    }

    // Dense reference along true circle: 360 points
    for (let deg = 0; deg < 360; deg++) {
      const rad = (deg * Math.PI) / 180;
      const truePt: Point2D = [R * Math.cos(rad), R * Math.sin(rad)];
      const d = distToPolyline(truePt, ring);
      assert.ok(d <= tol + 0.02, `Circle deviation at ${deg}° was ${d} > ${tol}`);
    }
  });

  it("approximates an inflection-rich S-curve within requested tolerance", () => {
    // S-curve cubic: (0,0) -> (0, 100) -> (100, 0) -> (100, 100)
    const c: Cubic = {
      p0: { x: 0, y: 0 },
      p1: { x: 0, y: 100 },
      p2: { x: 100, y: 0 },
      p3: { x: 100, y: 100 },
    };
    const path = new BezPath();
    path.moveTo(c.p0);
    path.curveTo(c.p1, c.p2, c.p3);
    path.lineTo({ x: 0, y: 100 });
    path.closePath();

    const tol = 0.1;
    const rings = flattenPath(path, tol);
    assert.ok(rings.length > 0);
    const ring = rings[0];

    // Sample 500 points along the true cubic curve
    for (let i = 0; i <= 500; i++) {
      const t = i / 500;
      const pt = cubicEval(c, t);
      const d = distToPolyline([pt.x, pt.y], ring);
      assert.ok(d <= tol + 1e-3, `S-curve deviation at t=${t} was ${d} > ${tol}`);
    }
  });

  it("flattens a text-like glyph path ('B' contour with two holes) accurately", () => {
    // Glyphs like 'B' have an outer contour and two inner counter-holes
    const path = new BezPath();
    // Outer 'B' spine and lobes
    path.moveTo({ x: 0, y: 0 });
    path.lineTo({ x: 40, y: 0 });
    path.quadTo({ x: 60, y: 15 }, { x: 40, y: 30 });
    path.quadTo({ x: 65, y: 45 }, { x: 40, y: 60 });
    path.lineTo({ x: 0, y: 60 });
    path.closePath();

    // Bottom counter hole (CW)
    path.moveTo({ x: 10, y: 10 });
    path.lineTo({ x: 10, y: 25 });
    path.lineTo({ x: 30, y: 25 });
    path.lineTo({ x: 30, y: 10 });
    path.closePath();

    // Top counter hole (CW)
    path.moveTo({ x: 10, y: 35 });
    path.lineTo({ x: 10, y: 50 });
    path.lineTo({ x: 30, y: 50 });
    path.lineTo({ x: 30, y: 35 });
    path.closePath();

    const rings = flattenPath(path, 0.1, "nonzero");
    assert.equal(rings.length, 3); // 1 outer + 2 holes

    const norm = normalizeRings(rings, "nonzero");
    assert.equal(norm.length, 1);
    assert.equal(norm[0].holes.length, 2);
    assert.equal(ringOrientation(norm[0].outer), "ccw");
    assert.equal(ringOrientation(norm[0].holes[0]), "cw");
    assert.equal(ringOrientation(norm[0].holes[1]), "cw");
  });
});

describe("flatten: holes by both fill rules", () => {
  it("resolves nested rings correctly under evenodd vs nonzero", () => {
    // Outer square: 0..40 (CCW)
    const outer: Ring = [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
      [0, 0],
    ];
    // Inner square: 10..30 (also CCW, same orientation)
    const innerCCW: Ring = [
      [10, 10],
      [30, 10],
      [30, 30],
      [10, 30],
      [10, 10],
    ];

    // Under evenodd: inner square is a hole regardless of orientation
    const normEvenOdd = normalizeRings([outer, innerCCW], "evenodd");
    assert.equal(normEvenOdd.length, 1);
    assert.equal(normEvenOdd[0].holes.length, 1);
    approx(ringArea(normEvenOdd[0].outer), 1600, 1e-3);
    approx(ringArea(normEvenOdd[0].holes[0]), 400, 1e-3);
    assert.equal(ringOrientation(normEvenOdd[0].outer), "ccw");
    assert.equal(ringOrientation(normEvenOdd[0].holes[0]), "cw");

    // Under nonzero: if both are CCW, union preserves both without holes
    const normNonzeroSame = normalizeRings([outer, innerCCW], "nonzero");
    assert.equal(normNonzeroSame.length, 1);
    assert.equal(normNonzeroSame[0].holes.length, 0);

    // Under nonzero: if inner is reversed (CW), it creates a hole
    const innerCW = innerCCW.slice().reverse();
    const normNonzeroOpp = normalizeRings([outer, innerCW], "nonzero");
    assert.equal(normNonzeroOpp.length, 1);
    assert.equal(normNonzeroOpp[0].holes.length, 1);
    assert.equal(ringOrientation(normNonzeroOpp[0].outer), "ccw");
    assert.equal(ringOrientation(normNonzeroOpp[0].holes[0]), "cw");
  });
});
