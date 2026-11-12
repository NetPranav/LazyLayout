/**
 * ============================================================================
 * 3D AXIS CONVERSIONS (glTF Y-Up <-> Blender Z-Up)
 * ============================================================================
 * Pure TypeScript coordinate axis transformation helpers with exact inverses.
 *
 * Coordinate Systems:
 *   - glTF standard:    +X Right, +Y Up,   -Z Forward (into screen)
 *   - Blender standard: +X Right, +Y Away, +Z Up
 *
 * Conversion:
 *   - Z-Up to Y-Up is a -90° rotation around +X:
 *       X_y = X_z
 *       Y_y = Z_z
 *       Z_y = -Y_z
 *   - Y-Up to Z-Up is a +90° rotation around +X:
 *       X_z = X_y
 *       Y_z = -Z_y
 *       Z_z = Y_y
 * ============================================================================
 */

import {
  type Mat4,
  type Quat,
  type Vec3,
  mat4From,
  quat,
  quatMultiply,
  vec3,
} from "./math";

// ---------------------------------------------------------------------------
// Base Transformation Constants (-90° and +90° around X axis)
// ---------------------------------------------------------------------------

const SQRT1_2 = Math.SQRT1_2; // sqrt(1/2) ≈ 0.7071067811865476

/**
 * Quaternion representing a -90° rotation about X: transforms Z-up vectors to Y-up.
 */
export const QUAT_Z_UP_TO_Y_UP: Quat = quat(-SQRT1_2, 0, 0, SQRT1_2);

/**
 * Quaternion representing a +90° rotation about X: transforms Y-up vectors to Z-up.
 */
export const QUAT_Y_UP_TO_Z_UP: Quat = quat(SQRT1_2, 0, 0, SQRT1_2);

/**
 * Column-major 4x4 matrix representing a -90° rotation about X:
 * [ 1,  0,  0, 0,
 *   0,  0, -1, 0,
 *   0,  1,  0, 0,
 *   0,  0,  0, 1 ]
 */
export const MAT4_Z_UP_TO_Y_UP: Mat4 = mat4From([
  1, 0, 0, 0,
  0, 0, -1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
]);

/**
 * Column-major 4x4 matrix representing a +90° rotation about X (exact inverse of MAT4_Z_UP_TO_Y_UP):
 * [ 1,  0,  0, 0,
 *   0,  0,  1, 0,
 *   0, -1,  0, 0,
 *   0,  0,  0, 1 ]
 */
export const MAT4_Y_UP_TO_Z_UP: Mat4 = mat4From([
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
]);

function noNegZero(n: number): number {
  return n === 0 ? 0 : n;
}

// ---------------------------------------------------------------------------
// Dedicated Typed Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a 3D vector from Blender Z-up to glTF Y-up: [x, y, z] -> [x, z, -y].
 */
export function zUpToYUpVec3(v: ArrayLike<number>, out?: Vec3): Vec3 {
  const res = out ?? vec3();
  const x = v[0], y = v[1], z = v[2];
  res[0] = noNegZero(x);
  res[1] = noNegZero(z);
  res[2] = noNegZero(-y);
  return res;
}

/**
 * Converts a 3D vector from glTF Y-up to Blender Z-up: [x, y, z] -> [x, -z, y].
 */
export function yUpToZUpVec3(v: ArrayLike<number>, out?: Vec3): Vec3 {
  const res = out ?? vec3();
  const x = v[0], y = v[1], z = v[2];
  res[0] = noNegZero(x);
  res[1] = noNegZero(-z);
  res[2] = noNegZero(y);
  return res;
}

/**
 * Converts a quaternion orientation from Blender Z-up to glTF Y-up:
 *   q_y = Q_{Z->Y} * q_z * Q_{Y->Z}
 */
export function zUpToYUpQuat(q: ArrayLike<number>, out?: Quat): Quat {
  // q_temp = q * Q_{Y->Z}
  const temp = quatMultiply(q, QUAT_Y_UP_TO_Z_UP);
  // res = Q_{Z->Y} * temp
  return quatMultiply(QUAT_Z_UP_TO_Y_UP, temp, out);
}

/**
 * Converts a quaternion orientation from glTF Y-up to Blender Z-up:
 *   q_z = Q_{Y->Z} * q_y * Q_{Z->Y}
 */
export function yUpToZUpQuat(q: ArrayLike<number>, out?: Quat): Quat {
  // q_temp = q * Q_{Z->Y}
  const temp = quatMultiply(q, QUAT_Z_UP_TO_Y_UP);
  // res = Q_{Y->Z} * temp
  return quatMultiply(QUAT_Y_UP_TO_Z_UP, temp, out);
}

/**
 * Converts a 4x4 matrix from Blender Z-up to glTF Y-up:
 *   M_y = R * M_z * R^-1
 *
 * Evaluated analytically for zero floating-point error.
 */
export function zUpToYUpMat4(m: ArrayLike<number>, out?: Mat4): Mat4 {
  const res = out ?? new Float64Array(16);

  // Col 0
  res[0] = noNegZero(m[0]);
  res[1] = noNegZero(m[2]);
  res[2] = noNegZero(-m[1]);
  res[3] = noNegZero(m[3]);

  // Col 1
  res[4] = noNegZero(-m[8]);
  res[5] = noNegZero(-m[10]);
  res[6] = noNegZero(m[9]);
  res[7] = noNegZero(-m[11]);

  // Col 2
  res[8] = noNegZero(m[4]);
  res[9] = noNegZero(m[6]);
  res[10] = noNegZero(-m[5]);
  res[11] = noNegZero(m[7]);

  // Col 3 (translation)
  res[12] = noNegZero(m[12]);
  res[13] = noNegZero(m[14]);
  res[14] = noNegZero(-m[13]);
  res[15] = noNegZero(m[15]);

  return res;
}

/**
 * Converts a 4x4 matrix from glTF Y-up to Blender Z-up:
 *   M_z = R^-1 * M_y * R
 *
 * Exact analytical inverse of zUpToYUpMat4.
 */
export function yUpToZUpMat4(m: ArrayLike<number>, out?: Mat4): Mat4 {
  const res = out ?? new Float64Array(16);

  // Col 0
  res[0] = noNegZero(m[0]);
  res[1] = noNegZero(-m[2]);
  res[2] = noNegZero(m[1]);
  res[3] = noNegZero(m[3]);

  // Col 1
  res[4] = noNegZero(m[8]);
  res[5] = noNegZero(-m[10]);
  res[6] = noNegZero(m[9]);
  res[7] = noNegZero(m[11]);

  // Col 2
  res[8] = noNegZero(-m[4]);
  res[9] = noNegZero(m[6]);
  res[10] = noNegZero(-m[5]);
  res[11] = noNegZero(-m[7]);

  // Col 3 (translation)
  res[12] = noNegZero(m[12]);
  res[13] = noNegZero(-m[14]);
  res[14] = noNegZero(m[13]);
  res[15] = noNegZero(m[15]);

  return res;
}

// ---------------------------------------------------------------------------
// Polymorphic Conversion Functions
// ---------------------------------------------------------------------------

export function zUpToYUp(v: Vec3): Vec3;
export function zUpToYUp(q: Quat): Quat;
export function zUpToYUp(m: Mat4): Mat4;
export function zUpToYUp(input: ArrayLike<number>): Float64Array;
export function zUpToYUp(input: ArrayLike<number>): Float64Array {
  if (input.length === 3) {
    return zUpToYUpVec3(input);
  }
  if (input.length === 4) {
    return zUpToYUpQuat(input);
  }
  if (input.length === 16) {
    return zUpToYUpMat4(input);
  }
  throw new Error(
    `zUpToYUp: unsupported array length ${input.length}. Expected 3 (Vec3), 4 (Quat), or 16 (Mat4).`
  );
}

export function yUpToZUp(v: Vec3): Vec3;
export function yUpToZUp(q: Quat): Quat;
export function yUpToZUp(m: Mat4): Mat4;
export function yUpToZUp(input: ArrayLike<number>): Float64Array;
export function yUpToZUp(input: ArrayLike<number>): Float64Array {
  if (input.length === 3) {
    return yUpToZUpVec3(input);
  }
  if (input.length === 4) {
    return yUpToZUpQuat(input);
  }
  if (input.length === 16) {
    return yUpToZUpMat4(input);
  }
  throw new Error(
    `yUpToZUp: unsupported array length ${input.length}. Expected 3 (Vec3), 4 (Quat), or 16 (Mat4).`
  );
}
