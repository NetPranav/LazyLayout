/**
 * ============================================================================
 * 3D SILHOUETTE EDGE EXTRACTION (Phase 3D-015)
 * ============================================================================
 * Computes mesh edges with their adjacent triangle face normals for the
 * selection outline pass.
 *
 * In the GPU outline shader, an edge is rendered as a silhouette when:
 *   dot(normal0, viewDir) * dot(normal1, viewDir) <= 0
 * or when the edge is on an open mesh boundary (only 1 adjacent triangle).
 * ============================================================================
 */

import { type Vec3, vec3 } from "../math";

export interface SilhouetteEdge {
  readonly v0: Vec3;
  readonly v1: Vec3;
  readonly normal0: Vec3;
  readonly normal1: Vec3;
}

/**
 * Extracts all unique edges of a triangulated mesh along with the face normals
 * of the triangles sharing each edge.
 *
 * @param positions Flattened vertex positions [x0, y0, z0, x1, y1, z1, ...]
 * @param indices Triangle index array [f0_a, f0_b, f0_c, f1_a, ...]
 */
export function silhouetteEdges(
  positions: Float32Array | ArrayLike<number>,
  indices: Uint16Array | Uint32Array | ArrayLike<number>
): SilhouetteEdge[] {
  const numFaces = Math.floor(indices.length / 3);
  if (numFaces === 0) return [];

  // 1. Compute face normals
  const faceNormals: Vec3[] = new Array(numFaces);

  for (let f = 0; f < numFaces; f++) {
    const i0 = indices[f * 3];
    const i1 = indices[f * 3 + 1];
    const i2 = indices[f * 3 + 2];

    const ax = positions[i0 * 3];
    const ay = positions[i0 * 3 + 1];
    const az = positions[i0 * 3 + 2];

    const bx = positions[i1 * 3];
    const by = positions[i1 * 3 + 1];
    const bz = positions[i1 * 3 + 2];

    const cx = positions[i2 * 3];
    const cy = positions[i2 * 3 + 1];
    const cz = positions[i2 * 3 + 2];

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;

    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      faceNormals[f] = vec3(nx / len, ny / len, nz / len);
    } else {
      faceNormals[f] = vec3(0, 1, 0);
    }
  }

  // 2. Map edges to adjacent face normals
  interface EdgeData {
    readonly v0Idx: number;
    readonly v1Idx: number;
    normal0: Vec3;
    normal1: Vec3 | null;
  }

  const edgeMap = new Map<string, EdgeData>();

  for (let f = 0; f < numFaces; f++) {
    const fn = faceNormals[f];
    const fIndices = [indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]];

    for (let e = 0; e < 3; e++) {
      const a = fIndices[e];
      const b = fIndices[(e + 1) % 3];
      const minIdx = Math.min(a, b);
      const maxIdx = Math.max(a, b);
      const key = `${minIdx}:${maxIdx}`;

      const existing = edgeMap.get(key);
      if (!existing) {
        edgeMap.set(key, {
          v0Idx: minIdx,
          v1Idx: maxIdx,
          normal0: fn,
          normal1: null,
        });
      } else if (existing.normal1 === null) {
        existing.normal1 = fn;
      }
    }
  }

  // 3. Assemble SilhouetteEdge array
  const results: SilhouetteEdge[] = [];

  for (const edge of edgeMap.values()) {
    const v0 = vec3(
      positions[edge.v0Idx * 3],
      positions[edge.v0Idx * 3 + 1],
      positions[edge.v0Idx * 3 + 2]
    );

    const v1 = vec3(
      positions[edge.v1Idx * 3],
      positions[edge.v1Idx * 3 + 1],
      positions[edge.v1Idx * 3 + 2]
    );

    // If boundary edge with only 1 adjacent face, normal1 is set to [0, 0, 0]
    const normal1 = edge.normal1 ?? vec3(0, 0, 0);

    results.push({
      v0,
      v1,
      normal0: edge.normal0,
      normal1,
    });
  }

  return results;
}
