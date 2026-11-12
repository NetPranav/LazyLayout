/**
 * ============================================================================
 * 3D LINEAR ALGEBRA KERNEL (Vec3, Quat, Mat4)
 * ============================================================================
 * Pure TypeScript, zero external dependencies.
 * Follows glTF 2.0 / WebGL column-major matrix layout and conventions.
 *
 * Types:
 *   - Vec3: Float64Array(3)  [x, y, z]
 *   - Quat: Float64Array(4)  [x, y, z, w]
 *   - Mat4: Float64Array(16) column-major:
 *     [ m0,  m1,  m2,  m3,   // column 0 (X basis)
 *       m4,  m5,  m6,  m7,   // column 1 (Y basis)
 *       m8,  m9,  m10, m11,  // column 2 (Z basis)
 *       m12, m13, m14, m15 ] // column 3 (translation)
 * ============================================================================
 */

export type Vec3 = Float64Array;
export type Quat = Float64Array;
export type Mat4 = Float64Array;

export type EulerOrder = "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX";

// ---------------------------------------------------------------------------
// Constructors & Factories
// ---------------------------------------------------------------------------

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  const out = new Float64Array(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function quat(x = 0, y = 0, z = 0, w = 1): Quat {
  const out = new Float64Array(4);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

export function mat4(): Mat4 {
  return identity();
}

export function vec3From(arr: ArrayLike<number>): Vec3 {
  const out = new Float64Array(3);
  out[0] = arr[0] ?? 0;
  out[1] = arr[1] ?? 0;
  out[2] = arr[2] ?? 0;
  return out;
}

export function quatFrom(arr: ArrayLike<number>): Quat {
  const out = new Float64Array(4);
  out[0] = arr[0] ?? 0;
  out[1] = arr[1] ?? 0;
  out[2] = arr[2] ?? 0;
  out[3] = arr[3] ?? 1;
  return out;
}

export function mat4From(arr: ArrayLike<number>): Mat4 {
  const out = new Float64Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = arr[i] ?? 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrix 4x4 Operations
// ---------------------------------------------------------------------------

/**
 * Returns a 4x4 identity matrix.
 */
export function identity(out?: Mat4): Mat4 {
  const m = out ?? new Float64Array(16);
  m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
  m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
  return m;
}

/**
 * Multiplies matrix `a` by matrix `b` (out = a * b).
 */
export function multiply(a: Mat4, b: Mat4, out?: Mat4): Mat4 {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
  const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
  const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

  const res = out ?? new Float64Array(16);

  res[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  res[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  res[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  res[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

  res[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  res[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  res[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  res[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

  res[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  res[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  res[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  res[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

  res[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  res[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  res[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  res[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

  return res;
}

/**
 * General 4x4 matrix inversion using Laplace cofactor expansion.
 * Throws an Error if matrix is singular (det === 0).
 */
export function invert(m: Mat4, out?: Mat4): Mat4 {
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
  const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
  const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
  const m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

  const b00 = m0 * m5 - m1 * m4;
  const b01 = m0 * m6 - m2 * m4;
  const b02 = m0 * m7 - m3 * m4;
  const b03 = m1 * m6 - m2 * m5;
  const b04 = m1 * m7 - m3 * m5;
  const b05 = m2 * m7 - m3 * m6;
  const b06 = m8 * m13 - m9 * m12;
  const b07 = m8 * m14 - m10 * m12;
  const b08 = m8 * m15 - m11 * m12;
  const b09 = m9 * m14 - m10 * m13;
  const b10 = m9 * m15 - m11 * m13;
  const b11 = m10 * m15 - m11 * m14;

  const det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (Math.abs(det) < 1e-15) {
    throw new Error("Matrix is singular and cannot be inverted.");
  }

  const invDet = 1.0 / det;
  const res = out ?? new Float64Array(16);

  res[0] = (m5 * b11 - m6 * b10 + m7 * b09) * invDet;
  res[1] = (-m1 * b11 + m2 * b10 - m3 * b09) * invDet;
  res[2] = (m13 * b05 - m14 * b04 + m15 * b03) * invDet;
  res[3] = (-m9 * b05 + m10 * b04 - m11 * b03) * invDet;

  res[4] = (-m4 * b11 + m6 * b08 - m7 * b07) * invDet;
  res[5] = (m0 * b11 - m2 * b08 + m3 * b07) * invDet;
  res[6] = (-m12 * b05 + m14 * b02 - m15 * b01) * invDet;
  res[7] = (m8 * b05 - m10 * b02 + m11 * b01) * invDet;

  res[8] = (m4 * b10 - m5 * b08 + m7 * b06) * invDet;
  res[9] = (-m0 * b10 + m1 * b08 - m3 * b06) * invDet;
  res[10] = (m12 * b04 - m13 * b02 + m15 * b00) * invDet;
  res[11] = (-m8 * b04 + m9 * b02 - m11 * b00) * invDet;

  res[12] = (-m4 * b09 + m5 * b07 - m6 * b06) * invDet;
  res[13] = (m0 * b09 - m1 * b07 + m2 * b06) * invDet;
  res[14] = (-m12 * b03 + m13 * b01 - m14 * b00) * invDet;
  res[15] = (m8 * b03 - m9 * b01 + m10 * b00) * invDet;

  return res;
}

/**
 * Fast 4x4 affine matrix inversion.
 * Assumes bottom row is [0, 0, 0, 1]. Inverts upper 3x3 block (A^-1 = adj(A)/det)
 * and computes translation -A^-1 * t.
 */
export function invertAffine(m: Mat4, out?: Mat4): Mat4 {
  const m0 = m[0], m1 = m[1], m2 = m[2];
  const m4 = m[4], m5 = m[5], m6 = m[6];
  const m8 = m[8], m9 = m[9], m10 = m[10];

  // Cofactors of upper 3x3 block
  const c00 = m5 * m10 - m9 * m6;
  const c01 = m2 * m9 - m1 * m10;
  const c02 = m1 * m6 - m5 * m2;

  const c10 = m6 * m8 - m4 * m10;
  const c11 = m0 * m10 - m8 * m2;
  const c12 = m2 * m4 - m0 * m6;

  const c20 = m4 * m9 - m8 * m5;
  const c21 = m1 * m8 - m0 * m9;
  const c22 = m0 * m5 - m4 * m1;

  const det = m0 * c00 + m4 * c01 + m8 * c02;
  if (Math.abs(det) < 1e-15) {
    throw new Error("Affine matrix is singular and cannot be inverted.");
  }

  const invDet = 1.0 / det;

  const res = out ?? new Float64Array(16);

  // Column 0: A^-1 row 0, 1, 2 of column 0
  res[0] = c00 * invDet;
  res[1] = c01 * invDet;
  res[2] = c02 * invDet;
  res[3] = 0;

  // Column 1: A^-1 row 0, 1, 2 of column 1
  res[4] = c10 * invDet;
  res[5] = c11 * invDet;
  res[6] = c12 * invDet;
  res[7] = 0;

  // Column 2: A^-1 row 0, 1, 2 of column 2
  res[8] = c20 * invDet;
  res[9] = c21 * invDet;
  res[10] = c22 * invDet;
  res[11] = 0;

  // Column 3: -A^-1 * translation
  const tx = m[12], ty = m[13], tz = m[14];
  res[12] = -(res[0] * tx + res[4] * ty + res[8] * tz);
  res[13] = -(res[1] * tx + res[5] * ty + res[9] * tz);
  res[14] = -(res[2] * tx + res[6] * ty + res[10] * tz);
  res[15] = 1;

  return res;
}

/**
 * Composes a 4x4 matrix from location, quaternion orientation, and scale.
 * Transformation order: S * R * T (scale, then rotate, then translate).
 */
export function compose(
  location: ArrayLike<number>,
  quat: ArrayLike<number>,
  scale: ArrayLike<number>,
  out?: Mat4
): Mat4 {
  const x = quat[0], y = quat[1], z = quat[2], w = quat[3];
  const sx = scale[0], sy = scale[1], sz = scale[2];

  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  const res = out ?? new Float64Array(16);

  res[0] = (1 - (yy + zz)) * sx;
  res[1] = (xy + wz) * sx;
  res[2] = (xz - wy) * sx;
  res[3] = 0;

  res[4] = (xy - wz) * sy;
  res[5] = (1 - (xx + zz)) * sy;
  res[6] = (yz + wx) * sy;
  res[7] = 0;

  res[8] = (xz + wy) * sz;
  res[9] = (yz - wx) * sz;
  res[10] = (1 - (xx + yy)) * sz;
  res[11] = 0;

  res[12] = location[0];
  res[13] = location[1];
  res[14] = location[2];
  res[15] = 1;

  return res;
}

/**
 * Decomposes a 4x4 matrix into location, quaternion orientation, and scale.
 */
export function decompose(m: Mat4): { location: Vec3; quat: Quat; scale: Vec3 } {
  const outLoc = vec3(m[12], m[13], m[14]);

  let sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);

  // Handle reflection (negative determinant)
  const det3x3 =
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[1] * (m[4] * m[10] - m[6] * m[8]) +
    m[2] * (m[4] * m[9] - m[5] * m[8]);
  if (det3x3 < 0) {
    sx = -sx;
  }

  const invSx = sx !== 0 ? 1 / sx : 0;
  const invSy = sy !== 0 ? 1 / sy : 0;
  const invSz = sz !== 0 ? 1 / sz : 0;

  const r00 = m[0] * invSx, r10 = m[1] * invSx, r20 = m[2] * invSx;
  const r01 = m[4] * invSy, r11 = m[5] * invSy, r21 = m[6] * invSy;
  const r02 = m[8] * invSz, r12 = m[9] * invSz, r22 = m[10] * invSz;

  const trace = r00 + r11 + r22;
  let qx = 0, qy = 0, qz = 0, qw = 1;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (r21 - r12) * s;
    qy = (r02 - r20) * s;
    qz = (r10 - r01) * s;
  } else if (r00 > r11 && r00 > r22) {
    const s = 2.0 * Math.sqrt(1.0 + r00 - r11 - r22);
    qw = (r21 - r12) / s;
    qx = 0.25 * s;
    qy = (r01 + r10) / s;
    qz = (r02 + r20) / s;
  } else if (r11 > r22) {
    const s = 2.0 * Math.sqrt(1.0 + r11 - r00 - r22);
    qw = (r02 - r20) / s;
    qx = (r01 + r10) / s;
    qy = 0.25 * s;
    qz = (r12 + r21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + r22 - r00 - r11);
    qw = (r10 - r01) / s;
    qx = (r02 + r20) / s;
    qy = (r12 + r21) / s;
    qz = 0.25 * s;
  }

  const outQuat = quatNormalize(quat(qx, qy, qz, qw));
  return {
    location: outLoc,
    quat: outQuat,
    scale: vec3(sx, sy, sz),
  };
}

// ---------------------------------------------------------------------------
// Quaternion & Euler Conversions
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts Euler angles in radians to a Quaternion for any of the 6 Tait-Bryan orders.
 */
export function quatFromEuler(
  order: EulerOrder,
  x: number,
  y: number,
  z: number,
  out?: Quat
): Quat {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);

  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  let qx = 0, qy = 0, qz = 0, qw = 1;

  switch (order) {
    case "XYZ":
      qx = s1 * c2 * c3 + c1 * s2 * s3;
      qy = c1 * s2 * c3 - s1 * c2 * s3;
      qz = c1 * c2 * s3 + s1 * s2 * c3;
      qw = c1 * c2 * c3 - s1 * s2 * s3;
      break;

    case "YXZ":
      qx = s1 * c2 * c3 + c1 * s2 * s3;
      qy = c1 * s2 * c3 - s1 * c2 * s3;
      qz = c1 * c2 * s3 - s1 * s2 * c3;
      qw = c1 * c2 * c3 + s1 * s2 * s3;
      break;

    case "ZXY":
      qx = s1 * c2 * c3 - c1 * s2 * s3;
      qy = c1 * s2 * c3 + s1 * c2 * s3;
      qz = c1 * c2 * s3 + s1 * s2 * c3;
      qw = c1 * c2 * c3 - s1 * s2 * s3;
      break;

    case "ZYX":
      qx = s1 * c2 * c3 - c1 * s2 * s3;
      qy = c1 * s2 * c3 + s1 * c2 * s3;
      qz = c1 * c2 * s3 - s1 * s2 * c3;
      qw = c1 * c2 * c3 + s1 * s2 * s3;
      break;

    case "YZX":
      qx = s1 * c2 * c3 + c1 * s2 * s3;
      qy = c1 * s2 * c3 + s1 * c2 * s3;
      qz = c1 * c2 * s3 - s1 * s2 * c3;
      qw = c1 * c2 * c3 - s1 * s2 * s3;
      break;

    case "XZY":
      qx = s1 * c2 * c3 - c1 * s2 * s3;
      qy = c1 * s2 * c3 - s1 * c2 * s3;
      qz = c1 * c2 * s3 + s1 * s2 * c3;
      qw = c1 * c2 * c3 + s1 * s2 * s3;
      break;
  }

  const res = out ?? new Float64Array(4);
  res[0] = qx;
  res[1] = qy;
  res[2] = qz;
  res[3] = qw;
  return quatNormalize(res, res);
}

/**
 * Extracts Euler angles in radians from a Quaternion for any of the 6 Tait-Bryan orders.
 */
export function eulerFromQuat(
  order: EulerOrder,
  q: ArrayLike<number>
): Vec3 {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  // 3x3 rotation matrix in column-major notation
  const m00 = 1 - (yy + zz);
  const m10 = xy + wz;
  const m20 = xz - wy;

  const m01 = xy - wz;
  const m11 = 1 - (xx + zz);
  const m21 = yz + wx;

  const m02 = xz + wy;
  const m12 = yz - wx;
  const m22 = 1 - (xx + yy);

  let ex = 0, ey = 0, ez = 0;

  switch (order) {
    case "XYZ": {
      if (Math.abs(m02) < 0.9999999) {
        ey = Math.asin(clamp(m02, -1, 1));
        ex = Math.atan2(-m12, m22);
        ez = Math.atan2(-m01, m00);
      } else {
        ey = m02 < 0 ? -Math.PI / 2 : Math.PI / 2;
        ex = Math.atan2(m21, m11);
        ez = 0;
      }
      break;
    }

    case "YXZ": {
      if (Math.abs(m12) < 0.9999999) {
        ex = Math.asin(-clamp(m12, -1, 1));
        ey = Math.atan2(m02, m22);
        ez = Math.atan2(m10, m11);
      } else {
        ex = m12 < 0 ? Math.PI / 2 : -Math.PI / 2;
        ey = Math.atan2(-m20, m00);
        ez = 0;
      }
      break;
    }

    case "ZXY": {
      if (Math.abs(m21) < 0.9999999) {
        ex = Math.asin(clamp(m21, -1, 1));
        ey = Math.atan2(-m20, m22);
        ez = Math.atan2(-m01, m11);
      } else {
        ex = m21 < 0 ? -Math.PI / 2 : Math.PI / 2;
        ez = Math.atan2(m10, m00);
        ey = 0;
      }
      break;
    }

    case "ZYX": {
      if (Math.abs(m20) < 0.9999999) {
        ey = Math.asin(-clamp(m20, -1, 1));
        ex = Math.atan2(m21, m22);
        ez = Math.atan2(m10, m00);
      } else {
        ey = m20 < 0 ? Math.PI / 2 : -Math.PI / 2;
        ex = 0;
        ez = Math.atan2(-m01, m11);
      }
      break;
    }

    case "YZX": {
      if (Math.abs(m10) < 0.9999999) {
        ez = Math.asin(clamp(m10, -1, 1));
        ex = Math.atan2(-m12, m11);
        ey = Math.atan2(-m20, m00);
      } else {
        ez = m10 < 0 ? -Math.PI / 2 : Math.PI / 2;
        ey = 0;
        ex = Math.atan2(m02, m22);
      }
      break;
    }

    case "XZY": {
      if (Math.abs(m01) < 0.9999999) {
        ez = Math.asin(-clamp(m01, -1, 1));
        ex = Math.atan2(m21, m11);
        ey = Math.atan2(m02, m00);
      } else {
        ez = m01 < 0 ? Math.PI / 2 : -Math.PI / 2;
        ex = Math.atan2(-m12, m22);
        ey = 0;
      }
      break;
    }
  }

  return vec3(ex, ey, ez);
}

// ---------------------------------------------------------------------------
// Quaternion Arithmetic
// ---------------------------------------------------------------------------

/**
 * Multiplies quaternion `a` by quaternion `b` (out = a * b).
 */
export function quatMultiply(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  out?: Quat
): Quat {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];

  const res = out ?? new Float64Array(4);
  res[0] = aw * bx + ax * bw + ay * bz - az * by;
  res[1] = aw * by - ax * bz + ay * bw + az * bx;
  res[2] = aw * bz + ax * by - ay * bx + az * bw;
  res[3] = aw * bw - ax * bx - ay * by - az * bz;
  return res;
}

/**
 * Normalizes quaternion `q` to unit length.
 */
export function quatNormalize(q: ArrayLike<number>, out?: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  const res = out ?? new Float64Array(4);

  if (len === 0) {
    res[0] = 0;
    res[1] = 0;
    res[2] = 0;
    res[3] = 1;
    return res;
  }

  const inv = 1 / len;
  res[0] = q[0] * inv;
  res[1] = q[1] * inv;
  res[2] = q[2] * inv;
  res[3] = q[3] * inv;
  return res;
}

/**
 * Spherical linear interpolation between quaternions `qa` and `qb` by factor `t` in [0, 1].
 */
export function quatSlerp(
  qa: ArrayLike<number>,
  qb: ArrayLike<number>,
  t: number,
  out?: Quat
): Quat {
  let bx = qb[0], by = qb[1], bz = qb[2], bw = qb[3];
  let cosHalfTheta = qa[0] * bx + qa[1] * by + qa[2] * bz + qa[3] * bw;

  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (cosHalfTheta >= 1.0) {
    const res = out ?? new Float64Array(4);
    res[0] = qa[0];
    res[1] = qa[1];
    res[2] = qa[2];
    res[3] = qa[3];
    return res;
  }

  const sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;
  if (sqrSinHalfTheta <= Number.EPSILON) {
    const s = 1 - t;
    const res = out ?? new Float64Array(4);
    res[0] = s * qa[0] + t * bx;
    res[1] = s * qa[1] + t * by;
    res[2] = s * qa[2] + t * bz;
    res[3] = s * qa[3] + t * bw;
    return quatNormalize(res, res);
  }

  const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
  const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  const res = out ?? new Float64Array(4);
  res[0] = qa[0] * ratioA + bx * ratioB;
  res[1] = qa[1] * ratioA + by * ratioB;
  res[2] = qa[2] * ratioA + bz * ratioB;
  res[3] = qa[3] * ratioA + bw * ratioB;
  return res;
}

// ---------------------------------------------------------------------------
// Point & Direction Transformations
// ---------------------------------------------------------------------------

/**
 * Transforms a 3D point `p` by 4x4 matrix `m`, performing perspective divide if w !== 1.
 */
export function transformPoint(
  m: Mat4,
  p: ArrayLike<number>,
  out?: Vec3
): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const invW = w !== 0 ? 1 / w : 1;

  const res = out ?? new Float64Array(3);
  res[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW;
  res[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW;
  res[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW;
  return res;
}

/**
 * Transforms a 3D direction vector `v` by 4x4 matrix `m` (ignores translation).
 */
export function transformDirection(
  m: Mat4,
  v: ArrayLike<number>,
  out?: Vec3
): Vec3 {
  const x = v[0], y = v[1], z = v[2];

  const res = out ?? new Float64Array(3);
  res[0] = m[0] * x + m[4] * y + m[8] * z;
  res[1] = m[1] * x + m[5] * y + m[9] * z;
  res[2] = m[2] * x + m[6] * y + m[10] * z;
  return res;
}

// ---------------------------------------------------------------------------
// Ergonomic Aliases & Namespaces
// ---------------------------------------------------------------------------

export const mat4Identity = identity;
export const mat4Multiply = multiply;
export const mat4Invert = invert;
export const mat4InvertAffine = invertAffine;
export const mat4Compose = compose;
export const mat4Decompose = decompose;

export const mat4Ops = {
  identity,
  multiply,
  invert,
  invertAffine,
  compose,
  decompose,
  transformPoint,
  transformDirection,
};

export const quatOps = {
  multiply: quatMultiply,
  normalize: quatNormalize,
  slerp: quatSlerp,
  fromEuler: quatFromEuler,
  toEuler: eulerFromQuat,
};
