/**
 * ============================================================================
 * 3D STATE PARITY DIFF HELPER (Phase 3D-010)
 * ============================================================================
 * Pure comparison helper for evaluated 3D states.
 * Compares two evaluated 3D states and returns a list of differing paths with
 * a default numeric tolerance of 1e-9 (used as the parity monitor for the
 * renderer and scrubbing determinism).
 * ============================================================================
 */

import type {
  Scene3d,
  Object3d,
  Mesh3d,
  Material3d,
  Light3d,
  Camera3d,
  Armature3d,
  Action3d,
  World3d,
  Image3d,
  Text3d,
} from "../document/schema";
import type { Mat4 } from "./math";

export interface Evaluated3DState {
  scenes?: Record<string, Scene3d>;
  objects?: Record<string, Object3d>;
  meshes?: Record<string, Mesh3d>;
  materials?: Record<string, Material3d>;
  lights?: Record<string, Light3d>;
  cameras?: Record<string, Camera3d>;
  armatures?: Record<string, Armature3d>;
  actions?: Record<string, Action3d>;
  worlds?: Record<string, World3d>;
  images3d?: Record<string, Image3d>;
  texts?: Record<string, Text3d>;
  worldMatrices?: Record<string, Mat4 | number[]>;
  [key: string]: unknown;
}

export const DEFAULT_PARITY_TOLERANCE = 1e-9;

function isArrayLike(val: unknown): val is ArrayLike<unknown> & Iterable<unknown> {
  return Array.isArray(val) || ArrayBuffer.isView(val);
}

function diffRecursive(
  a: unknown,
  b: unknown,
  currentPath: string,
  tolerance: number,
  out: string[]
): void {
  if (a === b) return;

  // Number comparison with floating-point tolerance
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    if (Math.abs(a - b) > tolerance) {
      out.push(currentPath);
    }
    return;
  }

  // Null / undefined or type mismatch
  if (a === null || a === undefined || b === null || b === undefined || typeof a !== typeof b) {
    out.push(currentPath);
    return;
  }

  // Primitive strings, booleans, symbols, bigints
  if (typeof a !== "object") {
    if (a !== b) out.push(currentPath);
    return;
  }

  // Arrays / TypedArrays (Vector3, Quaternion, Mat4, etc.)
  if (isArrayLike(a) || isArrayLike(b)) {
    if (!isArrayLike(a) || !isArrayLike(b)) {
      out.push(currentPath);
      return;
    }
    const lenA = a.length;
    const lenB = b.length;
    if (lenA !== lenB) {
      out.push(`${currentPath}.length`);
      return;
    }
    for (let i = 0; i < lenA; i++) {
      const elemPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
      diffRecursive((a as ArrayLike<unknown>)[i], (b as ArrayLike<unknown>)[i], elemPath, tolerance, out);
    }
    return;
  }

  // Plain objects
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  const allKeys = Array.from(new Set([...keysA, ...keysB])).sort();

  for (const k of allKeys) {
    const hasA = Object.prototype.hasOwnProperty.call(objA, k);
    const hasB = Object.prototype.hasOwnProperty.call(objB, k);

    const childPath = currentPath ? `${currentPath}/${k}` : k;

    if (!hasA || !hasB) {
      out.push(childPath);
      continue;
    }

    diffRecursive(objA[k], objB[k], childPath, tolerance, out);
  }
}

/**
 * Compares two evaluated 3D states and returns an array of differing property path strings.
 * Returns an empty array `[]` if both states are identical within `tolerance`.
 */
export function describe3DDiff(
  a: Evaluated3DState | Record<string, unknown>,
  b: Evaluated3DState | Record<string, unknown>,
  tolerance: number = DEFAULT_PARITY_TOLERANCE
): string[] {
  const diffs: string[] = [];
  diffRecursive(a, b, "", tolerance, diffs);
  return diffs;
}
