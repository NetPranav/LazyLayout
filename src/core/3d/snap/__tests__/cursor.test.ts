/**
 * ============================================================================
 * UNIT TESTS: 3D CURSOR
 * ============================================================================
 * Phase 3D-017 & 3D-019: cursor.ts verification
 * Cursor state reset and surface snapping placement. Tolerance: 1e-9.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { placeCursor, resetCursor } from "../cursor";

const SQRT1_2 = Math.SQRT1_2;

function assertVectorsClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  eps = 1e-9
) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > eps) {
      assert.fail(`at index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

describe("3D Cursor: Reset and Surface Snapping", () => {
  it("resetCursor: returns cursor at origin with identity rotation", () => {
    const c = resetCursor();
    assertVectorsClose(c.position, [0, 0, 0]);
    assertVectorsClose(c.rotation, [0, 0, 0, 1]);
  });

  it("placeCursor: ray hits flat horizontal table, snaps to surface point upright", () => {
    const scene = {
      objects: [
        {
          id: "table",
          positions: [
            -5, -5, 1.5,
             5, -5, 1.5,
             0,  5, 1.5,
          ],
          indices: [0, 1, 2],
        },
      ],
    };

    const ray = {
      origin: [0, 0, 10],
      direction: [0, 0, -1],
    };

    const c = placeCursor(ray, scene);
    assertVectorsClose(c.position, [0, 0, 1.5]);
    assertVectorsClose(c.rotation, [0, 0, 0, 1]);
  });

  it("placeCursor: ray hits vertical wall, cursor rotates to align with wall normal", () => {
    const scene = {
      objects: [
        {
          id: "wall",
          positions: [
            4, -2, -2,
            4,  2, -2,
            4,  0,  2,
          ],
          indices: [0, 1, 2],
        },
      ],
    };

    const ray = {
      origin: [10, 0, 0],
      direction: [-1, 0, 0],
    };

    const c = placeCursor(ray, scene);
    assertVectorsClose(c.position, [4, 0, 0]);
    // Normal is [1, 0, 0] -> rotated +90 deg around Y
    assertVectorsClose(c.rotation, [0, SQRT1_2, 0, SQRT1_2]);
  });

  it("placeCursor: ray misses objects and hits ground plane Z = 0", () => {
    const scene = { objects: [] };

    const ray = {
      origin: [3, 4, 10],
      direction: [0, 0, -1],
    };

    const c = placeCursor(ray, scene);
    assertVectorsClose(c.position, [3, 4, 0]);
    assertVectorsClose(c.rotation, [0, 0, 0, 1]);
  });

  it("placeCursor: ray pointing upwards away from ground plane places at default distance", () => {
    const scene = { objects: [] };

    const ray = {
      origin: [1, 2, 3],
      direction: [0, 1, 0],
    };

    const c = placeCursor(ray, scene);
    // 5 units along ray
    assertVectorsClose(c.position, [1, 7, 3]);
    assertVectorsClose(c.rotation, [0, 0, 0, 1]);
  });
});
