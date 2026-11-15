/**
 * ============================================================================
 * STAGE 5 · PHASE 207 — INVERSE KINEMATICS (2-BONE + FABRIK + LIMITS)
 * ============================================================================
 * Analytical Law-of-Cosines two-bone IK and clamped FABRIK multi-bone IK
 * with bend direction flip, stretch toggle, strict per-bone angle limits,
 * and smooth FK/IK blending.
 * ============================================================================
 */

import {
  type Point2D,
  type RigDefinition,
  type RigPoseMap,
  evaluateRigWorldTransforms,
} from "./rigModel";
import { lerpAngleShortestDeg } from "./boneTimeline";

export interface BoneAngleLimit {
  readonly minDeg: number;
  readonly maxDeg: number;
}

export interface IkChainConfig {
  readonly id: string;
  readonly boneIds: readonly string[];
  readonly target: Point2D;
  readonly bendDirection?: 1 | -1;
  readonly allowStretch?: boolean;
  readonly maxStretch?: number;
  readonly fkIkBlend?: number;
  readonly limits?: Record<string, BoneAngleLimit>;
}

const RAD_TO_DEG = 180 / Math.PI;

export function normalizeSignedDeg(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180 && deg > 0) d = 180;
  return d;
}

function clampAngleLimit(deg: number, limit?: BoneAngleLimit): number {
  const norm = normalizeSignedDeg(deg);
  if (!limit) return norm;
  return Math.max(limit.minDeg, Math.min(limit.maxDeg, norm));
}

/**
 * Exact analytical Law-of-Cosines two-bone IK solver with bend direction,
 * optional stretch, angle limits, and FK/IK blend.
 */
export function solveTwoBoneIk(
  rig: RigDefinition,
  chain: IkChainConfig,
  basePose: RigPoseMap = {},
): RigPoseMap {
  if (chain.boneIds.length < 2) return { ...basePose };
  const [upperId, lowerId] = chain.boneIds;
  const upper = rig.bones.find((b) => b.id === upperId);
  const lower = rig.bones.find((b) => b.id === lowerId);
  if (!upper || !lower) return { ...basePose };

  const blend = Math.max(0, Math.min(1, chain.fkIkBlend ?? 1));
  if (blend <= 0) return { ...basePose };

  const baseWorld = evaluateRigWorldTransforms(rig, basePose);
  const upperWorld = baseWorld[upperId];
  const lowerWorld = baseWorld[lowerId];
  if (!upperWorld || !lowerWorld) return { ...basePose };

  const parentWorldRot =
    upper.parentId !== null && baseWorld[upper.parentId]
      ? baseWorld[upper.parentId].worldRotationDeg
      : 0;

  const rootPos = upperWorld.head;
  const L1Base = Math.max(1e-3, upper.length * upperWorld.worldScaleX);
  const L2Base = Math.max(1e-3, lower.length * lowerWorld.worldScaleX);

  const dx = chain.target.x - rootPos.x;
  const dy = chain.target.y - rootPos.y;
  const rawDist = Math.hypot(dx, dy);

  let stretchScale = 1;
  if (chain.allowStretch && rawDist > L1Base + L2Base) {
    const maxS = Math.max(1, chain.maxStretch ?? 1.5);
    stretchScale = Math.min(maxS, rawDist / (L1Base + L2Base));
  }
  const L1 = L1Base * stretchScale;
  const L2 = L2Base * stretchScale;

  const minReach = Math.abs(L1 - L2) + 1e-3;
  const maxReach = L1 + L2 - 1e-4;
  const r = Math.max(minReach, Math.min(maxReach, rawDist));

  const targetAngle = Math.atan2(dy, dx);
  const cosAlpha = Math.max(-1, Math.min(1, (r * r + L1 * L1 - L2 * L2) / (2 * r * L1)));
  const cosBeta = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2)));

  const alpha = Math.acos(cosAlpha);
  const beta = Math.acos(cosBeta);
  const bend: 1 | -1 = chain.bendDirection ?? 1;

  const worldUpperDeg = (targetAngle - bend * alpha) * RAD_TO_DEG;
  const desiredLowerLocalDeg = bend * (180 - beta * RAD_TO_DEG);

  const rawUpperPoseDeg = worldUpperDeg - parentWorldRot - upper.restRotationDeg;
  const upperLimit = chain.limits?.[upperId];
  const clampedUpperPoseDeg = clampAngleLimit(rawUpperPoseDeg, upperLimit);

  // If upper hit a limit, re-aim lower bone toward target from the clamped elbow
  let rawLowerPoseDeg = desiredLowerLocalDeg - lower.restRotationDeg;
  if (upperLimit && Math.abs(normalizeSignedDeg(rawUpperPoseDeg) - clampedUpperPoseDeg) > 1e-3) {
    const clampedUpperWorldDeg = parentWorldRot + upper.restRotationDeg + clampedUpperPoseDeg;
    const rad = (clampedUpperWorldDeg * Math.PI) / 180;
    const elbow = {
      x: rootPos.x + L1 * Math.cos(rad),
      y: rootPos.y + L1 * Math.sin(rad),
    };
    const aimWorldDeg = Math.atan2(chain.target.y - elbow.y, chain.target.x - elbow.x) * RAD_TO_DEG;
    rawLowerPoseDeg = aimWorldDeg - clampedUpperWorldDeg - lower.restRotationDeg;
  }

  const lowerLimit = chain.limits?.[lowerId];
  const clampedLowerPoseDeg = clampAngleLimit(rawLowerPoseDeg, lowerLimit);

  const fkUpper = basePose[upperId]?.rotationDeg ?? 0;
  const fkLower = basePose[lowerId]?.rotationDeg ?? 0;

  const finalUpperDeg = clampAngleLimit(
    lerpAngleShortestDeg(fkUpper, clampedUpperPoseDeg, blend),
    upperLimit,
  );
  const finalLowerDeg = clampAngleLimit(
    lerpAngleShortestDeg(fkLower, clampedLowerPoseDeg, blend),
    lowerLimit,
  );

  return {
    ...basePose,
    [upperId]: {
      ...basePose[upperId],
      rotationDeg: finalUpperDeg,
      scaleX: (basePose[upperId]?.scaleX ?? 1) * (stretchScale > 1 ? stretchScale : 1),
    },
    [lowerId]: {
      ...basePose[lowerId],
      rotationDeg: finalLowerDeg,
    },
  };
}

/**
 * Multi-bone FABRIK inverse kinematics solver supporting arbitrary chain lengths,
 * per-bone angular limits, and FK/IK blending.
 */
export function solveFabrikChain(
  rig: RigDefinition,
  chain: IkChainConfig,
  basePose: RigPoseMap = {},
  maxIterations = 24,
  tolerancePx = 0.05,
): RigPoseMap {
  if (chain.boneIds.length < 2) return { ...basePose };
  if (chain.boneIds.length === 2) return solveTwoBoneIk(rig, chain, basePose);

  const blend = Math.max(0, Math.min(1, chain.fkIkBlend ?? 1));
  if (blend <= 0) return { ...basePose };

  const baseWorld = evaluateRigWorldTransforms(rig, basePose);
  const bones = chain.boneIds.map((id) => rig.bones.find((b) => b.id === id));
  if (bones.some((b) => !b)) return { ...basePose };

  const joints: { x: number; y: number }[] = [];
  const lengths: number[] = [];

  for (let i = 0; i < chain.boneIds.length; i++) {
    const wt = baseWorld[chain.boneIds[i]];
    if (!wt) return { ...basePose };
    joints.push({ x: wt.head.x, y: wt.head.y });
    lengths.push(Math.max(1e-3, Math.hypot(wt.tail.x - wt.head.x, wt.tail.y - wt.head.y)));
  }
  const lastWt = baseWorld[chain.boneIds[chain.boneIds.length - 1]]!;
  joints.push({ x: lastWt.tail.x, y: lastWt.tail.y });

  const rootOrigin = { ...joints[0] };
  const totalLength = lengths.reduce((s, l) => s + l, 0);
  const distToTarget = Math.hypot(chain.target.x - rootOrigin.x, chain.target.y - rootOrigin.y);

  // Subtle bend bias when target is collinear so straight chains fold cleanly
  const bendDir = chain.bendDirection ?? 1;
  if (distToTarget < totalLength - 1e-2) {
    for (let i = 1; i < joints.length - 1; i++) {
      joints[i].y += bendDir * 0.5;
    }
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    if (distToTarget >= totalLength && !chain.allowStretch) {
      const ux = distToTarget > 1e-8 ? (chain.target.x - rootOrigin.x) / distToTarget : 1;
      const uy = distToTarget > 1e-8 ? (chain.target.y - rootOrigin.y) / distToTarget : 0;
      for (let i = 0; i < lengths.length; i++) {
        joints[i + 1] = {
          x: joints[i].x + ux * lengths[i],
          y: joints[i].y + uy * lengths[i],
        };
      }
      break;
    }

    // Forward pass: pull end-effector to target
    joints[joints.length - 1] = { x: chain.target.x, y: chain.target.y };
    for (let i = joints.length - 2; i >= 0; i--) {
      const dx = joints[i].x - joints[i + 1].x;
      const dy = joints[i].y - joints[i + 1].y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const lambda = lengths[i] / d;
      joints[i] = {
        x: joints[i + 1].x + dx * lambda,
        y: joints[i + 1].y + dy * lambda,
      };
    }

    // Backward pass: pin root back to origin
    joints[0] = { ...rootOrigin };
    for (let i = 0; i < lengths.length; i++) {
      const dx = joints[i + 1].x - joints[i].x;
      const dy = joints[i + 1].y - joints[i].y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const lambda = lengths[i] / d;
      joints[i + 1] = {
        x: joints[i].x + dx * lambda,
        y: joints[i].y + dy * lambda,
      };
    }

    const endErr = Math.hypot(
      joints[joints.length - 1].x - chain.target.x,
      joints[joints.length - 1].y - chain.target.y,
    );
    if (endErr <= tolerancePx) break;
  }

  // Convert solved world segments into parent-local clamped pose rotations
  const outPose: RigPoseMap = { ...basePose };
  const rootBone = bones[0]!;
  let accumWorldRot =
    rootBone.parentId !== null && baseWorld[rootBone.parentId]
      ? baseWorld[rootBone.parentId].worldRotationDeg
      : 0;

  for (let i = 0; i < chain.boneIds.length; i++) {
    const bone = bones[i]!;
    const segWorldDeg =
      Math.atan2(joints[i + 1].y - joints[i].y, joints[i + 1].x - joints[i].x) * RAD_TO_DEG;
    const rawPoseDeg = segWorldDeg - accumWorldRot - bone.restRotationDeg;
    const limit = chain.limits?.[bone.id];
    const fkDeg = basePose[bone.id]?.rotationDeg ?? 0;
    const clampedIkDeg = clampAngleLimit(rawPoseDeg, limit);
    const blendedDeg = clampAngleLimit(lerpAngleShortestDeg(fkDeg, clampedIkDeg, blend), limit);

    outPose[bone.id] = {
      ...basePose[bone.id],
      rotationDeg: blendedDeg,
    };
    accumWorldRot = accumWorldRot + bone.restRotationDeg + blendedDeg;
  }

  return outPose;
}
