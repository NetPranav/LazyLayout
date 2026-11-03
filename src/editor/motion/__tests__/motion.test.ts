// Unit test for pure functions ported from Nook (the owner's own product)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { springEase } from "../ease";
import { Spring, settleAll, stepAll } from "../spring";
import { MOTION_PRESETS } from "../presets";

describe("Motion engine pure functions ported from Nook", () => {
  it("simulates springEase ending exactly at 1 and caches the result", () => {
    const res1 = springEase(0.5, 0.72);
    const res2 = springEase(0.5, 0.72);
    assert.equal(res1, res2); // cached per pair

    assert.ok(res1.easing.startsWith("linear("));
    assert.ok(res1.easing.endsWith(")"));

    const pts = res1.easing
      .slice("linear(".length, -1)
      .split(", ")
      .map(Number);

    assert.equal(pts[0], 0);
    assert.equal(pts[pts.length - 1], 1);
    assert.ok(res1.duration > 0);
  });

  it("produces expected overshoot for (0.5, 0.72) and (0.28, 0.40)", () => {
    // (0.5, 0.72) overshoot ≈ 3.6%
    const easeSmooth = springEase(0.5, 0.72);
    const ptsSmooth = easeSmooth.easing
      .slice("linear(".length, -1)
      .split(", ")
      .map(Number);
    const maxSmooth = Math.max(...ptsSmooth);
    const overshootSmooth = (maxSmooth - 1) * 100;
    assert.ok(overshootSmooth > 3, `Expected overshoot > 3, got ${overshootSmooth}`);
    assert.ok(overshootSmooth < 4.5, `Expected overshoot < 4.5, got ${overshootSmooth}`);

    // (0.28, 0.40) overshoot ≈ 25%
    const easeBouncy = springEase(0.28, 0.4);
    const ptsBouncy = easeBouncy.easing
      .slice("linear(".length, -1)
      .split(", ")
      .map(Number);
    const maxBouncy = Math.max(...ptsBouncy);
    const overshootBouncy = (maxBouncy - 1) * 100;
    assert.ok(overshootBouncy > 23, `Expected overshoot > 23, got ${overshootBouncy}`);
    assert.ok(overshootBouncy < 27, `Expected overshoot < 27, got ${overshootBouncy}`);
  });

  it("advances Spring correctly and settles when reaching target", () => {
    const s = new Spring(0, [0.3, 0.7]);
    s.to = 100;
    assert.equal(s.atRest, false);

    // Step through physics
    for (let i = 0; i < 200; i++) {
      stepAll([s], 0.016, 4);
    }
    assert.ok(settleAll([s]));
    assert.equal(s.x, 100);
    assert.equal(s.v, 0);
    assert.equal(s.atRest, true);
  });

  it("has matching motion presets for smooth, lively, and bouncy", () => {
    assert.ok(MOTION_PRESETS.smooth);
    assert.ok(MOTION_PRESETS.lively);
    assert.ok(MOTION_PRESETS.bouncy);
    assert.equal(MOTION_PRESETS.smooth.wind, 10);
    assert.equal(MOTION_PRESETS.lively.wind, 12);
    assert.equal(MOTION_PRESETS.bouncy.wind, 16);
  });
});

