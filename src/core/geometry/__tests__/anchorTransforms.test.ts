import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  transformPoint,
  computeTransformedCorners,
  compensateTransformForAnchorChange,
  evaluateTransformOrder,
} from "../transforms";
import { resolvePresetPinPosition } from "../pins";

describe("Phase 72: Golden Value Matrix & Transformation Verification", () => {
  const W = 100;
  const H = 60;
  const TOLERANCE = 1e-5;

  function assertClose(actual: number, expected: number, msg?: string) {
    assert.ok(
      Math.abs(actual - expected) < TOLERANCE,
      `${msg ?? "Value"} expected ${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`
    );
  }

  function assertCornersMatch(
    actual: [[number, number], [number, number], [number, number], [number, number]],
    expected: readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]],
    pinName: string
  ) {
    for (let c = 0; c < 4; c++) {
      assertClose(actual[c][0], expected[c][0], `${pinName} Corner ${c} X`);
      assertClose(actual[c][1], expected[c][1], `${pinName} Corner ${c} Y`);
    }
  }

  // =========================================================================
  // Requirement 1: Independently Calculated Golden Values
  // Derived analytically for 100x60 box with corners:
  // C0=(0,0), C1=(100,0), C2=(100,60), C3=(0,60)
  // =========================================================================

  // Golden Matrix 1: 90 deg clockwise rotation (cos 90° = 0, sin 90° = 1, sx = 1, sy = 1)
  const GOLDEN_90_DEG: Record<string, readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]]> = {
    topLeft: [[0.0, 0.0], [0.0, 100.0], [-60.0, 100.0], [-60.0, 0.0]],
    top: [[50.0, -50.0], [50.0, 50.0], [-10.0, 50.0], [-10.0, -50.0]],
    topRight: [[100.0, -100.0], [100.0, 0.0], [40.0, 0.0], [40.0, -100.0]],
    left: [[30.0, 30.0], [30.0, 130.0], [-30.0, 130.0], [-30.0, 30.0]],
    center: [[80.0, -20.0], [80.0, 80.0], [20.0, 80.0], [20.0, -20.0]],
    right: [[130.0, -70.0], [130.0, 30.0], [70.0, 30.0], [70.0, -70.0]],
    bottomLeft: [[60.0, 60.0], [60.0, 160.0], [0.0, 160.0], [0.0, 60.0]],
    bottom: [[110.0, 10.0], [110.0, 110.0], [50.0, 110.0], [50.0, 10.0]],
    bottomRight: [[160.0, -40.0], [160.0, 60.0], [100.0, 60.0], [100.0, -40.0]],
  };

  // Golden Matrix 2: Nonuniform Scale (sx = 2, sy = 0.5, deg = 0)
  const GOLDEN_SCALE_2_05: Record<string, readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]]> = {
    topLeft: [[0.0, 0.0], [200.0, 0.0], [200.0, 30.0], [0.0, 30.0]],
    top: [[-50.0, 0.0], [150.0, 0.0], [150.0, 30.0], [-50.0, 30.0]],
    topRight: [[-100.0, 0.0], [100.0, 0.0], [100.0, 30.0], [-100.0, 30.0]],
    left: [[0.0, 15.0], [200.0, 15.0], [200.0, 45.0], [0.0, 45.0]],
    center: [[-50.0, 15.0], [150.0, 15.0], [150.0, 45.0], [-50.0, 45.0]],
    right: [[-100.0, 15.0], [100.0, 15.0], [100.0, 45.0], [-100.0, 45.0]],
    bottomLeft: [[0.0, 30.0], [200.0, 30.0], [200.0, 60.0], [0.0, 60.0]],
    bottom: [[-50.0, 30.0], [150.0, 30.0], [150.0, 60.0], [-50.0, 60.0]],
    bottomRight: [[-100.0, 30.0], [100.0, 30.0], [100.0, 60.0], [-100.0, 60.0]],
  };

  // Golden Matrix 3: Combined Rotation and Scale (deg = 45°, sx = 1.5, sy = 0.8)
  const GOLDEN_COMBINED_45_DEG: Record<string, readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]]> = {
    topLeft: [[0.0, 0.0], [106.066017, 106.066017], [72.124892, 140.007143], [-33.941125, 33.941125]],
    top: [[-3.033009, -53.033009], [103.033009, 53.033009], [69.091883, 86.974134], [-36.974134, -19.091883]],
    topRight: [[-6.066017, -106.066017], [100.0, 0.0], [66.058875, 33.941125], [-40.007143, -72.124892]],
    left: [[16.970563, 13.029437], [123.03658, 119.095454], [89.095454, 153.03658], [-16.970563, 46.970563]],
    center: [[13.937554, -40.003571], [120.003571, 66.062446], [86.062446, 100.003571], [-20.003571, -6.062446]],
    right: [[10.904546, -93.03658], [116.970563, 13.029437], [83.029437, 46.970563], [-23.03658, -59.095454]],
    bottomLeft: [[33.941125, 26.058875], [140.007143, 132.124892], [106.066017, 166.066017], [0.0, 60.0]],
    bottom: [[30.908117, -26.974134], [136.974134, 79.091883], [103.033009, 113.033009], [-3.033009, 6.966991]],
    bottomRight: [[27.875108, -80.007143], [133.941125, 26.058875], [100.0, 60.0], [-6.066017, -46.066017]],
  };

  it("matches golden values for 90° rotation across all 9 preset pins", () => {
    for (const [pinName, expected] of Object.entries(GOLDEN_90_DEG)) {
      const anchor = resolvePresetPinPosition(pinName, W, H);
      const corners = computeTransformedCorners(W, H, {
        anchor,
        rotationDeg: 90,
        scaleX: 1,
        scaleY: 1,
      });
      assertCornersMatch(corners, expected, `90° Rotation - ${pinName}`);
    }
  });

  it("matches golden values for nonuniform scale (2, 0.5) across all 9 preset pins", () => {
    for (const [pinName, expected] of Object.entries(GOLDEN_SCALE_2_05)) {
      const anchor = resolvePresetPinPosition(pinName, W, H);
      const corners = computeTransformedCorners(W, H, {
        anchor,
        rotationDeg: 0,
        scaleX: 2,
        scaleY: 0.5,
      });
      assertCornersMatch(corners, expected, `Scale (2, 0.5) - ${pinName}`);
    }
  });

  it("matches golden values for combined rotation & scale (45°, 1.5, 0.8) across all 9 preset pins", () => {
    for (const [pinName, expected] of Object.entries(GOLDEN_COMBINED_45_DEG)) {
      const anchor = resolvePresetPinPosition(pinName, W, H);
      const corners = computeTransformedCorners(W, H, {
        anchor,
        rotationDeg: 45,
        scaleX: 1.5,
        scaleY: 0.8,
      });
      assertCornersMatch(corners, expected, `Combined (45°, 1.5, 0.8) - ${pinName}`);
    }
  });

  // =========================================================================
  // Requirement 2: Anchor Invariance Verification
  // For every preset pin: A_world = F + A + T before and after rotation and scale
  // =========================================================================

  it("verifies anchor point invariance for all 9 preset pins under arbitrary transforms", () => {
    const frame: [number, number] = [120, 80];
    const offset: [number, number] = [15, -25];

    const testTransforms = [
      { deg: 0, sx: 1, sy: 1 },
      { deg: 90, sx: 1, sy: 1 },
      { deg: 45, sx: 2, sy: 0.5 },
      { deg: -135, sx: 0.75, sy: 1.25 },
      { deg: 270, sx: 3, sy: 3 },
    ];

    for (const pinName of Object.keys(GOLDEN_90_DEG)) {
      const localAnchor = resolvePresetPinPosition(pinName, W, H);
      const expectedWorldAnchor: [number, number] = [
        frame[0] + localAnchor[0] + offset[0],
        frame[1] + localAnchor[1] + offset[1],
      ];

      for (const t of testTransforms) {
        const transformedAnchor = transformPoint(localAnchor, {
          anchor: localAnchor,
          rotationDeg: t.deg,
          scaleX: t.sx,
          scaleY: t.sy,
          frameOrigin: frame,
          transformOffset: offset,
        });

        assertClose(
          transformedAnchor[0],
          expectedWorldAnchor[0],
          `Invariance ${pinName} X under deg=${t.deg}, sx=${t.sx}, sy=${t.sy}`
        );
        assertClose(
          transformedAnchor[1],
          expectedWorldAnchor[1],
          `Invariance ${pinName} Y under deg=${t.deg}, sx=${t.sx}, sy=${t.sy}`
        );
      }
    }
  });

  // =========================================================================
  // Requirement 3: Matrix Order Verification
  // Confirms R · S ≠ S · R for nonuniform scale and that transforms strictly follow R · S
  // =========================================================================

  it("verifies R · S ≠ S · R for nonuniform scale (matrix order distinction)", () => {
    const testVector: [number, number] = [10, 20];
    const deg = 90;
    const sx = 2;
    const sy = 0.5;

    const { rs, sr } = evaluateTransformOrder(testVector, deg, sx, sy);

    // Analytical expectation:
    // v = [10, 20]
    // S · v = [10 * 2, 20 * 0.5] = [20, 10]
    // R(90) · [20, 10] = [-10, 20]
    assertClose(rs[0], -10, "R · S X");
    assertClose(rs[1], 20, "R · S Y");

    // S · R · v:
    // R(90) · [10, 20] = [-20, 10]
    // S · [-20, 10] = [-20 * 2, 10 * 0.5] = [-40, 5]
    assertClose(sr[0], -40, "S · R X");
    assertClose(sr[1], 5, "S · R Y");

    // Strictly different!
    assert.notDeepEqual(rs, sr);

    // Confirm transformPoint follows canonical R · S
    const p = transformPoint([10, 20], {
      anchor: [0, 0],
      rotationDeg: deg,
      scaleX: sx,
      scaleY: sy,
    });
    assertClose(p[0], -10, "transformPoint strictly follows R · S");
    assertClose(p[1], 20, "transformPoint strictly follows R · S");
  });

  // =========================================================================
  // Requirement 4: Edge Cases & Stability
  // Zero-scale behavior without division, small positive scale stability, out-of-bounds pins
  // =========================================================================

  it("handles zero-scale safely without division by zero or NaN", () => {
    const p = transformPoint([100, 60], {
      anchor: [50, 30],
      rotationDeg: 45,
      scaleX: 0,
      scaleY: 0,
    });
    assert.ok(Number.isFinite(p[0]));
    assert.ok(Number.isFinite(p[1]));
    assertClose(p[0], 50, "Zero scale collapses to anchor X");
    assertClose(p[1], 30, "Zero scale collapses to anchor Y");
  });

  it("remains numerically stable with very small positive scale (1e-6)", () => {
    const scale = 1e-6;
    const p = transformPoint([100, 60], {
      anchor: [50, 30],
      rotationDeg: 30,
      scaleX: scale,
      scaleY: scale,
    });
    assert.ok(Number.isFinite(p[0]));
    assert.ok(Number.isFinite(p[1]));
    // Analytical expectation:
    // dx = 50, dy = 30
    // rx = (50 * cos(30°) - 30 * sin(30°)) * 1e-6
    // ry = (50 * sin(30°) + 30 * cos(30°)) * 1e-6
    const rad = (30 * Math.PI) / 180;
    const expectedX = 50 + (50 * Math.cos(rad) - 30 * Math.sin(rad)) * scale;
    const expectedY = 30 + (50 * Math.sin(rad) + 30 * Math.cos(rad)) * scale;
    assertClose(p[0], expectedX, "Tiny scale X matches analytical calculation");
    assertClose(p[1], expectedY, "Tiny scale Y matches analytical calculation");
  });

  it("supports out-of-bounds custom pins correctly as pivots", () => {
    const outOfBoundsAnchor: [number, number] = [-30, -20];
    const corners = computeTransformedCorners(W, H, {
      anchor: outOfBoundsAnchor,
      rotationDeg: 90,
      scaleX: 1,
      scaleY: 1,
    });
    // Anchor itself remains invariant at [-30, -20]
    const transformedAnchor = transformPoint(outOfBoundsAnchor, {
      anchor: outOfBoundsAnchor,
      rotationDeg: 90,
      scaleX: 1,
      scaleY: 1,
    });
    assertClose(transformedAnchor[0], -30);
    assertClose(transformedAnchor[1], -20);

    // C0 at [0, 0] relative to anchor [-30, -20] is vector [30, 20]
    // Rotated 90°: [-20, 30] => world pos: [-30 - 20, -20 + 30] = [-50, 10]
    assertClose(corners[0][0], -50);
    assertClose(corners[0][1], 10);
  });

  // =========================================================================
  // Condition F: Visual Geometry Preservation on Anchor Move
  // B' = B + (I - M)(A - A')
  // =========================================================================

  it("preserves rendered visual geometry when changing anchor on an already rotated/scaled layer", () => {
    const oldAnchor: [number, number] = [50, 30]; // center
    const newAnchor: [number, number] = [100, 0]; // topRight
    const deg = 45;
    const sx = 1.5;
    const sy = 0.8;
    const initialOffset: [number, number] = [20, 30];
    const frame: [number, number] = [100, 100];

    // Compute corners with old anchor
    const cornersBefore = computeTransformedCorners(W, H, {
      anchor: oldAnchor,
      rotationDeg: deg,
      scaleX: sx,
      scaleY: sy,
      frameOrigin: frame,
      transformOffset: initialOffset,
    });

    // Compensate transform offset for new anchor
    const compensatedOffset = compensateTransformForAnchorChange(
      oldAnchor,
      newAnchor,
      deg,
      sx,
      sy,
      initialOffset
    );

    // Compute corners with new anchor and compensated offset
    const cornersAfter = computeTransformedCorners(W, H, {
      anchor: newAnchor,
      rotationDeg: deg,
      scaleX: sx,
      scaleY: sy,
      frameOrigin: frame,
      transformOffset: compensatedOffset,
    });

    // ALL corners must match exactly before and after! Zero visual jump!
    for (let c = 0; c < 4; c++) {
      assertClose(cornersAfter[c][0], cornersBefore[c][0], `Compensated Corner ${c} X`);
      assertClose(cornersAfter[c][1], cornersBefore[c][1], `Compensated Corner ${c} Y`);
    }
  });
});
