import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sampleBlendTree1D,
  sampleBlendTree2D,
  blendPoseWithMask,
  createStandardLocomotionMachine,
  evaluateCharacterStateMachineTape,
} from "../characterBlendTrees";

const assertClose = (a: number, b: number, eps = 1e-3) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b}`);
};

describe("Phase 211 · Character states & blend trees", () => {
  it("blends 1D speed from idle -> walk -> run and 2D directional targets", () => {
    const poseMid = sampleBlendTree1D(
      [
        { threshold: 0, pose: { spine: { rotationDeg: 0 }, leg_l: { rotationDeg: 0 } } },
        { threshold: 0.5, pose: { spine: { rotationDeg: 10 }, leg_l: { rotationDeg: 20 } } },
        { threshold: 1, pose: { spine: { rotationDeg: 20 }, leg_l: { rotationDeg: 40 } } },
      ],
      0.75,
    );
    assertClose(poseMid.spine.rotationDeg ?? 0, 15);
    assertClose(poseMid.leg_l.rotationDeg ?? 0, 30);

    const p2d = sampleBlendTree2D(
      [
        { x: 0, y: 0, pose: { spine: { rotationDeg: 0 } } },
        { x: 1, y: 0, pose: { spine: { rotationDeg: 20 } } },
      ],
      0.5,
      0,
    );
    assertClose(p2d.spine.rotationDeg ?? 0, 10, 0.05);
  });

  it("layers upper-body wave over walking legs with bone masks and steps 5-state machine tape", () => {
    const layered = blendPoseWithMask(
      { leg_l: { rotationDeg: 25 }, arm_u: { rotationDeg: 15 } },
      { leg_l: { rotationDeg: 0 }, arm_u: { rotationDeg: -120 } },
      ["arm_u"],
      1,
    );
    assertClose(layered.leg_l.rotationDeg ?? 0, 25); // legs untouched
    assertClose(layered.arm_u.rotationDeg ?? 0, -120); // arm masked in

    const machine = createStandardLocomotionMachine(0.15);
    const frames = evaluateCharacterStateMachineTape(machine, [
      { dtSec: 0.05, speed: 0 }, // idle
      { dtSec: 0.05, speed: 0.5 }, // walk
      { dtSec: 0.1, speed: 0.5, waveActive: true }, // walk + wave overlay
      { dtSec: 0.1, speed: 1.0 }, // accelerate into run
      { dtSec: 0.05, speed: 1.0, jumpPressed: true }, // jump
    ]);

    assert.equal(frames[0].activeState, "idle");
    assert.equal(frames[1].activeState, "walk");
    assert.equal(frames[2].activeState, "walk");
    assert.ok(frames[2].waveLayerWeight > 0.5);
    assert.equal(frames[3].activeState, "run");
    assert.equal(frames[4].activeState, "jump");
  });
});
