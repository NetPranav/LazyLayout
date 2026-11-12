/**
 * ============================================================================
 * UNIT TESTS: 3D TRANSFORM ORIENTATION
 * ============================================================================
 * Phase 3D-017: orientation.ts verification
 * Golden hand-computed tests for global, local, normal, view, and cursor
 * coordinate orientation matrices. Tolerance: 1e-9.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compose,
  identity,
  quat,
  transformDirection,
  vec3,
} from "../../math";
import { orientationMatrix } from "../orientation";

const SQRT1_2 = Math.SQRT1_2;

function assertMatricesClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  eps = 1e-9
) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > eps) {
      assert.fail(`at matrix index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

function assertVectorsClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  eps = 1e-9
) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > eps) {
      assert.fail(`at vector index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

describe("3D Orientation Matrices", () => {
  it("orientation 'global' returns 4x4 identity matrix", () => {
    const m = orientationMatrix("global");
    assertMatricesClose(m, identity());
  });

  it("orientation 'local' extracts rotation matrix from active object", () => {
    const qZ90 = quat(0, 0, SQRT1_2, SQRT1_2);
    const expected = compose(vec3(0, 0, 0), qZ90, vec3(1, 1, 1));

    const ctx = {
      activeObject: {
        worldMatrix: compose(vec3(10, 20, 30), qZ90, vec3(2, 2, 2)),
      },
    };

    const m = orientationMatrix("local", ctx);
    // Unscaled pure rotation matrix
    assertMatricesClose(m, expected);
  });

  it("orientation 'normal' aligns matrix Z column with active normal [0, 0, 1]", () => {
    const ctx = {
      activeNormal: vec3(0, 0, 1),
    };
    const m = orientationMatrix("normal", ctx);

    // Transforming unit Z gives normal vector [0, 0, 1]
    const zDir = transformDirection(m, [0, 0, 1]);
    assertVectorsClose(zDir, [0, 0, 1]);
  });

  it("orientation 'normal' aligns matrix Z column with normal [1, 0, 0]", () => {
    const ctx = {
      activeNormal: vec3(1, 0, 0),
    };
    const m = orientationMatrix("normal", ctx);

    const zDir = transformDirection(m, [0, 0, 1]);
    assertVectorsClose(zDir, [1, 0, 0]);

    // X and Y are orthonormal to Z
    const xDir = transformDirection(m, [1, 0, 0]);
    const yDir = transformDirection(m, [0, 1, 0]);
    assertVectorsClose(xDir, [0, 0, -1]);
    assertVectorsClose(yDir, [0, 1, 0]);
  });

  it("orientation 'view' aligns axes with camera right, up, and back", () => {
    // Identity view matrix: camera at origin looking down -Z
    const viewMat = identity();
    const ctx = {
      viewCamera: { viewMatrix: viewMat },
    };

    const m = orientationMatrix("view", ctx);
    assertMatricesClose(m, identity());
  });

  it("orientation 'cursor' matches cursor rotation quaternion", () => {
    const q = quat(0, SQRT1_2, 0, SQRT1_2); // 90 deg around Y
    const expected = compose(vec3(0, 0, 0), q, vec3(1, 1, 1));

    const ctx = {
      cursor: { rotation: q },
    };

    const m = orientationMatrix("cursor", ctx);
    assertMatricesClose(m, expected);
  });
});
