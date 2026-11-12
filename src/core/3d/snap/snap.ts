/**
 * ============================================================================
 * 3D SNAPPING KERNEL (Phase 3D-017)
 * ============================================================================
 * Pure TypeScript snapping engine supporting:
 * - Increment snapping (`snapValue`)
 * - Grid snapping (`snapToGrid`)
 * - Vertex, edge, and face snapping (`snapToVertex`, `snapToEdge`, `snapToFace`)
 * - Surface normal alignment (`alignToNormal`)
 * - Composite multi-target snapping (`snapPoint`)
 * ============================================================================
 */

import {
  type Mat4,
  type Quat,
  type Vec3,
  mat4From,
  quat,
  quatNormalize,
  transformPoint,
  vec3,
  vec3From,
} from "../math";
import type { Ray3d } from "../transform/gizmo";

export interface SnapMeshGeometry {
  positions: Float32Array | Float64Array | number[];
  indices?: Uint16Array | Uint32Array | number[];
  normals?: Float32Array | Float64Array | number[];
}

export interface SnapObject {
  id: string;
  worldMatrix?: Mat4 | ArrayLike<number>;
  mesh?: SnapMeshGeometry;
  positions?: Float32Array | Float64Array | number[];
  indices?: Uint16Array | Uint32Array | number[];
}

export interface SnapScene {
  objects: SnapObject[];
}

export type SnapTarget = "vertex" | "edge" | "face" | "grid" | "increment";

export interface SnapSettings {
  enabled?: boolean;
  targets?: SnapTarget[];
  gridSize?: number | [number, number, number];
  increment?: number;
  radiusPx?: number;
  ray?: Ray3d;
  viewProj?: Mat4 | ArrayLike<number>;
}

export interface SnapVertexResult {
  point: Vec3;
  normal?: Vec3;
  objectId: string;
  vertexIndex: number;
  distance: number;
}

export interface SnapEdgeResult {
  point: Vec3;
  normal?: Vec3;
  objectId: string;
  edgeIndex: number;
  distance: number;
}

export interface SnapFaceResult {
  point: Vec3;
  normal: Vec3;
  objectId: string;
  faceIndex?: number;
  distance: number;
}

export interface SnapResult {
  point: Vec3;
  normal?: Vec3;
  target?: SnapTarget;
  objectId?: string;
}

/**
 * Snaps a scalar value to the nearest multiple of `step`.
 */
export function snapValue(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return value;
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

/**
 * Snaps a 3D point to the nearest grid intersection of size `size`.
 */
export function snapToGrid(
  point: Vec3 | ArrayLike<number>,
  size: number | ArrayLike<number> = 1
): Vec3 {
  const p = vec3From(point);
  if (typeof size === "number") {
    return vec3(snapValue(p[0], size), snapValue(p[1], size), snapValue(p[2], size));
  }
  return vec3(
    snapValue(p[0], size[0] ?? 1),
    snapValue(p[1], size[1] ?? 1),
    snapValue(p[2], size[2] ?? 1)
  );
}

/**
 * Snaps to the closest mesh vertex within tolerance.
 * Accepts either a 3D Point or a 3D Ray.
 */
export function snapToVertex(
  target: Ray3d | Vec3 | ArrayLike<number>,
  objects: SnapObject[],
  radiusPx = 10,
  viewProj?: Mat4 | ArrayLike<number>
): SnapVertexResult | null {
  const isRay = "direction" in target && "origin" in target;
  const rayOrig = isRay ? vec3From((target as Ray3d).origin) : null;
  const rayDir = isRay ? normalize(vec3From((target as Ray3d).direction)) : null;
  const targetPoint = isRay ? null : vec3From(target as Vec3 | ArrayLike<number>);

  let closestHit: SnapVertexResult | null = null;
  let minDistance = Infinity;

  for (const obj of objects) {
    const wMat = obj.worldMatrix ? mat4From(obj.worldMatrix) : null;
    const positions = obj.mesh?.positions ?? obj.positions;
    if (!positions || positions.length < 3) continue;

    const count = Math.floor(positions.length / 3);
    for (let i = 0; i < count; i++) {
      const lx = positions[i * 3];
      const ly = positions[i * 3 + 1];
      const lz = positions[i * 3 + 2];
      const pWorld = wMat ? transformPoint(wMat, [lx, ly, lz]) : vec3(lx, ly, lz);

      let dist: number;
      if (isRay && rayOrig && rayDir) {
        dist = pointToRayDist(pWorld, rayOrig, rayDir);
      } else if (targetPoint) {
        if (viewProj) {
          dist = projectedScreenDistance(pWorld, targetPoint, mat4From(viewProj));
        } else {
          dist = euclideanDistance(pWorld, targetPoint);
        }
      } else {
        continue;
      }

      if (dist <= radiusPx && dist < minDistance) {
        minDistance = dist;
        closestHit = {
          point: pWorld,
          objectId: obj.id,
          vertexIndex: i,
          distance: dist,
        };
      }
    }
  }

  return closestHit;
}

/**
 * Snaps to the closest point along mesh edges.
 */
export function snapToEdge(
  target: Ray3d | Vec3 | ArrayLike<number>,
  objects: SnapObject[],
  radiusPx = 10,
  _viewProj?: Mat4 | ArrayLike<number>
): SnapEdgeResult | null {
  const isRay = "direction" in target && "origin" in target;
  const rayOrig = isRay ? vec3From((target as Ray3d).origin) : null;
  const rayDir = isRay ? normalize(vec3From((target as Ray3d).direction)) : null;
  const targetPoint = isRay ? null : vec3From(target as Vec3 | ArrayLike<number>);

  let closestHit: SnapEdgeResult | null = null;
  let minDistance = Infinity;
  let globalEdgeIdx = 0;

  for (const obj of objects) {
    const wMat = obj.worldMatrix ? mat4From(obj.worldMatrix) : null;
    const positions = obj.mesh?.positions ?? obj.positions;
    const indices = obj.mesh?.indices ?? obj.indices;
    if (!positions || positions.length < 6) continue;

    const getVertex = (idx: number): Vec3 => {
      const lx = positions[idx * 3];
      const ly = positions[idx * 3 + 1];
      const lz = positions[idx * 3 + 2];
      return wMat ? transformPoint(wMat, [lx, ly, lz]) : vec3(lx, ly, lz);
    };

    const testEdge = (idxA: number, idxB: number) => {
      const a = getVertex(idxA);
      const b = getVertex(idxB);

      let closestOnEdge: Vec3;
      let dist: number;

      if (isRay && rayOrig && rayDir) {
        const segRes = closestPointsRaySegment(rayOrig, rayDir, a, b);
        closestOnEdge = segRes.segmentPoint;
        dist = segRes.distance;
      } else if (targetPoint) {
        closestOnEdge = closestPointOnSegment(targetPoint, a, b);
        dist = euclideanDistance(targetPoint, closestOnEdge);
      } else {
        return;
      }

      if (dist <= radiusPx && dist < minDistance) {
        minDistance = dist;
        closestHit = {
          point: closestOnEdge,
          objectId: obj.id,
          edgeIndex: globalEdgeIdx,
          distance: dist,
        };
      }
      globalEdgeIdx++;
    };

    if (indices && indices.length >= 3) {
      const triCount = Math.floor(indices.length / 3);
      for (let t = 0; t < triCount; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];
        testEdge(i0, i1);
        testEdge(i1, i2);
        testEdge(i2, i0);
      }
    } else {
      const vCount = Math.floor(positions.length / 3);
      for (let v = 0; v < vCount - 1; v++) {
        testEdge(v, v + 1);
      }
    }
  }

  return closestHit;
}

/**
 * Snaps a ray to triangle faces of mesh objects using Möller–Trumbore intersection.
 */
export function snapToFace(
  ray: Ray3d,
  objects: SnapObject[]
): SnapFaceResult | null {
  const rOrig = vec3From(ray.origin);
  const rDir = normalize(vec3From(ray.direction));

  let closestHit: SnapFaceResult | null = null;
  let minT = Infinity;

  for (const obj of objects) {
    const wMat = obj.worldMatrix ? mat4From(obj.worldMatrix) : null;
    const positions = obj.mesh?.positions ?? obj.positions;
    const indices = obj.mesh?.indices ?? obj.indices;
    if (!positions || positions.length < 9) continue;

    const getVertex = (idx: number): Vec3 => {
      const lx = positions[idx * 3];
      const ly = positions[idx * 3 + 1];
      const lz = positions[idx * 3 + 2];
      return wMat ? transformPoint(wMat, [lx, ly, lz]) : vec3(lx, ly, lz);
    };

    const triCount = indices
      ? Math.floor(indices.length / 3)
      : Math.floor(positions.length / 9);

    for (let t = 0; t < triCount; t++) {
      const i0 = indices ? indices[t * 3] : t * 3;
      const i1 = indices ? indices[t * 3 + 1] : t * 3 + 1;
      const i2 = indices ? indices[t * 3 + 2] : t * 3 + 2;

      const v0 = getVertex(i0);
      const v1 = getVertex(i1);
      const v2 = getVertex(i2);

      const hit = rayTriangleIntersect(rOrig, rDir, v0, v1, v2);
      if (hit !== null && hit.t > 1e-6 && hit.t < minT) {
        minT = hit.t;
        closestHit = {
          point: hit.point,
          normal: hit.normal,
          objectId: obj.id,
          faceIndex: t,
          distance: hit.t,
        };
      }
    }
  }

  return closestHit;
}

/**
 * Computes a rotation quaternion that aligns an object's local up vector with
 * a surface normal, placing the object flat on the surface upright.
 */
export function alignToNormal(
  _point: Vec3 | ArrayLike<number>,
  normal: Vec3 | ArrayLike<number>,
  upAxis: Vec3 | ArrayLike<number> = [0, 0, 1]
): Quat {
  const u = normalize(vec3From(upAxis));
  const n = normalize(vec3From(normal));

  const d = u[0] * n[0] + u[1] * n[1] + u[2] * n[2];

  // Vectors are parallel
  if (d > 0.999999999) {
    return quat(0, 0, 0, 1);
  }

  // Vectors are anti-parallel (180 degree rotation around arbitrary orthogonal vector)
  if (d < -0.999999999) {
    // the axis flips about the world X axis (or Y when up is along X): that part of it perpendicular to `up`
    const base = Math.abs(u[0]) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0);
    const along = base[0] * u[0] + base[1] * u[1] + base[2] * u[2];
    const ortho = normalize(vec3(base[0] - along * u[0], base[1] - along * u[1], base[2] - along * u[2]));
    return quat(ortho[0], ortho[1], ortho[2], 0);
  }

  // General case: half-angle formulation
  const crossX = u[1] * n[2] - u[2] * n[1];
  const crossY = u[2] * n[0] - u[0] * n[2];
  const crossZ = u[0] * n[1] - u[1] * n[0];

  const s = Math.sqrt(2 * (1 + d));
  const invS = 1 / s;

  const q = quat(crossX * invS, crossY * invS, crossZ * invS, s * 0.5);
  return quatNormalize(q);
}

/**
 * Combines enabled snap targets with strict priority:
 * vertex > edge > face > grid > increment.
 */
export function snapPoint(
  point: Vec3 | ArrayLike<number>,
  settings: SnapSettings,
  scene: SnapScene
): SnapResult {
  const p = vec3From(point);
  if (settings.enabled === false) {
    return { point: p };
  }

  const targets = settings.targets ?? ["vertex", "edge", "face", "grid", "increment"];

  // 1. Vertex priority
  if (targets.includes("vertex")) {
    const vHit = snapToVertex(
      settings.ray ?? p,
      scene.objects,
      settings.radiusPx ?? 10,
      settings.viewProj
    );
    if (vHit) {
      return {
        point: vHit.point,
        normal: vHit.normal,
        target: "vertex",
        objectId: vHit.objectId,
      };
    }
  }

  // 2. Edge priority
  if (targets.includes("edge")) {
    const eHit = snapToEdge(
      settings.ray ?? p,
      scene.objects,
      settings.radiusPx ?? 10,
      settings.viewProj
    );
    if (eHit) {
      return {
        point: eHit.point,
        normal: eHit.normal,
        target: "edge",
        objectId: eHit.objectId,
      };
    }
  }

  // 3. Face priority
  if (targets.includes("face") && settings.ray) {
    const fHit = snapToFace(settings.ray, scene.objects);
    if (fHit) {
      return {
        point: fHit.point,
        normal: fHit.normal,
        target: "face",
        objectId: fHit.objectId,
      };
    }
  }

  // 4. Grid priority
  if (targets.includes("grid")) {
    const gPoint = snapToGrid(p, settings.gridSize ?? 1);
    return {
      point: gPoint,
      target: "grid",
    };
  }

  // 5. Increment priority
  if (targets.includes("increment")) {
    const step = settings.increment ?? 1;
    const iPoint = vec3(snapValue(p[0], step), snapValue(p[1], step), snapValue(p[2], step));
    return {
      point: iPoint,
      target: "increment",
    };
  }

  return { point: p };
}

// ---------------------------------------------------------------------------
// Math & Geometric Utilities
// ---------------------------------------------------------------------------

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? vec3(v[0] / len, v[1] / len, v[2] / len) : vec3(0, 0, 1);
}

function euclideanDistance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function pointToRayDist(p: Vec3, rOrig: Vec3, rDir: Vec3): number {
  const diffX = p[0] - rOrig[0];
  const diffY = p[1] - rOrig[1];
  const diffZ = p[2] - rOrig[2];
  const t = diffX * rDir[0] + diffY * rDir[1] + diffZ * rDir[2];
  const projX = rOrig[0] + t * rDir[0];
  const projY = rOrig[1] + t * rDir[1];
  const projZ = rOrig[2] + t * rDir[2];
  return Math.sqrt((p[0] - projX) ** 2 + (p[1] - projY) ** 2 + (p[2] - projZ) ** 2);
}

function projectedScreenDistance(pWorld: Vec3, targetWorld: Vec3, viewProj: Mat4): number {
  const pA = transformPoint(viewProj, pWorld);
  const pB = transformPoint(viewProj, targetWorld);
  return Math.sqrt((pA[0] - pB[0]) ** 2 + (pA[1] - pB[1]) ** 2);
}

function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const abX = b[0] - a[0];
  const abY = b[1] - a[1];
  const abZ = b[2] - a[2];
  const abLen2 = abX * abX + abY * abY + abZ * abZ;
  if (abLen2 < 1e-9) return vec3(a[0], a[1], a[2]);

  const apX = p[0] - a[0];
  const apY = p[1] - a[1];
  const apZ = p[2] - a[2];

  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY + apZ * abZ) / abLen2));
  return vec3(a[0] + t * abX, a[1] + t * abY, a[2] + t * abZ);
}

function closestPointsRaySegment(
  rOrig: Vec3,
  rDir: Vec3,
  s0: Vec3,
  s1: Vec3
): { distance: number; segmentPoint: Vec3 } {
  const uX = s1[0] - s0[0];
  const uY = s1[1] - s0[1];
  const uZ = s1[2] - s0[2];
  const segLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
  if (segLen < 1e-9) {
    return { distance: pointToRayDist(s0, rOrig, rDir), segmentPoint: s0 };
  }

  const uDirX = uX / segLen;
  const uDirY = uY / segLen;
  const uDirZ = uZ / segLen;

  const w0X = rOrig[0] - s0[0];
  const w0Y = rOrig[1] - s0[1];
  const w0Z = rOrig[2] - s0[2];

  const a = 1; // rDir is normalized
  const b = rDir[0] * uDirX + rDir[1] * uDirY + rDir[2] * uDirZ;
  const c = 1; // uDir is normalized
  const d = rDir[0] * w0X + rDir[1] * w0Y + rDir[2] * w0Z;
  const e = uDirX * w0X + uDirY * w0Y + uDirZ * w0Z;

  const denom = a * c - b * b;
  let s: number;
  let t: number;

  if (denom < 1e-9) {
    s = 0;
    t = d / a;
  } else {
    s = (b * d - a * e) / denom;
    t = (c * d - b * e) / denom;
  }

  const sClamped = Math.max(0, Math.min(segLen, s));
  const pRay = vec3(rOrig[0] + rDir[0] * t, rOrig[1] + rDir[1] * t, rOrig[2] + rDir[2] * t);
  const pSeg = vec3(s0[0] + uDirX * sClamped, s0[1] + uDirY * sClamped, s0[2] + uDirZ * sClamped);

  const dist = euclideanDistance(pRay, pSeg);
  return { distance: dist, segmentPoint: pSeg };
}

function rayTriangleIntersect(
  rOrig: Vec3,
  rDir: Vec3,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3
): { t: number; point: Vec3; normal: Vec3 } | null {
  const e1X = v1[0] - v0[0];
  const e1Y = v1[1] - v0[1];
  const e1Z = v1[2] - v0[2];

  const e2X = v2[0] - v0[0];
  const e2Y = v2[1] - v0[1];
  const e2Z = v2[2] - v0[2];

  const pX = rDir[1] * e2Z - rDir[2] * e2Y;
  const pY = rDir[2] * e2X - rDir[0] * e2Z;
  const pZ = rDir[0] * e2Y - rDir[1] * e2X;

  const det = e1X * pX + e1Y * pY + e1Z * pZ;
  if (Math.abs(det) < 1e-9) return null;

  const invDet = 1 / det;
  const tX = rOrig[0] - v0[0];
  const tY = rOrig[1] - v0[1];
  const tZ = rOrig[2] - v0[2];

  const u = (tX * pX + tY * pY + tZ * pZ) * invDet;
  if (u < 0 || u > 1) return null;

  const qX = tY * e1Z - tZ * e1Y;
  const qY = tZ * e1X - tX * e1Z;
  const qZ = tX * e1Y - tY * e1X;

  const v = (rDir[0] * qX + rDir[1] * qY + rDir[2] * qZ) * invDet;
  if (v < 0 || u + v > 1) return null;

  const t = (e2X * qX + e2Y * qY + e2Z * qZ) * invDet;
  if (t < 0) return null;

  const normX = e1Y * e2Z - e1Z * e2Y;
  const normY = e1Z * e2X - e1X * e2Z;
  const normZ = e1X * e2Y - e1Y * e2X;
  const normal = normalize(vec3(normX, normY, normZ));

  const point = vec3(rOrig[0] + t * rDir[0], rOrig[1] + t * rDir[1], rOrig[2] + t * rDir[2]);
  return { t, point, normal };
}
