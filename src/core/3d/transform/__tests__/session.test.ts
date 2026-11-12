/**
 * ============================================================================
 * UNIT TESTS: TRANSFORM SESSION (15-STEP JOURNEY)
 * ============================================================================
 * Phase 3D-016: session.ts verification
 * 15-step interactive transformation journey checked against hand-computed
 * golden values with tolerance 1e-9.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compose,
  identity,
  quat,
  quatFromEuler,
  vec3,
} from "../../math";
import {
  TransformSession,
  type TransformSessionObject,
  type ViewCameraInfo,
} from "../session";

const SQRT1_2 = Math.SQRT1_2; // ~0.7071067811865476

function assertFloatsClose(
  actual: number,
  expected: number,
  eps = 1e-9,
  msg = "Float mismatch"
) {
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    assert.fail(`${msg}: actual=${actual} expected=${expected} diff=${diff} > ${eps}`);
  }
}

function assertVectorsClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  eps = 1e-9,
  msg = "Vector mismatch"
) {
  assert.equal(actual.length, expected.length, `${msg}: length mismatch`);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > eps) {
      assert.fail(`${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

function makeDefaultCamera(): ViewCameraInfo {
  // Simple camera looking down -Z at depth 5
  const viewMat = identity();
  viewMat[14] = -5; // camera at z = +5

  const projMat = identity();
  projMat[0] = 1;
  projMat[5] = 1;
  projMat[10] = -1;
  projMat[14] = -1;
  projMat[15] = 0; // perspective

  return {
    viewMatrix: viewMat,
    projectionMatrix: projMat,
    viewport: { width: 800, height: 600 },
  };
}

describe("TransformSession: 15-Step Journey", () => {
  it("Step 1: 'G X 2 Enter' translates object along global X by 2 metres", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.setAxis("X", { plane: false });
    session.typeChar("2");
    assertFloatsClose(session.value(), 2);

    const committed = session.commit();
    assert.equal(committed.length, 1);
    assertVectorsClose(committed[0].location, [2, 0, 0]);
    assertVectorsClose(committed[0].rotationQuat, [0, 0, 0, 1]);
    assertVectorsClose(committed[0].scale, [1, 1, 1]);
  });

  it("Step 2: 'R Z 90 Enter' rotates 90 degrees around Z at pivot", () => {
    // Object already at location [2, 0, 0]
    const m = identity();
    m[12] = 2;

    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: m,
      local: {
        location: vec3(2, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "rotate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(2, 0, 0), // Pivot at object origin
    });

    session.setAxis("Z", { plane: false });
    session.typeChar("9").typeChar("0");
    assertFloatsClose(session.value(), 90);
    assertFloatsClose(session.storedValue(), Math.PI / 2);

    const committed = session.commit();
    assertVectorsClose(committed[0].location, [2, 0, 0]);
    // Quaternion for +90 deg around Z is [0, 0, sin(45 deg), cos(45 deg)]
    assertVectorsClose(committed[0].rotationQuat, [0, 0, SQRT1_2, SQRT1_2]);
    assertVectorsClose(committed[0].scale, [1, 1, 1]);
  });

  it("Step 3: 'S 2 Enter' applies uniform scale 2 around pivot", () => {
    const qZ90 = quat(0, 0, SQRT1_2, SQRT1_2);
    const m = compose(vec3(2, 0, 0), qZ90, vec3(1, 1, 1));

    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: m,
      local: {
        location: vec3(2, 0, 0),
        rotationQuat: qZ90,
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "scale",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(2, 0, 0),
    });

    session.typeChar("2");
    assertFloatsClose(session.value(), 2);

    const committed = session.commit();
    assertVectorsClose(committed[0].location, [2, 0, 0]);
    assertVectorsClose(committed[0].rotationQuat, [0, 0, SQRT1_2, SQRT1_2]);
    assertVectorsClose(committed[0].scale, [2, 2, 2]);
  });

  it("Step 4: Cancel restores original transform exactly", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(5, 10, 15),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(5, 10, 15),
    });

    session.setAxis("X");
    session.typeChar("5").typeChar("0");

    const cancelled = session.cancel();
    assertVectorsClose(cancelled[0].location, [5, 10, 15]);
  });

  it("Step 5: 'G Shift+Z 4' translates in the XY plane by 4", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.setAxis("Z", { plane: true });
    assert.equal(session.isPlaneLocked, true);
    session.typeChar("4");

    const committed = session.commit();
    assertVectorsClose(committed[0].location, [4, 0, 0]); // Moves along in-plane X axis
  });

  it("Step 6: Typed negative values: '-3.5' translates along -X", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.setAxis("X");
    session.typeChar("3").typeChar(".").typeChar("5").negate();
    assertFloatsClose(session.value(), -3.5);

    const committed = session.commit();
    assertVectorsClose(committed[0].location, [-3.5, 0, 0]);
  });

  it("Step 7: Numeric buffer editing with backspace and negate", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.typeChar("1").typeChar("5");
    assertFloatsClose(session.value(), 15);
    session.backspace();
    assertFloatsClose(session.value(), 1);
    session.negate();
    assertFloatsClose(session.value(), -1);
    session.typeChar(".").typeChar("2");
    assertFloatsClose(session.value(), -1.2);
  });

  it("Step 8: Repeated axis key toggles global and local orientation spaces", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.setAxis("X");
    assert.equal(session.currentAxis, "X");
    assert.equal(session.currentSpace, "global");

    // Press X again -> toggles to local
    session.setAxis("X");
    assert.equal(session.currentSpace, "local");

    // Press X again -> toggles back to global
    session.setAxis("X");
    assert.equal(session.currentSpace, "global");
  });

  it("Step 9: Child of a rotated parent (+90 deg Z) moves correctly along world X", () => {
    // Parent rotated +90 deg around Z:
    // Parent X points along world +Y; Parent Y points along world -X.
    const parentQuat = quat(0, 0, SQRT1_2, SQRT1_2);
    const parentWorld = compose(vec3(0, 0, 0), parentQuat, vec3(1, 1, 1));

    // Child is at local location [1, 0, 0]
    // In world space, child is at [0, 1, 0]
    const childLocal = vec3(1, 0, 0);
    const childWorld = compose(vec3(0, 1, 0), parentQuat, vec3(1, 1, 1));

    const childObj: TransformSessionObject = {
      id: "child",
      worldMatrix: childWorld,
      parentWorldMatrix: parentWorld,
      local: {
        location: childLocal,
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [childObj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 1, 0),
    });

    // Translate along global X by +2 metres:
    session.setAxis("X");
    session.typeChar("2");

    const committed = session.commit();
    assert.equal(committed.length, 1);

    // Hand calculation:
    // New world position is [0 + 2, 1, 0] = [2, 1, 0].
    // Converted back through parent (rotated -90 deg around Z):
    // R_z(-90) * [2, 1, 0] = [1, -2, 0].
    assertVectorsClose(committed[0].location, [1, -2, 0]);
  });

  it("Step 10: Child of a scaled parent (2x) moves correctly along world X", () => {
    const parentScale = vec3(2, 2, 2);
    const parentWorld = compose(vec3(0, 0, 0), quat(0, 0, 0, 1), parentScale);

    // Child local [1, 0, 0] -> world [2, 0, 0]
    const childWorld = compose(vec3(2, 0, 0), quat(0, 0, 0, 1), parentScale);

    const childObj: TransformSessionObject = {
      id: "child",
      worldMatrix: childWorld,
      parentWorldMatrix: parentWorld,
      local: {
        location: vec3(1, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [childObj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(2, 0, 0),
    });

    // Translate by +4 in world X
    session.setAxis("X");
    session.typeChar("4");

    const committed = session.commit();
    // New world position is [6, 0, 0].
    // Converted through parent inverse (1/2 scale): [3, 0, 0].
    assertVectorsClose(committed[0].location, [3, 0, 0]);
  });

  it("Step 11: Child of a rotated (+90 Z) and scaled (2x) parent", () => {
    const parentQuat = quat(0, 0, SQRT1_2, SQRT1_2);
    const parentScale = vec3(2, 2, 2);
    const parentWorld = compose(vec3(0, 0, 0), parentQuat, parentScale);

    // Child local [1, 0, 0] -> parent scale [2, 0, 0] -> parent rot [0, 2, 0]
    const childWorld = compose(vec3(0, 2, 0), parentQuat, parentScale);

    const childObj: TransformSessionObject = {
      id: "child",
      worldMatrix: childWorld,
      parentWorldMatrix: parentWorld,
      local: {
        location: vec3(1, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [childObj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 2, 0),
    });

    // Translate along world X by +2
    session.setAxis("X");
    session.typeChar("2");

    const committed = session.commit();
    // Hand calculation:
    // New world position = [2, 2, 0].
    // Parent inverse: unscale 1/2 gives [1, 1, 0].
    // Rotate by -90 Z gives [1, -1, 0].
    assertVectorsClose(committed[0].location, [1, -1, 0]);
  });

  it("Step 12: Rotation around a pivot distant from object origin", () => {
    // Object at [3, 0, 0], pivot at [0, 0, 0]
    const m = identity();
    m[12] = 3;

    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: m,
      local: {
        location: vec3(3, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "rotate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.setAxis("Z");
    session.typeChar("9").typeChar("0");

    const committed = session.commit();
    // Position [3, 0, 0] rotated 90 deg around origin becomes [0, 3, 0]
    assertVectorsClose(committed[0].location, [0, 3, 0]);
    assertVectorsClose(committed[0].rotationQuat, [0, 0, SQRT1_2, SQRT1_2]);
  });

  it("Step 13: Scale around a pivot distant from object origin", () => {
    // Object at [2, 0, 0], pivot at [0, 0, 0]
    const m = identity();
    m[12] = 2;

    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: m,
      local: {
        location: vec3(2, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "scale",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.typeChar("2");

    const committed = session.commit();
    // Distance from pivot doubles: [4, 0, 0]
    assertVectorsClose(committed[0].location, [4, 0, 0]);
    assertVectorsClose(committed[0].scale, [2, 2, 2]);
  });

  it("Step 14: Mouse move translates at pivot depth", () => {
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: identity(),
      local: {
        location: vec3(0, 0, 0),
        rotationQuat: quat(0, 0, 0, 1),
        scale: vec3(1, 1, 1),
      },
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: vec3(0, 0, 0),
    });

    session.moveMouse(100, 0);
    const committed = session.commit();
    // Depth is 5, viewport width is 800 -> motion in +X
    assert.ok(committed[0].location[0] > 0);
    assertFloatsClose(committed[0].location[1], 0);
    assertFloatsClose(committed[0].location[2], 0);
  });

  it("Step 15: Commit followed by cancel invariant", () => {
    const originalLocal = {
      location: vec3(7, -3, 11),
      rotationQuat: quatFromEuler("XYZ", 0.1, 0.2, 0.3),
      scale: vec3(1.5, 1.5, 1.5),
    };
    const obj: TransformSessionObject = {
      id: "obj1",
      worldMatrix: compose(originalLocal.location, originalLocal.rotationQuat, originalLocal.scale),
      local: originalLocal,
    };

    const session = new TransformSession({
      mode: "translate",
      objects: [obj],
      viewCamera: makeDefaultCamera(),
      pivot: originalLocal.location,
    });

    session.setAxis("Y");
    session.typeChar("5");
    const committed = session.commit();
    assertVectorsClose(committed[0].location, [7, 2, 11]);

    // Cancel returns original transforms identically
    const cancelled = session.cancel();
    assertVectorsClose(cancelled[0].location, [7, -3, 11]);
    assertVectorsClose(cancelled[0].rotationQuat, originalLocal.rotationQuat);
    assertVectorsClose(cancelled[0].scale, [1.5, 1.5, 1.5]);
  });
});
