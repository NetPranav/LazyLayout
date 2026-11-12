/**
 * ============================================================================
 * 3D GIZMOS AND DIRECT MANIPULATION (Phase 3D-016)
 * ============================================================================
 * Handle geometry generation, ray hit testing, and direct-manipulation dragging.
 * Keeps constant on-screen size via sizePx and camera perspective calculations.
 * ============================================================================
 */

import {
  type Mat4,
  type Quat,
  type Vec3,
  compose,
  mat4From,
  multiply,
  quat,
  quatNormalize,
  transformPoint,
  vec3,
  vec3From,
} from "../math";
import type { ViewCameraInfo } from "./session";
import type { TransformAxis, TransformMode } from "./typed";

export type GizmoHandleType = "axis" | "plane" | "ring" | "box" | "uniform";

export interface GizmoHandle {
  id: string;
  mode: TransformMode;
  type: GizmoHandleType;
  axis: TransformAxis | "all";
  origin: Vec3;
  direction: Vec3; // Primary axis direction (unit vector)
  normal?: Vec3; // For planes and rings: surface normal
  planeU?: Vec3; // For plane handles: first in-plane axis
  planeV?: Vec3; // For plane handles: second in-plane axis
  radius?: number; // For rings
  length: number; // Length of axis arrow or box
  size?: number; // Size of planar square or box handle
  hitRadius: number; // Raycast hit tolerance in world units
  color: string;
}

export interface Ray3d {
  origin: Vec3 | ArrayLike<number>;
  direction: Vec3 | ArrayLike<number>;
}

export interface GizmoTransformDelta {
  mode: TransformMode;
  translation: Vec3;
  rotationQuat: Quat;
  scale: Vec3;
  matrix: Mat4;
}

/**
 * Computes world radius corresponding to `sizePx` on screen at the gizmo position.
 */
function computeWorldScale(
  matrix: Mat4,
  camera: ViewCameraInfo,
  sizePx: number
): number {
  const vMat = mat4From(camera.viewMatrix);
  const pMat = mat4From(camera.projectionMatrix);

  const origin = vec3(matrix[12], matrix[13], matrix[14]);
  const pView = transformPoint(vMat, origin);
  const depth = Math.max(Math.abs(pView[2]), 1e-4);

  const vpH = Math.max(camera.viewport.height, 1);
  const projY = pMat[5] !== 0 ? Math.abs(pMat[5]) : 1;
  const isPerspective = pMat[15] === 0;

  const unitsPerPixel = isPerspective ? (2 * depth) / (projY * vpH) : 2 / (projY * vpH);
  return sizePx * unitsPerPixel;
}

/**
 * Generates geometric handles for a transform gizmo (translate, rotate, or scale).
 */
export function gizmoHandles(
  mode: TransformMode,
  matrix: Mat4 | ArrayLike<number>,
  camera: ViewCameraInfo,
  sizePx = 100
): GizmoHandle[] {
  const m = mat4From(matrix);
  const origin = vec3(m[12], m[13], m[14]);

  // Extract orientation columns
  const lenX = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]) || 1;
  const lenY = Math.sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]) || 1;
  const lenZ = Math.sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]) || 1;

  const dirX = vec3(m[0] / lenX, m[1] / lenX, m[2] / lenX);
  const dirY = vec3(m[4] / lenY, m[5] / lenY, m[6] / lenY);
  const dirZ = vec3(m[8] / lenZ, m[9] / lenZ, m[10] / lenZ);

  const worldSize = computeWorldScale(m, camera, sizePx);
  const axisLength = worldSize;
  const hitTolerance = worldSize * 0.12;

  const handles: GizmoHandle[] = [];

  if (mode === "translate") {
    // 3 Axis arrows
    handles.push(
      {
        id: "translate-x",
        mode: "translate",
        type: "axis",
        axis: "X",
        origin,
        direction: dirX,
        length: axisLength,
        hitRadius: hitTolerance,
        color: "#e04040",
      },
      {
        id: "translate-y",
        mode: "translate",
        type: "axis",
        axis: "Y",
        origin,
        direction: dirY,
        length: axisLength,
        hitRadius: hitTolerance,
        color: "#40e040",
      },
      {
        id: "translate-z",
        mode: "translate",
        type: "axis",
        axis: "Z",
        origin,
        direction: dirZ,
        length: axisLength,
        hitRadius: hitTolerance,
        color: "#4040e0",
      }
    );

    // 3 Plane squares
    const planeOffset = worldSize * 0.35;
    const planeSize = worldSize * 0.25;
    handles.push(
      {
        id: "translate-yz",
        mode: "translate",
        type: "plane",
        axis: "X",
        origin,
        direction: dirX,
        normal: dirX,
        planeU: dirY,
        planeV: dirZ,
        length: planeOffset,
        size: planeSize,
        hitRadius: hitTolerance,
        color: "#e0404088",
      },
      {
        id: "translate-xz",
        mode: "translate",
        type: "plane",
        axis: "Y",
        origin,
        direction: dirY,
        normal: dirY,
        planeU: dirX,
        planeV: dirZ,
        length: planeOffset,
        size: planeSize,
        hitRadius: hitTolerance,
        color: "#40e04088",
      },
      {
        id: "translate-xy",
        mode: "translate",
        type: "plane",
        axis: "Z",
        origin,
        direction: dirZ,
        normal: dirZ,
        planeU: dirX,
        planeV: dirY,
        length: planeOffset,
        size: planeSize,
        hitRadius: hitTolerance,
        color: "#4040e088",
      }
    );
  } else if (mode === "rotate") {
    // 3 Rotation rings
    const ringRadius = worldSize * 0.85;
    handles.push(
      {
        id: "rotate-x",
        mode: "rotate",
        type: "ring",
        axis: "X",
        origin,
        direction: dirX,
        normal: dirX,
        radius: ringRadius,
        length: ringRadius,
        hitRadius: hitTolerance * 1.2,
        color: "#e04040",
      },
      {
        id: "rotate-y",
        mode: "rotate",
        type: "ring",
        axis: "Y",
        origin,
        direction: dirY,
        normal: dirY,
        radius: ringRadius,
        length: ringRadius,
        hitRadius: hitTolerance * 1.2,
        color: "#40e040",
      },
      {
        id: "rotate-z",
        mode: "rotate",
        type: "ring",
        axis: "Z",
        origin,
        direction: dirZ,
        normal: dirZ,
        radius: ringRadius,
        length: ringRadius,
        hitRadius: hitTolerance * 1.2,
        color: "#4040e0",
      }
    );
  } else if (mode === "scale") {
    // 3 Scale boxes
    handles.push(
      {
        id: "scale-x",
        mode: "scale",
        type: "box",
        axis: "X",
        origin,
        direction: dirX,
        length: axisLength,
        size: worldSize * 0.15,
        hitRadius: hitTolerance,
        color: "#e04040",
      },
      {
        id: "scale-y",
        mode: "scale",
        type: "box",
        axis: "Y",
        origin,
        direction: dirY,
        length: axisLength,
        size: worldSize * 0.15,
        hitRadius: hitTolerance,
        color: "#40e040",
      },
      {
        id: "scale-z",
        mode: "scale",
        type: "box",
        axis: "Z",
        origin,
        direction: dirZ,
        length: axisLength,
        size: worldSize * 0.15,
        hitRadius: hitTolerance,
        color: "#4040e0",
      }
    );

    // Uniform scale handle (cube at origin or outer handle)
    handles.push({
      id: "scale-uniform",
      mode: "scale",
      type: "uniform",
      axis: "all",
      origin,
      direction: dirZ,
      length: 0,
      size: worldSize * 0.18,
      hitRadius: hitTolerance * 1.5,
      color: "#ffffff",
    });
  }

  return handles;
}

/**
 * Tests a ray against a list of gizmo handles and returns the id of the hit handle
 * closest to the ray origin, or null if none hit.
 */
export function hitGizmo(ray: Ray3d, handles: GizmoHandle[]): string | null {
  const rOrig = vec3From(ray.origin);
  const rDir = normalize(vec3From(ray.direction));

  let closestHitT = Infinity;
  let closestHandleId: string | null = null;

  for (const handle of handles) {
    if (handle.type === "axis" || handle.type === "box") {
      // Line segment from handle.origin to handle.origin + direction * length
      const pStart = handle.origin;
      const pEnd = vec3(
        pStart[0] + handle.direction[0] * handle.length,
        pStart[1] + handle.direction[1] * handle.length,
        pStart[2] + handle.direction[2] * handle.length
      );

      const hit = rayToSegmentDistance(rOrig, rDir, pStart, pEnd);
      if (hit.distance <= handle.hitRadius && hit.rayT >= 0 && hit.rayT < closestHitT) {
        closestHitT = hit.rayT;
        closestHandleId = handle.id;
      }
    } else if (handle.type === "plane") {
      if (!handle.normal || !handle.planeU || !handle.planeV || !handle.size) continue;
      const planeNorm = handle.normal;
      const t = intersectRayPlane(rOrig, rDir, handle.origin, planeNorm);
      if (t !== null && t >= 0 && t < closestHitT) {
        const hitP = vec3(rOrig[0] + rDir[0] * t, rOrig[1] + rDir[1] * t, rOrig[2] + rDir[2] * t);
        const rel = vec3(hitP[0] - handle.origin[0], hitP[1] - handle.origin[1], hitP[2] - handle.origin[2]);
        const u = dot(rel, handle.planeU);
        const v = dot(rel, handle.planeV);
        if (u >= 0 && u <= handle.length + handle.size && v >= 0 && v <= handle.length + handle.size) {
          closestHitT = t;
          closestHandleId = handle.id;
        }
      }
    } else if (handle.type === "ring") {
      if (!handle.normal || !handle.radius) continue;
      const planeNorm = handle.normal;
      const t = intersectRayPlane(rOrig, rDir, handle.origin, planeNorm);
      if (t !== null && t >= 0 && t < closestHitT) {
        const hitP = vec3(rOrig[0] + rDir[0] * t, rOrig[1] + rDir[1] * t, rOrig[2] + rDir[2] * t);
        const distToCenter = Math.sqrt(
          (hitP[0] - handle.origin[0]) ** 2 +
          (hitP[1] - handle.origin[1]) ** 2 +
          (hitP[2] - handle.origin[2]) ** 2
        );
        if (Math.abs(distToCenter - handle.radius) <= handle.hitRadius) {
          closestHitT = t;
          closestHandleId = handle.id;
        }
      }
    } else if (handle.type === "uniform") {
      // Small sphere/cube around origin
      const dist = pointToRayDistance(handle.origin, rOrig, rDir);
      if (dist.distance <= (handle.size ?? handle.hitRadius) && dist.rayT >= 0 && dist.rayT < closestHitT) {
        closestHitT = dist.rayT;
        closestHandleId = handle.id;
      }
    }
  }

  return closestHandleId;
}

/**
 * Computes transform delta produced by dragging a gizmo handle between rayStart and rayNow.
 */
export function dragGizmo(
  handle: GizmoHandle,
  rayStart: Ray3d,
  rayNow: Ray3d,
  startMatrix: Mat4 | ArrayLike<number>
): GizmoTransformDelta {
  const mStart = mat4From(startMatrix);
  const orig = handle.origin;

  const rStartOrig = vec3From(rayStart.origin);
  const rStartDir = normalize(vec3From(rayStart.direction));
  const rNowOrig = vec3From(rayNow.origin);
  const rNowDir = normalize(vec3From(rayNow.direction));

  let translation = vec3(0, 0, 0);
  let rotationQuat = quat(0, 0, 0, 1);
  let scale = vec3(1, 1, 1);

  if (handle.type === "axis" || handle.type === "box") {
    // Closest point between ray and axis line
    const axisDir = handle.direction;
    const t0 = closestPointOnLineFromRay(rStartOrig, rStartDir, orig, axisDir);
    const t1 = closestPointOnLineFromRay(rNowOrig, rNowDir, orig, axisDir);
    const deltaT = t1 - t0;

    if (handle.mode === "translate") {
      translation = vec3(axisDir[0] * deltaT, axisDir[1] * deltaT, axisDir[2] * deltaT);
    } else if (handle.mode === "scale") {
      const len = handle.length > 0 ? handle.length : 1;
      const sFactor = Math.max(1 + deltaT / len, 0.001);
      if (handle.axis === "X") scale = vec3(sFactor, 1, 1);
      else if (handle.axis === "Y") scale = vec3(1, sFactor, 1);
      else if (handle.axis === "Z") scale = vec3(1, 1, sFactor);
      else scale = vec3(sFactor, sFactor, sFactor);
    }
  } else if (handle.type === "plane") {
    const norm = handle.normal ?? handle.direction;
    const p0 = intersectRayPlane(rStartOrig, rStartDir, orig, norm);
    const p1 = intersectRayPlane(rNowOrig, rNowDir, orig, norm);

    if (p0 !== null && p1 !== null) {
      const hit0 = vec3(rStartOrig[0] + rStartDir[0] * p0, rStartOrig[1] + rStartDir[1] * p0, rStartOrig[2] + rStartDir[2] * p0);
      const hit1 = vec3(rNowOrig[0] + rNowDir[0] * p1, rNowOrig[1] + rNowDir[1] * p1, rNowOrig[2] + rNowDir[2] * p1);
      const deltaP = vec3(hit1[0] - hit0[0], hit1[1] - hit0[1], hit1[2] - hit0[2]);

      if (handle.mode === "translate") {
        translation = deltaP;
      } else if (handle.mode === "scale") {
        const d0 = Math.sqrt((hit0[0] - orig[0]) ** 2 + (hit0[1] - orig[1]) ** 2 + (hit0[2] - orig[2]) ** 2);
        const d1 = Math.sqrt((hit1[0] - orig[0]) ** 2 + (hit1[1] - orig[1]) ** 2 + (hit1[2] - orig[2]) ** 2);
        const sFactor = d0 > 1e-4 ? d1 / d0 : 1;
        if (handle.axis === "X") scale = vec3(1, sFactor, sFactor);
        else if (handle.axis === "Y") scale = vec3(sFactor, 1, sFactor);
        else scale = vec3(sFactor, sFactor, 1);
      }
    }
  } else if (handle.type === "ring") {
    const norm = handle.normal ?? handle.direction;
    const p0 = intersectRayPlane(rStartOrig, rStartDir, orig, norm);
    const p1 = intersectRayPlane(rNowOrig, rNowDir, orig, norm);

    if (p0 !== null && p1 !== null) {
      const hit0 = vec3(rStartOrig[0] + rStartDir[0] * p0, rStartOrig[1] + rStartDir[1] * p0, rStartOrig[2] + rStartDir[2] * p0);
      const hit1 = vec3(rNowOrig[0] + rNowDir[0] * p1, rNowOrig[1] + rNowDir[1] * p1, rNowOrig[2] + rNowDir[2] * p1);

      const v0 = vec3(hit0[0] - orig[0], hit0[1] - orig[1], hit0[2] - orig[2]);
      const v1 = vec3(hit1[0] - orig[0], hit1[1] - orig[1], hit1[2] - orig[2]);

      const len0 = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2]);
      const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]);

      if (len0 > 1e-4 && len1 > 1e-4) {
        const v0u = vec3(v0[0] / len0, v0[1] / len0, v0[2] / len0);
        const v1u = vec3(v1[0] / len1, v1[1] / len1, v1[2] / len1);

        const c = dot(v0u, v1u);
        const crossP = cross(v0u, v1u);
        const s = dot(crossP, norm);
        const angle = Math.atan2(s, c);

        const half = angle * 0.5;
        const sinHalf = Math.sin(half);
        rotationQuat = quatNormalize(quat(norm[0] * sinHalf, norm[1] * sinHalf, norm[2] * sinHalf, Math.cos(half)));
      }
    }
  } else if (handle.type === "uniform") {
    // Drag distance along view/drag direction
    const p0 = rStartOrig;
    const p1 = rNowOrig;
    const delta = (p1[0] - p0[0]) + (p1[1] - p0[1]) + (p1[2] - p0[2]);
    const sFactor = Math.max(1 + delta, 0.001);
    scale = vec3(sFactor, sFactor, sFactor);
  }

  // Construct delta matrix and final matrix
  const deltaMat = compose(translation, rotationQuat, scale);
  const matrix = multiply(deltaMat, mStart);

  return {
    mode: handle.mode,
    translation,
    rotationQuat,
    scale,
    matrix,
  };
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return vec3(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  );
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? vec3(v[0] / len, v[1] / len, v[2] / len) : vec3(0, 0, 1);
}

function intersectRayPlane(
  rOrig: Vec3,
  rDir: Vec3,
  pPlane: Vec3,
  nPlane: Vec3
): number | null {
  const denom = dot(rDir, nPlane);
  if (Math.abs(denom) < 1e-9) return null; // Ray parallel to plane

  const diff = vec3(pPlane[0] - rOrig[0], pPlane[1] - rOrig[1], pPlane[2] - rOrig[2]);
  const t = dot(diff, nPlane) / denom;
  return t;
}

function rayToSegmentDistance(
  rOrig: Vec3,
  rDir: Vec3,
  s0: Vec3,
  s1: Vec3
): { distance: number; rayT: number } {
  const u = vec3(s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]);
  const segLen = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
  if (segLen < 1e-9) {
    return pointToRayDistance(s0, rOrig, rDir);
  }
  const uDir = vec3(u[0] / segLen, u[1] / segLen, u[2] / segLen);

  const w0 = vec3(rOrig[0] - s0[0], rOrig[1] - s0[1], rOrig[2] - s0[2]);
  const a = dot(rDir, rDir); // 1.0
  const b = dot(rDir, uDir);
  const c = dot(uDir, uDir); // 1.0
  const d = dot(rDir, w0);
  const e = dot(uDir, w0);

  const denom = a * c - b * b;
  let s: number;
  let t: number;

  if (denom < 1e-9) {
    s = 0;
    t = -d / a;
  } else {
    // closest points between the ray (parameter t) and the segment's line (parameter s)
    s = (a * e - b * d) / denom;
    t = (b * e - c * d) / denom;
  }

  const sClamped = Math.max(0, Math.min(segLen, s));
  const pRay = vec3(rOrig[0] + rDir[0] * t, rOrig[1] + rDir[1] * t, rOrig[2] + rDir[2] * t);
  const pSeg = vec3(s0[0] + uDir[0] * sClamped, s0[1] + uDir[1] * sClamped, s0[2] + uDir[2] * sClamped);

  const dist = Math.sqrt(
    (pRay[0] - pSeg[0]) ** 2 +
    (pRay[1] - pSeg[1]) ** 2 +
    (pRay[2] - pSeg[2]) ** 2
  );

  return { distance: dist, rayT: t };
}

function pointToRayDistance(
  p: Vec3,
  rOrig: Vec3,
  rDir: Vec3
): { distance: number; rayT: number } {
  const diff = vec3(p[0] - rOrig[0], p[1] - rOrig[1], p[2] - rOrig[2]);
  const t = dot(diff, rDir);
  const pProj = vec3(rOrig[0] + rDir[0] * t, rOrig[1] + rDir[1] * t, rOrig[2] + rDir[2] * t);
  const dist = Math.sqrt(
    (p[0] - pProj[0]) ** 2 +
    (p[1] - pProj[1]) ** 2 +
    (p[2] - pProj[2]) ** 2
  );
  return { distance: dist, rayT: t };
}

function closestPointOnLineFromRay(
  rOrig: Vec3,
  rDir: Vec3,
  lOrig: Vec3,
  lDir: Vec3
): number {
  const w0 = vec3(rOrig[0] - lOrig[0], rOrig[1] - lOrig[1], rOrig[2] - lOrig[2]);
  const a = dot(rDir, rDir);
  const b = dot(rDir, lDir);
  const c = dot(lDir, lDir);
  const d = dot(rDir, w0);
  const e = dot(lDir, w0);

  const denom = a * c - b * b;
  if (denom < 1e-9) {
    return e / c;
  }
  return (a * e - b * d) / denom;
}
