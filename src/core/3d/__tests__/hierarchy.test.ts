/**
 * ============================================================================
 * UNIT TESTS: 3D TRANSFORM HIERARCHY
 * ============================================================================
 * Phase 3D-008: hierarchy.ts verification
 *   - Hand-computed golden world matrices through a 4-level hierarchy.
 *   - Parenting and unparenting keep the world matrix within 1e-6.
 *   - Depth computation through the hierarchy.
 *   - Cycle detection and rejection (self, child, deep descendant).
 *   - Delta transforms.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDocument, type MotionDocument, type Object3d } from "../../document/schema";
import {
  clearParent,
  depth,
  localMatrix,
  setParent,
  worldMatrix,
} from "../hierarchy";
import { compose, quatFromEuler } from "../math";

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

describe("3D Hierarchy: Hand-computed Golden 4-Level World Matrices", () => {
  it("evaluates hand-computed golden world matrices through 4 levels", () => {
    const doc = createEmptyDocument();

    const SQRT2_OVER_2 = Math.SQRT2 / 2;

    // Level 0: Root
    // location: [10, 0, 0], rot: 90 deg around Y, scale: [2, 2, 2]
    const rootObj: Object3d = {
      id: "obj_lvl0_root",
      type: "empty",
      parentId: null,
      transform: {
        location: [10, 0, 0],
        rotationQuat: [0, SQRT2_OVER_2, 0, SQRT2_OVER_2],
        scale: [2, 2, 2],
      },
    };

    // Level 1: Child
    // location: [0, 5, 0], rot: 90 deg around X, scale: [1, 1, 1]
    const childObj: Object3d = {
      id: "obj_lvl1_child",
      type: "empty",
      parentId: "obj_lvl0_root",
      transform: {
        location: [0, 5, 0],
        rotationQuat: [SQRT2_OVER_2, 0, 0, SQRT2_OVER_2],
        scale: [1, 1, 1],
      },
    };

    // Level 2: Grandchild
    // location: [0, 0, 3], rot: identity, scale: [3, 1, 2]
    const grandObj: Object3d = {
      id: "obj_lvl2_grand",
      type: "empty",
      parentId: "obj_lvl1_child",
      transform: {
        location: [0, 0, 3],
        rotationQuat: [0, 0, 0, 1],
        scale: [3, 1, 2],
      },
    };

    // Level 3: GreatGrandchild
    // location: [1, 2, 3], rot: 180 deg around Z, scale: [1, 1, 1]
    const greatObj: Object3d = {
      id: "obj_lvl3_great",
      type: "empty",
      parentId: "obj_lvl2_grand",
      transform: {
        location: [1, 2, 3],
        rotationQuat: [0, 0, 1, 0],
        scale: [1, 1, 1],
      },
    };

    doc.objects = {
      [rootObj.id]: rootObj,
      [childObj.id]: childObj,
      [grandObj.id]: grandObj,
      [greatObj.id]: greatObj,
    };

    // 1. Level 0 Golden Matrix:
    // [  0,  0, -2,  0,
    //    0,  2,  0,  0,
    //    2,  0,  0,  0,
    //   10,  0,  0,  1 ]
    const w0Expected = [
      0, 0, -2, 0,
      0, 2, 0, 0,
      2, 0, 0, 0,
      10, 0, 0, 1,
    ];
    const w0Actual = worldMatrix(doc, "obj_lvl0_root");
    assertMatricesNear(w0Actual, w0Expected, 1e-6, "Level 0 Root world matrix");

    // 2. Level 1 Golden Matrix:
    // [  0,  0, -2,  0,
    //    2,  0,  0,  0,
    //    0, -2,  0,  0,
    //   10, 10,  0,  1 ]
    const w1Expected = [
      0, 0, -2, 0,
      2, 0, 0, 0,
      0, -2, 0, 0,
      10, 10, 0, 1,
    ];
    const w1Actual = worldMatrix(doc, "obj_lvl1_child");
    assertMatricesNear(w1Actual, w1Expected, 1e-6, "Level 1 Child world matrix");

    // 3. Level 2 Golden Matrix:
    // [  0,  0, -6,  0,
    //    2,  0,  0,  0,
    //    0, -4,  0,  0,
    //   10,  4,  0,  1 ]
    const w2Expected = [
      0, 0, -6, 0,
      2, 0, 0, 0,
      0, -4, 0, 0,
      10, 4, 0, 1,
    ];
    const w2Actual = worldMatrix(doc, "obj_lvl2_grand");
    assertMatricesNear(w2Actual, w2Expected, 1e-6, "Level 2 Grandchild world matrix");

    // 4. Level 3 Golden Matrix:
    // [   0,  0,  6,  0,
    //    -2,  0,  0,  0,
    //     0, -4,  0,  0,
    //    14, -8, -6,  1 ]
    const w3Expected = [
      0, 0, 6, 0,
      -2, 0, 0, 0,
      0, -4, 0, 0,
      14, -8, -6, 1,
    ];
    const w3Actual = worldMatrix(doc, "obj_lvl3_great");
    assertMatricesNear(w3Actual, w3Expected, 1e-6, "Level 3 GreatGrandchild world matrix");
  });
});

describe("3D Hierarchy: Parenting & Unparenting with keepWorld", () => {
  it("parenting and unparenting keep the world matrix within 1e-6", () => {
    const doc = createEmptyDocument();

    const parentObj: Object3d = {
      id: "obj_parent",
      type: "empty",
      parentId: null,
      transform: {
        location: [5, 10, -3],
        rotationQuat: Array.from(quatFromEuler("XYZ", 0.4, -0.6, 0.2)) as [number, number, number, number],
        scale: [1.5, 2.0, 0.8],
      },
    };

    const childObj: Object3d = {
      id: "obj_child",
      type: "empty",
      parentId: null,
      transform: {
        location: [-12, 4, 18],
        rotationQuat: Array.from(quatFromEuler("XYZ", -0.3, 0.5, 0.9)) as [number, number, number, number],
        scale: [0.5, 1.2, 2.4],
      },
    };

    doc.objects = {
      [parentObj.id]: parentObj,
      [childObj.id]: childObj,
    };

    // World matrix of child before parenting
    const wBefore = worldMatrix(doc, "obj_child");

    // 1. Parent child under parent with keepWorld: true
    setParent(doc, "obj_child", "obj_parent", { keepWorld: true });
    assert.equal(doc.objects["obj_child"].parentId, "obj_parent");
    assert.ok(doc.objects["obj_child"].parentInverse !== undefined);

    const wAfterParent = worldMatrix(doc, "obj_child");
    assertMatricesNear(
      wAfterParent,
      wBefore,
      1e-6,
      "Parenting with keepWorld preserves world matrix within 1e-6"
    );

    // 2. Unparent child with keepWorld: true
    clearParent(doc, "obj_child", { keepWorld: true });
    assert.equal(doc.objects["obj_child"].parentId, null);
    assert.equal(doc.objects["obj_child"].parentInverse, undefined);

    const wAfterClear = worldMatrix(doc, "obj_child");
    assertMatricesNear(
      wAfterClear,
      wBefore,
      1e-6,
      "Unparenting with keepWorld preserves world matrix within 1e-6"
    );
  });

  it("re-parenting an already-parented child to a new parent preserves world matrix within 1e-6", () => {
    const doc = createEmptyDocument();

    const p1: Object3d = {
      id: "obj_p1",
      type: "empty",
      parentId: null,
      transform: { location: [1, 2, 3], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
    };

    const p2: Object3d = {
      id: "obj_p2",
      type: "empty",
      parentId: null,
      transform: {
        location: [-10, 5, 2],
        rotationQuat: Array.from(quatFromEuler("YXZ", 0.5, -0.3, 0.4)) as [number, number, number, number],
        scale: [2, 1.5, 3],
      },
    };

    const child: Object3d = {
      id: "obj_child",
      type: "empty",
      parentId: null,
      transform: { location: [4, 5, 6], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
    };

    doc.objects = { [p1.id]: p1, [p2.id]: p2, [child.id]: child };

    const initialWorld = worldMatrix(doc, "obj_child");

    // Parent to P1
    setParent(doc, "obj_child", "obj_p1", { keepWorld: true });
    assertMatricesNear(worldMatrix(doc, "obj_child"), initialWorld, 1e-6);

    // Re-parent directly to P2
    setParent(doc, "obj_child", "obj_p2", { keepWorld: true });
    assertMatricesNear(worldMatrix(doc, "obj_child"), initialWorld, 1e-6);
  });

  it("parenting with keepWorld: false applies child local transform directly in parent space", () => {
    const doc = createEmptyDocument();

    const parent: Object3d = {
      id: "p",
      type: "empty",
      parentId: null,
      transform: { location: [10, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
    };
    const child: Object3d = {
      id: "c",
      type: "empty",
      parentId: null,
      transform: { location: [5, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
    };

    doc.objects = { p: parent, c: child };

    setParent(doc, "c", "p", { keepWorld: false });
    assert.equal(doc.objects["c"].parentInverse, undefined);

    const wChild = worldMatrix(doc, "c");
    // In parent space, location [5, 0, 0] becomes [15, 0, 0] in world space
    assertMatricesNear(
      wChild,
      compose([15, 0, 0], [0, 0, 0, 1], [1, 1, 1]),
      1e-12
    );
  });
});

describe("3D Hierarchy: Depth & Cycle Detection", () => {
  it("depth() correctly reports level in hierarchy", () => {
    const doc = createEmptyDocument();
    doc.objects = {
      root: { id: "root", type: "empty", parentId: null, transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      l1: { id: "l1", type: "empty", parentId: "root", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      l2: { id: "l2", type: "empty", parentId: "l1", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      l3: { id: "l3", type: "empty", parentId: "l2", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
    };

    assert.equal(depth(doc, "root"), 0);
    assert.equal(depth(doc, "l1"), 1);
    assert.equal(depth(doc, "l2"), 2);
    assert.equal(depth(doc, "l3"), 3);
  });

  it("cycle rejected: parenting to self throws", () => {
    const doc = createEmptyDocument();
    doc.objects = {
      objA: { id: "objA", type: "empty", parentId: null, transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
    };

    assert.throws(() => setParent(doc, "objA", "objA"), /itself/i);
  });

  it("cycle rejected: parenting an object under its own descendant throws", () => {
    const doc = createEmptyDocument();
    doc.objects = {
      root: { id: "root", type: "empty", parentId: null, transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      child: { id: "child", type: "empty", parentId: "root", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      grand: { id: "grand", type: "empty", parentId: "child", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
    };

    // Attempting to parent 'root' under 'child' or 'grand' must throw
    assert.throws(() => setParent(doc, "root", "child"), /cycle/i);
    assert.throws(() => setParent(doc, "root", "grand"), /cycle/i);
    assert.throws(() => setParent(doc, "child", "grand"), /cycle/i);
  });

  it("worldMatrix and depth throw on corrupt cyclic hierarchy data", () => {
    const doc = createEmptyDocument();
    doc.objects = {
      a: { id: "a", type: "empty", parentId: "b", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
      b: { id: "b", type: "empty", parentId: "a", transform: { location: [0,0,0], rotationQuat: [0,0,0,1], scale: [1,1,1] } },
    };

    assert.throws(() => worldMatrix(doc, "a"), /cycle/i);
    assert.throws(() => depth(doc, "a"), /cycle/i);
  });
});

describe("3D Hierarchy: Delta Transforms", () => {
  it("delta transforms combine additively/multiplicatively with base transform", () => {
    const obj: Object3d = {
      id: "obj_delta",
      type: "empty",
      parentId: null,
      transform: {
        location: [10, 20, 30],
        rotationQuat: [0, 0, 0, 1],
        scale: [2, 2, 2],
      },
      delta: {
        location: [1, -2, 3],
        scale: [1.5, 0.5, 2.0],
      },
    };

    const m = localMatrix(obj);
    const expected = compose([11, 18, 33], [0, 0, 0, 1], [3, 1, 4]);
    assertMatricesNear(m, expected, 1e-12);
  });
});
