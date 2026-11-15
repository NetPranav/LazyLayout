/**
 * ============================================================================
 * STAGE 5 · PHASE 203 — RIG MODEL: BONES & SKINS
 * ============================================================================
 * Pure deterministic 2D hierarchical bone & skinning model shared across
 * live editor posing, timeline evaluation, IK/constraints, and export runtime.
 * Decision record: DOCS/INITIAL/decisions/0017-rigging-and-deformation.md
 * ============================================================================
 */

export type AffineMatrix2D = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  tx: number,
  ty: number,
];

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Bone2D {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly length: number;
  readonly restX: number;
  readonly restY: number;
  readonly restRotationDeg: number;
  readonly restScaleX?: number;
  readonly restScaleY?: number;
}

export interface PoseBoneTransform {
  readonly dx?: number;
  readonly dy?: number;
  readonly rotationDeg?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export type RigPoseMap = Record<string, PoseBoneTransform>;

export interface WorldBoneTransform {
  readonly boneId: string;
  readonly matrix: AffineMatrix2D;
  readonly head: Point2D;
  readonly tail: Point2D;
  readonly worldRotationDeg: number;
  readonly worldScaleX: number;
  readonly worldScaleY: number;
  readonly localRotationDeg: number;
}

export interface BoneWeightInfluence {
  readonly boneId: string;
  readonly weight: number;
}

export type VertexWeightList = readonly BoneWeightInfluence[];

export type RigSkinBinding =
  | {
      readonly layerId: string;
      readonly mode: "rigid";
      readonly boneId: string;
      readonly offsetX?: number;
      readonly offsetY?: number;
      readonly offsetRotationDeg?: number;
    }
  | {
      readonly layerId: string;
      readonly mode: "mesh";
      readonly vertexWeights: readonly VertexWeightList[];
    };

export interface RigDefinition {
  readonly id: string;
  readonly name: string;
  readonly rootLayerId: string;
  readonly bones: readonly Bone2D[];
  readonly skins: readonly RigSkinBinding[];
}

export interface EvaluatedRigidLayer {
  readonly layerId: string;
  readonly x: number;
  readonly y: number;
  readonly rotationDeg: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
export const IDENTITY_MATRIX_2D: AffineMatrix2D = [1, 0, 0, 1, 0, 0];

/** Multiply two 2D affine matrices (`m1 * m2`). */
export function multiplyAffine(m1: AffineMatrix2D, m2: AffineMatrix2D): AffineMatrix2D {
  const [a1, b1, c1, d1, tx1, ty1] = m1;
  const [a2, b2, c2, d2, tx2, ty2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1,
  ];
}

/** Build a translation * rotation * scale 2D affine matrix. */
export function composeAffineTRS(
  tx: number,
  ty: number,
  rotationDeg: number,
  scaleX = 1,
  scaleY = 1,
): AffineMatrix2D {
  const rad = rotationDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    cos * scaleX,
    sin * scaleX,
    -sin * scaleY,
    cos * scaleY,
    tx,
    ty,
  ];
}

/** Invert a 2D affine matrix, returning identity if singular. */
export function invertAffineMatrix(m: AffineMatrix2D): AffineMatrix2D {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return IDENTITY_MATRIX_2D;
  const invDet = 1 / det;
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (c * ty - d * tx) * invDet,
    (b * tx - a * ty) * invDet,
  ];
}

/** Transform a 2D point by an affine matrix. */
export function transformPoint(m: AffineMatrix2D, pt: Point2D): Point2D {
  const [a, b, c, d, tx, ty] = m;
  return {
    x: a * pt.x + c * pt.y + tx,
    y: b * pt.x + d * pt.y + ty,
  };
}

/** Order bones parent-first while tolerating arbitrary input order and breaking cycles. */
export function sortBonesTopological(bones: readonly Bone2D[]): Bone2D[] {
  const byId = new Map(bones.map((b) => [b.id, b] as const));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Bone2D[] = [];

  const visit = (bone: Bone2D): void => {
    if (visited.has(bone.id) || visiting.has(bone.id)) return;
    visiting.add(bone.id);
    if (bone.parentId !== null) {
      const parent = byId.get(bone.parentId);
      if (parent) visit(parent);
    }
    visiting.delete(bone.id);
    visited.add(bone.id);
    ordered.push(bone);
  };

  for (const bone of bones) visit(bone);
  return ordered;
}

/** Create a normalized rig definition with parent-first sorted bones. */
export function createRigDefinition(
  id: string,
  name: string,
  rootLayerId: string,
  bones: readonly Bone2D[],
  skins: readonly RigSkinBinding[] = [],
): RigDefinition {
  return {
    id,
    name,
    rootLayerId,
    bones: sortBonesTopological(bones),
    skins: [...skins],
  };
}

/** Normalize vertex bone weights so their sum equals 1.0 (when non-empty). */
export function normalizeVertexWeights(weights: VertexWeightList): BoneWeightInfluence[] {
  if (weights.length === 0) return [];
  const clean = weights
    .filter((w) => Number.isFinite(w.weight) && w.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.boneId.localeCompare(b.boneId));
  if (clean.length === 0) {
    return [{ boneId: weights[0].boneId, weight: 1 }];
  }
  const sum = clean.reduce((acc, w) => acc + w.weight, 0);
  if (sum <= 1e-12) {
    return [{ boneId: clean[0].boneId, weight: 1 }];
  }
  return clean.map((w) => ({ boneId: w.boneId, weight: w.weight / sum }));
}

/** Evaluate world transforms for every bone in `rig` under `poseOverride`. */
export function evaluateRigWorldTransforms(
  rig: RigDefinition,
  poseOverride: RigPoseMap = {},
): Record<string, WorldBoneTransform> {
  const ordered = sortBonesTopological(rig.bones);
  const byId = new Map(ordered.map((b) => [b.id, b] as const));
  const out: Record<string, WorldBoneTransform> = {};

  for (const bone of ordered) {
    const pose = poseOverride[bone.id];
    const dx = pose?.dx ?? 0;
    const dy = pose?.dy ?? 0;
    const localRot = bone.restRotationDeg + (pose?.rotationDeg ?? 0);
    const localSx = (bone.restScaleX ?? 1) * (pose?.scaleX ?? 1);
    const localSy = (bone.restScaleY ?? 1) * (pose?.scaleY ?? 1);

    const parent = bone.parentId !== null ? byId.get(bone.parentId) : undefined;
    const parentWorld = bone.parentId !== null ? out[bone.parentId] : undefined;

    const anchorX = (parent ? parent.length : 0) + bone.restX + dx;
    const anchorY = bone.restY + dy;
    const localMatrix = composeAffineTRS(anchorX, anchorY, localRot, localSx, localSy);
    const matrix = parentWorld ? multiplyAffine(parentWorld.matrix, localMatrix) : localMatrix;

    const head = transformPoint(matrix, { x: 0, y: 0 });
    const tail = transformPoint(matrix, { x: bone.length, y: 0 });
    const [a, b, c, d] = matrix;
    const worldRotationDeg = Math.atan2(b, a) * RAD_TO_DEG;
    const worldScaleX = Math.hypot(a, b);
    const worldScaleY = Math.hypot(c, d);

    out[bone.id] = {
      boneId: bone.id,
      matrix,
      head,
      tail,
      worldRotationDeg,
      worldScaleX,
      worldScaleY,
      localRotationDeg: localRot,
    };
  }

  return out;
}

export interface BindMatrixEntry {
  readonly restWorld: WorldBoneTransform;
  readonly invBindMatrix: AffineMatrix2D;
}

/** Compute rest-pose inverse bind matrices for Linear-Blend Skinning. */
export function computeBindMatrices(rig: RigDefinition): Record<string, BindMatrixEntry> {
  const restWorlds = evaluateRigWorldTransforms(rig, {});
  const out: Record<string, BindMatrixEntry> = {};
  for (const [boneId, restWorld] of Object.entries(restWorlds)) {
    out[boneId] = {
      restWorld,
      invBindMatrix: invertAffineMatrix(restWorld.matrix),
    };
  }
  return out;
}

/** Evaluate a layer rigidly bound to a bone. */
export function evaluateRigidBoundLayer(
  binding: Extract<RigSkinBinding, { mode: "rigid" }>,
  worldTransforms: Record<string, WorldBoneTransform>,
): EvaluatedRigidLayer | null {
  const boneWorld = worldTransforms[binding.boneId];
  if (!boneWorld) return null;
  const worldPt = transformPoint(boneWorld.matrix, {
    x: binding.offsetX ?? 0,
    y: binding.offsetY ?? 0,
  });
  return {
    layerId: binding.layerId,
    x: worldPt.x,
    y: worldPt.y,
    rotationDeg: boneWorld.worldRotationDeg + (binding.offsetRotationDeg ?? 0),
    scaleX: boneWorld.worldScaleX,
    scaleY: boneWorld.worldScaleY,
  };
}

/**
 * Evaluate Linear-Blend Skinning (LBS) for a single rest-space 2D point.
 * Guarantees exact rest-pose identity when `worldTransforms` match bind pose.
 */
export function evaluateSkinnedPoint(
  restPoint: Point2D,
  weights: VertexWeightList,
  bindMatrices: Record<string, BindMatrixEntry>,
  worldTransforms: Record<string, WorldBoneTransform>,
): Point2D {
  const normalized = normalizeVertexWeights(weights);
  if (normalized.length === 0) return restPoint;

  let accumX = 0;
  let accumY = 0;
  let appliedWeight = 0;

  for (const inf of normalized) {
    const bind = bindMatrices[inf.boneId];
    const world = worldTransforms[inf.boneId];
    if (!bind || !world) continue;
    const skinMatrix = multiplyAffine(world.matrix, bind.invBindMatrix);
    const deformed = transformPoint(skinMatrix, restPoint);
    accumX += deformed.x * inf.weight;
    accumY += deformed.y * inf.weight;
    appliedWeight += inf.weight;
  }

  if (appliedWeight <= 1e-10) return restPoint;
  return {
    x: accumX / appliedWeight,
    y: accumY / appliedWeight,
  };
}
