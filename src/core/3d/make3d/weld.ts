/**
 * ============================================================================
 * VERTEX WELDING & MESH CLEANUP (Phase 3D-029)
 * ============================================================================
 * Spatial hash grid welding for unifying vertices across procedural seams
 * (e.g. between triangulated caps and extruded/beveled side walls)
 * to guarantee closed watertight 2-manifold topology.
 * ============================================================================
 */

import type { MeshData } from "./types";

/**
 * Welds coincident vertices within `tolerance` into shared indices.
 * Removes degenerate triangles and computes smoothed outward normals.
 */
export function weldVertices(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  uvs?: ArrayLike<number>,
  tolerance = 1e-4
): MeshData {
  const invTol = 1 / Math.max(1e-7, tolerance);
  const numVerts = Math.floor(positions.length / 3);

  const grid = new Map<string, number>();
  const oldToNew = new Int32Array(numVerts);
  const newPositions: number[] = [];
  const newUvs: number[] = [];

  let uniqueCount = 0;

  for (let i = 0; i < numVerts; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    const qx = Math.round(x * invTol);
    const qy = Math.round(y * invTol);
    const qz = Math.round(z * invTol);

    const key = `${qx},${qy},${qz}`;
    let matchIdx = grid.get(key);

    if (matchIdx === undefined) {
      matchIdx = uniqueCount++;
      grid.set(key, matchIdx);
      newPositions.push(x, y, z);

      if (uvs && i * 2 + 1 < uvs.length) {
        newUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
      } else {
        newUvs.push(0, 0);
      }
    }

    oldToNew[i] = matchIdx;
  }

  // Remap indices and discard degenerate triangles
  const newIndices: number[] = [];
  const numTris = Math.floor(indices.length / 3);

  for (let t = 0; t < numTris; t++) {
    const i0 = oldToNew[indices[t * 3]];
    const i1 = oldToNew[indices[t * 3 + 1]];
    const i2 = oldToNew[indices[t * 3 + 2]];

    if (i0 !== i1 && i1 !== i2 && i2 !== i0) {
      newIndices.push(i0, i1, i2);
    }
  }

  // Compute vertex normals by accumulating face normals
  const normals = new Float32Array(uniqueCount * 3);
  const finalTriCount = Math.floor(newIndices.length / 3);

  for (let t = 0; t < finalTriCount; t++) {
    const i0 = newIndices[t * 3];
    const i1 = newIndices[t * 3 + 1];
    const i2 = newIndices[t * 3 + 2];

    const ax = newPositions[i0 * 3];
    const ay = newPositions[i0 * 3 + 1];
    const az = newPositions[i0 * 3 + 2];

    const bx = newPositions[i1 * 3];
    const by = newPositions[i1 * 3 + 1];
    const bz = newPositions[i1 * 3 + 2];

    const cx = newPositions[i2 * 3];
    const cy = newPositions[i2 * 3 + 1];
    const cz = newPositions[i2 * 3 + 2];

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;

    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    // Cross product (ab x ac)
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;

    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < uniqueCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-9) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 0;
      normals[i * 3 + 2] = 1;
    }
  }

  return {
    positions: new Float32Array(newPositions),
    indices: new Uint32Array(newIndices),
    uvs: new Float32Array(newUvs),
    normals,
  };
}
