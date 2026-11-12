/**
 * ============================================================================
 * LATHE / REVOLUTION SURFACE GENERATOR (Phase 3D-029)
 * ============================================================================
 * Revolves a 2D profile curve or closed polygonal ring around an axis
 * to produce a watertight 3D rotational solid.
 * ============================================================================
 */

import type { Point2D, Ring } from "../path/flatten";
import type { LatheOptions, MeshData } from "./types";
import { weldVertices } from "./weld";

/**
 * Revolves a 2D profile or closed ring 360 degrees around a central axis.
 */
export function latheRings(
  profileOrRings: readonly Point2D[] | readonly Ring[],
  options?: LatheOptions
): MeshData {
  const segments = Math.max(3, options?.segments ?? 32);
  const axis = options?.axis ?? "y";

  if (profileOrRings.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  // Extract raw points
  let rawPts: Point2D[];
  if (Array.isArray(profileOrRings[0]) && Array.isArray((profileOrRings[0] as unknown as unknown[])[0])) {
    // Array of rings: take the first ring
    rawPts = (profileOrRings as readonly Ring[])[0].slice();
  } else {
    rawPts = (profileOrRings as readonly Point2D[]).slice();
  }

  if (rawPts.length < 3) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0),
    };
  }

  // Remove duplicate closing point if present
  const len = rawPts.length;
  if (
    len > 1 &&
    Math.abs(rawPts[0][0] - rawPts[len - 1][0]) < 1e-7 &&
    Math.abs(rawPts[0][1] - rawPts[len - 1][1]) < 1e-7
  ) {
    rawPts.pop();
  }

  const n = rawPts.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate grid of vertices: (i in profile, s in revolution)
  for (let s = 0; s < segments; s++) {
    const phi = (s / segments) * 2 * Math.PI;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const u = s / segments;

    for (let i = 0; i < n; i++) {
      const p = rawPts[i];
      const r = p[0];
      const v = p[1];

      let x = 0, y = 0, z = 0;
      if (axis === "y") {
        x = r * cosP;
        y = v;
        z = r * sinP;
      } else if (axis === "z") {
        x = r * cosP;
        y = r * sinP;
        z = v;
      } else {
        // axis === "x"
        x = v;
        y = r * cosP;
        z = r * sinP;
      }

      positions.push(x, y, z);
      uvs.push(u, i / n);
    }
  }

  // Create quads connecting adjacent profile points and rotational steps
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    const col0 = s * n;
    const col1 = nextS * n;

    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;

      const p00 = col0 + i;
      const p10 = col0 + nextI;
      const p11 = col1 + nextI;
      const p01 = col1 + i;

      indices.push(p00, p10, p11);
      indices.push(p00, p11, p01);
    }
  }

  return weldVertices(positions, indices, uvs, 1e-4);
}
