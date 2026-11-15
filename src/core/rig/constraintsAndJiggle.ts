/**
 * ============================================================================
 * STAGE 5 · PHASE 208 — CONSTRAINTS & SECONDARY MOTION (JIGGLE)
 * ============================================================================
 * Bone constraints (lookAt, copyTransform, distance, pathFollow, rotationLimit)
 * plus deterministic fixed-step damped spring jiggle physics for ears, hair,
 * tails, and antennae.
 * ============================================================================
 */

import {
  type Point2D,
  type RigDefinition,
  type RigPoseMap,
  evaluateRigWorldTransforms,
} from "./rigModel";
import { lerpAngleShortestDeg } from "./boneTimeline";
import { normalizeSignedDeg } from "./ikSolver";

export type BoneConstraint =
  | {
      readonly id: string;
      readonly kind: "lookAt";
      readonly boneId: string;
      readonly targetX: number;
      readonly targetY: number;
      readonly minDeg?: number;
      readonly maxDeg?: number;
      readonly smoothing?: number;
    }
  | {
      readonly id: string;
      readonly kind: "copyTransform";
      readonly boneId: string;
      readonly sourceBoneId: string;
      readonly copyRotation?: boolean;
      readonly copyTranslation?: boolean;
      readonly copyScale?: boolean;
      readonly influence?: number;
      readonly invert?: boolean;
    }
  | {
      readonly id: string;
      readonly kind: "distance";
      readonly boneId: string;
      readonly anchorX: number;
      readonly anchorY: number;
      readonly distance: number;
      readonly mode?: "exact" | "max" | "min";
    }
  | {
      readonly id: string;
      readonly kind: "pathFollow";
      readonly boneId: string;
      readonly pathPoints: readonly Point2D[];
      readonly progress: number;
      readonly alignToTangent?: boolean;
    }
  | {
      readonly id: string;
      readonly kind: "rotationLimit";
      readonly boneId: string;
      readonly minDeg: number;
      readonly maxDeg: number;
    };

const RAD_TO_DEG = 180 / Math.PI;

function samplePolylineAtProgress(
  points: readonly Point2D[],
  progress: number,
): { point: Point2D; tangentDeg: number } {
  if (points.length === 0) return { point: { x: 0, y: 0 }, tangentDeg: 0 };
  if (points.length === 1) return { point: points[0], tangentDeg: 0 };

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segLengths.push(l);
    total += l;
  }
  const targetLen = Math.max(0, Math.min(1, progress)) * total;
  let accum = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const l = segLengths[i];
    if (accum + l >= targetLen || i === segLengths.length - 1) {
      const t = l > 1e-8 ? Math.max(0, Math.min(1, (targetLen - accum) / l)) : 0;
      const p0 = points[i];
      const p1 = points[i + 1];
      return {
        point: { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t },
        tangentDeg: Math.atan2(p1.y - p0.y, p1.x - p0.x) * RAD_TO_DEG,
      };
    }
    accum += l;
  }
  return { point: points[points.length - 1], tangentDeg: 0 };
}

/** Evaluate ordered list of bone constraints cleanly on top of a rig pose. */
export function evaluateBoneConstraints(
  rig: RigDefinition,
  basePose: RigPoseMap,
  constraints: readonly BoneConstraint[],
  prevPose: RigPoseMap = {},
): RigPoseMap {
  const pose: RigPoseMap = {};
  for (const [k, v] of Object.entries(basePose)) pose[k] = { ...v };

  for (const constraint of constraints) {
    const bone = rig.bones.find((b) => b.id === constraint.boneId);
    if (!bone) continue;
    const world = evaluateRigWorldTransforms(rig, pose);
    const boneWorld = world[bone.id];
    if (!boneWorld) continue;

    const parentWorldRot =
      bone.parentId !== null && world[bone.parentId]
        ? world[bone.parentId].worldRotationDeg
        : 0;

    if (constraint.kind === "lookAt") {
      const aimWorldDeg =
        Math.atan2(
          constraint.targetY - boneWorld.head.y,
          constraint.targetX - boneWorld.head.x,
        ) * RAD_TO_DEG;
      let targetPoseDeg = normalizeSignedDeg(
        aimWorldDeg - parentWorldRot - bone.restRotationDeg,
      );
      if (constraint.minDeg !== undefined) {
        targetPoseDeg = Math.max(constraint.minDeg, targetPoseDeg);
      }
      if (constraint.maxDeg !== undefined) {
        targetPoseDeg = Math.min(constraint.maxDeg, targetPoseDeg);
      }
      const prevDeg = prevPose[bone.id]?.rotationDeg ?? pose[bone.id]?.rotationDeg ?? 0;
      const smooth = Math.max(0, Math.min(0.99, constraint.smoothing ?? 0));
      const finalDeg =
        smooth > 0 ? lerpAngleShortestDeg(targetPoseDeg, prevDeg, smooth) : targetPoseDeg;
      pose[bone.id] = { ...pose[bone.id], rotationDeg: finalDeg };
    } else if (constraint.kind === "copyTransform") {
      const srcPose = pose[constraint.sourceBoneId] ?? {};
      const inf = Math.max(0, Math.min(1, constraint.influence ?? 1));
      const sign = constraint.invert ? -1 : 1;
      const cur = pose[bone.id] ?? {};
      const next = { ...cur };
      if (constraint.copyRotation ?? true) {
        const dstR = cur.rotationDeg ?? 0;
        const srcR = (srcPose.rotationDeg ?? 0) * sign;
        next.rotationDeg = lerpAngleShortestDeg(dstR, srcR, inf);
      }
      if (constraint.copyTranslation) {
        next.dx = (cur.dx ?? 0) + ((srcPose.dx ?? 0) * sign - (cur.dx ?? 0)) * inf;
        next.dy = (cur.dy ?? 0) + ((srcPose.dy ?? 0) * sign - (cur.dy ?? 0)) * inf;
      }
      if (constraint.copyScale) {
        next.scaleX = (cur.scaleX ?? 1) + ((srcPose.scaleX ?? 1) - (cur.scaleX ?? 1)) * inf;
        next.scaleY = (cur.scaleY ?? 1) + ((srcPose.scaleY ?? 1) - (cur.scaleY ?? 1)) * inf;
      }
      pose[bone.id] = next;
    } else if (constraint.kind === "distance") {
      const curDx = pose[bone.id]?.dx ?? 0;
      const curDy = pose[bone.id]?.dy ?? 0;
      const vx = boneWorld.head.x - constraint.anchorX;
      const vy = boneWorld.head.y - constraint.anchorY;
      const dist = Math.hypot(vx, vy);
      const mode = constraint.mode ?? "exact";
      const needsAdjust =
        mode === "exact"
          ? Math.abs(dist - constraint.distance) > 1e-6
          : mode === "max"
            ? dist > constraint.distance
            : dist < constraint.distance;
      if (needsAdjust) {
        const ux = dist > 1e-8 ? vx / dist : 1;
        const uy = dist > 1e-8 ? vy / dist : 0;
        const targetHeadX = constraint.anchorX + ux * constraint.distance;
        const targetHeadY = constraint.anchorY + uy * constraint.distance;
        pose[bone.id] = {
          ...pose[bone.id],
          dx: curDx + (targetHeadX - boneWorld.head.x),
          dy: curDy + (targetHeadY - boneWorld.head.y),
        };
      }
    } else if (constraint.kind === "pathFollow") {
      const sampled = samplePolylineAtProgress(constraint.pathPoints, constraint.progress);
      pose[bone.id] = {
        ...pose[bone.id],
        dx: sampled.point.x - bone.restX,
        dy: sampled.point.y - bone.restY,
        rotationDeg: constraint.alignToTangent
          ? normalizeSignedDeg(sampled.tangentDeg - parentWorldRot - bone.restRotationDeg)
          : pose[bone.id]?.rotationDeg,
      };
    } else if (constraint.kind === "rotationLimit") {
      const curR = normalizeSignedDeg(pose[bone.id]?.rotationDeg ?? 0);
      pose[bone.id] = {
        ...pose[bone.id],
        rotationDeg: Math.max(constraint.minDeg, Math.min(constraint.maxDeg, curR)),
      };
    }
  }

  return pose;
}

export interface JiggleBoneConfig {
  readonly boneId: string;
  readonly stiffness: number;
  readonly damping: number;
  readonly mass?: number;
  readonly inertiaScale?: number;
  readonly maxAngleDeg?: number;
}

export interface JiggleSimulationState {
  readonly angleDeg: number;
  readonly angularVelocityDeg: number;
}

export function createInitialJiggleState(): JiggleSimulationState {
  return { angleDeg: 0, angularVelocityDeg: 0 };
}

/**
 * Deterministic semi-implicit Euler spring solver for secondary jiggle motion.
 * Identical inputs `(config, motionTape, fixedDt)` always produce identical replay.
 */
export function stepJiggleSimulation(
  state: JiggleSimulationState,
  config: JiggleBoneConfig,
  parentAccelMag: number,
  dtSec: number,
): JiggleSimulationState {
  const dt = Math.max(0, Math.min(0.05, dtSec));
  if (dt === 0) return state;

  const mass = Math.max(0.1, config.mass ?? 1);
  const inertia = config.inertiaScale ?? 0.35;
  const maxAng = config.maxAngleDeg ?? 45;

  const springTorque = -config.stiffness * state.angleDeg;
  const dampingTorque = -config.damping * state.angularVelocityDeg;
  const externalTorque = -parentAccelMag * inertia;
  const angularAccel = (springTorque + dampingTorque + externalTorque) / mass;

  const nextVel = state.angularVelocityDeg + angularAccel * dt;
  const nextAng = Math.max(-maxAng, Math.min(maxAng, state.angleDeg + nextVel * dt));

  return {
    angleDeg: nextAng,
    angularVelocityDeg: nextVel,
  };
}

/** Deterministically replay jiggle angles over an excitation acceleration tape. */
export function replayJiggleOnTape(
  config: JiggleBoneConfig,
  excitationTape: readonly number[],
  fixedStepSec = 1 / 60,
): number[] {
  let state = createInitialJiggleState();
  return excitationTape.map((accel) => {
    state = stepJiggleSimulation(state, config, accel, fixedStepSec);
    return state.angleDeg;
  });
}
