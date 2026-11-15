import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema } from "../../document/signals";
import { compileExpr, UnsupportedOperatorError } from "../evaluate";
import {
  compareFrameRates,
  REFERENCE_BINDINGS,
  REFERENCE_CASES,
  REFERENCE_TRAIL_EXPR,
  runExprAtRate,
  runTrailAtRate,
} from "../referenceBindings";

describe("Stage 4 Phase 138: operators & bindings runtime", () => {
  it("validates all 12 reference bindings against BindingSchema", () => {
    assert.equal(REFERENCE_BINDINGS.length, 12);
    for (const binding of REFERENCE_BINDINGS) {
      const parsed = BindingSchema.safeParse(binding);
      assert.equal(parsed.success, true, `Binding ${binding.id} failed schema validation`);
    }
  });

  it("matches hand-computed checkpoint values across all 12 reference bindings at 60 Hz", () => {
    for (const testCase of REFERENCE_CASES) {
      const times = Object.keys(testCase.checkpoints).map(Number);
      const actual = runExprAtRate(testCase.binding.expr, 60, 60, times);
      for (const sec of times) {
        const expected = testCase.checkpoints[sec]!;
        const delta = Math.abs((actual[sec] ?? Number.NaN) - expected);
        assert.ok(
          delta <= testCase.tolerance,
          `${testCase.id} at t=${sec}s: expected ${expected} ± ${testCase.tolerance}, got ${actual[sec]}`
        );
      }
    }
  });

  it("stays frame-rate independent across 30, 60, and 120 Hz over a 60 s tape", () => {
    for (const testCase of REFERENCE_CASES) {
      const times = Object.keys(testCase.checkpoints).map(Number);
      const comparison = compareFrameRates(testCase.id, testCase.binding.expr, times, 60, [30, 60, 120]);
      // Cross-rate tolerance scales cleanly even for spring/velocity/accumulate
      const crossRateLimit = Math.max(0.5, testCase.tolerance * 2);
      assert.ok(
        comparison.maxDelta <= crossRateLimit,
        `${testCase.id} drifted across 30/60/120 Hz: maxDelta=${comparison.maxDelta} (limit=${crossRateLimit})`
      );
    }
  });

  it("supports trail ring buffer via compileTrailExpr while compileExpr keeps throwing UnsupportedOperatorError", () => {
    assert.throws(() => compileExpr(REFERENCE_TRAIL_EXPR), UnsupportedOperatorError);

    const trailFrames = runTrailAtRate(REFERENCE_TRAIL_EXPR, 6, 10);
    assert.equal(trailFrames.length, 6);
    assert.equal(trailFrames[0]!.length, 1);
    assert.equal(trailFrames[3]!.length, 4);
    assert.equal(trailFrames[5]!.length, 4);
    // At t=0.5s, pointerIn px=[105,50] rotated 90 deg -> [-50, 105]
    const newest = trailFrames[5]![0] as [number, number];
    assert.ok(Math.abs(newest[0] + 50) < 1e-6);
    assert.ok(Math.abs(newest[1] - 105) < 1e-6);
  });
});
