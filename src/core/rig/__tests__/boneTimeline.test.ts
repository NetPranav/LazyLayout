import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRigDefinition, evaluateRigWorldTransforms } from "../rigModel";
import {
  lerpAngleShortestDeg,
  evaluatePoseTrackAtTime,
  computePoseOnionSkins,
  mirrorPoseLeftRight,
  PoseLibrary,
  type BonePoseTrack,
} from "../boneTimeline";

const assertClose = (a: number, b: number, eps = 1e-4) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b}`);
};

describe("Phase 205 · Bones on the timeline (3-pose wave sampled at 10 times)", () => {
  const rig = createRigDefinition("wave_rig", "WaveArm", "layer_arm", [
    { id: "shoulder", name: "Shoulder", parentId: null, length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "elbow", name: "Elbow", parentId: "shoulder", length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "arm_L", name: "Arm.L", parentId: null, length: 40, restX: -20, restY: 0, restRotationDeg: 0 },
    { id: "arm_R", name: "Arm.R", parentId: null, length: 40, restX: 20, restY: 0, restRotationDeg: 0 },
  ]);

  const waveTrack: BonePoseTrack = [
    { timeSec: 0, pose: { shoulder: { rotationDeg: -60 }, elbow: { rotationDeg: -30 } } },
    { timeSec: 0.5, pose: { shoulder: { rotationDeg: -90 }, elbow: { rotationDeg: 30 } } },
    { timeSec: 1.0, pose: { shoulder: { rotationDeg: -60 }, elbow: { rotationDeg: -30 } } },
  ];

  it("matches evaluate() across 10 sampled times on a 3-pose wave", () => {
    const sampleTimes = [0, 0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0];
    for (const t of sampleTimes) {
      const pose = evaluatePoseTrackAtTime(waveTrack, t);
      const world = evaluateRigWorldTransforms(rig, pose);
      const expectedShoulder =
        t <= 0.5 ? -60 + (-90 - -60) * (t / 0.5) : -90 + (-60 - -90) * ((t - 0.5) / 0.5);
      const expectedElbowDelta =
        t <= 0.5 ? -30 + (30 - -30) * (t / 0.5) : 30 + (-30 - 30) * ((t - 0.5) / 0.5);

      assertClose(world.shoulder.worldRotationDeg, expectedShoulder);
      assertClose(world.elbow.worldRotationDeg, expectedShoulder + expectedElbowDelta);
    }
  });

  it("uses shortest-arc angle interpolation across ±180°", () => {
    assertClose(lerpAngleShortestDeg(-170, 170, 0.5), -180);
    assertClose(lerpAngleShortestDeg(170, -170, 0.5), 180);
  });

  it("computes onion skin ghosts before/after playhead and mirrors left/right poses", () => {
    const ghosts = computePoseOnionSkins(rig, waveTrack, 0.5, 2, 2, 0.1);
    assert.deepEqual(ghosts.map((g) => g.offsetFrames), [-2, -1, 1, 2]);
    assert.equal(ghosts[0].tint, "past");
    assert.equal(ghosts[2].tint, "future");
    assert.ok(ghosts[0].opacity < ghosts[1].opacity);

    const mirrored = mirrorPoseLeftRight({ arm_L: { dx: -5, rotationDeg: 35 } });
    assert.deepEqual(mirrored.arm_R, {
      dx: 5,
      dy: undefined,
      rotationDeg: -35,
      scaleX: undefined,
      scaleY: undefined,
    });
  });

  it("stores and blends poses from the PoseLibrary", () => {
    const lib = new PoseLibrary();
    lib.save("wave_high", "Wave High", { shoulder: { rotationDeg: -100 }, elbow: { rotationDeg: 20 } });
    const blended = lib.apply("wave_high", { shoulder: { rotationDeg: -60 }, elbow: { rotationDeg: 0 } }, 0.5);
    assertClose(blended.shoulder.rotationDeg ?? 0, -80);
    assertClose(blended.elbow.rotationDeg ?? 0, 10);
  });
});
