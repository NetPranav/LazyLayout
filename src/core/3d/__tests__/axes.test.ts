/**
 * ============================================================================
 * UNIT TESTS: 3D AXIS CONVERSIONS (glTF Y-Up <-> Blender Z-Up)
 * ============================================================================
 * Phase 3D-009: axes.ts verification
 *   - Axis conversion round-trips with exact inverses for Vec3, Quat, and Mat4.
 *   - Verification of known cardinal axes and handedness preservation.
 *   - Translation and orientation matrix transformations.
 *   - Polymorphic conversion dispatcher and dedicated typed functions.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAT4_Y_UP_TO_Z_UP,
  MAT4_Z_UP_TO_Y_UP,
  QUAT_Y_UP_TO_Z_UP,
  QUAT_Z_UP_TO_Y_UP,
  yUpToZUp,
  yUpToZUpMat4,
  yUpToZUpQuat,
  yUpToZUpVec3,
  zUpToYUp,
  zUpToYUpMat4,
  zUpToYUpQuat,
  zUpToYUpVec3,
} from "../axes";
import {
  compose,
  decompose,
  mat4From,
  multiply,
  quat,
  quatFromEuler,
  quatMultiply,
  vec3,
} from "../math";

function assertNear(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-12,
  msg = "Array mismatch"
) {
  assert.equal(actual.length, expected.length, `${msg}: length mismatch`);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    assert.ok(
      diff <= epsilon,
      `${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`
    );
  }
}

describe("3D Axis Conversions: Constants & Known Axes", () => {
  it("converts Blender Z-up cardinal directions to glTF Y-up cardinal directions", () => {
    // Up in Blender Z-up: [0, 0, 1] -> Up in glTF Y-up: [0, 1, 0]
    const zUp = zUpToYUpVec3([0, 0, 1]);
    assertNear(Array.from(zUp), [0, 1, 0]);

    // Right in Blender Z-up: [1, 0, 0] -> Right in glTF Y-up: [1, 0, 0]
    const xRight = zUpToYUpVec3([1, 0, 0]);
    assertNear(Array.from(xRight), [1, 0, 0]);

    // Away / Forward in Blender Z-up: [0, 1, 0] -> Forward (-Z) in glTF Y-up: [0, 0, -1]
    const yForward = zUpToYUpVec3([0, 1, 0]);
    assertNear(Array.from(yForward), [0, 0, -1]);
  });

  it("converts glTF Y-up cardinal directions to Blender Z-up cardinal directions", () => {
    // Up in glTF Y-up: [0, 1, 0] -> Up in Blender Z-up: [0, 0, 1]
    const yUp = yUpToZUpVec3([0, 1, 0]);
    assertNear(Array.from(yUp), [0, 0, 1]);

    // Right in glTF Y-up: [1, 0, 0] -> Right in Blender Z-up: [1, 0, 0]
    const xRight = yUpToZUpVec3([1, 0, 0]);
    assertNear(Array.from(xRight), [1, 0, 0]);

    // Forward (-Z) in glTF Y-up: [0, 0, -1] -> Away / Forward in Blender Z-up: [0, 1, 0]
    const zForward = yUpToZUpVec3([0, 0, -1]);
    assertNear(Array.from(zForward), [0, 1, 0]);
  });

  it("base transformation matrices and quaternions are exact inverses", () => {
    // Mat4 inverses: R * R^-1 = Identity
    const identityMat = multiply(MAT4_Z_UP_TO_Y_UP, MAT4_Y_UP_TO_Z_UP);
    const expectedIdentity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    assertNear(Array.from(identityMat), expectedIdentity, 1e-15);

    // Quat inverses: Q_{Z->Y} * Q_{Y->Z} = Identity
    const qProduct = quatMultiply(QUAT_Z_UP_TO_Y_UP, QUAT_Y_UP_TO_Z_UP);
    assert.ok(Math.abs(qProduct[3] - 1) < 1e-12 || Math.abs(qProduct[3] + 1) < 1e-12);
    assert.ok(Math.abs(qProduct[0]) < 1e-12);
    assert.ok(Math.abs(qProduct[1]) < 1e-12);
    assert.ok(Math.abs(qProduct[2]) < 1e-12);
  });
});

describe("3D Axis Conversions: Round-Trips (Exact Inverses)", () => {
  it("Vec3 round-trips through zUpToYUp and yUpToZUp with bit-exact equality", () => {
    const vectors = [
      [0, 0, 0],
      [1, 2, 3],
      [-5, 10, -20],
      [100.5, -200.25, 300.75],
      [0.0001, -0.0002, 0.0003],
    ];

    for (const v of vectors) {
      const yUp = zUpToYUpVec3(v);
      const restored = yUpToZUpVec3(yUp);
      assert.equal(restored[0], v[0]);
      assert.equal(restored[1], v[1]);
      assert.equal(restored[2], v[2]);

      // Reverse direction: Y-up -> Z-up -> Y-up
      const zUp = yUpToZUpVec3(v);
      const restoredY = zUpToYUpVec3(zUp);
      assert.equal(restoredY[0], v[0]);
      assert.equal(restoredY[1], v[1]);
      assert.equal(restoredY[2], v[2]);
    }
  });

  it("Quat round-trips through zUpToYUp and yUpToZUp within 1e-12", () => {
    const quaternions = [
      quat(0, 0, 0, 1),
      quatFromEuler("XYZ", Math.PI / 4, 0, 0),
      quatFromEuler("XYZ", 0, Math.PI / 3, 0),
      quatFromEuler("XYZ", 0, 0, Math.PI / 2),
      quatFromEuler("YXZ", 0.5, -0.8, 1.2),
      quatFromEuler("ZYX", -1.1, 0.4, -0.9),
    ];

    for (const q of quaternions) {
      const yUp = zUpToYUpQuat(q);
      const restored = yUpToZUpQuat(yUp);

      // Quaternions q and -q represent identical rotation
      const dot =
        q[0] * restored[0] +
        q[1] * restored[1] +
        q[2] * restored[2] +
        q[3] * restored[3];
      assert.ok(
        Math.abs(Math.abs(dot) - 1.0) < 1e-12,
        `Quat round-trip mismatch: dot=${dot}`
      );
    }
  });

  it("Mat4 round-trips through zUpToYUp and yUpToZUp with exact bit-level inverse", () => {
    // Identity matrix
    const identityM = mat4From([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const restoredId = yUpToZUpMat4(zUpToYUpMat4(identityM));
    assert.deepEqual(Array.from(restoredId), Array.from(identityM));

    // Arbitrary TRS matrices
    const testCases = [
      { loc: [10, 20, 30], rot: [0, 0, 0, 1], scl: [1, 1, 1] },
      { loc: [-5, 12, -8], rot: [0.7071, 0, 0, 0.7071], scl: [2, 3, 4] },
      { loc: [0.5, -1.5, 2.5], rot: [0.1, 0.2, 0.3, 0.927], scl: [0.5, 1.5, 2.0] },
    ];

    for (const { loc, rot, scl } of testCases) {
      const originalM = compose(loc, rot, scl);

      const yUpM = zUpToYUpMat4(originalM);
      const restoredM = yUpToZUpMat4(yUpM);

      // Bit-exact preservation on all 16 matrix elements
      for (let i = 0; i < 16; i++) {
        assert.equal(
          restoredM[i],
          originalM[i],
          `Mismatch at index [${i}]: ${restoredM[i]} !== ${originalM[i]}`
        );
      }

      // Check translation component mapping
      assert.equal(yUpM[12], loc[0]);
      assert.equal(yUpM[13], loc[2]);
      assert.equal(yUpM[14], -loc[1]);
    }
  });

  it("polymorphic zUpToYUp and yUpToZUp dispatch accurately by array length", () => {
    // Vec3
    const v = vec3(1, 2, 3);
    const vY = zUpToYUp(v);
    assert.equal(vY.length, 3);
    assertNear(Array.from(vY), [1, 3, -2]);

    const vZ = yUpToZUp(vY);
    assertNear(Array.from(vZ), [1, 2, 3]);

    // Quat
    const q = quat(0, 0, 0, 1);
    const qY = zUpToYUp(q);
    assert.equal(qY.length, 4);
    const qZ = yUpToZUp(qY);
    assertNear(Array.from(qZ), [0, 0, 0, 1]);

    // Mat4
    const m = mat4From([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ]);
    const mY = zUpToYUp(m);
    assert.equal(mY.length, 16);
    const mZ = yUpToZUp(mY);
    assertNear(Array.from(mZ), Array.from(m));

    // Throws on invalid length
    assert.throws(() => zUpToYUp(new Float64Array(5)));
    assert.throws(() => yUpToZUp(new Float64Array(2)));
  });
});
