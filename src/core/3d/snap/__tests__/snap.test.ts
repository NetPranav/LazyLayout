/**
 * ============================================================================
 * UNIT TESTS: 3D SNAPPING KERNEL (GOLDEN CASES)
 * ============================================================================
 * Phase 3D-017: snap.ts verification
 * Golden hand-computed tests for increment, grid, vertex, edge, face snapping,
 * cup-on-table normal alignment, and priority cascade. Tolerance: 1e-9.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alignToNormal,
  snapPoint,
  snapToEdge,
  snapToFace,
  snapToGrid,
  snapToVertex,
  snapValue,
  type SnapObject,
} from "../snap";

const SQRT1_2 = Math.SQRT1_2; // ~0.7071067811865476

function assertFloatsClose(actual: number, expected: number, eps = 1e-9) {
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    assert.fail(`actual=${actual} expected=${expected} diff=${diff} > ${eps}`);
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
      assert.fail(`at index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

describe("3D Snapping Kernel: Golden Cases", () => {
  it("Case 1: snapValue(2.34, 0.5) rounds up to 2.5", () => {
    assertFloatsClose(snapValue(2.34, 0.5), 2.5);
  });

  it("Case 2: snapValue(2.24, 0.5) rounds down to 2.0", () => {
    assertFloatsClose(snapValue(2.24, 0.5), 2.0);
  });

  it("Case 3: snapValue(-1.7, 0.5) rounds to -1.5", () => {
    assertFloatsClose(snapValue(-1.7, 0.5), -1.5);
  });

  it("Case 4: snapValue(0.123, 0.05) rounds to 0.1", () => {
    assertFloatsClose(snapValue(0.123, 0.05), 0.1);
  });

  it("Case 5: snapValue(10, 0) handles zero step safely", () => {
    assertFloatsClose(snapValue(10, 0), 10);
  });

  it("Case 6: snapToGrid([1.2, 3.8, -0.4], 1) -> [1, 4, 0]", () => {
    const p = snapToGrid([1.2, 3.8, -0.4], 1);
    assertVectorsClose(p, [1, 4, 0]);
  });

  it("Case 7: snapToGrid([1.2, 3.8, -0.4], [0.5, 2, 0.25]) -> [1.0, 4.0, -0.5]", () => {
    const p = snapToGrid([1.2, 3.8, -0.4], [0.5, 2, 0.25]);
    assertVectorsClose(p, [1.0, 4.0, -0.5]);
  });

  it("Case 8: snapToVertex: snaps nearby point to exact vertex", () => {
    const cube: SnapObject = {
      id: "cube",
      positions: [
        0, 0, 0,
        1, 2, 3,
        5, 5, 5,
      ],
    };
    const hit = snapToVertex([1.02, 1.99, 3.01], [cube], 0.1);
    assert.ok(hit !== null);
    assert.equal(hit.objectId, "cube");
    assert.equal(hit.vertexIndex, 1);
    assertVectorsClose(hit.point, [1, 2, 3]);
  });

  it("Case 9: snapToVertex: ray passing near vertex hits closest vertex", () => {
    const obj: SnapObject = {
      id: "points",
      positions: [0, 5, 0, 10, 10, 10],
    };
    const ray = {
      origin: [0, 0, 0],
      direction: [0, 1, 0],
    };
    const hit = snapToVertex(ray, [obj], 0.2);
    assert.ok(hit !== null);
    assert.equal(hit.objectId, "points");
    assertVectorsClose(hit.point, [0, 5, 0]);
  });

  it("Case 10: snapToEdge: point snaps to closest point on line segment", () => {
    const triangleObj: SnapObject = {
      id: "tri",
      positions: [
        0, 0, 0,
        2, 0, 0,
        0, 2, 0,
      ],
      indices: [0, 1, 2],
    };
    // Point near midpoint of edge (0,0,0)-(2,0,0) at (1, 0.05, 0)
    const hit = snapToEdge([1, 0.05, 0], [triangleObj], 0.1);
    assert.ok(hit !== null);
    assertVectorsClose(hit.point, [1, 0, 0]);
  });

  it("Case 11: snapToFace: vertical ray hits horizontal triangle with +Z normal", () => {
    const tableTop: SnapObject = {
      id: "table",
      positions: [
        -5, -5, 2,
         5, -5, 2,
         0,  5, 2,
      ],
      indices: [0, 1, 2],
    };

    // Ray shooting straight down from z = 10 onto (0, 0, 2)
    const ray = {
      origin: [0, 0, 10],
      direction: [0, 0, -1],
    };

    const hit = snapToFace(ray, [tableTop]);
    assert.ok(hit !== null);
    assertVectorsClose(hit.point, [0, 0, 2]);
    assertVectorsClose(hit.normal, [0, 0, 1]);
  });

  it("Case 12: snapToFace: horizontal ray hits vertical wall with +X normal", () => {
    const wall: SnapObject = {
      id: "wall",
      positions: [
        3, -2, -2,
        3,  2, -2,
        3,  0,  2,
      ],
      indices: [0, 1, 2],
    };

    const ray = {
      origin: [10, 0, 0],
      direction: [-1, 0, 0],
    };

    const hit = snapToFace(ray, [wall]);
    assert.ok(hit !== null);
    assertVectorsClose(hit.point, [3, 0, 0]);
    assertVectorsClose(hit.normal, [1, 0, 0]);
  });

  it("Case 13: alignToNormal (Cup on Table): normal [0, 0, 1] keeps cup upright", () => {
    // A cup on a flat horizontal table with normal [0, 0, 1]
    const q = alignToNormal([0, 0, 2], [0, 0, 1], [0, 0, 1]);
    // Quaternion is identity [0, 0, 0, 1]
    assertVectorsClose(q, [0, 0, 0, 1]);
  });

  it("Case 14: alignToNormal: vertical wall [1, 0, 0] rotates cup 90 deg around Y", () => {
    const q = alignToNormal([3, 0, 0], [1, 0, 0], [0, 0, 1]);
    // Rotation from +Z to +X is +90 deg around Y
    // Quat: [0, sin(45 deg), 0, cos(45 deg)] = [0, sqrt(2)/2, 0, sqrt(2)/2]
    assertVectorsClose(q, [0, SQRT1_2, 0, SQRT1_2]);
  });

  it("Case 15: alignToNormal: 45-degree ramp normal tilts cup by exactly 45 deg", () => {
    const rampNormal = [0, SQRT1_2, SQRT1_2];
    const q = alignToNormal([0, 0, 0], rampNormal, [0, 0, 1]);

    // Vector rotation: +Z rotated to [0, sqrt(2)/2, sqrt(2)/2] is -45 deg around X
    // sin(-22.5 deg) ~= -0.3826834323650898, cos(-22.5 deg) ~= 0.9238795325112867
    const expectedX = -Math.sin(Math.PI / 8);
    const expectedW = Math.cos(Math.PI / 8);
    assertVectorsClose(q, [expectedX, 0, 0, expectedW]);
  });

  it("Case 16: alignToNormal: upside-down surface [0, 0, -1] rotates 180 degrees", () => {
    const q = alignToNormal([0, 0, 10], [0, 0, -1], [0, 0, 1]);
    // 180 deg around orthogonal axis (e.g. X)
    assertFloatsClose(Math.abs(q[0]), 1.0);
    assertFloatsClose(q[1], 0.0);
    assertFloatsClose(q[2], 0.0);
    assertFloatsClose(q[3], 0.0);
  });

  it("Case 17: snapPoint priority: vertex takes precedence over edge, face, and grid", () => {
    const scene = {
      objects: [
        {
          id: "box",
          positions: [
            0, 0, 0,
            2, 0, 0,
            0, 2, 0,
          ],
          indices: [0, 1, 2],
        },
      ],
    };

    const res = snapPoint([0.02, 0.01, 0], {
      enabled: true,
      targets: ["vertex", "edge", "face", "grid", "increment"],
      gridSize: 1,
      radiusPx: 0.1,
    }, scene);

    assert.equal(res.target, "vertex");
    assertVectorsClose(res.point, [0, 0, 0]);
  });

  it("Case 18: snapPoint priority: edge takes precedence over face and grid when vertex disabled", () => {
    const scene = {
      objects: [
        {
          id: "box",
          positions: [
            0, 0, 0,
            2, 0, 0,
            0, 2, 0,
          ],
          indices: [0, 1, 2],
        },
      ],
    };

    const res = snapPoint([1, 0.02, 0], {
      enabled: true,
      targets: ["edge", "face", "grid"],
      gridSize: 1,
      radiusPx: 0.1,
    }, scene);

    assert.equal(res.target, "edge");
    assertVectorsClose(res.point, [1, 0, 0]);
  });

  it("Case 19: snapPoint priority: face takes precedence over grid when ray hits surface", () => {
    const scene = {
      objects: [
        {
          id: "table",
          positions: [
            -5, -5, 2.3,
             5, -5, 2.3,
             0,  5, 2.3,
          ],
          indices: [0, 1, 2],
        },
      ],
    };

    const ray = {
      origin: [0, 0, 10],
      direction: [0, 0, -1],
    };

    const res = snapPoint([0, 0, 10], {
      enabled: true,
      targets: ["face", "grid"],
      ray,
      gridSize: 1,
    }, scene);

    assert.equal(res.target, "face");
    assertVectorsClose(res.point, [0, 0, 2.3]);
    assertVectorsClose(res.normal!, [0, 0, 1]);
  });

  it("Case 20: snapPoint priority: grid takes precedence over increment on miss", () => {
    const scene = { objects: [] };

    const res = snapPoint([1.4, 2.8, -0.7], {
      enabled: true,
      targets: ["vertex", "edge", "face", "grid", "increment"],
      gridSize: 1,
      increment: 0.5,
    }, scene);

    assert.equal(res.target, "grid");
    assertVectorsClose(res.point, [1, 3, -1]);
  });
});
