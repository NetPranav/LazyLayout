/**
 * ============================================================================
 * AFFINE TRANSFORM COMPOSITION & PARENTING ENGINE (ROADMAP Phase 73)
 * ============================================================================
 * Specification & Acceptance Criteria:
 * - Pick-whip parenting independent of the layer tree.
 * - Kernel composes parent transforms: M_world = M_parent_k · ... · M_parent_1 · M_local
 * - Column-vector convention: P_world = M_world · P_local
 * - Matrix ordering: Scale local delta, rotate, translate, compose ancestors.
 * - Cycle prevention: Validates DAG topology (no self or indirect cycles).
 * - Pose preservation: L_new = P^-1 · W with singular matrix safe fallback.
 * ============================================================================
 */

import type { Layer } from "../document/schema";
import { resolveLayerAnchor } from "./pins";

/**
 * 2D Affine Transformation Matrix in homogeneous coordinates:
 * [ a, b, c, d, e, f ] representing:
 * [ a  c  e ]
 * [ b  d  f ]
 * [ 0  0  1 ]
 *
 * For a column vector [x, y, 1]^T:
 * x' = a*x + c*y + e
 * y' = b*x + d*y + f
 */
export type AffineMatrix2D = [number, number, number, number, number, number];

/** Standard 2D identity affine matrix */
export const IDENTITY_MATRIX: AffineMatrix2D = [1, 0, 0, 1, 0, 0];

/** Returns an identity matrix */
export function identityMatrix(): AffineMatrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Multiplies two 2D affine matrices: M = M1 · M2.
 * Corresponds to applying transform M2 first, then transform M1:
 * P' = M1 · (M2 · P) = (M1 · M2) · P.
 */
export function multiplyAffineMatrices(m1: AffineMatrix2D, m2: AffineMatrix2D): AffineMatrix2D {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  const a = a1 * a2 + c1 * b2;
  const b = b1 * a2 + d1 * b2;
  const c = a1 * c2 + c1 * d2;
  const d = b1 * c2 + d1 * d2;
  const e = a1 * e2 + c1 * f2 + e1;
  const f = b1 * e2 + d1 * f2 + f1;

  return [a, b, c, d, e, f];
}

/** Applies affine transform matrix M to a point [x, y] */
export function applyAffineMatrix(m: AffineMatrix2D, point: [number, number]): [number, number] {
  const [a, b, c, d, e, f] = m;
  const [x, y] = point;
  return [a * x + c * y + e, b * x + d * y + f];
}

export interface LocalMatrixParameters {
  frameOrigin?: [number, number];
  anchor: [number, number];
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  transformOffset?: [number, number];
}

/**
 * Creates the local 2D affine matrix for a layer matching Phase 72's canonical formula:
 * P_world = F + A + T + R(θ) · S(sx, sy) · (P - A)
 *
 * Expands to:
 * x' = (sx*cos)*x - (sy*sin)*y + [Fx + Ax + Tx - (sx*cos)*Ax + (sy*sin)*Ay]
 * y' = (sx*sin)*x + (sy*cos)*y + [Fy + Ay + Ty - (sx*sin)*Ax - (sy*cos)*Ay]
 */
export function createLayerLocalMatrix(params: LocalMatrixParameters): AffineMatrix2D {
  const [Fx, Fy] = params.frameOrigin ?? [0, 0];
  const [Ax, Ay] = params.anchor;
  const [Tx, Ty] = params.transformOffset ?? [0, 0];
  const sx = params.scaleX;
  const sy = params.scaleY;
  const deg = params.rotationDeg;

  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const a = sx * cos;
  const b = sx * sin;
  const c = -sy * sin;
  const d = sy * cos;

  const e = Fx + Ax + Tx - a * Ax - c * Ay;
  const f = Fy + Ay + Ty - b * Ax - d * Ay;

  return [a, b, c, d, e, f];
}

/** Computes the determinant of the 2x2 linear portion of the matrix: det = ad - bc */
export function matrixDeterminant(m: AffineMatrix2D): number {
  return m[0] * m[3] - m[1] * m[2];
}

/**
 * Inverts a 2D affine matrix.
 * Returns null if the matrix is singular (determinant magnitude < 1e-9).
 */
export function invertAffineMatrix(m: AffineMatrix2D): AffineMatrix2D | null {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) {
    return null;
  }

  const invDet = 1 / det;
  const invA = d * invDet;
  const invB = -b * invDet;
  const invC = -c * invDet;
  const invD = a * invDet;
  const invE = (-d * e + c * f) * invDet;
  const invF = (b * e - a * f) * invDet;

  return [invA, invB, invC, invD, invE, invF];
}

/**
 * Decomposes an affine matrix into translation offset, rotation (degrees), and scale (sx, sy)
 * given the known anchor and frame origin.
 */
export function decomposeAffineMatrix(
  m: AffineMatrix2D,
  anchor: [number, number],
  frameOrigin: [number, number] = [0, 0]
): {
  transformOffset: [number, number];
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
} {
  const [a, b, c, d, e, f] = m;
  const [Ax, Ay] = anchor;
  const [Fx, Fy] = frameOrigin;

  const det = a * d - b * c;
  const sx = Math.hypot(a, b);
  const rotRad = Math.atan2(b, a);
  const rotDeg = (rotRad * 180) / Math.PI;
  const sy = Math.hypot(c, d) * (det < 0 ? -1 : 1);

  // Invert e and f equations to solve for Tx, Ty:
  // e = Fx + Ax + Tx - a*Ax - c*Ay  =>  Tx = e - Fx - Ax + a*Ax + c*Ay
  // f = Fy + Ay + Ty - b*Ax - d*Ay  =>  Ty = f - Fy - Ay + b*Ax + d*Ay
  const Tx = e - Fx - Ax + a * Ax + c * Ay;
  const Ty = f - Fy - Ay + b * Ax + d * Ay;

  return {
    transformOffset: [Tx, Ty],
    rotationDeg: rotDeg,
    scaleX: sx,
    scaleY: sy,
  };
}

/** Maximum allowed nesting depth for parenting chains to protect against infinite loops */
export const MAX_PARENT_CHAIN_DEPTH = 32;

/**
 * Validates whether `childId` can be parented to `targetParentId`.
 * Ensures:
 * 1. No self-parenting (childId !== targetParentId).
 * 2. No indirect circular dependencies (targetParentId does not already have childId as an ancestor).
 * 3. Chain depth limit is preserved (<= 32).
 */
export function validateParentLink(
  layers: Record<string, Layer>,
  childId: string,
  targetParentId: string | null
): { valid: boolean; reason?: string } {
  if (targetParentId === null || targetParentId === "") {
    return { valid: true };
  }

  if (childId === targetParentId) {
    return { valid: false, reason: "A layer cannot be parented to itself." };
  }

  if (!layers[targetParentId]) {
    return { valid: false, reason: `Target parent layer "${targetParentId}" does not exist.` };
  }

  // Walk up the parent chain of targetParentId to verify childId is not an ancestor
  let current: string | null | undefined = targetParentId;
  let depth = 0;
  const visited = new Set<string>([childId]);

  while (current && depth++ < MAX_PARENT_CHAIN_DEPTH) {
    if (visited.has(current)) {
      return { valid: false, reason: "Cyclic parenting dependency detected." };
    }
    visited.add(current);
    const parentLayer = layers[current];
    if (!parentLayer) break;
    current = getLayerParentRef(parentLayer);
  }

  if (depth >= MAX_PARENT_CHAIN_DEPTH) {
    return { valid: false, reason: `Parent chain exceeds maximum depth of ${MAX_PARENT_CHAIN_DEPTH}.` };
  }

  return { valid: true };
}

/**
 * Canonical accessor for transform parenting (Phase 73).
 * `layer.parentRef` is the SOLE authoritative source of truth.
 * `properties["transform.parent"]` is maintained only as a derived read-only projection.
 */
export function getLayerParentRef(
  layer: { parentRef?: string | null; properties?: Record<string, unknown> } | null | undefined
): string | null {
  if (!layer) return null;
  if (typeof layer.parentRef === "string") {
    const trimmed = layer.parentRef.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (layer.parentRef === null) {
    return null;
  }
  // Secondary fallback for un-migrated raw objects where parentRef has not been initialized
  const propParent = layer.properties?.["transform.parent"];
  if (typeof propParent === "string" && propParent.trim().length > 0) {
    return propParent.trim();
  }
  return null;
}

/** Formats an affine matrix into standard CSS `matrix(a, b, c, d, e, f)` */
export function formatCssMatrix(m: AffineMatrix2D): string {
  // Round small floating-point errors for cleaner CSS output while preserving precision
  const round = (val: number) => {
    const fixed = Math.round(val * 1e6) / 1e6;
    return Object.is(fixed, -0) ? 0 : fixed;
  };
  return `matrix(${round(m[0])}, ${round(m[1])}, ${round(m[2])}, ${round(m[3])}, ${round(m[4])}, ${round(m[5])})`;
}

/**
 * Builds the local matrix for a layer from its properties and geometry.
 */
export function getLayerLocalMatrix(layer: Layer, width = 100, height = 100): AffineMatrix2D {
  const props = layer.properties;
  const n = (k: string, d: number) => (typeof props[k] === "number" ? (props[k] as number) : d);

  const fx = n("frame.x", 0);
  const fy = n("frame.y", 0);
  const tx = n("transform.x", 0);
  const ty = n("transform.y", 0);
  const deg = n("transform.rotate", 0);
  const s = n("transform.scale", 1);
  const sx = n("transform.scaleX", 1) * s;
  const sy = n("transform.scaleY", 1) * s;

  const w = n("frame.width", width);
  const h = n("frame.height", height);
  const anchor = resolveLayerAnchor(layer, w, h);

  return createLayerLocalMatrix({
    frameOrigin: [fx, fy],
    anchor,
    rotationDeg: deg,
    scaleX: sx,
    scaleY: sy,
    transformOffset: [tx, ty],
  });
}

/**
 * Computes the complete composed world transform matrix for a layer across its parent chain.
 * Chain: Child L0 -> Parent L1 -> ... -> Grandparent Lk
 * M_world = M_k · ... · M_1 · M_0
 */
export function computeComposedWorldMatrix(
  layers: Record<string, Layer>,
  layerId: string,
  localMatrixResolver?: (layer: Layer) => AffineMatrix2D
): AffineMatrix2D {
  const layer = layers[layerId];
  if (!layer) return IDENTITY_MATRIX;

  const resolver = localMatrixResolver ?? ((l) => getLayerLocalMatrix(l));

  // Collect the chain from child up to root ancestor
  const chain: Layer[] = [layer];
  const visited = new Set<string>([layerId]);
  let currentParentId = getLayerParentRef(layer);
  let depth = 0;

  while (currentParentId && depth++ < MAX_PARENT_CHAIN_DEPTH) {
    if (visited.has(currentParentId)) break; // cycle protection
    visited.add(currentParentId);
    const parentLayer = layers[currentParentId];
    if (!parentLayer) break;
    chain.push(parentLayer);
    currentParentId = getLayerParentRef(parentLayer);
  }

  // Multiply from root down to child: M_world = M_root · ... · M_child
  let result = resolver(chain[chain.length - 1]);
  for (let i = chain.length - 2; i >= 0; i--) {
    const nextLocal = resolver(chain[i]);
    result = multiplyAffineMatrices(result, nextLocal);
  }

  return result;
}

/**
 * Computes the new local transform properties for a child layer to preserve its current
 * world canvas pose when attaching to a new parent:
 * L_new = P_new^-1 · W_current
 *
 * If P_new is singular (zero scale) or unparenting to root, handles cleanly without NaN.
 */
export function computeReparentedLocalTransform(
  childLayer: Layer,
  newParentId: string | null,
  layers: Record<string, Layer>,
  width = 100,
  height = 100
): {
  "transform.x": number;
  "transform.y": number;
  "transform.rotate": number;
  "transform.scale": number;
  "transform.scaleX": number;
  "transform.scaleY": number;
} {
  const w = typeof childLayer.properties["frame.width"] === "number" ? (childLayer.properties["frame.width"] as number) : width;
  const h = typeof childLayer.properties["frame.height"] === "number" ? (childLayer.properties["frame.height"] as number) : height;
  const anchor = resolveLayerAnchor(childLayer, w, h);
  const fx = typeof childLayer.properties["frame.x"] === "number" ? (childLayer.properties["frame.x"] as number) : 0;
  const fy = typeof childLayer.properties["frame.y"] === "number" ? (childLayer.properties["frame.y"] as number) : 0;

  // 1. Current world matrix of child
  const currentWorldM = computeComposedWorldMatrix(layers, childLayer.id);

  // 2. If unparenting to root, the new local matrix equals the current world matrix
  if (!newParentId || !layers[newParentId]) {
    const decomp = decomposeAffineMatrix(currentWorldM, anchor, [fx, fy]);
    return {
      "transform.x": Math.round(decomp.transformOffset[0] * 100) / 100,
      "transform.y": Math.round(decomp.transformOffset[1] * 100) / 100,
      "transform.rotate": Math.round(decomp.rotationDeg * 100) / 100,
      "transform.scale": 1,
      "transform.scaleX": Math.round(decomp.scaleX * 1000) / 1000,
      "transform.scaleY": Math.round(decomp.scaleY * 1000) / 1000,
    };
  }

  // 3. New parent world matrix
  const parentWorldM = computeComposedWorldMatrix(layers, newParentId);
  const invParentM = invertAffineMatrix(parentWorldM);

  if (!invParentM) {
    // Singular parent matrix (e.g. parent is scaled to 0): maintain current local transform safely
    return {
      "transform.x": typeof childLayer.properties["transform.x"] === "number" ? (childLayer.properties["transform.x"] as number) : 0,
      "transform.y": typeof childLayer.properties["transform.y"] === "number" ? (childLayer.properties["transform.y"] as number) : 0,
      "transform.rotate": typeof childLayer.properties["transform.rotate"] === "number" ? (childLayer.properties["transform.rotate"] as number) : 0,
      "transform.scale": 1,
      "transform.scaleX": typeof childLayer.properties["transform.scaleX"] === "number" ? (childLayer.properties["transform.scaleX"] as number) : 1,
      "transform.scaleY": typeof childLayer.properties["transform.scaleY"] === "number" ? (childLayer.properties["transform.scaleY"] as number) : 1,
    };
  }

  // L_new = P^-1 · W
  const newLocalM = multiplyAffineMatrices(invParentM, currentWorldM);
  const decomp = decomposeAffineMatrix(newLocalM, anchor, [fx, fy]);

  return {
    "transform.x": Math.round(decomp.transformOffset[0] * 100) / 100,
    "transform.y": Math.round(decomp.transformOffset[1] * 100) / 100,
    "transform.rotate": Math.round(decomp.rotationDeg * 100) / 100,
    "transform.scale": 1,
    "transform.scaleX": Math.round(decomp.scaleX * 1000) / 1000,
    "transform.scaleY": Math.round(decomp.scaleY * 1000) / 1000,
  };
}
