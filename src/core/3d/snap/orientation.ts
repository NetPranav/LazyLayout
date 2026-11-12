/**
 * ============================================================================
 * 3D TRANSFORM ORIENTATIONS (Phase 3D-017)
 * ============================================================================
 * Computes coordinate system orientation rotation matrices:
 * - "global": world axes [X, Y, Z]
 * - "local": active object orientation
 * - "normal": surface normal orientation basis
 * - "view": camera viewport orientation basis
 * - "cursor": 3D cursor orientation
 * ============================================================================
 */

import {
  type Mat4,
  type Quat,
  type Vec3,
  compose,
  identity,
  invert,
  mat4From,
  quatFrom,
  vec3,
  vec3From,
} from "../math";

export type OrientationKind = "global" | "local" | "normal" | "view" | "cursor";

export interface OrientationContext {
  activeObject?: {
    worldMatrix?: Mat4 | ArrayLike<number>;
    rotationQuat?: Quat | ArrayLike<number>;
  };
  activeNormal?: Vec3 | ArrayLike<number>;
  viewCamera?: {
    viewMatrix?: Mat4 | ArrayLike<number>;
  };
  cursor?: {
    rotation?: Quat | ArrayLike<number>;
    rotationQuat?: Quat | ArrayLike<number>;
  };
}

/**
 * Computes a 4x4 rotation matrix representing the chosen transform orientation.
 */
export function orientationMatrix(
  kind: OrientationKind,
  ctx?: OrientationContext
): Mat4 {
  if (kind === "global" || !ctx) {
    return identity();
  }

  if (kind === "local") {
    if (ctx.activeObject?.rotationQuat) {
      return compose(vec3(0, 0, 0), quatFrom(ctx.activeObject.rotationQuat), vec3(1, 1, 1));
    }
    if (ctx.activeObject?.worldMatrix) {
      const w = mat4From(ctx.activeObject.worldMatrix);
      // Extract normalized column vectors for upper 3x3
      const lenX = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]) || 1;
      const lenY = Math.sqrt(w[4] * w[4] + w[5] * w[5] + w[6] * w[6]) || 1;
      const lenZ = Math.sqrt(w[8] * w[8] + w[9] * w[9] + w[10] * w[10]) || 1;

      const out = identity();
      out[0] = w[0] / lenX;
      out[1] = w[1] / lenX;
      out[2] = w[2] / lenX;

      out[4] = w[4] / lenY;
      out[5] = w[5] / lenY;
      out[6] = w[6] / lenY;

      out[8] = w[8] / lenZ;
      out[9] = w[9] / lenZ;
      out[10] = w[10] / lenZ;
      return out;
    }
    return identity();
  }

  if (kind === "normal") {
    if (!ctx.activeNormal) return identity();
    const n = normalize(vec3From(ctx.activeNormal));

    // Y stays world-up where it can (so a face on a wall keeps its up); along the world Y axis use Z instead
    let guide: Vec3;
    if (Math.abs(n[1]) < 0.9) {
      guide = vec3(0, 1, 0);
    } else {
      guide = vec3(0, 0, 1);
    }

    // X = guide x normal
    const xCross = cross(guide, n);
    const xLen = Math.sqrt(xCross[0] * xCross[0] + xCross[1] * xCross[1] + xCross[2] * xCross[2]);
    const x = xLen > 1e-6 ? vec3(xCross[0] / xLen, xCross[1] / xLen, xCross[2] / xLen) : vec3(1, 0, 0);

    // Y = normal x X
    const y = cross(n, x);

    const out = identity();
    out[0] = x[0];
    out[1] = x[1];
    out[2] = x[2];

    out[4] = y[0];
    out[5] = y[1];
    out[6] = y[2];

    out[8] = n[0];
    out[9] = n[1];
    out[10] = n[2];
    return out;
  }

  if (kind === "view") {
    if (!ctx.viewCamera?.viewMatrix) return identity();
    const vMat = mat4From(ctx.viewCamera.viewMatrix);
    const vInv = invert(vMat);

    // Columns are camera right, up, back
    const lenR = Math.sqrt(vInv[0] * vInv[0] + vInv[1] * vInv[1] + vInv[2] * vInv[2]) || 1;
    const lenU = Math.sqrt(vInv[4] * vInv[4] + vInv[5] * vInv[5] + vInv[6] * vInv[6]) || 1;
    const lenB = Math.sqrt(vInv[8] * vInv[8] + vInv[9] * vInv[9] + vInv[10] * vInv[10]) || 1;

    const out = identity();
    out[0] = vInv[0] / lenR;
    out[1] = vInv[1] / lenR;
    out[2] = vInv[2] / lenR;

    out[4] = vInv[4] / lenU;
    out[5] = vInv[5] / lenU;
    out[6] = vInv[6] / lenU;

    out[8] = vInv[8] / lenB;
    out[9] = vInv[9] / lenB;
    out[10] = vInv[10] / lenB;
    return out;
  }

  if (kind === "cursor") {
    const q = ctx.cursor?.rotationQuat ?? ctx.cursor?.rotation;
    if (q) {
      return compose(vec3(0, 0, 0), quatFrom(q), vec3(1, 1, 1));
    }
    return identity();
  }

  return identity();
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? vec3(v[0] / len, v[1] / len, v[2] / len) : vec3(0, 0, 1);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return vec3(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  );
}
