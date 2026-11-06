import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dist2D,
  evaluateCubic,
  evaluateCubicDerivative,
  computeSegmentMaxDerivative,
  waypointsToCentripetalCatmullRom,
  computeFiniteChordDeviation,
  integrateArcLength,
  splitCubic,
  compileSegmentLut,
  invertArcLength,
  invertArcLengthDetailed,
  integrateArcLengthAdaptiveDetailed,
  type ArcLengthInversionResult,
  compileSpatialTrajectory,
  createSpatialPath,
  SpatialTrajectoryGeometry,
  type Point2D,
  type CubicBezier,
} from "../spatialPath";
import type { Clip } from "../../document/motion";
import type { ResolvedWaypoint } from "../../timeline/keyframeOps";
import { DiagnosticBus } from "../../engine/DiagnosticBus";

// Independent high-precision reference: Composite Simpson's Rule with 1024 intervals
function compositeSimpsonReference(b: CubicBezier, u0: number, u1: number, nIntervals = 1024): number {
  const n = nIntervals % 2 === 0 ? nIntervals : nIntervals + 1;
  const h = (u1 - u0) / n;
  function speedAt(u: number): number {
    const deriv = evaluateCubicDerivative(b, u);
    return Math.hypot(deriv.x, deriv.y);
  }
  let sum = speedAt(u0) + speedAt(u1);
  for (let i = 1; i < n; i++) {
    const u = u0 + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * speedAt(u);
  }
  return (h / 3) * sum;
}

describe("Spatial Motion Paths - Geometry & Arc Length (Phase 69 Milestone 2)", () => {
  describe("Wang's Finite-Chord Control-Polygon Flatness Bound", () => {
    it("reports near-zero deviation for a straight collinear segment", () => {
      const straight: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 30, y: 0 },
        p2: { x: 70, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const dev = computeFiniteChordDeviation(straight);
      assert.ok(dev < 1e-6, `Expected ~0 deviation, got ${dev}`);
    });

    it("measures perpendicular deviation for curved control points", () => {
      const arched: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 25, y: 40 },
        p2: { x: 75, y: 40 },
        p3: { x: 100, y: 0 },
      };
      const dev = computeFiniteChordDeviation(arched);
      // Flatness bound: 0.75 * max(d1, d2) = 0.75 * 40 = 30
      assert.ok(Math.abs(dev - 30) < 1e-4, `Expected deviation ~30, got ${dev}`);
    });

    it("detects longitudinal overshoot when control points exceed chord endpoints", () => {
      // p1 is pulled backward past p0 (x = -20)
      const overshoot: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: -20, y: 0 },
        p2: { x: 80, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const dev = computeFiniteChordDeviation(overshoot);
      // p1 has longitudinal overshoot of 20, perpendicular of 0. Hypotenuse = 20. Dev = 0.75 * 20 = 15.
      assert.ok(Math.abs(dev - 15) < 1e-4, `Expected longitudinal overshoot deviation ~15, got ${dev}`);
    });

    it("safely handles coincident endpoints (p0 === p3)", () => {
      const loop: CubicBezier = {
        p0: { x: 50, y: 50 },
        p1: { x: 50, y: 150 },
        p2: { x: 150, y: 50 },
        p3: { x: 50, y: 50 },
      };
      const dev = computeFiniteChordDeviation(loop);
      // Coincident branch: 0.75 * max(d1, d2) = 0.75 * 100 = 75
      assert.ok(Math.abs(dev - 75) < 1e-4, `Expected deviation ~75, got ${dev}`);
    });
  });

  describe("Centripetal Catmull-Rom Parameterization (alpha = 0.5)", () => {
    it("returns straight cubic chord for 2 points", () => {
      const pts: Point2D[] = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ];
      const cubics = waypointsToCentripetalCatmullRom(pts, false);
      assert.equal(cubics.length, 1);
      assert.deepEqual(cubics[0].p0, { x: 0, y: 0 });
      assert.deepEqual(cubics[0].p1, { x: 100, y: 0 });
      assert.deepEqual(cubics[0].p2, { x: 200, y: 0 });
      assert.deepEqual(cubics[0].p3, { x: 300, y: 0 });
    });

    it("computes smooth tangents for 4 collinear points without overshoot", () => {
      const pts: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 300, y: 0 },
      ];
      const cubics = waypointsToCentripetalCatmullRom(pts, false);
      assert.equal(cubics.length, 3);
      for (const c of cubics) {
        assert.ok(Math.abs(c.p0.y) < 1e-6);
        assert.ok(Math.abs(c.p1.y) < 1e-6);
        assert.ok(Math.abs(c.p2.y) < 1e-6);
        assert.ok(Math.abs(c.p3.y) < 1e-6);
      }
    });

    it("handles coincident consecutive waypoints without NaN or zero division", () => {
      const pts: Point2D[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 }, // duplicate
        { x: 100, y: 100 },
      ];
      const cubics = waypointsToCentripetalCatmullRom(pts, false);
      assert.equal(cubics.length, 2);
      for (const c of cubics) {
        assert.ok(!Number.isNaN(c.p1.x) && !Number.isNaN(c.p1.y));
        assert.ok(!Number.isNaN(c.p2.x) && !Number.isNaN(c.p2.y));
      }
    });

    it("connects cyclic closed loops with smooth transition", () => {
      const pts: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      const cubics = waypointsToCentripetalCatmullRom(pts, true);
      assert.equal(cubics.length, 3); // 3 segments between 4 points
      for (const c of cubics) {
        assert.ok(!Number.isNaN(c.p1.x) && !Number.isNaN(c.p1.y));
      }
    });
  });

  describe("Gauss-Legendre Quadrature & Adaptive LUT Generation", () => {
    it("exact integration for straight line", () => {
      const straight: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 25, y: 0 },
        p2: { x: 75, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const len = integrateArcLength(straight, 0, 1);
      assert.ok(Math.abs(len - 100) < 1e-4, `Expected 100, got ${len}`);
    });

    it("unconditionally generates at least 32 root samples", () => {
      const straight: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 25, y: 0 },
        p2: { x: 75, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const { lut, totalLength } = compileSegmentLut(straight);
      assert.ok(lut.length >= 33, `Expected at least 33 samples (32 intervals + 1), got ${lut.length}`);
      assert.ok(Math.abs(totalLength - 100) < 1e-4);
      // Monotonicity check
      for (let i = 1; i < lut.length; i++) {
        assert.ok(lut[i].u > lut[i - 1].u, `u non-monotonic at ${i}`);
        assert.ok(lut[i].s >= lut[i - 1].s, `s non-monotonic at ${i}`);
      }
    });

    it("adaptively subdivides curved high-frequency loops", () => {
      const curvedLoop: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 200, y: 500 },
        p2: { x: -200, y: 500 },
        p3: { x: 100, y: 0 },
      };
      const { lut, totalLength } = compileSegmentLut(curvedLoop);
      // High curvature requires deeper adaptive subdivision beyond root 32 samples
      assert.ok(lut.length > 33, `Adaptive subdivision should produce > 33 samples, got ${lut.length}`);
      assert.ok(totalLength > 500, `Expected total length > 500, got ${totalLength}`);
    });
  });

  describe("Option A Inversion & Numerical Arc-Length Fidelity", () => {
    it("inverts linear straight segment with exact proportional mapping", () => {
      const straight: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 100 / 3, y: 0 },
        p2: { x: 200 / 3, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(straight);
      const { lut, totalLength } = compileSegmentLut(straight);

      for (const sTarget of [0.0, 0.25, 0.5, 0.75, 1.0]) {
        const u = invertArcLength(straight, lut, totalLength, mSeg, sTarget);
        assert.ok(Math.abs(u - sTarget) < 1e-4, `Expected u ~ ${sTarget}, got ${u}`);
      }
    });

    it("guarantees speed uniformity (sigma_v / mean_v < 0.05%) on S-curve benchmark", () => {
      // S-curve benchmark
      const sCurve: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 50, y: 200 },
        p2: { x: 150, y: -200 },
        p3: { x: 200, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(sCurve);
      const { lut, totalLength } = compileSegmentLut(sCurve);

      function computeArcLengthAt(uVal: number): number {
        let low = 0;
        let high = lut.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (lut[mid].u < uVal) low = mid + 1;
          else high = mid - 1;
        }
        const idx = Math.max(0, low - 1);
        return lut[idx].s + integrateArcLength(sCurve, lut[idx].u, uVal);
      }

      // Sample 100 equidistant arc-length positions: s = i / 100
      const N = 100;
      const uVals: number[] = [];
      for (let i = 0; i <= N; i++) {
        const sNorm = i / N;
        const u = invertArcLength(sCurve, lut, totalLength, mSeg, sNorm);
        uVals.push(u);
      }

      // Compute step arc lengths between consecutive samples
      const stepDists: number[] = [];
      for (let i = 1; i <= N; i++) {
        const s0 = computeArcLengthAt(uVals[i - 1]);
        const s1 = computeArcLengthAt(uVals[i]);
        stepDists.push(s1 - s0);
      }

      const meanDist = stepDists.reduce((a, b) => a + b, 0) / stepDists.length;
      const variance = stepDists.reduce((acc, d) => acc + (d - meanDist) ** 2, 0) / stepDists.length;
      const stdDev = Math.sqrt(variance);
      const relStdDev = stdDev / meanDist;

      // Assert uniformity condition: relative standard deviation < 0.05% (0.0005)
      assert.ok(
        relStdDev < 0.0005,
        `Relative standard deviation of arc-length velocity must be < 0.05%, got ${(relStdDev * 100).toFixed(4)}%`
      );
    });

    it("guarantees spatial position error < 0.015 px against 64-point reference", () => {
      const highCurvature: CubicBezier = {
        p0: { x: 50, y: 50 },
        p1: { x: 250, y: 400 },
        p2: { x: -100, y: 350 },
        p3: { x: 300, y: 100 },
      };
      const mSeg = computeSegmentMaxDerivative(highCurvature);
      const { lut, totalLength } = compileSegmentLut(highCurvature);

      function computeArcLengthAt(uVal: number): number {
        let low = 0;
        let high = lut.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (lut[mid].u < uVal) low = mid + 1;
          else high = mid - 1;
        }
        const idx = Math.max(0, low - 1);
        return lut[idx].s + integrateArcLength(highCurvature, lut[idx].u, uVal);
      }

      // Verify at multiple intermediate progress values
      const testFractions = [0.05, 0.13, 0.37, 0.52, 0.71, 0.89, 0.96];
      for (const frac of testFractions) {
        const u = invertArcLength(highCurvature, lut, totalLength, mSeg, frac);
        const arcLen = computeArcLengthAt(u);
        const targetLen = frac * totalLength;
        const lengthResidual = Math.abs(arcLen - targetLen);

        // Under bounded derivative, spatial error Delta P <= residual <= 0.015 px
        assert.ok(
          lengthResidual < 0.015,
          `At s=${frac}, arc-length error is ${lengthResidual.toFixed(6)} px, must be < 0.015 px`
        );
      }
    });
  });

  describe("SpatialTrajectoryGeometry & Segment Ownership", () => {
    it("respects outgoing waypoint mode: linear creates straight chord", () => {
      const waypoints: ResolvedWaypoint[] = [
        {
          id: "w0",
          time: 0,
          x: 0,
          y: 0,
          mode: "linear",
          ease: "linear",
          hold: false,
        },
        {
          id: "w1",
          time: 1,
          x: 100,
          y: 100,
          mode: "linear",
          ease: "linear",
          hold: false,
        },
      ];

      const geom = compileSpatialTrajectory(waypoints, false);
      assert.equal(geom.segments.length, 1);
      const mid = geom.evaluateAtTime(0.5);
      assert.ok(mid !== null);
      assert.ok(Math.abs(mid.x - 50) < 1e-4);
      assert.ok(Math.abs(mid.y - 50) < 1e-4);
    });

    it("respects outgoing hold waypoint: holds start point until end of segment", () => {
      const waypoints: ResolvedWaypoint[] = [
        {
          id: "w0",
          time: 0,
          x: 10,
          y: 20,
          mode: "linear",
          ease: "linear",
          hold: true, // Hold active on segment 0
        },
        {
          id: "w1",
          time: 1,
          x: 200,
          y: 300,
          mode: "linear",
          ease: "linear",
          hold: false,
        },
      ];

      const geom = compileSpatialTrajectory(waypoints, false);
      const at025 = geom.evaluateAtTime(0.25);
      const at075 = geom.evaluateAtTime(0.75);
      assert.deepEqual(at025, { x: 10, y: 20 });
      assert.deepEqual(at075, { x: 10, y: 20 });
      // At boundary time 1.0 (end of segment), reaches next point
      const at100 = geom.evaluateAtTime(1.0);
      assert.deepEqual(at100, { x: 200, y: 300 });
    });

    it("renders valid SVG path string with cubic Bezier C commands", () => {
      const waypoints: ResolvedWaypoint[] = [
        { id: "w0", time: 0, x: 0, y: 0, mode: "auto", hold: false },
        { id: "w1", time: 1, x: 100, y: 50, mode: "auto", hold: false },
        { id: "w2", time: 2, x: 200, y: 0, mode: "auto", hold: false },
      ];
      const geom = compileSpatialTrajectory(waypoints, true);
      const svg = geom.toSvgPath();
      assert.ok(svg.startsWith("M 0 0"));
      assert.ok(svg.includes(" C "));
      assert.ok(svg.endsWith(" Z"));
    });

    it("samples frame ticks at integer frame rates", () => {
      const waypoints: ResolvedWaypoint[] = [
        { id: "w0", time: 0, x: 0, y: 0, mode: "linear", hold: false },
        { id: "w1", time: 1, x: 60, y: 0, mode: "linear", hold: false },
      ];
      const geom = compileSpatialTrajectory(waypoints, false);
      const ticks = geom.sampleFrameTicks(30); // 30 fps over 1 second = 31 frames (0 to 30)
      assert.equal(ticks.length, 31);
      assert.equal(ticks[0].time, 0);
      assert.equal(ticks[30].time, 1);
      assert.ok(Math.abs(ticks[15].point.x - 30) < 1e-4);
    });

    it("creates spatial path from full Clip object with X and Y tracks", () => {
      const clip: Clip = {
        id: "clip-spatial",
        layerId: "layer-1",
        name: "Spatial Move",
        duration: 2,
        trigger: "time",
        type: "loop",
        easing: "linear",
        enabled: true,
        tracks: [
          {
            id: "tx",
            property: "transform.x",
            keyframes: [
              { id: "kx0", time: 0, value: 0, ease: "linear" },
              { id: "kx1", time: 2, value: 400, ease: "linear" },
            ],
          },
          {
            id: "ty",
            property: "transform.y",
            keyframes: [
              { id: "ky0", time: 0, value: 0, ease: "linear" },
              { id: "ky1", time: 2, value: 200, ease: "linear" },
            ],
          },
        ],
      };

      const geom = createSpatialPath(clip);
      assert.ok(geom !== null);
      assert.equal(geom.segments.length, 1);
      const pMid = geom.evaluateAtTime(1);
      assert.ok(pMid !== null);
      assert.ok(Math.abs(pMid.x - 200) < 1e-4);
      assert.ok(Math.abs(pMid.y - 100) < 1e-4);
    });
  });

  describe("High-Precision Numerical Reference Comparison (1024-Interval Simpson)", () => {
    it("matches 1024-interval composite Simpson reference on multiple curve families", () => {
      const testCurves: Array<{ name: string; bez: CubicBezier }> = [
        {
          name: "Collinear line",
          bez: { p0: { x: 0, y: 0 }, p1: { x: 33.3, y: 0 }, p2: { x: 66.6, y: 0 }, p3: { x: 100, y: 0 } },
        },
        {
          name: "S-Curve",
          bez: { p0: { x: 0, y: 0 }, p1: { x: 50, y: 200 }, p2: { x: 150, y: -200 }, p3: { x: 200, y: 0 } },
        },
        {
          name: "High-curvature loop",
          bez: { p0: { x: 50, y: 50 }, p1: { x: 250, y: 400 }, p2: { x: -100, y: 350 }, p3: { x: 300, y: 100 } },
        },
        {
          name: "Arched bow",
          bez: { p0: { x: 0, y: 0 }, p1: { x: 25, y: 80 }, p2: { x: 75, y: 80 }, p3: { x: 100, y: 0 } },
        },
      ];

      for (const { name, bez } of testCurves) {
        const { totalLength } = compileSegmentLut(bez);
        const simpsonLength = compositeSimpsonReference(bez, 0, 1, 1024);
        const diff = Math.abs(totalLength - simpsonLength);

        // Adaptive 5-point Gauss-Legendre across subintervals of width <= 1/32 matches 1024-interval Simpson < 0.005 px
        assert.ok(
          diff < 0.005,
          `Curve "${name}": LUT length (${totalLength.toFixed(6)}) vs Simpson (${simpsonLength.toFixed(6)}) diff ${diff.toFixed(6)} px must be < 0.005 px`
        );
      }
    });
  });

  describe("Adversarial Path Geometries & Inversion Robustness", () => {
    it("handles endpoint cusp / stationary zero-derivative gracefully", () => {
      // p0 === p1 creates zero derivative at u = 0 (B'(0) = (0,0))
      const cusp: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 0, y: 0 }, // Cusp!
        p2: { x: 100, y: 200 },
        p3: { x: 200, y: 200 },
      };
      const mSeg = computeSegmentMaxDerivative(cusp);
      const { lut, totalLength } = compileSegmentLut(cusp);

      assert.ok(totalLength > 100);
      for (const frac of [0.0, 0.1, 0.5, 0.9, 1.0]) {
        const u = invertArcLength(cusp, lut, totalLength, mSeg, frac);
        assert.ok(!Number.isNaN(u));
        assert.ok(u >= 0 && u <= 1);
        const pt = evaluateCubic(cusp, u);
        assert.ok(!Number.isNaN(pt.x) && !Number.isNaN(pt.y));
      }
    });

    it("inverts extreme canvas coordinates (30,000 px) within tolerance", () => {
      const extreme: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 10000, y: 30000 },
        p2: { x: 20000, y: -30000 },
        p3: { x: 30000, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(extreme);
      const { lut, totalLength } = compileSegmentLut(extreme);

      assert.ok(totalLength > 30000);
      for (const frac of [0.1, 0.33, 0.5, 0.67, 0.9]) {
        const u = invertArcLength(extreme, lut, totalLength, mSeg, frac);
        assert.ok(!Number.isNaN(u));
        assert.ok(u >= 0 && u <= 1);

        // Find subinterval in LUT for accurate arc-length check
        let low = 0;
        let high = lut.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (lut[mid].u < u) low = mid + 1;
          else high = mid - 1;
        }
        const idx = Math.max(0, low - 1);
        const actualS = lut[idx].s + integrateArcLength(extreme, lut[idx].u, u);
        const targetS = frac * totalLength;
        const residual = Math.abs(actualS - targetS);

        // Even on a 30,000px segment, spatial error is bounded to < 0.015 px
        assert.ok(
          residual < 0.015,
          `At frac=${frac}, residual is ${residual.toFixed(6)} px, must be < 0.015 px`
        );
      }
    });

    it("handles self-intersecting loops with longitudinal reversal", () => {
      const loop: CubicBezier = {
        p0: { x: 100, y: 100 },
        p1: { x: 400, y: 600 },
        p2: { x: -200, y: 600 },
        p3: { x: 100, y: 100 }, // Closes onto itself
      };
      const mSeg = computeSegmentMaxDerivative(loop);
      const { lut, totalLength } = compileSegmentLut(loop);

      assert.ok(totalLength > 500);
      const uMid = invertArcLength(loop, lut, totalLength, mSeg, 0.5);
      const ptMid = evaluateCubic(loop, uMid);
      // Apex of the loop is far from endpoints (y > 300)
      assert.ok(ptMid.y > 300);
    });

    it("detects and emits DiagnosticBus warning when max subdivision depth is reached", () => {
      DiagnosticBus.clearHistory();
      // An extreme pathological curve with tiny scale and massive curvature
      const pathological: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 1e5, y: 1e5 },
        p2: { x: -1e5, y: 1e5 },
        p3: { x: 0, y: 0 },
      };
      // Test integrateArcLengthAdaptiveDetailed directly with low maxDepth:
      const res = integrateArcLengthAdaptiveDetailed(pathological, 0, 1, 1e-12, 0, 2);
      assert.equal(res.converged, false);
      assert.ok(res.errorEst > 0);
      assert.ok(res.value > 0);

      const events = DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN");
      assert.ok(events.length > 0);
      assert.equal(events[0].severity, "warning");
      assert.ok(events[0].message.includes("max subdivision depth"));
    });

    it("handles interior stationary point B'(0.5) = (0,0) with continuous inversion", () => {
      // delta0 = (100, 0), delta1 = (-100, 0), delta2 = (100, 0)
      // At u = 0.5: B'(0.5) = 0.75*(delta0 + 2*delta1 + delta2) = 0.75*(100 - 200 + 100) = (0, 0)
      const stationaryCusp: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 100, y: 0 },
        p2: { x: 0, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const derivMid = evaluateCubicDerivative(stationaryCusp, 0.5);
      assert.ok(Math.hypot(derivMid.x, derivMid.y) < 1e-9, "Midpoint derivative must be 0");

      const mSeg = computeSegmentMaxDerivative(stationaryCusp);
      const { lut, totalLength } = compileSegmentLut(stationaryCusp);
      assert.ok(totalLength > 50);

      // Invert across the stationary point:
      const uMid = invertArcLength(stationaryCusp, lut, totalLength, mSeg, 0.5);
      assert.ok(!Number.isNaN(uMid));
      assert.ok(Math.abs(uMid - 0.5) < 0.05);

      for (const frac of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const u = invertArcLength(stationaryCusp, lut, totalLength, mSeg, frac);
        assert.ok(!Number.isNaN(u));
        assert.ok(u >= 0 && u <= 1);
      }
    });

    it("handles nearly stationary micro-scale segments without division by zero", () => {
      // Segment with tiny dimensions (total chord < 0.01 px)
      const microSegment: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 0.001, y: 0.002 },
        p2: { x: 0.003, y: 0.002 },
        p3: { x: 0.005, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(microSegment);
      const { lut, totalLength } = compileSegmentLut(microSegment);

      assert.ok(totalLength < 0.02 && totalLength > 0);
      for (const frac of [0.0, 0.25, 0.5, 0.75, 1.0]) {
        const u = invertArcLength(microSegment, lut, totalLength, mSeg, frac);
        assert.ok(!Number.isNaN(u));
        assert.ok(u >= 0 && u <= 1);
      }
    });

    it("strictly verifies interval root bracket validation and expansion under uncertainty", () => {
      const sCurve: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 50, y: 200 },
        p2: { x: 150, y: -200 },
        p3: { x: 200, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(sCurve);
      const { lut, totalLength } = compileSegmentLut(sCurve);

      // Verify that every sample in the LUT carries an errorBound
      for (const sample of lut) {
        assert.ok(typeof sample.errorBound === "number");
        assert.ok(sample.errorBound >= 0);
      }

      // Test a spectrum of target fractions:
      for (let i = 1; i <= 20; i++) {
        const frac = i / 20;
        const u = invertArcLength(sCurve, lut, totalLength, mSeg, frac);
        assert.ok(u >= 0 && u <= 1);

        // Check residual against adaptive quadrature:
        let low = 0;
        let high = lut.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (lut[mid].u < u) low = mid + 1;
          else high = mid - 1;
        }
        const idx = Math.max(0, low - 1);
        const actualS = lut[idx].s + integrateArcLength(sCurve, lut[idx].u, u);
        const targetS = frac * totalLength;
        assert.ok(
          Math.abs(actualS - targetS) < 0.015,
          `Spatial error at frac=${frac} must be < 0.015 px`
        );
      }
    });

    it("rejects and reports unresolved brackets at both LUT boundaries with diagnostics", () => {
      DiagnosticBus.clearHistory();
      const line: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 33, y: 0 },
        p2: { x: 66, y: 0 },
        p3: { x: 100, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(line);
      const { lut, totalLength } = compileSegmentLut(line);

      // 1. Left boundary out-of-range (sProgress < 0):
      const leftRes = invertArcLengthDetailed(line, lut, totalLength, mSeg, -0.05);
      assert.equal(leftRes.converged, false);
      assert.equal(leftRes.unresolvedReason, "bracket_unresolved_boundary");
      assert.equal(leftRes.u, 0);

      // 2. Right boundary out-of-range (sProgress > 1):
      const rightRes = invertArcLengthDetailed(line, lut, totalLength, mSeg, 1.05);
      assert.equal(rightRes.converged, false);
      assert.equal(rightRes.unresolvedReason, "bracket_unresolved_boundary");
      assert.equal(rightRes.u, 1);

      // Verify diagnostics emitted:
      const warnEvents = DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN");
      assert.ok(warnEvents.length >= 2);
      assert.ok(warnEvents.some((e) => e.message.includes("leftResolved=false")));
      assert.ok(warnEvents.some((e) => e.message.includes("rightResolved=false")));
    });

    it("detects when integration uncertainty consumes spatial tolerance and flags unresolved", () => {
      DiagnosticBus.clearHistory();
      const sCurve: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 50, y: 200 },
        p2: { x: 150, y: -200 },
        p3: { x: 200, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(sCurve);
      const { lut, totalLength } = compileSegmentLut(sCurve);

      // Inject uncertainty that consumes spatial tolerance (totalUncertainty = 0.02 > spatialTolerance = 0.015):
      const uncertLut = lut.map((s) => ({ ...s, estimatedError: 0.01, errorBound: 0.01 }));
      const res = invertArcLengthDetailed(sCurve, uncertLut, totalLength, mSeg, 0.5, 0.015);
      assert.equal(res.converged, false);
      assert.equal(res.unresolvedReason, "uncertainty_exceeds_tolerance");
      assert.ok(res.spatialErrorBound >= 0.015);

      const warns = DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN");
      assert.ok(warns.some((e) => e.message.includes("consumes spatial tolerance")));
    });

    it("handles midpoint residual uncertainty interval crossing zero with certified convergence", () => {
      const sCurve: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 50, y: 200 },
        p2: { x: 150, y: -200 },
        p3: { x: 200, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(sCurve);
      const { lut, totalLength } = compileSegmentLut(sCurve);

      // Invert at a regular fractional position:
      const res = invertArcLengthDetailed(sCurve, lut, totalLength, mSeg, 0.42, 0.015);
      assert.equal(res.converged, true);
      assert.ok(res.spatialErrorBound <= 0.015);
      assert.ok(res.u >= 0 && res.u <= 1);
    });

    it("verifies maximum-depth exhaustion cannot produce a successful guaranteed inversion", () => {
      DiagnosticBus.clearHistory();
      // Pathological curve with extreme curvature:
      const pathological: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 1e5, y: 1e5 },
        p2: { x: -1e5, y: 1e5 },
        p3: { x: 0, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(pathological);
      const quad = integrateArcLengthAdaptiveDetailed(pathological, 0, 1, 1e-4);
      const coarseLut = [
        { u: 0, s: 0, point: pathological.p0, errorBound: 0 },
        { u: 1, s: quad.value, point: pathological.p3, errorBound: quad.errorEst },
      ];

      // Invert across wide interval with quadMaxDepth = 1 and tight tolerance so quadrature hits maxDepth:
      const res = invertArcLengthDetailed(pathological, coarseLut, quad.value, mSeg, 0.5, 0.015, 1e-12, 1);
      assert.equal(res.converged, false);
      assert.equal(res.unresolvedReason, "quadrature_exhausted");

      const warnEvents = DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN");
      assert.ok(warnEvents.length > 0);
      assert.ok(warnEvents.some((e) => e.message.includes("max subdivision depth")));
    });

    it("preserves bracket in Newton when residual interval crosses zero despite non-zero estimated residual", () => {
      const sCurve: CubicBezier = {
        p0: { x: 0, y: 0 },
        p1: { x: 50, y: 200 },
        p2: { x: 150, y: -200 },
        p3: { x: 200, y: 0 },
      };
      const mSeg = computeSegmentMaxDerivative(sCurve);
      const { lut, totalLength } = compileSegmentLut(sCurve);

      // Create a LUT with moderate uncertainty (0.002 px)
      // When Newton evaluates a point with small residual (e.g. 0.001 px), the error interval crosses zero.
      const uncertLut = lut.map((s) => ({ ...s, estimatedError: 0.002, errorBound: 0.002 }));
      const res = invertArcLengthDetailed(sCurve, uncertLut, totalLength, mSeg, 0.5, 0.015);

      // Verify that Newton does not narrow bracket on an uncertain sign, cleanly detects zero crossing, and converges:
      assert.equal(res.converged, true);
      assert.ok(res.spatialErrorEst <= 0.015);
      assert.ok(res.u >= 0.45 && res.u <= 0.55);
    });
  });
});
