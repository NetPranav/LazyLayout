import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingDraftSchema } from "../../document/signals";
import {
  buildMotionEchoesAndSpeedLines,
  buildVelocityPresetDrafts,
  computeVelocityDeform,
} from "../velocityEffects";

describe("Stage 4 Phase 144: velocity effects (squash & stretch, lean & trails)", () => {
  it("preserves 2D area during high-speed elongation and squashes on impact deceleration", () => {
    const fast = computeVelocityDeform(600, 0, 500, 0, 1 / 60, {
      maxStretch: 0.5,
      referenceSpeed: 600,
    });
    assert.ok(Math.abs(fast.scaleX - 1.25) < 1e-6);
    assert.ok(Math.abs(fast.scaleX * fast.scaleY - 1) < 1e-6, "Area should be conserved");
    assert.ok(fast.rotate > 0);

    const stop = computeVelocityDeform(50, 0, 800, 0, 1 / 60, { impactSquash: 0.3 });
    assert.ok(stop.scaleParallel < 1, "Rapid deceleration squashes along travel axis");
    assert.ok(Math.abs(stop.scaleX * stop.scaleY - 1) < 1e-6);
  });

  it("emits echo poses and speed lines behind moving trail samples and builds Simple presets", () => {
    const { echoes, speedLines } = buildMotionEchoesAndSpeedLines(
      [
        [100, 50],
        [80, 50],
        [60, 50],
      ],
      600,
      0
    );
    assert.equal(echoes.length, 3);
    assert.ok(echoes[0]!.opacity > echoes[2]!.opacity);
    assert.equal(speedLines.length, 3);
    assert.ok(speedLines[1]!.x2 < speedLines[1]!.x1);

    const drafts = buildVelocityPresetDrafts("ball", 60, 80);
    assert.equal(drafts.length, 2);
    for (const d of drafts) assert.equal(BindingDraftSchema.safeParse(d).success, true);
  });

  it("evaluates 50 velocity-driven layers comfortably inside a 60fps frame budget", () => {
    const start = performance.now();
    for (let f = 0; f < 60; f++) {
      for (let i = 0; i < 50; i++) {
        computeVelocityDeform(400 + i * 5, 100 * Math.sin(f * 0.2), 380, 12, 1 / 60);
      }
    }
    const perFrameMs = (performance.now() - start) / 60;
    assert.ok(perFrameMs < 5, `Velocity batch took ${perFrameMs.toFixed(3)}ms/frame`);
  });
});
