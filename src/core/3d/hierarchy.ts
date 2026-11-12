/**
 * ============================================================================
 * 3D TRANSFORM HIERARCHY & SCENE GRAPH
 * ============================================================================
 * Pure TypeScript implementation of Blender-style parent/child hierarchy.
 *
 * Rules:
 *   - Local matrix: compose(location, rotationQuat, scale) combined with delta
 *   - World matrix: W_child = W_parent * parentInverse * M_local
 *   - Parenting with keepWorld preserves child's world matrix by solving:
 *     parentInverse = W_parent^-1 * W_child * M_local^-1
 *   - Unparenting with keepWorld preserves world matrix by decomposing it
 *     into the child's local transform and clearing parentInverse.
 *   - Cycle detection: rejects parenting an object to itself or any descendant.
 * ============================================================================
 */

import type { MotionDocument, Object3d } from "../document/schema";
import {
  type Mat4,
  compose,
  decompose,
  identity,
  invert,
  mat4From,
  multiply,
  quatMultiply,
} from "./math";

/**
 * Computes the local TRS transformation matrix for an object,
 * incorporating both base `transform` and optional `delta` transform.
 */
export function localMatrix(obj: Object3d): Mat4 {
  let loc: [number, number, number] = [
    obj.transform.location[0],
    obj.transform.location[1],
    obj.transform.location[2],
  ];
  let rot: [number, number, number, number] = [
    obj.transform.rotationQuat[0],
    obj.transform.rotationQuat[1],
    obj.transform.rotationQuat[2],
    obj.transform.rotationQuat[3],
  ];
  let scl: [number, number, number] = [
    obj.transform.scale[0],
    obj.transform.scale[1],
    obj.transform.scale[2],
  ];

  if (obj.delta) {
    if (obj.delta.location) {
      loc = [
        loc[0] + obj.delta.location[0],
        loc[1] + obj.delta.location[1],
        loc[2] + obj.delta.location[2],
      ];
    }
    if (obj.delta.rotationQuat) {
      const q = quatMultiply(obj.delta.rotationQuat, rot);
      rot = [q[0], q[1], q[2], q[3]];
    }
    if (obj.delta.scale) {
      scl = [
        scl[0] * obj.delta.scale[0],
        scl[1] * obj.delta.scale[1],
        scl[2] * obj.delta.scale[2],
      ];
    }
  }

  return compose(loc, rot, scl);
}

/**
 * Computes the 4x4 world matrix for an object by traversing the parent hierarchy.
 * Evaluates: W_child = W_parent * parentInverse * M_local.
 * Detects cycles and throws if one is encountered.
 */
export function worldMatrix(doc: MotionDocument, objectId: string): Mat4 {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  // Walk up to root while checking for cycles
  const seen = new Set<string>();
  const chain: string[] = [];
  let curr: string | null = objectId;

  while (curr !== null) {
    if (seen.has(curr)) {
      throw new Error(`Cycle detected in object hierarchy at "${curr}".`);
    }
    seen.add(curr);
    chain.push(curr);
    curr = doc.objects?.[curr]?.parentId ?? null;
  }

  // Walk top-down from root to target object
  let currentWorld = identity();

  for (let i = chain.length - 1; i >= 0; i--) {
    const id = chain[i];
    const currentObj = doc.objects![id];
    const local = localMatrix(currentObj);

    if (currentObj.parentId !== null && currentObj.parentId !== undefined) {
      if (currentObj.parentInverse) {
        const pInv = mat4From(currentObj.parentInverse);
        const combined = multiply(currentWorld, pInv);
        currentWorld = multiply(combined, local);
      } else {
        currentWorld = multiply(currentWorld, local);
      }
    } else {
      currentWorld = local;
    }
  }

  return currentWorld;
}

/**
 * Returns the depth of an object in the parent hierarchy.
 * Root objects have depth 0, direct children have depth 1, etc.
 * Throws on cycle detection or non-existent object.
 */
export function depth(doc: MotionDocument, objectId: string): number {
  const obj = doc.objects?.[objectId];
  if (!obj) {
    throw new Error(`Object "${objectId}" not found in document.`);
  }

  const seen = new Set<string>();
  let d = 0;
  let curr = obj.parentId ?? null;

  while (curr !== null) {
    if (seen.has(curr)) {
      throw new Error(`Cycle detected in object hierarchy at "${curr}".`);
    }
    seen.add(curr);
    d++;
    const nextObj = doc.objects?.[curr];
    if (!nextObj) break;
    curr = nextObj.parentId ?? null;
  }

  return d;
}

export interface SetParentOptions {
  /**
   * If true (default), calculates parentInverse so the child's world transform is preserved.
   */
  keepWorld?: boolean;
}

/**
 * Parents child object under parentId.
 * Validates existence, detects cycles (throws if parenting under own descendant),
 * and computes parentInverse if keepWorld is true (default).
 */
export function setParent(
  doc: MotionDocument,
  childId: string,
  parentId: string,
  options: SetParentOptions = {}
): MotionDocument {
  const child = doc.objects?.[childId];
  if (!child) {
    throw new Error(`Child object "${childId}" not found in document.`);
  }

  const parent = doc.objects?.[parentId];
  if (!parent) {
    throw new Error(`Parent object "${parentId}" not found in document.`);
  }

  if (childId === parentId) {
    throw new Error(`Cannot parent object "${childId}" to itself.`);
  }

  // Cycle check: verify parentId is not already a descendant of childId
  let curr: string | null = parentId;
  const seen = new Set<string>();
  while (curr !== null) {
    if (curr === childId) {
      throw new Error(
        `Cannot parent object "${childId}" under its own descendant "${parentId}" (cycle detected).`
      );
    }
    if (seen.has(curr)) {
      throw new Error(`Cycle detected in parent chain above "${parentId}".`);
    }
    seen.add(curr);
    curr = doc.objects?.[curr]?.parentId ?? null;
  }

  const keepWorld = options.keepWorld ?? true;
  let pInvArray: number[] | undefined;

  if (keepWorld) {
    // Current world matrix of child before parenting
    const wChild = worldMatrix(doc, childId);
    // World matrix of new parent
    const wParent = worldMatrix(doc, parentId);
    // Child's local matrix
    const mLocal = localMatrix(child);

    // Solve for parentInverse:
    // W_child = W_parent * parentInverse * M_local
    // parentInverse = W_parent^-1 * W_child * M_local^-1
    const invWParent = invert(wParent);
    const invMLocal = invert(mLocal);
    const step1 = multiply(invWParent, wChild);
    const pInv = multiply(step1, invMLocal);
    pInvArray = Array.from(pInv);
  }

  const updatedChild: Object3d = {
    ...child,
    parentId,
    ...(pInvArray ? { parentInverse: pInvArray } : {}),
  };

  if (!keepWorld) {
    delete updatedChild.parentInverse;
  }

  // Mutate in-place on doc for direct callers & return new document
  if (doc.objects) {
    doc.objects[childId] = updatedChild;
  }

  return {
    ...doc,
    objects: {
      ...doc.objects,
      [childId]: updatedChild,
    },
  };
}

export interface ClearParentOptions {
  /**
   * If true (default), decomposes current world matrix to child's transform so it does not move.
   */
  keepWorld?: boolean;
}

/**
 * Clears an object's parent reference, turning it into a root object.
 * If keepWorld is true (default), updates child's transform so its world matrix is preserved.
 */
export function clearParent(
  doc: MotionDocument,
  childId: string,
  options: ClearParentOptions = {}
): MotionDocument {
  const child = doc.objects?.[childId];
  if (!child) {
    throw new Error(`Object "${childId}" not found in document.`);
  }

  if (child.parentId === null || child.parentId === undefined) {
    // Already a root object
    return doc;
  }

  const keepWorld = options.keepWorld ?? true;
  let updatedChild: Object3d;

  if (keepWorld) {
    const wChild = worldMatrix(doc, childId);
    const { location, quat, scale } = decompose(wChild);

    updatedChild = {
      ...child,
      parentId: null,
      transform: {
        location: [location[0], location[1], location[2]],
        rotationQuat: [quat[0], quat[1], quat[2], quat[3]],
        scale: [scale[0], scale[1], scale[2]],
      },
    };
    delete updatedChild.parentInverse;
    delete updatedChild.delta;
  } else {
    updatedChild = {
      ...child,
      parentId: null,
    };
    delete updatedChild.parentInverse;
  }

  if (doc.objects) {
    doc.objects[childId] = updatedChild;
  }

  return {
    ...doc,
    objects: {
      ...doc.objects,
      [childId]: updatedChild,
    },
  };
}
