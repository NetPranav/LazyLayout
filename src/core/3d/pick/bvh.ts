/**
 * ============================================================================
 * 3D BVH ACCELERATED PICKING (Phase 3D-015)
 * ============================================================================
 * Accelerated ray-mesh intersection using `three-mesh-bvh`:
 *   - LRU / key cache per (meshId, version)
 *   - pickMesh: intersects ray with single mesh, transforming through worldMatrix
 *   - pickScene: intersects ray with multiple objects, sorted by distance ascending
 *   - Normal transformation with inverse-transpose for non-uniform scaling
 * ============================================================================
 */

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Ray as ThreeRay,
  Vector3 as ThreeVector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import {
  type Mat4,
  type Vec3,
  invert,
  transformDirection,
  transformPoint,
  vec3,
} from "../math";
import type { Ray3d } from "./ray";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PickResult {
  readonly objectId?: string;
  readonly distance: number;
  readonly point: Vec3;
  readonly faceIndex: number;
  readonly normal: Vec3;
}

export interface PickableMesh {
  readonly id?: string;
  readonly version?: number;
  readonly positions: Float32Array | ArrayLike<number>;
  readonly indices?: Uint16Array | Uint32Array | ArrayLike<number>;
  readonly worldMatrix?: Mat4;
}

export interface PickableSceneObject {
  readonly id: string;
  readonly mesh: PickableMesh;
}

// ---------------------------------------------------------------------------
// BVH Cache
// ---------------------------------------------------------------------------

interface CachedBVH {
  readonly bvh: MeshBVH;
  readonly geometry: BufferGeometry;
}

const bvhCache = new Map<string, CachedBVH>();

/**
 * Returns a cached MeshBVH or constructs and caches a new one.
 */
export function getOrCreateMeshBVH(
  meshId: string,
  version: number,
  positions: Float32Array | ArrayLike<number>,
  indices?: Uint16Array | Uint32Array | ArrayLike<number>
): CachedBVH {
  const key = `${meshId}:${version}`;
  const existing = bvhCache.get(key);
  if (existing) {
    return existing;
  }

  const geometry = new BufferGeometry();
  const posArray =
    positions instanceof Float32Array ? positions : new Float32Array(positions);
  geometry.setAttribute("position", new BufferAttribute(posArray, 3));

  if (indices) {
    const idxArray =
      indices instanceof Uint32Array || indices instanceof Uint16Array
        ? indices
        : new Uint32Array(indices);
    geometry.setIndex(new BufferAttribute(idxArray, 1));
  }

  const bvh = new MeshBVH(geometry);
  const entry: CachedBVH = { bvh, geometry };
  bvhCache.set(key, entry);
  return entry;
}

/**
 * Clears the mesh BVH cache.
 */
export function clearMeshBVHCache(): void {
  for (const entry of bvhCache.values()) {
    entry.geometry.dispose();
  }
  bvhCache.clear();
}

// ---------------------------------------------------------------------------
// Pick Mesh & Scene
// ---------------------------------------------------------------------------

/**
 * Intersects a world-space ray against a mesh geometry and returns the closest hit,
 * taking the object's 4x4 world transformation into account.
 */
export function pickMesh(
  ray: Ray3d,
  mesh: PickableMesh
): PickResult | null {
  const { positions, indices, worldMatrix, id, version } = mesh;

  // Retrieve or create BVH
  let cached: CachedBVH;
  if (id !== undefined && version !== undefined) {
    cached = getOrCreateMeshBVH(id, version, positions, indices);
  } else {
    const geo = new BufferGeometry();
    const posArray =
      positions instanceof Float32Array ? positions : new Float32Array(positions);
    geo.setAttribute("position", new BufferAttribute(posArray, 3));
    if (indices) {
      const idxArray =
        indices instanceof Uint32Array || indices instanceof Uint16Array
          ? indices
          : new Uint32Array(indices);
      geo.setIndex(new BufferAttribute(idxArray, 1));
    }
    cached = { bvh: new MeshBVH(geo), geometry: geo };
  }

  // Transform ray from world to local space if worldMatrix is provided
  let localRayOrigin: Vec3 = vec3(ray.origin[0], ray.origin[1], ray.origin[2]);
  let localRayDir: Vec3 = vec3(ray.dir[0], ray.dir[1], ray.dir[2]);
  let invWorld: Mat4 | null = null;

  if (worldMatrix) {
    try {
      invWorld = invert(worldMatrix);
      localRayOrigin = transformPoint(invWorld, ray.origin);
      localRayDir = transformDirection(invWorld, ray.dir);
    } catch {
      // If singular matrix, object cannot be picked
      return null;
    }
  }

  const dirLen = Math.hypot(localRayDir[0], localRayDir[1], localRayDir[2]);
  if (dirLen < 1e-12) return null;

  const invDirLen = 1.0 / dirLen;
  const normalizedLocalDir = new ThreeVector3(
    localRayDir[0] * invDirLen,
    localRayDir[1] * invDirLen,
    localRayDir[2] * invDirLen
  );
  const threeOrigin = new ThreeVector3(
    localRayOrigin[0],
    localRayOrigin[1],
    localRayOrigin[2]
  );

  const threeRay = new ThreeRay(threeOrigin, normalizedLocalDir);
  const hit = cached.bvh.raycastFirst(threeRay, DoubleSide);

  if (!hit) {
    return null;
  }

  // Local hit point and face index
  const localHitPt = hit.point;
  const faceIndex = hit.faceIndex ?? 0;

  // Compute local normal
  let localNormalX = 0;
  let localNormalY = 1;
  let localNormalZ = 0;

  if (hit.face) {
    localNormalX = hit.face.normal.x;
    localNormalY = hit.face.normal.y;
    localNormalZ = hit.face.normal.z;
  } else {
    // Compute normal from triangle vertices
    const posAttr = cached.geometry.getAttribute("position");
    const idxAttr = cached.geometry.getIndex();

    let i0 = faceIndex * 3;
    let i1 = faceIndex * 3 + 1;
    let i2 = faceIndex * 3 + 2;

    if (idxAttr) {
      i0 = idxAttr.getX(i0);
      i1 = idxAttr.getX(i1);
      i2 = idxAttr.getX(i2);
    }

    const ax = posAttr.getX(i0), ay = posAttr.getY(i0), az = posAttr.getZ(i0);
    const bx = posAttr.getX(i1), by = posAttr.getY(i1), bz = posAttr.getZ(i1);
    const cx = posAttr.getX(i2), cy = posAttr.getY(i2), cz = posAttr.getZ(i2);

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const cnx = aby * acz - abz * acy;
    const cny = abz * acx - abx * acz;
    const cnz = abx * acy - aby * acx;

    const nLen = Math.hypot(cnx, cny, cnz) || 1.0;
    localNormalX = cnx / nLen;
    localNormalY = cny / nLen;
    localNormalZ = cnz / nLen;
  }

  // Transform point and normal to world space
  let worldPoint: Vec3;
  let worldNormal: Vec3;

  if (worldMatrix && invWorld) {
    worldPoint = transformPoint(worldMatrix, [localHitPt.x, localHitPt.y, localHitPt.z]);

    // Normal transforms via transpose(invWorld)
    const tnx = invWorld[0] * localNormalX + invWorld[1] * localNormalY + invWorld[2] * localNormalZ;
    const tny = invWorld[4] * localNormalX + invWorld[5] * localNormalY + invWorld[6] * localNormalZ;
    const tnz = invWorld[8] * localNormalX + invWorld[9] * localNormalY + invWorld[10] * localNormalZ;

    const wnLen = Math.hypot(tnx, tny, tnz) || 1.0;
    worldNormal = vec3(tnx / wnLen, tny / wnLen, tnz / wnLen);
  } else {
    worldPoint = vec3(localHitPt.x, localHitPt.y, localHitPt.z);
    worldNormal = vec3(localNormalX, localNormalY, localNormalZ);
  }

  // Exact world distance from ray origin to intersection point
  const worldDistance = Math.hypot(
    worldPoint[0] - ray.origin[0],
    worldPoint[1] - ray.origin[1],
    worldPoint[2] - ray.origin[2]
  );

  return {
    objectId: id,
    distance: worldDistance,
    point: worldPoint,
    faceIndex,
    normal: worldNormal,
  };
}

/**
 * Intersects a world-space ray against an array of scene objects, returning all hits
 * sorted in ascending order of distance from the ray origin.
 */
export function pickScene(
  ray: Ray3d,
  objects: readonly PickableSceneObject[]
): PickResult[] {
  const results: PickResult[] = [];

  for (const obj of objects) {
    const meshWithId: PickableMesh = {
      ...obj.mesh,
      id: obj.id,
    };

    const hit = pickMesh(ray, meshWithId);
    if (hit) {
      results.push(hit);
    }
  }

  results.sort((a, b) => a.distance - b.distance);
  return results;
}
