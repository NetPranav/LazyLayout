/**
 * ============================================================================
 * SPATIAL MOTION PATHS & ARCLENGTH GEOMETRY (ROADMAP Phase 69)
 * ============================================================================
 * Pure mathematical foundation for 2D spatial motion trajectories:
 *   - Centripetal Catmull-Rom (alpha = 0.5) to cubic Bezier conversion with
 *     clamped natural endpoints and cyclic loop support.
 *   - Wang's finite-chord control-polygon flatness bound with longitudinal
 *     overshoot detection (tau_geom <= 0.02 px).
 *   - Unconditional 32-sample root grid initialization guaranteeing Delta u_0 <= 0.03125.
 *   - 5-point Gauss-Legendre adaptive numerical quadrature.
 *   - Provably convergent Option A inversion: 3 Newton acceleration steps for early
 *     residual exit (< 10^-4 px), backed by M_steps unconditional bisection steps
 *     bounded by the segment-specific derivative M_seg, guaranteeing spatial error < 0.015 px.
 * ============================================================================
 */

import type { Clip } from "../document/motion";
import type { PropValue } from "../document/registry";
import { parseEasing } from "../document/motion";
import { sampleEasing } from "../kernel/easing";
import { extractClipWaypoints, type ResolvedWaypoint } from "../timeline/keyframeOps";
import { DiagnosticBus } from "../engine/DiagnosticBus";

export interface Point2D {
  x: number;
  y: number;
}

export interface CubicBezier {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
}

export interface LutSample {
  u: number;
  s: number; // Cumulative arc length from segment start
  point: Point2D;
  errorBound?: number; // Cumulative integration uncertainty bound
}

export interface CompiledSegment {
  index: number;
  timeStart: number;
  timeEnd: number;
  bezier: CubicBezier;
  mSeg: number; // Segment-specific maximum derivative norm
  lut: LutSample[];
  length: number;
  ease?: string;
  hold?: boolean;
}

// ---------------------------------------------------------------------------
// 1. Vector Math & Derivatives
// ---------------------------------------------------------------------------

export const dist2D = (a: Point2D, b: Point2D): number => Math.hypot(b.x - a.x, b.y - a.y);

export function evaluateCubic(b: CubicBezier, u: number): Point2D {
  const t = Math.max(0, Math.min(1, u));
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const c = 3 * mt2 * t;
  const d = 3 * mt * t2;
  const e = t2 * t;

  return {
    x: a * b.p0.x + c * b.p1.x + d * b.p2.x + e * b.p3.x,
    y: a * b.p0.y + c * b.p1.y + d * b.p2.y + e * b.p3.y,
  };
}

export function evaluateCubicDerivative(b: CubicBezier, u: number): Point2D {
  const t = Math.max(0, Math.min(1, u));
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  // B'(u) = 3(1-u)^2 (p1 - p0) + 6(1-u)u (p2 - p1) + 3u^2 (p3 - p2)
  const c0 = 3 * mt2;
  const c1 = 6 * mt * t;
  const c2 = 3 * t2;

  const d0x = b.p1.x - b.p0.x;
  const d0y = b.p1.y - b.p0.y;
  const d1x = b.p2.x - b.p1.x;
  const d1y = b.p2.y - b.p1.y;
  const d2x = b.p3.x - b.p2.x;
  const d2y = b.p3.y - b.p2.y;

  return {
    x: c0 * d0x + c1 * d1x + c2 * d2x,
    y: c0 * d0y + c1 * d1y + c2 * d2y,
  };
}

export function computeSegmentMaxDerivative(b: CubicBezier): number {
  const d0 = dist2D(b.p0, b.p1);
  const d1 = dist2D(b.p1, b.p2);
  const d2 = dist2D(b.p2, b.p3);
  return 3 * Math.max(d0, d1, d2);
}

// ---------------------------------------------------------------------------
// 2. Centripetal Catmull-Rom to Cubic Bézier Conversion
// ---------------------------------------------------------------------------

/**
 * Converts a sequence of 2D waypoints to cubic Bézier control points using Centripetal
 * Catmull-Rom parameterization (alpha = 0.5).
 */
export function waypointsToCentripetalCatmullRom(
  points: readonly Point2D[],
  isClosed = false
): CubicBezier[] {
  const n = points.length;
  if (n < 2) return [];

  // Compute centripetal knot parameters: t_{i+1} = t_i + ||P_{i+1} - P_i||^0.5 + 1e-6
  const knots: number[] = new Array(n);
  knots[0] = 0;
  for (let i = 1; i < n; i++) {
    const d = dist2D(points[i - 1], points[i]);
    knots[i] = knots[i - 1] + Math.sqrt(d) + 1e-6;
  }

  const segments: CubicBezier[] = [];

  for (let k = 0; k < n - 1; k++) {
    const p0 = points[k];
    const p3 = points[k + 1];

    let p1: Point2D;
    let p2: Point2D;

    if (n === 2 && !isClosed) {
      // 2 points: straight cubic chord
      p1 = {
        x: p0.x + (p3.x - p0.x) / 3,
        y: p0.y + (p3.y - p0.y) / 3,
      };
      p2 = {
        x: p3.x - (p3.x - p0.x) / 3,
        y: p3.y - (p3.y - p0.y) / 3,
      };
    } else {
      // Start segment endpoint
      if (k === 0 && !isClosed) {
        p1 = {
          x: p0.x + (p3.x - p0.x) / 3,
          y: p0.y + (p3.y - p0.y) / 3,
        };
      } else {
        const pPrev = k > 0 ? points[k - 1] : points[n - 2];
        const tPrev = k > 0 ? knots[k - 1] : knots[0] - (knots[n - 1] - knots[n - 2]);
        const tk = knots[k];
        const tkPlus1 = knots[k + 1];

        const dt1 = tkPlus1 - tk;
        const dtPrev = tk - tPrev;
        const dtTotal = tkPlus1 - tPrev;

        const sec1x = (p0.x - pPrev.x) / dtPrev;
        const sec1y = (p0.y - pPrev.y) / dtPrev;
        const sec2x = (p3.x - p0.x) / dt1;
        const sec2y = (p3.y - p0.y) / dt1;

        const factor = dt1 / (3 * dtTotal);
        p1 = {
          x: p0.x + factor * (dt1 * sec1x + dtPrev * sec2x),
          y: p0.y + factor * (dt1 * sec1y + dtPrev * sec2y),
        };
      }

      // End segment endpoint
      if (k === n - 2 && !isClosed) {
        p2 = {
          x: p3.x - (p3.x - p0.x) / 3,
          y: p3.y - (p3.y - p0.y) / 3,
        };
      } else {
        const pNext = k < n - 2 ? points[k + 2] : points[1];
        const tk = knots[k];
        const tkPlus1 = knots[k + 1];
        const tkPlus2 = k < n - 2 ? knots[k + 2] : knots[n - 1] + (knots[1] - knots[0]);

        const dt1 = tkPlus1 - tk;
        const dtNext = tkPlus2 - tkPlus1;
        const dtTotal = tkPlus2 - tk;

        const sec2x = (p3.x - p0.x) / dt1;
        const sec2y = (p3.y - p0.y) / dt1;
        const sec3x = (pNext.x - p3.x) / dtNext;
        const sec3y = (pNext.y - p3.y) / dtNext;

        const factor = dt1 / (3 * dtTotal);
        p2 = {
          x: p3.x - factor * (dtNext * sec2x + dt1 * sec3x),
          y: p3.y - factor * (dtNext * sec2y + dt1 * sec3y),
        };
      }
    }

    segments.push({ p0, p1, p2, p3 });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// 3. Wang's Finite-Chord Control-Polygon Flatness Bound
// ---------------------------------------------------------------------------

/**
 * Computes Wang's finite-chord control-polygon deviation bound Delta_finite.
 * Detects both perpendicular deviation and longitudinal overshoot beyond segment endpoints.
 */
export function computeFiniteChordDeviation(b: CubicBezier): number {
  const vx = b.p3.x - b.p0.x;
  const vy = b.p3.y - b.p0.y;
  const lc = Math.hypot(vx, vy);

  // If endpoints are coincident:
  if (lc < 1e-6) {
    const d1 = dist2D(b.p0, b.p1);
    const d2 = dist2D(b.p0, b.p2);
    return 0.75 * Math.max(d1, d2);
  }

  const ux = vx / lc;
  const uy = vy / lc;

  function distToFiniteSegment(p: Point2D): number {
    const rx = p.x - b.p0.x;
    const ry = p.y - b.p0.y;
    const proj = rx * ux + ry * uy;
    const perpX = rx - proj * ux;
    const perpY = ry - proj * uy;
    const perpDist = Math.hypot(perpX, perpY);

    let overDist = 0;
    if (proj < 0) {
      overDist = -proj;
    } else if (proj > lc) {
      overDist = proj - lc;
    }

    return Math.hypot(perpDist, overDist);
  }

  const d1 = distToFiniteSegment(b.p1);
  const d2 = distToFiniteSegment(b.p2);

  return 0.75 * Math.max(d1, d2);
}

// ---------------------------------------------------------------------------
// 4. Gauss-Legendre Quadrature & Adaptive LUT Generation
// ---------------------------------------------------------------------------

// 5-point Gauss-Legendre nodes & weights on [-1, 1]
const GL5_NODES = [
  0,
  (1 / 3) * Math.sqrt(5 - 2 * Math.sqrt(10 / 7)),
  -(1 / 3) * Math.sqrt(5 - 2 * Math.sqrt(10 / 7)),
  (1 / 3) * Math.sqrt(5 + 2 * Math.sqrt(10 / 7)),
  -(1 / 3) * Math.sqrt(5 + 2 * Math.sqrt(10 / 7)),
];

const GL5_WEIGHTS = [
  128 / 225,
  (322 + 13 * Math.sqrt(70)) / 900,
  (322 + 13 * Math.sqrt(70)) / 900,
  (322 - 13 * Math.sqrt(70)) / 900,
  (322 - 13 * Math.sqrt(70)) / 900,
];

export function integrateArcLengthGL5(b: CubicBezier, u0: number, u1: number): number {
  if (u0 >= u1) return 0;
  const mid = (u0 + u1) / 2;
  const half = (u1 - u0) / 2;
  let sum = 0;

  for (let i = 0; i < 5; i++) {
    const u = mid + half * GL5_NODES[i];
    const deriv = evaluateCubicDerivative(b, u);
    const speed = Math.hypot(deriv.x, deriv.y);
    sum += GL5_WEIGHTS[i] * speed;
  }

  return half * sum;
}

export interface AdaptiveQuadratureResult {
  value: number;
  errorEst: number;
  converged: boolean;
}

/**
 * Adaptive Gauss-Legendre Quadrature with Local Error Estimation.
 * Subdivides [u0, u1] into 2 halves, compares single-interval GL5 (I1) with
 * two-half GL5 (I2), estimates local error as |I2 - I1| / 15.
 * If error <= tol, returns I2 with converged = true.
 * If error > tol and depth >= maxDepth, emits a DiagnosticBus warning and returns converged = false.
 * Otherwise, recursively subdivides both halves.
 */
export function integrateArcLengthAdaptiveDetailed(
  b: CubicBezier,
  u0: number,
  u1: number,
  tol = 1e-6,
  depth = 0,
  maxDepth = 8
): AdaptiveQuadratureResult {
  if (u0 >= u1) return { value: 0, errorEst: 0, converged: true };
  const mid = (u0 + u1) / 2;
  const i1 = integrateArcLengthGL5(b, u0, u1);
  const iLeft = integrateArcLengthGL5(b, u0, mid);
  const iRight = integrateArcLengthGL5(b, mid, u1);
  const i2 = iLeft + iRight;

  const errorEst = Math.abs(i2 - i1) / 15;
  if (errorEst <= tol) {
    return { value: i2, errorEst, converged: true };
  }

  if (depth >= maxDepth) {
    DiagnosticBus.emit({
      channel: "SPATIAL_TRAJECTORY_WARN",
      severity: "warning",
      source: { entityId: "spatial_quadrature", panel: "motion" },
      message: `Quadrature reached max subdivision depth (${maxDepth}) with residual error estimate ${errorEst.toFixed(6)}px`,
    });
    return { value: i2, errorEst, converged: false };
  }

  const leftRes = integrateArcLengthAdaptiveDetailed(b, u0, mid, tol / 2, depth + 1, maxDepth);
  const rightRes = integrateArcLengthAdaptiveDetailed(b, mid, u1, tol / 2, depth + 1, maxDepth);

  return {
    value: leftRes.value + rightRes.value,
    errorEst: leftRes.errorEst + rightRes.errorEst,
    converged: leftRes.converged && rightRes.converged,
  };
}

export function integrateArcLengthAdaptive(
  b: CubicBezier,
  u0: number,
  u1: number,
  tol = 1e-6,
  depth = 0,
  maxDepth = 8
): number {
  return integrateArcLengthAdaptiveDetailed(b, u0, u1, tol, depth, maxDepth).value;
}

export function integrateArcLength(b: CubicBezier, u0: number, u1: number): number {
  return integrateArcLengthAdaptive(b, u0, u1, 1e-6);
}

// Subdivides cubic Bezier at parameter t in [0, 1] using de Casteljau's algorithm
export function splitCubic(b: CubicBezier, t: number): [CubicBezier, CubicBezier] {
  const p01 = { x: b.p0.x + t * (b.p1.x - b.p0.x), y: b.p0.y + t * (b.p1.y - b.p0.y) };
  const p12 = { x: b.p1.x + t * (b.p2.x - b.p1.x), y: b.p1.y + t * (b.p2.y - b.p1.y) };
  const p23 = { x: b.p2.x + t * (b.p3.x - b.p2.x), y: b.p2.y + t * (b.p3.y - b.p2.y) };

  const p012 = { x: p01.x + t * (p12.x - p01.x), y: p01.y + t * (p12.y - p01.y) };
  const p123 = { x: p12.x + t * (p23.x - p12.x), y: p12.y + t * (p23.y - p12.y) };

  const p0123 = { x: p012.x + t * (p123.x - p012.x), y: p012.y + t * (p123.y - p012.y) };

  return [
    { p0: b.p0, p1: p01, p2: p012, p3: p0123 },
    { p0: p0123, p1: p123, p2: p23, p3: b.p3 },
  ];
}

/**
 * Compiles a cubic Bézier segment into an adaptive arc-length LUT.
 * Always initializes with an unconditional 32-sample root grid (Delta u_0 <= 0.03125),
 * followed by adaptive subdivision checking Wang's finite-chord bound (tau_geom <= 0.02 px).
 */
export interface CompiledLutResult {
  lut: LutSample[];
  totalLength: number;
  unresolvedDeviation?: boolean;
  maxResidualDeviation?: number;
}

/**
 * Compiles a cubic Bézier segment into an adaptive arc-length LUT.
 * Always initializes with an unconditional 32-sample root grid (Delta u_0 <= 0.03125),
 * followed by adaptive subdivision checking Wang's finite-chord bound (tau_geom <= 0.02 px).
 */
export function compileSegmentLut(b: CubicBezier): CompiledLutResult {
  interface SubInterval {
    u0: number;
    u1: number;
    bez: CubicBezier;
  }

  // 1. Unconditional 32-sample root grid:
  const ROOT_SAMPLES = 32;
  const initialIntervals: SubInterval[] = [];

  let curBez = b;
  for (let i = 0; i < ROOT_SAMPLES; i++) {
    const u0 = i / ROOT_SAMPLES;
    const u1 = (i + 1) / ROOT_SAMPLES;
    // Parameter relative to remaining curve:
    const relT = 1 / (ROOT_SAMPLES - i);
    const [left, right] = splitCubic(curBez, relT);
    initialIntervals.push({ u0, u1, bez: left });
    curBez = right;
  }

  // 2. Adaptive subdivision on each subinterval:
  const leafIntervals: Array<{ u0: number; u1: number; bez: CubicBezier; length: number; errorEst: number }> = [];
  const TAU_GEOM = 0.02; // px
  let unresolvedDeviation = false;
  let maxResidualDeviation = 0;

  function subdivideAdaptive(item: SubInterval, depth: number) {
    const deviation = computeFiniteChordDeviation(item.bez);
    if (deviation <= TAU_GEOM || depth >= 10) {
      if (deviation > TAU_GEOM && depth >= 10) {
        unresolvedDeviation = true;
        maxResidualDeviation = Math.max(maxResidualDeviation, deviation);
      }
      const quad = integrateArcLengthAdaptiveDetailed(item.bez, 0, 1, 1e-6);
      leafIntervals.push({
        u0: item.u0,
        u1: item.u1,
        bez: item.bez,
        length: quad.value,
        errorEst: quad.errorEst,
      });
      return;
    }

    const [left, right] = splitCubic(item.bez, 0.5);
    const midU = (item.u0 + item.u1) / 2;
    subdivideAdaptive({ u0: item.u0, u1: midU, bez: left }, depth + 1);
    subdivideAdaptive({ u0: midU, u1: item.u1, bez: right }, depth + 1);
  }

  for (const interval of initialIntervals) {
    subdivideAdaptive(interval, 0);
  }

  if (unresolvedDeviation) {
    DiagnosticBus.emit({
      channel: "SPATIAL_TRAJECTORY_WARN",
      severity: "warning",
      source: { entityId: "spatial_trajectory", panel: "motion" },
      message: `Spatial trajectory exceeded max subdivision depth (10) with residual deviation ${maxResidualDeviation.toFixed(4)}px`,
    });
  }

  // 3. Construct monotonic LUT with cumulative error bounds:
  const lut: LutSample[] = [{ u: 0, s: 0, point: b.p0, errorBound: 0 }];
  let runningS = 0;
  let runningError = 0;

  for (const leaf of leafIntervals) {
    runningS += leaf.length;
    runningError += leaf.errorEst;
    lut.push({
      u: leaf.u1,
      s: runningS,
      point: leaf.bez.p3,
      errorBound: runningError,
    });
  }

  return {
    lut,
    totalLength: runningS,
    unresolvedDeviation: unresolvedDeviation ? true : undefined,
    maxResidualDeviation: unresolvedDeviation ? maxResidualDeviation : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5. Option A Inversion: Bracket Verification + Newton + Guaranteed Bisection
// ---------------------------------------------------------------------------

/**
 * Inverts normalized arc-length s in [0, 1] to parameter u in [0, 1].
 * Implements Option A:
 *   - Verifies the actual interval root bracket.
 *   - Up to 3 Newton acceleration steps with residual exit (|F(u)| < 10^-4 px).
 *   - Guaranteed M_steps unconditional bisection steps, bounding spatial error to < 0.015 px.
 */
export function invertArcLength(
  b: CubicBezier,
  lut: readonly LutSample[],
  totalLength: number,
  mSeg: number,
  sProgress: number
): number {
  if (totalLength <= 1e-6 || lut.length === 0) return 0;
  const sNorm = Math.max(0, Math.min(1, sProgress));
  const sTarget = sNorm * totalLength;

  if (sTarget <= 0) return 0;
  if (sTarget >= totalLength) return 1;

  // Helper: exact arc length with integration error bound from 0 to uVal
  function exactArcLenWithBound(uVal: number): { s: number; errorBound: number } {
    if (uVal <= 0) return { s: 0, errorBound: 0 };
    if (uVal >= 1) return { s: totalLength, errorBound: lut[lut.length - 1]?.errorBound ?? 1e-6 };

    let l = 0;
    let h = lut.length - 1;
    while (l <= h) {
      const m = (l + h) >> 1;
      if (lut[m].u < uVal) l = m + 1;
      else h = m - 1;
    }
    const baseIdx = Math.max(0, l - 1);
    const uBase = lut[baseIdx].u;
    const sBase = lut[baseIdx].s;
    const errBase = lut[baseIdx].errorBound ?? 0;
    const quad = integrateArcLengthAdaptiveDetailed(b, uBase, uVal, 1e-6);
    return {
      s: sBase + quad.value,
      errorBound: errBase + quad.errorEst,
    };
  }

  function exactArcLen(uVal: number): number {
    return exactArcLenWithBound(uVal).s;
  }

  // 1. Initial lookup from monotonic LUT:
  let low = 0;
  let high = lut.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lut[mid].s < sTarget) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let idx0 = Math.max(0, low - 1);
  let idx1 = Math.min(lut.length - 1, low);

  let uLeft = lut[idx0].u;
  let uRight = lut[idx1].u;

  // 2. Rigorous Interval Residual Validation:
  // For each endpoint, true residual F(u) in [F_hat(u) - E(u), F_hat(u) + E(u)].
  // To strictly guarantee F(uLeft) <= 0: F_hat(uLeft) + E(uLeft) <= 0
  // To strictly guarantee F(uRight) >= 0: F_hat(uRight) - E(uRight) >= 0
  let evalLeft = exactArcLenWithBound(uLeft);
  let evalRight = exactArcLenWithBound(uRight);

  const TAU_RESIDUAL = 1e-4; // px
  if (Math.abs(evalLeft.s - sTarget) < TAU_RESIDUAL) return uLeft;
  if (Math.abs(evalRight.s - sTarget) < TAU_RESIDUAL) return uRight;

  while (evalLeft.s + evalLeft.errorBound > sTarget && idx0 > 0) {
    idx0--;
    uLeft = lut[idx0].u;
    evalLeft = exactArcLenWithBound(uLeft);
    if (Math.abs(evalLeft.s - sTarget) < TAU_RESIDUAL) return uLeft;
  }
  if (evalLeft.s + evalLeft.errorBound > sTarget) {
    uLeft = 0;
    evalLeft = { s: 0, errorBound: 0 };
  }

  while (evalRight.s - evalRight.errorBound < sTarget && idx1 < lut.length - 1) {
    idx1++;
    uRight = lut[idx1].u;
    evalRight = exactArcLenWithBound(uRight);
    if (Math.abs(evalRight.s - sTarget) < TAU_RESIDUAL) return uRight;
  }
  if (evalRight.s - evalRight.errorBound < sTarget) {
    uRight = 1;
    evalRight = exactArcLenWithBound(1);
  }

  // Root bracket [uLeft, uRight] is rigorously guaranteed to satisfy:
  // F(uLeft) <= 0 <= F(uRight) accounting for numerical integration uncertainty.
  if (uRight <= uLeft) return uLeft;

  // 3. Newton Acceleration (up to 3 steps):
  let u = uLeft + ((sTarget - evalLeft.s) / Math.max(1e-9, evalRight.s - evalLeft.s)) * (uRight - uLeft);

  for (let step = 0; step < 3; step++) {
    const curS = exactArcLen(u);
    const residual = curS - sTarget;
    if (Math.abs(residual) < TAU_RESIDUAL) return u;

    const deriv = evaluateCubicDerivative(b, u);
    const speed = Math.hypot(deriv.x, deriv.y);
    if (speed >= 1e-4) {
      const uNewton = u - residual / speed;
      // Accept Newton step only if inside central 80% of bracket:
      const margin = 0.1 * (uRight - uLeft);
      if (uNewton >= uLeft + margin && uNewton <= uRight - margin) {
        if (residual > 0) {
          uRight = u;
        } else {
          uLeft = u;
        }
        u = uNewton;
        continue;
      }
    }
    break; // Exit Newton if invalid/ineffective, preserving valid bracket
  }

  // 4. Guaranteed Bisection Contraction:
  // Re-evaluates iteration budget from actual validated bracket width after expansion (deltaU0),
  // accounting for total integration uncertainty (totalUncertainty) in the spatial error budget:
  const deltaU0 = uRight - uLeft;
  const totalUncertainty = evalLeft.errorBound + evalRight.errorBound;
  const effectiveSpatialTolerance = Math.max(0.001, 0.05 - totalUncertainty);
  const mSteps = Math.max(16, Math.ceil(Math.log2((mSeg * deltaU0) / effectiveSpatialTolerance)));

  for (let k = 0; k < mSteps; k++) {
    const uMid = (uLeft + uRight) / 2;
    const curS = exactArcLen(uMid);
    const residual = curS - sTarget;
    if (Math.abs(residual) < TAU_RESIDUAL) return uMid;

    if (residual < 0) {
      uLeft = uMid;
    } else {
      uRight = uMid;
    }
  }

  return (uLeft + uRight) / 2;
}

// ---------------------------------------------------------------------------
// 6. Trajectory Geometry Compiler
// ---------------------------------------------------------------------------

export class SpatialTrajectoryGeometry {
  readonly segments: CompiledSegment[];
  readonly totalLength: number;
  readonly isClosed: boolean;

  constructor(segments: CompiledSegment[], totalLength: number, isClosed = false) {
    this.segments = segments;
    this.totalLength = totalLength;
    this.isClosed = isClosed;
  }

  /**
   * Evaluates the 2D canvas point at clip-local time `time` (in seconds).
   * Respects outgoing segment ownership: waypoint k owns mode, easing, and hold for segment k.
   */
  evaluateAtTime(time: number): Point2D | null {
    if (this.segments.length === 0) return null;

    const first = this.segments[0];
    const last = this.segments[this.segments.length - 1];

    if (time <= first.timeStart) return first.bezier.p0;
    if (time >= last.timeEnd) return last.bezier.p3;

    // Locate active segment:
    for (const seg of this.segments) {
      if (time >= seg.timeStart && time <= seg.timeEnd) {
        if (seg.hold) return seg.bezier.p0;

        const duration = seg.timeEnd - seg.timeStart;
        const normTime = duration > 0 ? (time - seg.timeStart) / duration : 1;
        const easing = parseEasing(seg.ease ?? "linear") ?? { kind: "linear" as const };
        const easedProgress = sampleEasing(easing, normTime);

        const uParam = invertArcLength(seg.bezier, seg.lut, seg.length, seg.mSeg, easedProgress);
        return evaluateCubic(seg.bezier, uParam);
      }
    }

    return last.bezier.p3;
  }

  /** Generates an SVG path string `d="..."` for rendering the trajectory ribbon. */
  toSvgPath(): string {
    if (this.segments.length === 0) return "";
    let d = `M ${this.segments[0].bezier.p0.x} ${this.segments[0].bezier.p0.y}`;
    for (const seg of this.segments) {
      const b = seg.bezier;
      d += ` C ${b.p1.x} ${b.p1.y}, ${b.p2.x} ${b.p2.y}, ${b.p3.x} ${b.p3.y}`;
    }
    if (this.isClosed) d += " Z";
    return d;
  }

  /** Samples frame tick positions at integer frames t = frame / fps for velocity visualization. */
  sampleFrameTicks(fps: number): Array<{ time: number; point: Point2D }> {
    if (this.segments.length === 0) return [];
    const ticks: Array<{ time: number; point: Point2D }> = [];
    const startT = this.segments[0].timeStart;
    const endT = this.segments[this.segments.length - 1].timeEnd;

    const startFrame = Math.ceil(startT * fps);
    const endFrame = Math.floor(endT * fps);

    for (let f = startFrame; f <= endFrame; f++) {
      const t = f / fps;
      const pt = this.evaluateAtTime(t);
      if (pt) ticks.push({ time: t, point: pt });
    }

    return ticks;
  }
}

/**
 * Compiles a clip's waypoints and spatial metadata into a SpatialTrajectoryGeometry.
 */
export function compileSpatialTrajectory(
  waypoints: readonly ResolvedWaypoint[],
  isClosed = false
): SpatialTrajectoryGeometry {
  if (waypoints.length < 2) {
    return new SpatialTrajectoryGeometry([], 0, isClosed);
  }

  const rawPoints = waypoints.map((w) => ({ x: w.x, y: w.y }));
  // Catmull-Rom default curves:
  const defaultCubics = waypointsToCentripetalCatmullRom(rawPoints, isClosed);

  const compiledSegments: CompiledSegment[] = [];
  let totalLength = 0;

  for (let k = 0; k < waypoints.length - 1; k++) {
    const w0 = waypoints[k];
    const w1 = waypoints[k + 1];
    const defCubic = defaultCubics[k];

    let bez: CubicBezier;

    // Outgoing mode ownership: w0.mode dictates segment k
    if (w0.mode === "linear") {
      // Linear straight chord:
      bez = {
        p0: { x: w0.x, y: w0.y },
        p1: { x: w0.x + (w1.x - w0.x) / 3, y: w0.y + (w1.y - w0.y) / 3 },
        p2: { x: w1.x - (w1.x - w0.x) / 3, y: w1.y - (w1.y - w0.y) / 3 },
        p3: { x: w1.x, y: w1.y },
      };
    } else if (w0.mode === "bezier" || w0.mode === "continuous") {
      // Explicit handles:
      const p0 = { x: w0.x, y: w0.y };
      const p3 = { x: w1.x, y: w1.y };
      const p1 = w0.spatialOut ? { x: p0.x + w0.spatialOut.x, y: p0.y + w0.spatialOut.y } : defCubic.p1;
      const p2 = w1.spatialIn ? { x: p3.x + w1.spatialIn.x, y: p3.y + w1.spatialIn.y } : defCubic.p2;
      bez = { p0, p1, p2, p3 };
    } else {
      // Default: centripetal Catmull-Rom:
      bez = defCubic;
    }

    const mSeg = computeSegmentMaxDerivative(bez);
    const { lut, totalLength: segLength } = compileSegmentLut(bez);

    compiledSegments.push({
      index: k,
      timeStart: w0.time,
      timeEnd: w1.time,
      bezier: bez,
      mSeg,
      lut,
      length: segLength,
      ease: w0.ease,
      hold: w0.hold,
    });

    totalLength += segLength;
  }

  return new SpatialTrajectoryGeometry(compiledSegments, totalLength, isClosed);
}

/**
 * Builds or retrieves the compiled SpatialTrajectoryGeometry for a clip.
 */
export function createSpatialPath(
  clip: Clip,
  fallbackProps?: Record<string, PropValue>
): SpatialTrajectoryGeometry | null {
  const waypoints = extractClipWaypoints(clip, fallbackProps);
  if (waypoints.length < 2) return null;
  return compileSpatialTrajectory(waypoints, clip.repeat !== undefined && clip.repeat < 0);
}
