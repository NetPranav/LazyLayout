/**
 * ============================================================================
 * STAGE 5 · PHASE 211 — CHARACTER STATES & BLEND TREES
 * ============================================================================
 * 1D & 2D animation blend trees (idle -> walk -> run, directional 2D blends),
 * bone-masked layered state composition (e.g. wave upper body while legs walk),
 * and smooth crossfaded state machine transitions.
 * ============================================================================
 */

import { type PoseBoneTransform, type RigPoseMap } from "./rigModel";
import { blendBonePoses, copyPoseSnapshot, lerpAngleShortestDeg } from "./boneTimeline";

export type CharacterStateId = "idle" | "walk" | "run" | "jump" | "wave";

export interface BlendTree1DNode {
  readonly threshold: number;
  readonly pose: RigPoseMap;
}

export interface BlendTree2DNode {
  readonly x: number;
  readonly y: number;
  readonly pose: RigPoseMap;
}

export interface CharacterStateDefinition {
  readonly id: CharacterStateId;
  readonly evaluateAtPhase: (phaseRad: number) => RigPoseMap;
}

export interface CharacterStateMachineConfig {
  readonly crossfadeSec: number;
  readonly states: Record<CharacterStateId, CharacterStateDefinition>;
  readonly upperBodyMaskBoneIds: readonly string[];
}

export interface CharacterStateInputFrame {
  readonly dtSec: number;
  readonly speed: number; // 0 = idle, 0.5 = walk, 1.0 = run
  readonly dirX?: number;
  readonly jumpPressed?: boolean;
  readonly waveActive?: boolean;
}

export interface CharacterStateSnapshot {
  readonly activeState: CharacterStateId;
  readonly previousState: CharacterStateId | null;
  readonly crossfadeAlpha: number;
  readonly cyclePhaseRad: number;
  readonly waveLayerWeight: number;
  readonly pose: RigPoseMap;
}

/** Blend poses along a 1D scalar parameter (e.g. speed 0..1). */
export function sampleBlendTree1D(
  nodes: readonly BlendTree1DNode[],
  parameter: number,
): RigPoseMap {
  if (nodes.length === 0) return {};
  const sorted = [...nodes].sort((a, b) => a.threshold - b.threshold);
  if (parameter <= sorted[0].threshold) return copyPoseSnapshot(sorted[0].pose);
  const last = sorted[sorted.length - 1];
  if (parameter >= last.threshold) return copyPoseSnapshot(last.pose);

  for (let i = 1; i < sorted.length; i++) {
    const n0 = sorted[i - 1];
    const n1 = sorted[i];
    if (parameter <= n1.threshold) {
      const span = n1.threshold - n0.threshold;
      const t = span <= 1e-8 ? 1 : (parameter - n0.threshold) / span;
      return blendBonePoses(n0.pose, n1.pose, t);
    }
  }
  return copyPoseSnapshot(last.pose);
}

/** Blend poses in 2D parameter space (e.g. strafe X, forward speed Y). */
export function sampleBlendTree2D(
  nodes: readonly BlendTree2DNode[],
  paramX: number,
  paramY: number,
): RigPoseMap {
  if (nodes.length === 0) return {};
  if (nodes.length === 1) return copyPoseSnapshot(nodes[0].pose);

  const weights = nodes.map((n) => {
    const dSq = (paramX - n.x) ** 2 + (paramY - n.y) ** 2;
    return 1 / (dSq + 1e-4);
  });
  const totalW = weights.reduce((s, w) => s + w, 0);

  const boneIds = new Set<string>();
  for (const n of nodes) {
    for (const id of Object.keys(n.pose)) boneIds.add(id);
  }

  const out: RigPoseMap = {};
  for (const boneId of boneIds) {
    let dx = 0;
    let dy = 0;
    let sinSum = 0;
    let cosSum = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < nodes.length; i++) {
      const w = weights[i] / totalW;
      const p = nodes[i].pose[boneId] ?? {};
      dx += (p.dx ?? 0) * w;
      dy += (p.dy ?? 0) * w;
      const rad = ((p.rotationDeg ?? 0) * Math.PI) / 180;
      sinSum += Math.sin(rad) * w;
      cosSum += Math.cos(rad) * w;
      sx += (p.scaleX ?? 1) * w;
      sy += (p.scaleY ?? 1) * w;
    }
    const xf: PoseBoneTransform = {
      dx,
      dy,
      rotationDeg: (Math.atan2(sinSum, cosSum) * 180) / Math.PI,
      scaleX: sx,
      scaleY: sy,
    };
    out[boneId] = xf;
  }
  return out;
}

/** Layer an overlay pose (such as waving arms) over only `maskedBoneIds`. */
export function blendPoseWithMask(
  basePose: RigPoseMap,
  overlayPose: RigPoseMap,
  maskedBoneIds: readonly string[],
  weight: number,
): RigPoseMap {
  const w = Math.max(0, Math.min(1, weight));
  const out = copyPoseSnapshot(basePose);
  if (w <= 0) return out;

  for (const boneId of maskedBoneIds) {
    const base = out[boneId] ?? {};
    const over = overlayPose[boneId] ?? {};
    out[boneId] = {
      dx: (base.dx ?? 0) + ((over.dx ?? 0) - (base.dx ?? 0)) * w,
      dy: (base.dy ?? 0) + ((over.dy ?? 0) - (base.dy ?? 0)) * w,
      rotationDeg: lerpAngleShortestDeg(base.rotationDeg ?? 0, over.rotationDeg ?? 0, w),
      scaleX: (base.scaleX ?? 1) + ((over.scaleX ?? 1) - (base.scaleX ?? 1)) * w,
      scaleY: (base.scaleY ?? 1) + ((over.scaleY ?? 1) - (base.scaleY ?? 1)) * w,
    };
  }
  return out;
}

/** Build a ready 5-state locomotion + wave character state machine. */
export function createStandardLocomotionMachine(crossfadeSec = 0.2): CharacterStateMachineConfig {
  return {
    crossfadeSec,
    upperBodyMaskBoneIds: ["arm_u", "arm_l"],
    states: {
      idle: {
        id: "idle",
        evaluateAtPhase: (phase) => ({
          spine: { rotationDeg: Math.sin(phase) * 2 },
          leg_l: { rotationDeg: 0 },
          leg_r: { rotationDeg: 0 },
          arm_u: { rotationDeg: 5 },
          arm_l: { rotationDeg: 0 },
        }),
      },
      walk: {
        id: "walk",
        evaluateAtPhase: (phase) => ({
          spine: { rotationDeg: 6 },
          leg_l: { rotationDeg: Math.sin(phase) * 26 },
          leg_r: { rotationDeg: -Math.sin(phase) * 26 },
          arm_u: { rotationDeg: -Math.sin(phase) * 18 },
          arm_l: { rotationDeg: -10 },
        }),
      },
      run: {
        id: "run",
        evaluateAtPhase: (phase) => ({
          spine: { rotationDeg: 16 },
          leg_l: { rotationDeg: Math.sin(phase) * 48 },
          leg_r: { rotationDeg: -Math.sin(phase) * 48 },
          arm_u: { rotationDeg: -Math.sin(phase) * 40 },
          arm_l: { rotationDeg: -35 },
        }),
      },
      jump: {
        id: "jump",
        evaluateAtPhase: () => ({
          spine: { dy: -28, rotationDeg: -6 },
          leg_l: { rotationDeg: -22 },
          leg_r: { rotationDeg: 28 },
          arm_u: { rotationDeg: -115 },
          arm_l: { rotationDeg: -20 },
        }),
      },
      wave: {
        id: "wave",
        evaluateAtPhase: (phase) => ({
          arm_u: { rotationDeg: -125 },
          arm_l: { rotationDeg: Math.sin(phase * 1.8) * 32 },
        }),
      },
    },
  };
}

/** Step a 5-state character state machine across an input tape. */
export function evaluateCharacterStateMachineTape(
  machine: CharacterStateMachineConfig,
  tape: readonly CharacterStateInputFrame[],
): CharacterStateSnapshot[] {
  let activeState: CharacterStateId = "idle";
  let previousState: CharacterStateId | null = null;
  let crossfadeAlpha = 1;
  let cyclePhaseRad = 0;
  let waveLayerWeight = 0;

  return tape.map((frame) => {
    const dt = Math.max(0, Math.min(0.1, frame.dtSec));
    const speed = Math.max(0, Math.min(1, frame.speed));
    const desired: CharacterStateId = frame.jumpPressed
      ? "jump"
      : speed >= 0.7
        ? "run"
        : speed >= 0.15
          ? "walk"
          : "idle";

    if (desired !== activeState) {
      previousState = activeState;
      activeState = desired;
      crossfadeAlpha = 0;
    }

    const fadeStep = machine.crossfadeSec > 1e-4 ? dt / machine.crossfadeSec : 1;
    crossfadeAlpha = Math.min(1, crossfadeAlpha + fadeStep);

    const freq = desired === "run" ? 12 : desired === "walk" ? 7.5 : 3;
    cyclePhaseRad += freq * dt * (frame.dirX && frame.dirX < 0 ? -1 : 1);

    const waveTarget = frame.waveActive ? 1 : 0;
    waveLayerWeight += (waveTarget - waveLayerWeight) * Math.min(1, dt * 10);

    // Build locomotion pose via 1D blend when walking/running or via active state + crossfade
    const idlePose = machine.states.idle.evaluateAtPhase(cyclePhaseRad);
    const walkPose = machine.states.walk.evaluateAtPhase(cyclePhaseRad);
    const runPose = machine.states.run.evaluateAtPhase(cyclePhaseRad);

    const locoPose =
      desired === "jump"
        ? machine.states.jump.evaluateAtPhase(cyclePhaseRad)
        : sampleBlendTree1D(
            [
              { threshold: 0, pose: idlePose },
              { threshold: 0.5, pose: walkPose },
              { threshold: 1, pose: runPose },
            ],
            speed,
          );

    let finalPose = locoPose;
    if (previousState && crossfadeAlpha < 1) {
      const prevPose = machine.states[previousState].evaluateAtPhase(cyclePhaseRad);
      finalPose = blendBonePoses(prevPose, locoPose, crossfadeAlpha);
    }

    if (waveLayerWeight > 1e-3) {
      const wavePose = machine.states.wave.evaluateAtPhase(cyclePhaseRad);
      finalPose = blendPoseWithMask(
        finalPose,
        wavePose,
        machine.upperBodyMaskBoneIds,
        waveLayerWeight,
      );
    }

    return {
      activeState,
      previousState,
      crossfadeAlpha,
      cyclePhaseRad,
      waveLayerWeight,
      pose: finalPose,
    };
  });
}
