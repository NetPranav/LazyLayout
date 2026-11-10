/**
 * ============================================================================
 * AFFINE TRANSFORMATIONS ABOUT ANCHOR & PINS (ROADMAP Phase 72)
 * ============================================================================
 * Interactive Effects Engine Spec §8.6.2:
 *
 * For a layer with frame origin F = (frame.x, frame.y), local anchor A = (Ax, Ay),
 * pin P = (Px, Py), rotation R(θ) [degrees, clockwise on y-down screen],
 * scale S(sx, sy), and transform offset T = (transform.x, transform.y):
 *
 *   P_world = F + A + R(θ) · S(sx, sy) · (P - A) + T
 *
 * Anchor Invariance:
 * When P = A, (P - A) = (0, 0)
 *   => P_world = F + A + T
 * The anchor is the invariant fixed point of the transformation.
 * ============================================================================
 */

export interface TransformParameters {
  anchor: [number, number];
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  frameOrigin?: [number, number];
  transformOffset?: [number, number];
}

/**
 * Transforms a point in layer-local coordinates into canvas/world coordinates.
 * Evaluates transformation order: Scale first, then Rotation, then Translation (R · S).
 * Zero-scale is handled purely through multiplication (no division by scale).
 */
export function transformPoint(
  point: [number, number],
  params: TransformParameters
): [number, number] {
  const [Fx, Fy] = params.frameOrigin ?? [0, 0];
  const [Ax, Ay] = params.anchor;
  const [Tx, Ty] = params.transformOffset ?? [0, 0];
  const [Px, Py] = point;

  const sx = params.scaleX;
  const sy = params.scaleY;
  const deg = params.rotationDeg;

  // 1. Vector relative to anchor
  const dx = Px - Ax;
  const dy = Py - Ay;

  // 2. Scale (without division)
  const vx = dx * sx;
  const vy = dy * sy;

  // 3. Rotation (clockwise on y-down screen)
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = vx * cos - vy * sin;
  const ry = vx * sin + vy * cos;

  // 4. Invariant translation: F + A + T + rotated/scaled vector
  return [Fx + Ax + Tx + rx, Fy + Ay + Ty + ry];
}

/**
 * Computes the 4 transformed bounding corners of a layer in world/canvas space.
 * Corners order:
 * 0: topLeft (0, 0)
 * 1: topRight (width, 0)
 * 2: bottomRight (width, height)
 * 3: bottomLeft (0, height)
 */
export function computeTransformedCorners(
  width: number,
  height: number,
  params: TransformParameters
): [
  [number, number],
  [number, number],
  [number, number],
  [number, number]
] {
  const corners: [[number, number], [number, number], [number, number], [number, number]] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];

  return [
    transformPoint(corners[0], params),
    transformPoint(corners[1], params),
    transformPoint(corners[2], params),
    transformPoint(corners[3], params),
  ];
}

/**
 * Condition F: Changing the anchor point while preserving existing rendered geometry.
 *
 * For transformation:
 *   P' = F + A + M · (P - A) + T
 * where M = R(θ) · S(sx, sy).
 *
 * To transition from old anchor A to new anchor A' without changing the rendered visual position
 * of the layer's pixels, the transform offset T must be updated to T':
 *
 *   T' = T + (I - M) · (A - A')
 *
 * where:
 *   ΔA = A - A'
 *   M · ΔA = R(θ) · S(sx, sy) · ΔA
 *   (I - M) · ΔA = ΔA - (M · ΔA)
 */
export function compensateTransformForAnchorChange(
  oldAnchor: [number, number],
  newAnchor: [number, number],
  rotationDeg: number,
  scaleX: number,
  scaleY: number,
  currentTransformOffset: [number, number] = [0, 0]
): [number, number] {
  const [Ax, Ay] = oldAnchor;
  const [Apx, Apy] = newAnchor;
  const [Tx, Ty] = currentTransformOffset;

  const dAx = Ax - Apx;
  const dAy = Ay - Apy;

  // Compute M · ΔA = R(deg) · S(scaleX, scaleY) · ΔA
  const scaledX = dAx * scaleX;
  const scaledY = dAy * scaleY;

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const mX = scaledX * cos - scaledY * sin;
  const mY = scaledX * sin + scaledY * cos;

  // (I - M) · ΔA = ΔA - M · ΔA
  const compX = dAx - mX;
  const compY = dAy - mY;

  return [Tx + compX, Ty + compY];
}

/**
 * Order verification helper (Requirement 3).
 * Evaluates a vector v under (R · S) vs (S · R).
 */
export function evaluateTransformOrder(
  v: [number, number],
  rotationDeg: number,
  scaleX: number,
  scaleY: number
): {
  rs: [number, number]; // R · S (Canonical: Scale first, then rotate)
  sr: [number, number]; // S · R (Rotate first, then scale)
} {
  const [x, y] = v;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // R · S: scale first, then rotate
  const sx = x * scaleX;
  const sy = y * scaleY;
  const rs: [number, number] = [sx * cos - sy * sin, sx * sin + sy * cos];

  // S · R: rotate first, then scale
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  const sr: [number, number] = [rx * scaleX, ry * scaleY];

  return { rs, sr };
}
