/**
 * ============================================================================
 * VIEWPORT SCENE STATISTICS (Phase 3D-019)
 * ============================================================================
 * Computes deterministic statistics (objects, vertices, faces, triangles, memory)
 * from shared 3D document data blocks (inline meshes and binary pointers).
 * ============================================================================
 */

import type { Mesh3d, Object3d, Scene3d } from "../../document/scene3d";

export interface SceneStatsResult {
  objects: number;
  vertices: number;
  faces: number;
  triangles: number;
  estimatedMemoryBytes: number;
}

export interface DocumentLikeWith3D {
  scenes?: Record<string, Scene3d>;
  objects?: Record<string, Object3d>;
  meshes?: Record<string, Mesh3d>;
  [key: string]: unknown;
}

/**
 * Counts planar polygon faces on an indexed triangle mesh by clustering adjacent
 * coplanar triangles (e.g. 2 triangles per quad face on a standard box).
 */
export function countPlanarFaces(positions: number[], indices: number[]): number {
  const triCount = Math.floor(indices.length / 3);
  if (triCount === 0) return 0;

  // Compute normal and plane offset for each triangle
  const normals: Array<[number, number, number]> = [];
  const planeD: number[] = [];

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    const p0x = positions[i0 * 3] ?? 0;
    const p0y = positions[i0 * 3 + 1] ?? 0;
    const p0z = positions[i0 * 3 + 2] ?? 0;

    const p1x = positions[i1 * 3] ?? 0;
    const p1y = positions[i1 * 3 + 1] ?? 0;
    const p1z = positions[i1 * 3 + 2] ?? 0;

    const p2x = positions[i2 * 3] ?? 0;
    const p2y = positions[i2 * 3 + 1] ?? 0;
    const p2z = positions[i2 * 3 + 2] ?? 0;

    const e1x = p1x - p0x;
    const e1y = p1y - p0y;
    const e1z = p1z - p0z;

    const e2x = p2x - p0x;
    const e2y = p2y - p0y;
    const e2z = p2z - p0z;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len < 1e-8) {
      normals.push([0, 0, 0]);
      planeD.push(0);
    } else {
      const invLen = 1 / len;
      const unx = nx * invLen;
      const uny = ny * invLen;
      const unz = nz * invLen;
      normals.push([unx, uny, unz]);
      planeD.push(unx * p0x + uny * p0y + unz * p0z);
    }
  }

  // Build edge-to-triangle adjacency: edge key -> list of triangle indices
  const edgeMap = new Map<string, number[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    const edges = [
      i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`,
      i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`,
      i2 < i0 ? `${i2}_${i0}` : `${i0}_${i2}`,
    ];

    for (const edge of edges) {
      const list = edgeMap.get(edge);
      if (list) list.push(t);
      else edgeMap.set(edge, [t]);
    }
  }

  // Disjoint set (union-find) for clustering coplanar adjacent triangles
  const parent = new Int32Array(triCount);
  for (let i = 0; i < triCount; i++) parent[i] = i;

  function find(i: number): number {
    let root = i;
    while (root !== parent[root]) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const next = parent[curr];
      parent[curr] = root;
      curr = next;
    }
    return root;
  }

  function union(i: number, j: number): void {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  // Union adjacent triangles if their plane normals and offsets match
  for (const triList of edgeMap.values()) {
    if (triList.length < 2) continue;
    for (let a = 0; a < triList.length; a++) {
      for (let b = a + 1; b < triList.length; b++) {
        const tA = triList[a];
        const tB = triList[b];

        const nA = normals[tA];
        const nB = normals[tB];
        const dot = nA[0] * nB[0] + nA[1] * nB[1] + nA[2] * nB[2];

        // Coplanar: normal dot product close to 1 and distance delta close to 0
        if (dot > 0.999 && Math.abs(planeD[tA] - planeD[tB]) < 1e-4) {
          union(tA, tB);
        }
      }
    }
  }

  // Count distinct roots
  const roots = new Set<number>();
  for (let t = 0; t < triCount; t++) {
    roots.add(find(t));
  }

  return roots.size;
}

/**
 * Computes scene statistics (objects, vertices, faces, triangles, memory bytes)
 * from data blocks in the document.
 */
export function sceneStats(
  doc: DocumentLikeWith3D,
  sceneId: string
): SceneStatsResult {
  const result: SceneStatsResult = {
    objects: 0,
    vertices: 0,
    faces: 0,
    triangles: 0,
    estimatedMemoryBytes: 0,
  };

  const scene = doc.scenes?.[sceneId];
  if (!scene || !Array.isArray(scene.objects)) {
    return result;
  }

  result.objects = scene.objects.length;
  const visitedMeshIds = new Set<string>();

  for (const objId of scene.objects) {
    const obj = doc.objects?.[objId];
    if (!obj || obj.type !== "mesh" || !obj.dataId) continue;

    const meshId = obj.dataId;
    const mesh = doc.meshes?.[meshId];
    if (!mesh) continue;

    let objVertices = 0;
    let objFaces = 0;
    let objTriangles = 0;
    let objBytes = 0;

    if (mesh.binary) {
      // Binary mesh pointer
      objVertices = mesh.binary.vertexCount;
      objFaces = mesh.binary.faceCount;
      objTriangles = mesh.binary.faceCount; // Triangulated binary storage
      objBytes = 16 + mesh.binary.vertexCount * 12 + mesh.binary.faceCount * 3 * 4;
    } else if (mesh.positions) {
      // Inline mesh positions
      objVertices = Math.floor(mesh.positions.length / 3);

      if (mesh.indices && mesh.indices.length > 0) {
        objTriangles = Math.floor(mesh.indices.length / 3);
        objFaces = countPlanarFaces(mesh.positions, mesh.indices);
      } else {
        objTriangles = Math.floor(mesh.positions.length / 9);
        objFaces = objTriangles;
      }

      // Memory estimation: 4 bytes per float/uint in standard vertex + index buffers
      objBytes =
        mesh.positions.length * 4 +
        (mesh.indices ? mesh.indices.length * 4 : 0) +
        (mesh.normals ? mesh.normals.length * 4 : 0) +
        (mesh.uvs ? mesh.uvs.length * 4 : 0);
    }

    result.vertices += objVertices;
    result.faces += objFaces;
    result.triangles += objTriangles;

    // Attribute mesh memory once per unique data block, or add to total
    if (!visitedMeshIds.has(meshId)) {
      visitedMeshIds.add(meshId);
      result.estimatedMemoryBytes += objBytes;
    }
  }

  return result;
}
