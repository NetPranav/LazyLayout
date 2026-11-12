/**
 * ============================================================================
 * UNIT TESTS: 3D TRANSFORM PIVOTS
 * ============================================================================
 * Phase 3D-017: pivot.ts verification
 * Golden hand-computed tests for median, individual origins, 3D cursor,
 * and active object pivots. Tolerance: 1e-9.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { identity, vec3 } from "../../math";
import { pivotPoint, type PivotSelectionItem } from "../pivot";

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

describe("3D Pivot Point Computation", () => {
  it("computes median pivot as arithmetic mean of 3 objects", () => {
    const sel: PivotSelectionItem[] = [
      { id: "a", location: [0, 0, 0] },
      { id: "b", location: [3, 0, 0] },
      { id: "c", location: [0, 6, 9] },
    ];
    // Mean: (0+3+0)/3 = 1, (0+0+6)/3 = 2, (0+0+9)/3 = 3
    const p = pivotPoint("median", sel);
    assertVectorsClose(p, [1, 2, 3]);
  });

  it("computes median pivot from world matrices", () => {
    const mA = identity();
    mA[12] = 2; mA[13] = 4; mA[14] = 6;
    const mB = identity();
    mB[12] = 4; mB[13] = 6; mB[14] = 8;

    const sel: PivotSelectionItem[] = [
      { id: "a", worldMatrix: mA },
      { id: "b", worldMatrix: mB },
    ];

    const p = pivotPoint("median", sel);
    assertVectorsClose(p, [3, 5, 7]);
  });

  it("returns individual origins: one pivot per object", () => {
    const sel: PivotSelectionItem[] = [
      { id: "cube", location: [1, 2, 3] },
      { id: "sphere", location: [10, 20, 30] },
    ];

    const pivots = pivotPoint("individual", sel);
    assert.equal(pivots.length, 2);
    assert.equal(pivots[0].id, "cube");
    assertVectorsClose(pivots[0].point, [1, 2, 3]);
    assert.equal(pivots[1].id, "sphere");
    assertVectorsClose(pivots[1].point, [10, 20, 30]);
  });

  it("returns cursor position when pivot is 'cursor'", () => {
    const sel: PivotSelectionItem[] = [{ id: "a", location: [100, 100, 100] }];
    const cursor = vec3(7, -3, 42);

    const p = pivotPoint("cursor", sel, cursor);
    assertVectorsClose(p, [7, -3, 42]);
  });

  it("returns cursor position when selection is empty", () => {
    const cursor = vec3(12, 34, 56);
    const p = pivotPoint("median", [], cursor);
    assertVectorsClose(p, [12, 34, 56]);
  });

  it("returns active object pivot (defaults to last item in selection)", () => {
    const sel: PivotSelectionItem[] = [
      { id: "first", location: [0, 0, 0] },
      { id: "second", location: [5, 5, 5] },
      { id: "last", location: [99, 88, 77] },
    ];

    const p = pivotPoint("active", sel);
    assertVectorsClose(p, [99, 88, 77]);
  });

  it("returns explicit active object pivot marked with isActive: true", () => {
    const sel: PivotSelectionItem[] = [
      { id: "first", location: [0, 0, 0] },
      { id: "activeOne", location: [42, 42, 42], isActive: true },
      { id: "last", location: [99, 88, 77] },
    ];

    const p = pivotPoint("active", sel);
    assertVectorsClose(p, [42, 42, 42]);
  });
});
