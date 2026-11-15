import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRigDefinition,
  evaluateRigWorldTransforms,
  computeBindMatrices,
  evaluateRigidBoundLayer,
  evaluateSkinnedPoint,
  normalizeVertexWeights,
  type RigPoseMap,
} from "../rigModel";

const assertClose = (actual: number, expected: number, eps = 1e-4) => {
  assert.ok(Math.abs(actual - expected) < eps, `Expected ${actual} ≈ ${expected} (±${eps})`);
};

describe("Phase 203 · Rig model: 20 hand-computed rig fixtures", () => {
  it("Fixture 01-03: single bone at 0°, 90°, 180°", () => {
    const rig = createRigDefinition("r1", "Single", "layer_root", [
      { id: "b1", name: "Root", parentId: null, length: 100, restX: 10, restY: 20, restRotationDeg: 0 },
    ]);

    const t0 = evaluateRigWorldTransforms(rig, {});
    assertClose(t0.b1.head.x, 10);
    assertClose(t0.b1.head.y, 20);
    assertClose(t0.b1.tail.x, 110);
    assertClose(t0.b1.tail.y, 20);

    const t90 = evaluateRigWorldTransforms(rig, { b1: { rotationDeg: 90 } });
    assertClose(t90.b1.tail.x, 10);
    assertClose(t90.b1.tail.y, 120);

    const t180 = evaluateRigWorldTransforms(rig, { b1: { rotationDeg: 180 } });
    assertClose(t180.b1.tail.x, -90);
    assertClose(t180.b1.tail.y, 20);
  });

  it("Fixture 04-06: 2-bone arm at 45°+45°, -45°+45°, and rest offset", () => {
    const rig = createRigDefinition("r2", "TwoBone", "layer_arm", [
      { id: "upper", name: "Upper", parentId: null, length: 100, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "lower", name: "Lower", parentId: "upper", length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);

    const f4 = evaluateRigWorldTransforms(rig, {
      upper: { rotationDeg: 45 },
      lower: { rotationDeg: 45 },
    });
    const s45 = 100 * Math.SQRT1_2;
    assertClose(f4.lower.head.x, s45);
    assertClose(f4.lower.head.y, s45);
    assertClose(f4.lower.worldRotationDeg, 90);
    assertClose(f4.lower.tail.x, s45);
    assertClose(f4.lower.tail.y, s45 + 50);

    const f5 = evaluateRigWorldTransforms(rig, {
      upper: { rotationDeg: -45 },
      lower: { rotationDeg: 45 },
    });
    assertClose(f5.lower.worldRotationDeg, 0);
    assertClose(f5.lower.tail.x, s45 + 50);
    assertClose(f5.lower.tail.y, -s45);

    const f6 = evaluateRigWorldTransforms(rig, {
      upper: { dx: 25, dy: -10, rotationDeg: 90 },
      lower: { rotationDeg: -90 },
    });
    assertClose(f6.lower.head.x, 25);
    assertClose(f6.lower.head.y, 90);
    assertClose(f6.lower.tail.x, 75);
    assertClose(f6.lower.tail.y, 90);
  });

  it("Fixture 07-09: 3-bone arm with unordered input & negative rest angles", () => {
    const rig = createRigDefinition("r3", "UnorderedArm", "layer_arm", [
      { id: "hand", name: "Hand", parentId: "forearm", length: 20, restX: 0, restY: 0, restRotationDeg: 10 },
      { id: "forearm", name: "Forearm", parentId: "arm", length: 40, restX: 0, restY: 0, restRotationDeg: -20 },
      { id: "arm", name: "Arm", parentId: null, length: 60, restX: 0, restY: 0, restRotationDeg: 10 },
    ]);
    assert.deepEqual(rig.bones.map((b) => b.id), ["arm", "forearm", "hand"]);

    const w0 = evaluateRigWorldTransforms(rig, {});
    assertClose(w0.hand.worldRotationDeg, 0);

    const w8 = evaluateRigWorldTransforms(rig, { arm: { rotationDeg: 80 }, hand: { rotationDeg: 10 } });
    assertClose(w8.arm.worldRotationDeg, 90);
    assertClose(w8.forearm.worldRotationDeg, 70);
    assertClose(w8.hand.worldRotationDeg, 90);

    const w9 = evaluateRigWorldTransforms(rig, { forearm: { rotationDeg: 20 } });
    assertClose(w9.forearm.worldRotationDeg, 10);
    assertClose(w9.hand.worldRotationDeg, 20);
  });

  it("Fixture 10-12: 5-bone spine+neck+head & hierarchical uniform scaling", () => {
    const rig = createRigDefinition("r4", "Spine", "layer_char", [
      { id: "hips", name: "Hips", parentId: null, length: 30, restX: 0, restY: 0, restRotationDeg: -90 },
      { id: "spine1", name: "Spine1", parentId: "hips", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "spine2", name: "Spine2", parentId: "spine1", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "neck", name: "Neck", parentId: "spine2", length: 20, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "head", name: "Head", parentId: "neck", length: 30, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);

    const f10 = evaluateRigWorldTransforms(rig, {});
    assertClose(f10.head.head.x, 0);
    assertClose(f10.head.head.y, -130);
    assertClose(f10.head.tail.y, -160);

    const f11 = evaluateRigWorldTransforms(rig, { hips: { scaleX: 2, scaleY: 2 } });
    assertClose(f11.head.head.y, -260);
    assertClose(f11.head.tail.y, -320);

    const f12 = evaluateRigWorldTransforms(rig, {
      hips: { rotationDeg: 15 },
      neck: { rotationDeg: 15 },
      head: { rotationDeg: -30 },
    });
    assertClose(f12.head.worldRotationDeg, -90);
  });

  it("Fixture 13-14: branched torso with left and right arms", () => {
    const rig = createRigDefinition("r5", "Torso", "layer_torso", [
      { id: "chest", name: "Chest", parentId: null, length: 60, restX: 100, restY: 200, restRotationDeg: -90 },
      { id: "arm_l", name: "Arm.L", parentId: "chest", length: 50, restX: -10, restY: -20, restRotationDeg: -90 },
      { id: "arm_r", name: "Arm.R", parentId: "chest", length: 50, restX: -10, restY: 20, restRotationDeg: 90 },
    ]);
    const w = evaluateRigWorldTransforms(rig, {});
    assertClose(w.chest.tail.x, 100);
    assertClose(w.chest.tail.y, 140);
    assertClose(w.arm_l.head.x, 80);
    assertClose(w.arm_l.head.y, 150);
    assertClose(Math.abs(w.arm_l.worldRotationDeg), 180);
    assertClose(w.arm_r.head.x, 120);
    assertClose(w.arm_r.head.y, 150);
    assertClose(w.arm_r.worldRotationDeg, 0);
  });

  it("Fixture 15-16: rigid layer attachment & non-zero child offset", () => {
    const rig = createRigDefinition(
      "r6",
      "Rigid",
      "layer_root",
      [{ id: "root", name: "Root", parentId: null, length: 80, restX: 50, restY: 50, restRotationDeg: 0 }],
      [{ layerId: "badge", mode: "rigid", boneId: "root", offsetX: 40, offsetY: 10, offsetRotationDeg: 15 }],
    );

    const w15 = evaluateRigWorldTransforms(rig, {});
    const l15 = evaluateRigidBoundLayer(rig.skins[0] as Extract<(typeof rig.skins)[number], { mode: "rigid" }>, w15)!;
    assertClose(l15.x, 90);
    assertClose(l15.y, 60);
    assertClose(l15.rotationDeg, 15);

    const w16 = evaluateRigWorldTransforms(rig, { root: { rotationDeg: 90 } });
    const l16 = evaluateRigidBoundLayer(rig.skins[0] as Extract<(typeof rig.skins)[number], { mode: "rigid" }>, w16)!;
    assertClose(l16.x, 40);
    assertClose(l16.y, 90);
    assertClose(l16.rotationDeg, 105);
  });

  it("Fixture 17-19: Linear-Blend Skinning (rest identity, 50/50 split, 3-bone bend)", () => {
    const rig = createRigDefinition("r7", "Skinned", "layer_mesh", [
      { id: "b1", name: "B1", parentId: null, length: 100, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "b2", name: "B2", parentId: "b1", length: 100, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "b3", name: "B3", parentId: "b2", length: 100, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const bind = computeBindMatrices(rig);

    const restW = evaluateRigWorldTransforms(rig, {});
    const p17 = evaluateSkinnedPoint(
      { x: 120, y: 15 },
      [
        { boneId: "b1", weight: 0.25 },
        { boneId: "b2", weight: 0.75 },
      ],
      bind,
      restW,
    );
    assertClose(p17.x, 120);
    assertClose(p17.y, 15);

    const bend90: RigPoseMap = { b2: { rotationDeg: 90 } };
    const w18 = evaluateRigWorldTransforms(rig, bend90);
    const p18 = evaluateSkinnedPoint(
      { x: 100, y: 0 },
      [
        { boneId: "b1", weight: 0.5 },
        { boneId: "b2", weight: 0.5 },
      ],
      bind,
      w18,
    );
    assertClose(p18.x, 100);
    assertClose(p18.y, 0);

    const p19 = evaluateSkinnedPoint(
      { x: 120, y: 0 },
      [
        { boneId: "b1", weight: 0.5 },
        { boneId: "b2", weight: 0.5 },
      ],
      bind,
      w18,
    );
    assertClose(p19.x, 110);
    assertClose(p19.y, 10);
  });

  it("Fixture 20: zero-length pivot bone + deep 6-bone tail + weight normalization", () => {
    const rig = createRigDefinition("r8", "Tail", "layer_tail", [
      { id: "pivot", name: "Pivot", parentId: null, length: 0, restX: 50, restY: 50, restRotationDeg: 0 },
      { id: "t1", name: "T1", parentId: "pivot", length: 20, restX: 0, restY: 0, restRotationDeg: 15 },
      { id: "t2", name: "T2", parentId: "t1", length: 20, restX: 0, restY: 0, restRotationDeg: 15 },
      { id: "t3", name: "T3", parentId: "t2", length: 20, restX: 0, restY: 0, restRotationDeg: 15 },
      { id: "t4", name: "T4", parentId: "t3", length: 20, restX: 0, restY: 0, restRotationDeg: 15 },
      { id: "t5", name: "T5", parentId: "t4", length: 20, restX: 0, restY: 0, restRotationDeg: 30 },
    ]);
    const w = evaluateRigWorldTransforms(rig, {});
    assertClose(w.t5.worldRotationDeg, 90);
    assertClose(w.pivot.head.x, 50);
    assertClose(w.pivot.tail.x, 50);

    const normalized = normalizeVertexWeights([
      { boneId: "t1", weight: 2 },
      { boneId: "t2", weight: 6 },
      { boneId: "t3", weight: 2 },
    ]);
    const sum = normalized.reduce((s, v) => s + v.weight, 0);
    assertClose(sum, 1);
  });
});
