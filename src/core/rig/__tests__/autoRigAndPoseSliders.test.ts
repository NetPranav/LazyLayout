import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRigWorldTransforms } from "../rigModel";
import {
  autoRigIllustration,
  evaluatePoseSliders,
  type IllustrationLayerPart,
} from "../autoRigAndPoseSliders";

const assertClose = (a: number, b: number, eps = 1e-4) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b}`);
};

const FIXTURE_ILLUSTRATIONS: { name: string; parts: IllustrationLayerPart[] }[] = [
  {
    name: "01 Named Person",
    parts: [
      { id: "p1", name: "head", bounds: { x: 80, y: 20, width: 40, height: 40 } },
      { id: "p2", name: "torso", bounds: { x: 75, y: 60, width: 50, height: 70 } },
      { id: "p3", name: "arm_L", bounds: { x: 45, y: 65, width: 30, height: 60 } },
      { id: "p4", name: "arm_R", bounds: { x: 125, y: 65, width: 30, height: 60 } },
      { id: "p5", name: "leg_L", bounds: { x: 75, y: 130, width: 22, height: 70 } },
      { id: "p6", name: "leg_R", bounds: { x: 103, y: 130, width: 22, height: 70 } },
    ],
  },
  {
    name: "02 Unnamed Geometric Person",
    parts: [
      { id: "s1", name: "Oval 1", bounds: { x: 80, y: 20, width: 40, height: 40 } },
      { id: "s2", name: "Rect 1", bounds: { x: 75, y: 60, width: 50, height: 70 } },
      { id: "s3", name: "Rect 2", bounds: { x: 40, y: 65, width: 30, height: 55 } },
      { id: "s4", name: "Rect 3", bounds: { x: 130, y: 65, width: 30, height: 55 } },
      { id: "s5", name: "Rect 4", bounds: { x: 75, y: 135, width: 20, height: 65 } },
      { id: "s6", name: "Rect 5", bounds: { x: 105, y: 135, width: 20, height: 65 } },
    ],
  },
  {
    name: "03 Quadruped Dog",
    parts: [
      { id: "d1", name: "dog_head", bounds: { x: 130, y: 40, width: 40, height: 35 } },
      { id: "d2", name: "body", bounds: { x: 60, y: 65, width: 90, height: 45 } },
      { id: "d3", name: "tail", bounds: { x: 30, y: 55, width: 35, height: 20 } },
      { id: "d4", name: "leg_L", bounds: { x: 65, y: 110, width: 15, height: 40 } },
      { id: "d5", name: "leg_R", bounds: { x: 130, y: 110, width: 15, height: 40 } },
    ],
  },
  {
    name: "04 Quadruped Cat",
    parts: [
      { id: "c1", name: "head", bounds: { x: 80, y: 40, width: 40, height: 38 } },
      { id: "c2", name: "body", bounds: { x: 65, y: 78, width: 70, height: 50 } },
      { id: "c3", name: "tail", bounds: { x: 25, y: 90, width: 40, height: 15 } },
      { id: "c4", name: "ear_L", bounds: { x: 78, y: 24, width: 12, height: 18 } },
      { id: "c5", name: "ear_R", bounds: { x: 110, y: 24, width: 12, height: 18 } },
    ],
  },
  {
    name: "05 Portrait Face",
    parts: [
      { id: "f1", name: "face_base", bounds: { x: 60, y: 40, width: 80, height: 95 } },
      { id: "f2", name: "eye_L", bounds: { x: 78, y: 72, width: 14, height: 14 } },
      { id: "f3", name: "eye_R", bounds: { x: 108, y: 72, width: 14, height: 14 } },
      { id: "f4", name: "mouth", bounds: { x: 85, y: 105, width: 30, height: 12 } },
    ],
  },
  {
    name: "06 Blob Mascot",
    parts: [
      { id: "m1", name: "body", bounds: { x: 60, y: 50, width: 80, height: 90 } },
      { id: "m2", name: "arm_L", bounds: { x: 35, y: 80, width: 25, height: 20 } },
      { id: "m3", name: "arm_R", bounds: { x: 140, y: 80, width: 25, height: 20 } },
    ],
  },
  {
    name: "07 Floating Robot",
    parts: [
      { id: "r1", name: "head", bounds: { x: 75, y: 25, width: 50, height: 40 } },
      { id: "r2", name: "chest", bounds: { x: 70, y: 65, width: 60, height: 65 } },
      { id: "r3", name: "antenna_L", bounds: { x: 80, y: 5, width: 8, height: 20 } },
      { id: "r4", name: "antenna_R", bounds: { x: 112, y: 5, width: 8, height: 20 } },
    ],
  },
  {
    name: "08 Winged Bird Mascot",
    parts: [
      { id: "b1", name: "head", bounds: { x: 82, y: 30, width: 36, height: 32 } },
      { id: "b2", name: "body", bounds: { x: 75, y: 62, width: 50, height: 55 } },
      { id: "b3", name: "wing_L", bounds: { x: 35, y: 65, width: 40, height: 25 } },
      { id: "b4", name: "wing_R", bounds: { x: 125, y: 65, width: 40, height: 25 } },
    ],
  },
  {
    name: "09 Asymmetric Monster",
    parts: [
      { id: "x1", name: "Group 1", bounds: { x: 65, y: 40, width: 70, height: 95 } },
      { id: "x2", name: "Path 2", bounds: { x: 35, y: 70, width: 30, height: 40 } },
      { id: "x3", name: "Path 3", bounds: { x: 135, y: 70, width: 30, height: 40 } },
    ],
  },
  {
    name: "10 Simple 3-Part Mascot",
    parts: [
      { id: "z1", name: "head", bounds: { x: 80, y: 30, width: 40, height: 40 } },
      { id: "z2", name: "torso", bounds: { x: 75, y: 70, width: 50, height: 60 } },
      { id: "z3", name: "arm_R", bounds: { x: 125, y: 75, width: 25, height: 30 } },
    ],
  },
];

describe("Phase 212 · Auto-rig & pose sliders (10 fixture illustrations)", () => {
  it("auto-rigs all 10 fixture illustrations with valid connected bones & skins", () => {
    let successCount = 0;
    for (const fixture of FIXTURE_ILLUSTRATIONS) {
      const res = autoRigIllustration(fixture.parts);
      assert.ok(res.rig.bones.length >= 4, `${fixture.name} should have >=4 bones`);
      assert.equal(res.rig.skins.length, fixture.parts.length);
      const world = evaluateRigWorldTransforms(res.rig, {});
      assert.ok(world.spine !== undefined);
      assert.equal(res.poseSliders.length, 4);
      successCount++;
    }
    assert.ok(successCount >= 8);
  });

  it("blends additive pose sliders (happy, sad, wave, point) cleanly", () => {
    const res = autoRigIllustration(FIXTURE_ILLUSTRATIONS[0].parts);
    const posed = evaluatePoseSliders(res.poseSliders, { happy: 0.5, wave: 1.0 });
    assertClose(posed.head.rotationDeg ?? 0, -13, 0.5);
    assertClose(posed.arm_r.rotationDeg ?? 0, -77.5, 0.5);
  });
});
