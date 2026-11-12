/**
 * ============================================================================
 * 3D SCREEN RAYCASTING KERNEL (Phase 3D-015)
 * ============================================================================
 * Computes a 3D world-space ray { origin, dir } from screen coordinates.
 * Works uniformly for both perspective and orthographic camera projections
 * by unprojecting NDC near (-1) and far (+1) depth planes via inverted
 * view-projection transform:
 *
 *   NDC: x in [-1, 1], y in [-1, 1]
 *   nearPt = inv(ViewProj) * [ndcX, ndcY, -1, 1]
 *   farPt  = inv(ViewProj) * [ndcX, ndcY,  1, 1]
 *   dir = normalize(farPt - nearPt)
 * ============================================================================
 */

import { type Mat4, type Vec3, invert, multiply, transformPoint, vec3 } from "../math";

export interface Ray3d {
  readonly origin: Vec3;
  readonly dir: Vec3;
}

/**
 * Computes a normalized world-space ray corresponding to viewport coordinate (x, y).
 *
 * @param x Pixel coordinate along viewport width (0 at left)
 * @param y Pixel coordinate along viewport height (0 at top)
 * @param viewportW Viewport width in pixels
 * @param viewportH Viewport height in pixels
 * @param viewMatrix 4x4 column-major camera view matrix
 * @param projMatrix 4x4 column-major camera projection matrix
 */
export function rayFromScreen(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  viewMatrix: Mat4,
  projMatrix: Mat4
): Ray3d {
  if (viewportW <= 0 || viewportH <= 0) {
    return {
      origin: vec3(0, 0, 0),
      dir: vec3(0, 0, -1),
    };
  }

  // Convert screen coordinates (top-left origin) to NDC (-1 to 1, Y up)
  const ndcX = (x / viewportW) * 2.0 - 1.0;
  const ndcY = 1.0 - (y / viewportH) * 2.0;

  // View-Projection matrix: VP = Proj * View
  const viewProj = multiply(projMatrix, viewMatrix);

  // Invert VP to unproject from clip space to world space
  const invViewProj = invert(viewProj);

  // Unproject near plane point (z = -1) and far plane point (z = 1)
  const nearPoint = transformPoint(invViewProj, [ndcX, ndcY, -1]);
  const farPoint = transformPoint(invViewProj, [ndcX, ndcY, 1]);

  // Ray direction: from near to far
  const dx = farPoint[0] - nearPoint[0];
  const dy = farPoint[1] - nearPoint[1];
  const dz = farPoint[2] - nearPoint[2];

  const len = Math.hypot(dx, dy, dz);
  const invLen = len > 1e-12 ? 1.0 / len : 1.0;

  const dir = vec3(dx * invLen, dy * invLen, dz * invLen);

  return {
    origin: nearPoint,
    dir,
  };
}
