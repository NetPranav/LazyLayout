import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRigDefinition, evaluateRigWorldTransforms } from "../rigModel";
import { solveTwoBoneIk, solveFabrikChain } from "../ikSolver";

const assertClose = (a: number, b: number, eps = 0.05) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b} (±${eps})`);
};

describe("Phase 207 · Inverse kinematics (50 target positions + angle limits + FABRIK)", () => {
  const twoBoneRig = createRigDefinition("ik_arm", "IKArm", "layer_arm", [
    { id: "upper", name: "Upper", parentId: null, length: 100, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "lower", name: "Lower", parentId: "upper", length: 80, restX: 0, restY: 0, restRotationDeg: 0 },
  ]);

  it("solves 50 interior reachable target positions accurately", () => {
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const radius = 35 + ((i * 29) % 135); // within minReach=20..maxReach=180
      const target = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
      const pose = solveTwoBoneIk(twoBoneRig, {
        id: "arm_ik",
        boneIds: ["upper", "lower"],
        target,
        bendDirection: i % 2 === 0 ? 1 : -1,
      });
      const world = evaluateRigWorldTransforms(twoBoneRig, pose);
      assertClose(world.lower.tail.x, target.x, 0.25);
      assertClose(world.lower.tail.y, target.y, 0.25);
    }
  });

  it("flips elbow bend direction cleanly and supports stretch + FK/IK blend", () => {
    const pos = solveTwoBoneIk(twoBoneRig, {
      id: "arm",
      boneIds: ["upper", "lower"],
      target: { x: 120, y: 0 },
      bendDirection: 1,
    });
    const neg = solveTwoBoneIk(twoBoneRig, {
      id: "arm",
      boneIds: ["upper", "lower"],
      target: { x: 120, y: 0 },
      bendDirection: -1,
    });
    const wPos = evaluateRigWorldTransforms(twoBoneRig, pos);
    const wNeg = evaluateRigWorldTransforms(twoBoneRig, neg);
    assert.ok(wPos.lower.head.y < 0);
    assert.ok(wNeg.lower.head.y > 0);
    assertClose(wPos.lower.tail.x, 120);
    assertClose(wNeg.lower.tail.x, 120);

    // Stretch when target exceeds 180px
    const stretched = solveTwoBoneIk(twoBoneRig, {
      id: "arm",
      boneIds: ["upper", "lower"],
      target: { x: 225, y: 0 },
      allowStretch: true,
      maxStretch: 1.5,
    });
    const wStretch = evaluateRigWorldTransforms(twoBoneRig, stretched);
    assertClose(wStretch.lower.tail.x, 225, 0.5);

    // FK/IK blend=0 keeps FK basePose untouched
    const fkOnly = solveTwoBoneIk(
      twoBoneRig,
      { id: "arm", boneIds: ["upper", "lower"], target: { x: 0, y: 120 }, fkIkBlend: 0 },
      { upper: { rotationDeg: 10 }, lower: { rotationDeg: 20 } },
    );
    assert.equal(fkOnly.upper.rotationDeg, 10);
    assert.equal(fkOnly.lower.rotationDeg, 20);
  });

  it("strictly enforces per-bone angle limits (never exceeded)", () => {
    const pose = solveTwoBoneIk(twoBoneRig, {
      id: "arm_limited",
      boneIds: ["upper", "lower"],
      target: { x: -120, y: 100 },
      limits: {
        upper: { minDeg: -45, maxDeg: 45 },
        lower: { minDeg: 0, maxDeg: 110 },
      },
    });
    const uRot = pose.upper.rotationDeg ?? 0;
    const lRot = pose.lower.rotationDeg ?? 0;
    assert.ok(uRot >= -45 && uRot <= 45, `upper=${uRot}`);
    assert.ok(lRot >= 0 && lRot <= 110, `lower=${lRot}`);
  });

  it("solves multi-bone 4-segment FABRIK chains accurately", () => {
    const tentacleRig = createRigDefinition("tentacle", "Tentacle", "layer_t", [
      { id: "t1", name: "T1", parentId: null, length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "t2", name: "T2", parentId: "t1", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "t3", name: "T3", parentId: "t2", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "t4", name: "T4", parentId: "t3", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const pose = solveFabrikChain(tentacleRig, {
      id: "t_ik",
      boneIds: ["t1", "t2", "t3", "t4"],
      target: { x: 90, y: 70 },
    });
    const w = evaluateRigWorldTransforms(tentacleRig, pose);
    assertClose(w.t4.tail.x, 90, 0.5);
    assertClose(w.t4.tail.y, 70, 0.5);
  });
});
