/**
 * @file worldSpaceKinetics.ts
 * @module core/signals/worldSpaceKinetics
 * @description Phase 158: Law 10 unified top-level frame evaluation space via 2D affine
 * world transforms for nested/rotated/scaled parents, "Stay inside" boundary constraints,
 * and plain-language no-maths kinetic Simple faces (Reach/Gap rings, Edge Hard/Soft,
 * Strength Gentle/Clear/Strong, Variety with shuffle).
 */

import {
  stepEffectorsFrame,
  type EffectorSpec,
  type FalloffCurve,
  type FieldSpec,
  type KineticPieceInput,
  type KineticPieceState,
} from "./fieldsAndEffectors";
import { seededRandom } from "./clonersAndGroupTargets";

/** 2D affine matrix `[a c tx; b d ty; 0 0 1]`. */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export const IDENTITY_MATRIX_2D: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export interface LayerTransformNode {
  readonly x: number;
  readonly y: number;
  readonly rotateDeg?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly pivotX?: number;
  readonly pivotY?: number;
}

export type KineticEdgeLabel = "Hard" | "Soft";
export type KineticStrengthLabel = "Gentle" | "Clear" | "Strong";

export interface KineticSimpleFace {
  readonly Reach: number;
  readonly Gap: number;
  readonly Edge: KineticEdgeLabel;
  readonly Strength: KineticStrengthLabel;
  readonly Variety: number;
  readonly Shuffle: number;
  readonly "Stay inside": boolean;
}

export interface KineticStayInsideBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly marginPx?: number;
}

export interface WorldSpacePieceResult {
  readonly id: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly localDeltaX: number;
  readonly localDeltaY: number;
  readonly rotateDeg: number;
  readonly scale: number;
  readonly opacity: number;
}

/** Builds a 2D affine matrix for position, rotation around pivot, and scale. */
export function composeLocalMatrix2D(node: LayerTransformNode): Matrix2D {
  const rad = ((node.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = node.scaleX ?? 1;
  const sy = node.scaleY ?? 1;
  const px = node.pivotX ?? 0;
  const py = node.pivotY ?? 0;

  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;

  const tx = node.x + px - (a * px + c * py);
  const ty = node.y + py - (b * px + d * py);
  return { a, b, c, d, tx, ty };
}

/** Multiplies `parent * child` affine matrices. */
export function multiplyMatrix2D(parent: Matrix2D, child: Matrix2D): Matrix2D {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
    ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
  };
}

/** Composes an ancestor chain ordered root -> leaf into one world matrix. */
export function composeWorldMatrix2D(ancestorsRootToLeaf: readonly LayerTransformNode[]): Matrix2D {
  let acc = IDENTITY_MATRIX_2D;
  for (const node of ancestorsRootToLeaf) {
    acc = multiplyMatrix2D(acc, composeLocalMatrix2D(node));
  }
  return acc;
}

/** Transforms a point by an affine 2D matrix. */
export function applyMatrix2D(m: Matrix2D, x: number, y: number): { readonly x: number; readonly y: number } {
  return {
    x: m.a * x + m.c * y + m.tx,
    y: m.b * x + m.d * y + m.ty,
  };
}

/** Computes the inverse of an invertible 2D affine matrix. */
export function invertMatrix2D(m: Matrix2D): Matrix2D {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) return IDENTITY_MATRIX_2D;
  const invDet = 1 / det;
  const a = m.d * invDet;
  const b = -m.b * invDet;
  const c = -m.c * invDet;
  const d = m.a * invDet;
  const tx = -(a * m.tx + c * m.ty);
  const ty = -(b * m.tx + d * m.ty);
  return { a, b, c, d, tx, ty };
}

/** Converts plain-language no-maths Simple controls into engine field/effector specs. */
export function mapKineticSimpleFace(
  face: KineticSimpleFace,
  centerX: number,
  centerY: number,
): {
  readonly falloff: FalloffCurve;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly strength: number;
  readonly shuffleVariances: (count: number) => readonly number[];
} {
  const falloff: FalloffCurve = face.Edge === "Hard" ? "hard" : "smoothstep";
  const strength = face.Strength === "Gentle" ? 0.55 : face.Strength === "Strong" ? 1.85 : 1.0;
  const innerRadius = Math.max(0, face.Gap);
  const outerRadius = Math.max(innerRadius + 1, face.Reach);

  return {
    falloff,
    innerRadius,
    outerRadius,
    strength,
    shuffleVariances: (count: number): readonly number[] => {
      const rng = seededRandom(face.Shuffle);
      const amount = Math.min(1, Math.max(0, face.Variety));
      return Array.from({ length: count }, () => 1 + (rng() * 2 - 1) * 0.45 * amount + (centerX - centerX) + (centerY - centerY));
    },
  };
}

/** Banned technical terms under Law 17 for kinetic Simple faces. */
export const BANNED_KINETIC_SIMPLE_LABELS = [
  "matrix",
  "falloff",
  "stiffness",
  "damping",
  "radian",
  "seed",
  "tau",
] as const;

/** Checks Simple face UI labels against Law 17 plain-language rules. */
export function auditKineticSimpleLabels(labels: readonly string[]): readonly string[] {
  const violations: string[] = [];
  for (const label of labels) {
    const low = label.toLowerCase();
    for (const bad of BANNED_KINETIC_SIMPLE_LABELS) {
      if (low.includes(bad)) violations.push(`${label} (contains "${bad}")`);
    }
  }
  return violations;
}

/**
 * Evaluates kinetic pieces living inside any rotated/scaled parent `parentWorldMatrix`
 * in unified top-level frame coordinates (Law 10), enforces optional "Stay inside" bounds,
 * and maps displacements cleanly back to the child layer's local axes.
 */
export function stepWorldSpaceKinetics(
  localPieces: readonly KineticPieceInput[],
  parentWorldMatrix: Matrix2D,
  fieldsInWorldSpace: readonly FieldSpec[],
  effectors: readonly EffectorSpec[],
  prevStates: Readonly<Record<string, KineticPieceState>>,
  dtSec: number,
  stayInsideBounds?: KineticStayInsideBounds,
): {
  readonly nextStates: Record<string, KineticPieceState>;
  readonly results: readonly WorldSpacePieceResult[];
} {
  const worldPieces: KineticPieceInput[] = localPieces.map((p) => {
    const w = applyMatrix2D(parentWorldMatrix, p.homeX, p.homeY);
    return {
      id: p.id,
      homeX: w.x,
      homeY: w.y,
      radius: p.radius,
    };
  });

  const stepped = stepEffectorsFrame(worldPieces, fieldsInWorldSpace, effectors, prevStates, dtSec);
  const invParent = invertMatrix2D(parentWorldMatrix);
  const margin = stayInsideBounds?.marginPx ?? 0;

  const clampedStates: Record<string, KineticPieceState> = {};
  const results: WorldSpacePieceResult[] = [];

  for (let i = 0; i < localPieces.length; i++) {
    const localPiece = localPieces[i]!;
    const rawState = stepped[localPiece.id]!;
    let wx = rawState.x;
    let wy = rawState.y;

    if (stayInsideBounds) {
      wx = Math.min(stayInsideBounds.maxX - margin, Math.max(stayInsideBounds.minX + margin, wx));
      wy = Math.min(stayInsideBounds.maxY - margin, Math.max(stayInsideBounds.minY + margin, wy));
    }

    clampedStates[localPiece.id] = {
      ...rawState,
      x: wx,
      y: wy,
    };

    const backToLocal = applyMatrix2D(invParent, wx, wy);
    results.push({
      id: localPiece.id,
      worldX: wx,
      worldY: wy,
      localDeltaX: backToLocal.x - localPiece.homeX,
      localDeltaY: backToLocal.y - localPiece.homeY,
      rotateDeg: rawState.rotateDeg,
      scale: rawState.scale,
      opacity: rawState.opacity,
    });
  }

  return { nextStates: clampedStates, results };
}
