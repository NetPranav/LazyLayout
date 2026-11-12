/**
 * ============================================================================
 * UNIT TESTS: 3D LINEAR ALGEBRA KERNEL
 * ============================================================================
 * Phase 3D-008: math.ts verification
 *   - Identity, multiply, general invert, fast affine invert.
 *   - compose/decompose round-trip with varied translation, rotation, and scale.
 *   - quat/euler round-trips for all six orders (XYZ, XZY, YXZ, YZX, ZXY, ZYX)
 *     at a spread of angles across quadrants, plus gimbal lock cases.
 *   - quat multiply, normalize, slerp.
 *   - transformPoint and transformDirection.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  type EulerOrder,
  compose,
  decompose,
  eulerFromQuat,
  identity,
  invert,
  invertAffine,
  mat4,
  multiply,
  quat,
  quatFromEuler,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  transformDirection,
  transformPoint,
  vec3,
} from "../math";

function assertMatricesNear(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-6,
  msg = "Matrices differ"
) {
  assert.equal(actual.length, expected.length, `${msg}: length mismatch`);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > epsilon) {
      assert.fail(
        `${msg} at index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`
      );
    }
  }
}

function assertQuaternionsEquivalent(
  q1: ArrayLike<number>,
  q2: ArrayLike<number>,
  epsilon = 1e-6,
  msg = "Quaternions not equivalent"
) {
  // Quaternions q and -q represent the identical 3D rotation
  const dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
  const absDot = Math.abs(dot);
  if (Math.abs(absDot - 1.0) > epsilon) {
    assert.fail(
      `${msg}: |q1 . q2| = ${absDot}, expected ~1.0 (diff=${Math.abs(absDot - 1.0)})`
    );
  }
}

describe("3D Math: Mat4 Identity, Multiply & Inversion", () => {
  it("identity() returns 4x4 identity matrix", () => {
    const m = identity();
    assert.equal(m.length, 16);
    assertMatricesNear(
      m,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      1e-12
    );
  });

  it("multiply(identity, m) and multiply(m, identity) equal m", () => {
    const id = identity();
    const m = compose([1, 2, 3], [0, 0, 0, 1], [2, 3, 4]);

    const mLeft = multiply(id, m);
    assertMatricesNear(mLeft, m, 1e-12);

    const mRight = multiply(m, id);
    assertMatricesNear(mRight, m, 1e-12);
  });

  it("multiply accumulates translations and rotations correctly", () => {
    const t1 = compose([10, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
    const t2 = compose([5, 3, 2], [0, 0, 0, 1], [1, 1, 1]);
    const combined = multiply(t1, t2);

    assertMatricesNear(
      combined,
      compose([15, 3, 2], [0, 0, 0, 1], [1, 1, 1]),
      1e-12
    );
  });

  it("invert() general 4x4 multiplies with original to produce identity", () => {
    const m = compose(
      [12.5, -4.2, 7.8],
      quatNormalize(quat(0.2, -0.4, 0.7, 0.5)),
      [1.5, 0.8, 2.2]
    );

    const inv = invert(m);
    const prod = multiply(m, inv);
    assertMatricesNear(prod, identity(), 1e-10);

    const prodRev = multiply(inv, m);
    assertMatricesNear(prodRev, identity(), 1e-10);
  });

  it("invertAffine() produces exact inverse matching general invert on affine transforms", () => {
    const m = compose(
      [3.1, 4.2, -5.6],
      quatNormalize(quat(0.1, 0.3, -0.5, 0.8)),
      [2.0, 1.5, 0.5]
    );

    const invGeneral = invert(m);
    const invAffine = invertAffine(m);

    assertMatricesNear(invAffine, invGeneral, 1e-12);
    const prod = multiply(m, invAffine);
    assertMatricesNear(prod, identity(), 1e-12);
  });

  it("invert() and invertAffine() throw on singular matrix", () => {
    const singular = mat4();
    singular[0] = 0;
    singular[5] = 0;
    singular[10] = 0;

    assert.throws(() => invert(singular), /singular/i);
    assert.throws(() => invertAffine(singular), /singular/i);
  });
});

describe("3D Math: Compose & Decompose", () => {
  it("compose and decompose round-trip preserves location, quat and scale", () => {
    const testCases = [
      { loc: [0, 0, 0], q: [0, 0, 0, 1], scl: [1, 1, 1] },
      { loc: [10, -5, 2.5], q: [0, 0, 0, 1], scl: [1, 1, 1] },
      {
        loc: [-3.4, 15.2, 0.01],
        q: Array.from(quatNormalize(quat(0.5, -0.2, 0.4, 0.7))),
        scl: [2.5, 0.4, 1.8],
      },
      {
        loc: [100, -200, 300],
        q: Array.from(quatFromEuler("XYZ", Math.PI / 3, -Math.PI / 4, Math.PI / 6)),
        scl: [1, 2, 3],
      },
      // Reflection with negative scale
      {
        loc: [1, 2, 3],
        q: [0, 0, 0, 1],
        scl: [-1, 2, 3],
      },
    ];

    for (const tc of testCases) {
      const m = compose(tc.loc, tc.q, tc.scl);
      const decomp = decompose(m);

      // Verify reconstructed matrix matches exactly
      const recomposed = compose(decomp.location, decomp.quat, decomp.scale);
      assertMatricesNear(
        recomposed,
        m,
        1e-10,
        `Compose/decompose failed for case: ${JSON.stringify(tc)}`
      );

      // Verify individual components
      assert.ok(Math.abs(decomp.location[0] - tc.loc[0]) < 1e-10);
      assert.ok(Math.abs(decomp.location[1] - tc.loc[1]) < 1e-10);
      assert.ok(Math.abs(decomp.location[2] - tc.loc[2]) < 1e-10);

      assert.ok(Math.abs(decomp.scale[0] - tc.scl[0]) < 1e-10);
      assert.ok(Math.abs(decomp.scale[1] - tc.scl[1]) < 1e-10);
      assert.ok(Math.abs(decomp.scale[2] - tc.scl[2]) < 1e-10);

      assertQuaternionsEquivalent(decomp.quat, tc.q, 1e-9);
    }
  });
});

describe("3D Math: Quat <-> Euler Conversions for All 6 Orders", () => {
  const ORDERS: EulerOrder[] = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"];

  it("quat/euler round-trips for all six orders at a spread of angles", () => {
    // Non-gimbal-locked angle sets across multiple quadrants
    const angleSets = [
      [0, 0, 0],
      [0.2, 0.3, 0.4],
      [-0.5, 0.7, -0.3],
      [1.1, -0.6, 0.9],
      [-1.2, -0.8, -1.4],
      [0.8, 0.5, -1.1],
      [Math.PI / 4, -Math.PI / 6, Math.PI / 3],
    ];

    for (const order of ORDERS) {
      for (const [x, y, z] of angleSets) {
        // Euler -> Quat -> Euler
        const q = quatFromEuler(order, x, y, z);
        const euler = eulerFromQuat(order, q);

        // Convert extracted euler back to quat to verify rotational equivalence
        const qReconstructed = quatFromEuler(order, euler[0], euler[1], euler[2]);
        assertQuaternionsEquivalent(
          qReconstructed,
          q,
          1e-6,
          `Round-trip failed for order=${order} angles=[${x}, ${y}, ${z}]`
        );
      }
    }
  });

  it("gimbal-lock cases round-trip to equivalent rotation matrix", () => {
    // Test exact gimbal lock pitch (+/- pi/2) for all 6 orders
    const gimbalAngles: Record<EulerOrder, [number, number, number]> = {
      XYZ: [0.3, Math.PI / 2, 0.4],
      XZY: [0.3, 0.4, -Math.PI / 2],
      YXZ: [-Math.PI / 2, 0.2, 0.5],
      YZX: [0.4, 0.2, Math.PI / 2],
      ZXY: [Math.PI / 2, 0.3, -0.4],
      ZYX: [0.1, -Math.PI / 2, 0.3],
    };

    for (const [order, [x, y, z]] of Object.entries(gimbalAngles)) {
      const q = quatFromEuler(order as EulerOrder, x, y, z);
      const euler = eulerFromQuat(order as EulerOrder, q);
      const qRoundTrip = quatFromEuler(order as EulerOrder, euler[0], euler[1], euler[2]);

      // At gimbal lock, individual Euler angles are not unique, but the resulting
      // orientation (quaternion and rotation matrix) must be identical!
      assertQuaternionsEquivalent(
        qRoundTrip,
        q,
        1e-6,
        `Gimbal lock test failed for order=${order}`
      );
    }
  });
});

describe("3D Math: Quat Arithmetic (Multiply, Normalize, Slerp)", () => {
  it("quatMultiply combines sequential rotations", () => {
    // 90 deg around X then 90 deg around Y
    const qX = quatFromEuler("XYZ", Math.PI / 2, 0, 0);
    const qY = quatFromEuler("XYZ", 0, Math.PI / 2, 0);

    const qCombined = quatMultiply(qY, qX);

    // Transforming point [0, 0, 1] through X-rotation then Y-rotation:
    // After X-rotation (+90): [0, 0, 1] -> [0, -1, 0]
    // After Y-rotation (+90): [0, -1, 0] -> [0, -1, 0]
    const m = compose([0, 0, 0], qCombined, [1, 1, 1]);
    const pOut = transformPoint(m, [0, 0, 1]);
    assert.ok(Math.abs(pOut[0] - 0) < 1e-6);
    assert.ok(Math.abs(pOut[1] - -1) < 1e-6);
    assert.ok(Math.abs(pOut[2] - 0) < 1e-6);
  });

  it("quatNormalize scales non-unit quaternions to length 1", () => {
    const qRaw = quat(2, 4, 6, 8);
    const qNorm = quatNormalize(qRaw);

    const len = Math.hypot(qNorm[0], qNorm[1], qNorm[2], qNorm[3]);
    assert.ok(Math.abs(len - 1.0) < 1e-12);
  });

  it("quatSlerp interpolates smoothly between orientations", () => {
    const qA = quat(0, 0, 0, 1); // 0 rotation
    const qB = quatFromEuler("XYZ", 0, Math.PI / 2, 0); // 90 deg around Y

    // t = 0 -> qA
    const q0 = quatSlerp(qA, qB, 0);
    assertQuaternionsEquivalent(q0, qA, 1e-12);

    // t = 1 -> qB
    const q1 = quatSlerp(qA, qB, 1);
    assertQuaternionsEquivalent(q1, qB, 1e-12);

    // t = 0.5 -> 45 deg around Y
    const qMid = quatSlerp(qA, qB, 0.5);
    const qExpectedMid = quatFromEuler("XYZ", 0, Math.PI / 4, 0);
    assertQuaternionsEquivalent(qMid, qExpectedMid, 1e-6);

    // Shortest path test across opposite hemispheres (dot < 0)
    const qNegativeB = quat(-qB[0], -qB[1], -qB[2], -qB[3]);
    const qMidNeg = quatSlerp(qA, qNegativeB, 0.5);
    assertQuaternionsEquivalent(qMidNeg, qExpectedMid, 1e-6);
  });
});

describe("3D Math: Point & Direction Transformations", () => {
  it("transformPoint is affected by scale, rotation, and translation", () => {
    const m = compose([10, 20, 30], [0, 0, 0, 1], [2, 3, 4]);
    const p = vec3(1, 1, 1);

    const transformed = transformPoint(m, p);
    // 1*2 + 10 = 12, 1*3 + 20 = 23, 1*4 + 30 = 34
    assert.ok(Math.abs(transformed[0] - 12) < 1e-12);
    assert.ok(Math.abs(transformed[1] - 23) < 1e-12);
    assert.ok(Math.abs(transformed[2] - 34) < 1e-12);
  });

  it("transformDirection is affected by rotation and scale, but NOT translation", () => {
    const m = compose([100, 200, 300], [0, 0, 0, 1], [2, 3, 4]);
    const dir = vec3(1, 0, 0);

    const transformed = transformDirection(m, dir);
    // 1*2 + 0 = 2, 0*3 + 0 = 0, 0*4 + 0 = 0
    assert.ok(Math.abs(transformed[0] - 2) < 1e-12);
    assert.ok(Math.abs(transformed[1] - 0) < 1e-12);
    assert.ok(Math.abs(transformed[2] - 0) < 1e-12);
  });
});
