/**
 * ============================================================================
 * 3D CURSOR (Phase 3D-017 & 3D-019)
 * ============================================================================
 * Manages the 3D cursor position and orientation:
 * - `Cursor3d`: { position: Vec3, rotation: Quat }
 * - `resetCursor()`: returns cursor at origin with identity rotation
 * - `placeCursor(ray, scene)`: raycasts against scene geometry and aligns to normal
 * ============================================================================
 */

import { type Quat, type Vec3, quat, vec3, vec3From } from "../math";
import type { Ray3d } from "../transform/gizmo";
import { type SnapScene, alignToNormal, snapToFace } from "./snap";

export interface Cursor3d {
  position: Vec3;
  rotation: Quat;
}

/**
 * Resets the 3D cursor to the world origin with default upright identity orientation.
 */
export function resetCursor(): Cursor3d {
  return {
    position: vec3(0, 0, 0),
    rotation: quat(0, 0, 0, 1),
  };
}

/**
 * Places the 3D cursor along a ray, snapping to mesh surface faces if hit,
 * or falling back to the ground plane (Z = 0) / ray projection.
 */
export function placeCursor(ray: Ray3d, scene: SnapScene): Cursor3d {
  const rOrig = vec3From(ray.origin);
  const rDir = normalize(vec3From(ray.direction));

  // 1. Raycast against scene objects
  const hit = snapToFace({ origin: rOrig, direction: rDir }, scene.objects);
  if (hit) {
    const rot = alignToNormal(hit.point, hit.normal, [0, 0, 1]);
    return {
      position: hit.point,
      rotation: rot,
    };
  }

  // 2. Intersect with ground plane Z = 0
  if (Math.abs(rDir[2]) > 1e-6) {
    const t = -rOrig[2] / rDir[2];
    if (t > 0) {
      return {
        position: vec3(rOrig[0] + t * rDir[0], rOrig[1] + t * rDir[1], 0),
        rotation: quat(0, 0, 0, 1),
      };
    }
  }

  // 3. Fallback: distance of 5 units along ray
  const defaultDist = 5;
  return {
    position: vec3(
      rOrig[0] + defaultDist * rDir[0],
      rOrig[1] + defaultDist * rDir[1],
      rOrig[2] + defaultDist * rDir[2]
    ),
    rotation: quat(0, 0, 0, 1),
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? vec3(v[0] / len, v[1] / len, v[2] / len) : vec3(0, 0, 1);
}
