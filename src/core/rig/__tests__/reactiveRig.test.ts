import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRigDefinition } from "../rigModel";
import { runReactiveRigTape, type ReactiveRigConfig } from "../reactiveRig";

describe("Phase 210 · Rigs that react (5 reactive rig tapes + keyboard walk)", () => {
  const mascotRig = createRigDefinition("mascot", "Mascot", "layer_mascot", [
    { id: "spine", name: "Spine", parentId: null, length: 50, restX: 200, restY: 200, restRotationDeg: -90 },
    { id: "neck", name: "Neck", parentId: "spine", length: 20, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "head", name: "Head", parentId: "neck", length: 40, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "eye_l", name: "Eye.L", parentId: "head", length: 12, restX: 10, restY: -10, restRotationDeg: 0 },
    { id: "eye_r", name: "Eye.R", parentId: "head", length: 12, restX: 10, restY: 10, restRotationDeg: 0 },
    { id: "arm_u", name: "ArmU", parentId: "spine", length: 35, restX: -5, restY: 20, restRotationDeg: 90 },
    { id: "arm_l", name: "ArmL", parentId: "arm_u", length: 30, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "leg_l", name: "Leg.L", parentId: null, length: 45, restX: 190, restY: 200, restRotationDeg: 90 },
    { id: "leg_r", name: "Leg.R", parentId: null, length: 45, restX: 210, restY: 200, restRotationDeg: 90 },
  ]);

  const baseConfig: ReactiveRigConfig = {
    followCursorScope: "head",
    rigOriginX: 200,
    rigOriginY: 200,
    eyeLeftBoneId: "eye_l",
    eyeRightBoneId: "eye_r",
    neckBoneId: "neck",
    headBoneId: "head",
    spineBoneId: "spine",
    handIkBoneIds: ["arm_u", "arm_l"],
    walkLegLeftId: "leg_l",
    walkLegRightId: "leg_r",
  };

  it("evaluates 5 reactive modes (eyes, head+neck, whole-body IK, scroll lean, arrow walk + click)", () => {
    // 1. Eyes only leaves head unrotated
    const eyesOut = runReactiveRigTape(mascotRig, { ...baseConfig, followCursorScope: "eyes" }, [
      { pointerX: 350, pointerY: 100, dtSec: 1 / 60 },
    ]);
    assert.equal(eyesOut[0].pose.head, undefined);
    assert.ok(eyesOut[0].pose.eye_l?.rotationDeg !== undefined);

    // 2. Head + neck bends both neck & head
    const headOut = runReactiveRigTape(mascotRig, { ...baseConfig, followCursorScope: "head" }, [
      { pointerX: 350, pointerY: 120, dtSec: 1 / 60 },
      { pointerX: 350, pointerY: 120, dtSec: 1 / 60 },
    ]);
    assert.ok(Math.abs(headOut[1].pose.neck?.rotationDeg ?? 0) > 1);
    assert.ok(Math.abs(headOut[1].pose.head?.rotationDeg ?? 0) > 1);

    // 3. Whole-body includes spine tilt + 2-bone IK arm reach
    const wholeOut = runReactiveRigTape(mascotRig, { ...baseConfig, followCursorScope: "whole-body" }, [
      { pointerX: 260, pointerY: 140, dtSec: 1 / 60 },
    ]);
    assert.ok(Math.abs(wholeOut[0].pose.spine?.rotationDeg ?? 0) > 0.5);
    assert.ok(wholeOut[0].pose.arm_u?.rotationDeg !== undefined);

    // 4. Scroll speed leans spine
    const scrollOut = runReactiveRigTape(mascotRig, baseConfig, [
      { pointerX: 200, pointerY: 100, scrollVelocity: 500, dtSec: 1 / 60 },
    ]);
    assert.ok(Math.abs(scrollOut[0].pose.spine?.rotationDeg ?? 0) >= 10);

    // 5. Keyboard ArrowRight walks character forward and swings legs; click pulses
    const walkOut = runReactiveRigTape(mascotRig, baseConfig, [
      { pointerX: 200, pointerY: 100, keysPressed: ["ArrowRight"], clicked: true, dtSec: 0.1 },
      { pointerX: 200, pointerY: 100, keysPressed: ["ArrowRight"], dtSec: 0.1 },
    ]);
    assert.ok(walkOut[1].worldOffsetX > 25);
    assert.ok(Math.abs(walkOut[0].pose.leg_l?.rotationDeg ?? 0) > 5);
    assert.ok(walkOut[0].clickPulse === 1);
  });
});
