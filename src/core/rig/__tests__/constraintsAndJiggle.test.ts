import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRigDefinition, evaluateRigWorldTransforms } from "../rigModel";
import {
  evaluateBoneConstraints,
  replayJiggleOnTape,
  type JiggleBoneConfig,
} from "../constraintsAndJiggle";

const assertClose = (a: number, b: number, eps = 0.05) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b} (±${eps})`);
};

describe("Phase 208 · Constraints & secondary motion (jiggle)", () => {
  const rig = createRigDefinition("face_rig", "Constraints", "layer_face", [
    { id: "head", name: "Head", parentId: null, length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "eye_l", name: "Eye.L", parentId: null, length: 20, restX: 100, restY: 100, restRotationDeg: 0 },
    { id: "eye_r", name: "Eye.R", parentId: null, length: 20, restX: 140, restY: 100, restRotationDeg: 0 },
    { id: "car", name: "Follower", parentId: null, length: 30, restX: 0, restY: 0, restRotationDeg: 0 },
  ]);

  it("evaluates lookAt with natural angle limits, copyTransform, distance, pathFollow & rotationLimit", () => {
    const pose1 = evaluateBoneConstraints(
      rig,
      { head: { rotationDeg: 25 }, car: { rotationDeg: 140 } },
      [
        {
          id: "c_look",
          kind: "lookAt",
          boneId: "eye_l",
          targetX: 100,
          targetY: 200, // straight down = +90°
          minDeg: -60,
          maxDeg: 60, // clamped to +60°
        },
        {
          id: "c_copy",
          kind: "copyTransform",
          boneId: "eye_r",
          sourceBoneId: "eye_l",
          copyRotation: true,
          influence: 0.5,
        },
        {
          id: "c_dist",
          kind: "distance",
          boneId: "eye_l",
          anchorX: 100,
          anchorY: 100,
          distance: 15,
          mode: "exact",
        },
        {
          id: "c_limit",
          kind: "rotationLimit",
          boneId: "car",
          minDeg: -45,
          maxDeg: 45,
        },
      ],
    );

    assertClose(pose1.eye_l.rotationDeg ?? 0, 60);
    assertClose(pose1.eye_r.rotationDeg ?? 0, 30);
    assertClose(pose1.car.rotationDeg ?? 0, 45);

    const w1 = evaluateRigWorldTransforms(rig, pose1);
    const d = Math.hypot(w1.eye_l.head.x - 100, w1.eye_l.head.y - 100);
    assertClose(d, 15);

    // Path follow aligns tangent along diagonal line (0,0) -> (100,100)
    const pathPose = evaluateBoneConstraints(rig, {}, [
      {
        id: "c_path",
        kind: "pathFollow",
        boneId: "car",
        pathPoints: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        progress: 0.5,
        alignToTangent: true,
      },
    ]);
    const wPath = evaluateRigWorldTransforms(rig, pathPose);
    assertClose(wPath.car.head.x, 50);
    assertClose(wPath.car.head.y, 50);
    assertClose(wPath.car.worldRotationDeg, 45);
  });

  it("replays jiggle secondary motion bit-deterministically and settles after impulse", () => {
    const cfg: JiggleBoneConfig = {
      boneId: "ear_l",
      stiffness: 180,
      damping: 12,
      mass: 1,
      inertiaScale: 0.8,
      maxAngleDeg: 35,
    };
    const tape = [
      300, 300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const runA = replayJiggleOnTape(cfg, tape, 1 / 60);
    const runB = replayJiggleOnTape(cfg, tape, 1 / 60);
    assert.deepEqual(runA, runB);
    assert.ok(Math.abs(runA[1]) > 0.05, "Jiggle should deflect on impulse");
    assert.ok(Math.abs(runA[runA.length - 1]) < 0.5, "Jiggle should settle near 0 after damping");
  });
});
