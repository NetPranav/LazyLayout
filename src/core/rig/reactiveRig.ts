/**
 * ============================================================================
 * STAGE 5 · PHASE 210 — RIGS THAT REACT
 * ============================================================================
 * Simple face ("Follow the cursor with: eyes · head · whole body") and full
 * input bindings for IK targets, look-at targets, scroll-speed torso lean,
 * arrow-key locomotion walk, and click reactions.
 * ============================================================================
 */

import { type RigDefinition, type RigPoseMap } from "./rigModel";
import { evaluateBoneConstraints, type BoneConstraint } from "./constraintsAndJiggle";
import { solveTwoBoneIk } from "./ikSolver";

export type FollowCursorScope = "eyes" | "head" | "whole-body";

export interface ReactiveRigConfig {
  readonly followCursorScope: FollowCursorScope;
  readonly rigOriginX: number;
  readonly rigOriginY: number;
  readonly sensitivity?: number;
  readonly eyeLeftBoneId?: string;
  readonly eyeRightBoneId?: string;
  readonly headBoneId?: string;
  readonly neckBoneId?: string;
  readonly spineBoneId?: string;
  readonly handIkBoneIds?: readonly [string, string];
  readonly walkLegLeftId?: string;
  readonly walkLegRightId?: string;
  readonly scrollLeanStrength?: number;
  readonly walkSpeedPxPerSec?: number;
}

export interface ReactiveRigInputFrame {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly scrollVelocity?: number;
  readonly keysPressed?: readonly string[];
  readonly clicked?: boolean;
  readonly dtSec: number;
}

export interface ReactiveRigRuntimeState {
  readonly worldOffsetX: number;
  readonly walkPhaseRad: number;
  readonly clickPulse: number;
  readonly pose: RigPoseMap;
}

export function createReactiveRigState(): ReactiveRigRuntimeState {
  return {
    worldOffsetX: 0,
    walkPhaseRad: 0,
    clickPulse: 0,
    pose: {},
  };
}

/** Step one deterministic frame of reactive rig evaluation. */
export function evaluateReactiveRigFrame(
  rig: RigDefinition,
  state: ReactiveRigRuntimeState,
  config: ReactiveRigConfig,
  input: ReactiveRigInputFrame,
): ReactiveRigRuntimeState {
  const dt = Math.max(0, Math.min(0.1, input.dtSec));
  const keys = new Set(input.keysPressed ?? []);
  const walkDir =
    (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
    (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);

  const speed = config.walkSpeedPxPerSec ?? 160;
  const nextWorldOffsetX = state.worldOffsetX + walkDir * speed * dt;
  const nextWalkPhase =
    walkDir !== 0 ? state.walkPhaseRad + walkDir * 9.5 * dt : state.walkPhaseRad * Math.exp(-8 * dt);
  const nextClickPulse = input.clicked
    ? 1
    : Math.max(0, state.clickPulse - 3.5 * dt);

  let pose: RigPoseMap = {};
  const originX = config.rigOriginX + nextWorldOffsetX;
  const originY = config.rigOriginY;
  const sens = config.sensitivity ?? 1;
  const relTargetX = originX + (input.pointerX - originX) * sens;
  const relTargetY = originY + (input.pointerY - originY) * sens;

  const constraints: BoneConstraint[] = [];

  if (config.eyeLeftBoneId) {
    constraints.push({
      id: "rx_eye_l",
      kind: "lookAt",
      boneId: config.eyeLeftBoneId,
      targetX: relTargetX,
      targetY: relTargetY,
      minDeg: -28,
      maxDeg: 28,
    });
  }
  if (config.eyeRightBoneId) {
    constraints.push({
      id: "rx_eye_r",
      kind: "lookAt",
      boneId: config.eyeRightBoneId,
      targetX: relTargetX,
      targetY: relTargetY,
      minDeg: -28,
      maxDeg: 28,
    });
  }

  if (config.followCursorScope === "head" || config.followCursorScope === "whole-body") {
    if (config.neckBoneId) {
      constraints.push({
        id: "rx_neck",
        kind: "lookAt",
        boneId: config.neckBoneId,
        targetX: relTargetX,
        targetY: relTargetY,
        minDeg: -22,
        maxDeg: 22,
        smoothing: 0.25,
      });
    }
    if (config.headBoneId) {
      constraints.push({
        id: "rx_head",
        kind: "lookAt",
        boneId: config.headBoneId,
        targetX: relTargetX,
        targetY: relTargetY,
        minDeg: -38,
        maxDeg: 38,
        smoothing: 0.15,
      });
    }
  }

  if (config.spineBoneId) {
    const scrollLean = Math.max(
      -20,
      Math.min(20, (input.scrollVelocity ?? 0) * (config.scrollLeanStrength ?? 0.03)),
    );
    const bodyFollowTilt =
      config.followCursorScope === "whole-body"
        ? Math.max(-12, Math.min(12, ((input.pointerX - originX) / 240) * 12))
        : 0;
    pose[config.spineBoneId] = {
      rotationDeg: scrollLean + bodyFollowTilt - nextClickPulse * 8,
    };
  }

  if (config.walkLegLeftId && config.walkLegRightId) {
    const stride = walkDir !== 0 ? Math.sin(nextWalkPhase) * 28 : 0;
    pose[config.walkLegLeftId] = { rotationDeg: stride };
    pose[config.walkLegRightId] = { rotationDeg: -stride };
  }

  pose = evaluateBoneConstraints(rig, pose, constraints, state.pose);

  if (config.followCursorScope === "whole-body" && config.handIkBoneIds) {
    pose = solveTwoBoneIk(
      rig,
      {
        id: "rx_hand_reach",
        boneIds: config.handIkBoneIds,
        target: { x: relTargetX, y: relTargetY - nextClickPulse * 24 },
        fkIkBlend: 0.65,
      },
      pose,
    );
  }

  return {
    worldOffsetX: nextWorldOffsetX,
    walkPhaseRad: nextWalkPhase,
    clickPulse: nextClickPulse,
    pose,
  };
}

/** Run a scripted tape through a reactive rig configuration. */
export function runReactiveRigTape(
  rig: RigDefinition,
  config: ReactiveRigConfig,
  tape: readonly ReactiveRigInputFrame[],
): ReactiveRigRuntimeState[] {
  let state = createReactiveRigState();
  return tape.map((frame) => {
    state = evaluateReactiveRigFrame(rig, state, config, frame);
    return state;
  });
}
