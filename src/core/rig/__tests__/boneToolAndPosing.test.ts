import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createBoneToolSession,
  drawBoneOnCanvas,
  attachLayerToBoneCommand,
  beginPoseGesture,
  updatePoseBoneFK,
  commitPoseGesture,
  resetRigToRestPose,
  undoBoneSession,
  redoBoneSession,
  setBoneOverlayVisible,
  hitTestBoneOverlay,
} from "../boneToolAndPosing";
import { evaluateRigWorldTransforms } from "../rigModel";

const assertClose = (a: number, b: number, eps = 1e-4) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b}`);
};

describe("Phase 204 · Bone tool & FK posing (15-step journey)", () => {
  it("completes the 15-step draw, attach, multi-drag pose, undo/redo, rest, and overlay journey", () => {
    const session = createBoneToolSession();

    const b1 = drawBoneOnCanvas(session, { x: 100, y: 100 }, { x: 180, y: 100 }, { id: "arm" });
    const b2 = drawBoneOnCanvas(session, { x: 180, y: 100 }, { x: 240, y: 100 }, { id: "forearm" });
    const b3 = drawBoneOnCanvas(session, { x: 240, y: 100 }, { x: 270, y: 100 }, { id: "hand" });
    assertClose(b1.length, 80);
    assertClose(b2.length, 60);
    assertClose(b3.length, 30);
    assert.equal(b2.parentId, "arm");
    assert.equal(b3.parentId, "forearm");

    assert.equal(attachLayerToBoneCommand(session, "layer_upper", "arm"), true);
    assert.equal(attachLayerToBoneCommand(session, "layer_lower", "forearm"), true);
    assert.equal(attachLayerToBoneCommand(session, "layer_hand", "hand"), true);
    assert.equal(session.undoStack.length, 6);

    beginPoseGesture(session, "Rotate arm");
    updatePoseBoneFK(session, "arm", { rotationDeg: 15 });
    updatePoseBoneFK(session, "arm", { rotationDeg: 15 });
    updatePoseBoneFK(session, "arm", { rotationDeg: 15 });
    assert.equal(commitPoseGesture(session), true);
    assert.equal(session.undoStack.length, 7);

    beginPoseGesture(session, "Bend elbow");
    updatePoseBoneFK(session, "forearm", { rotationDeg: 20 });
    updatePoseBoneFK(session, "forearm", { rotationDeg: 25 });
    assert.equal(commitPoseGesture(session), true);
    assert.equal(session.undoStack.length, 8);

    const w10 = evaluateRigWorldTransforms(session.rig, session.pose);
    assertClose(w10.hand.worldRotationDeg, 90);
    assertClose(w10.hand.tail.x, 100 + 80 * Math.SQRT1_2);
    assertClose(w10.hand.tail.y, 100 + 80 * Math.SQRT1_2 + 90);

    const forearmMid = {
      x: (w10.forearm.head.x + w10.forearm.tail.x) / 2,
      y: (w10.forearm.head.y + w10.forearm.tail.y) / 2,
    };
    const hitId = hitTestBoneOverlay(w10, forearmMid, 10);
    assert.equal(hitId, "forearm");

    assert.equal(undoBoneSession(session), true);
    const w12 = evaluateRigWorldTransforms(session.rig, session.pose);
    assertClose(w12.hand.worldRotationDeg, 45);

    assert.equal(redoBoneSession(session), true);
    const w13 = evaluateRigWorldTransforms(session.rig, session.pose);
    assertClose(w13.hand.worldRotationDeg, 90);

    setBoneOverlayVisible(session, false);
    assert.equal(session.showBoneOverlay, false);
    setBoneOverlayVisible(session, true);
    assert.equal(session.showBoneOverlay, true);

    resetRigToRestPose(session);
    const w15 = evaluateRigWorldTransforms(session.rig, session.pose);
    assertClose(w15.hand.tail.x, 270);
    assertClose(w15.hand.tail.y, 100);
  });
});
