/**
 * @file helpersAndFollow.ts
 * @module core/bindings/helpersAndFollow
 * @description Phase 152: Helper layers (invisible on export, live in runtime),
 * `L.position(pin)` target resolution across rotated/scaled poses, and the full
 * Follow component (target, pin, offset, Bounce/Time lag, axis, bounds, leave
 * behaviour, velocity auto-rotation, scale-by-speed, touch & reduced-motion policies).
 */

import {
  PRESET_PIN_NAMES,
  pinOnPage,
  type PageBox,
  type Pose,
  type PresetPinName,
} from "./follow";

export type FollowTarget =
  | { readonly kind: "pointer" }
  | { readonly kind: "layerPin"; readonly layerId: string; readonly pin: PresetPinName };

export type FollowLeaveBehaviour = "stay" | "returnHome" | "coast";
export type FollowTouchPolicy = "follow" | "dragOnly" | "ignore";
export type FollowReducedMotionPolicy = "snap" | "damped" | "off";

export interface HelperLayerDescriptor {
  readonly id: string;
  readonly name?: string;
  readonly isHelper?: boolean;
  readonly role?: string;
}

export interface FollowScaleBySpeed {
  readonly minScale: number;
  readonly maxScale: number;
  readonly referenceSpeedPxPerSec: number;
}

export interface FollowBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface FollowComponentConfig {
  readonly id: string;
  readonly layerId: string;
  readonly homeBox: PageBox;
  readonly target: FollowTarget;
  /** Which of the 9 pins on the follower layer tracks the target. */
  readonly pin: PresetPinName;
  readonly offsetX?: number;
  readonly offsetY?: number;
  /** Simple face: perceptual spring Bounce in [0, 0.9] and Time in seconds (>= 0). */
  readonly bounce?: number;
  readonly timeSec?: number;
  readonly axis?: "both" | "x" | "y";
  readonly bounds?: FollowBounds;
  readonly leaveBehaviour?: FollowLeaveBehaviour;
  readonly autoRotate?: boolean;
  readonly rotationOffsetDeg?: number;
  readonly scaleBySpeed?: FollowScaleBySpeed;
  readonly touchPolicy?: FollowTouchPolicy;
  readonly reducedMotionPolicy?: FollowReducedMotionPolicy;
  readonly pose?: Pose;
}

export interface FollowFrameInput {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerActive: boolean;
  readonly pointerType: "mouse" | "pen" | "touch";
  readonly pointerDragging?: boolean;
  readonly reducedMotion?: boolean;
  readonly layerBoxes?: Readonly<Record<string, { readonly box: PageBox; readonly pose?: Pose }>>;
}

export interface FollowComponentState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly rotationDeg: number;
  readonly scale: number;
  /** World-space position of the follower's active pin after applying displacement. */
  readonly pinWorldX: number;
  readonly pinWorldY: number;
}

/** Returns true if a layer is marked as a non-exported runtime helper. */
export function isHelperLayer(layer: HelperLayerDescriptor): boolean {
  return layer.isHelper === true || layer.role === "helper";
}

/**
 * Strips helper layers from exported DOM output while keeping all standard layers intact.
 */
export function filterExportableLayers<T extends HelperLayerDescriptor>(layers: readonly T[]): T[] {
  return layers.filter((layer) => !isHelperLayer(layer));
}

/**
 * Evaluates `L.position(pin)` in page space for any of the 9 preset pins
 * under the layer's current rotation and scale pose.
 */
export function evaluateLayerPinTarget(
  box: PageBox,
  pin: PresetPinName,
  pose: Pose = {},
): readonly [number, number] {
  return pinOnPage(box, pin, pose);
}

/**
 * Simple face descriptor for the 9 clickable pin dots + Bounce / Time spring sliders.
 */
export function getFollowSimpleFaceSpec(): {
  readonly pins: readonly PresetPinName[];
  readonly bounceRange: readonly [number, number];
  readonly timeRangeSec: readonly [number, number];
} {
  return {
    pins: PRESET_PIN_NAMES,
    bounceRange: [0, 0.85],
    timeRangeSec: [0.05, 1.5],
  };
}

function clampValue(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Steps the Follow component one frame with perceptual Bounce/Time spring dynamics,
 * axis locking, bounds clamping, leave behaviour, auto-rotation, scale-by-speed,
 * touch policy, and `prefers-reduced-motion` policy.
 */
export function stepFollowComponent(
  config: FollowComponentConfig,
  state: FollowComponentState | null,
  input: FollowFrameInput,
  dtSec: number,
): FollowComponentState {
  const dt = Math.max(1 / 240, Math.min(0.1, Number.isFinite(dtSec) ? dtSec : 1 / 60));
  const pose = config.pose ?? {};
  const [basePinX, basePinY] = pinOnPage(config.homeBox, config.pin, pose);

  const curX = state ? state.x : 0;
  const curY = state ? state.y : 0;
  let vx = state ? state.vx : 0;
  let vy = state ? state.vy : 0;
  let rotationDeg = state ? state.rotationDeg : 0;

  // Touch policy check
  if (input.pointerType === "touch") {
    const touchPolicy = config.touchPolicy ?? "follow";
    if (touchPolicy === "ignore" || (touchPolicy === "dragOnly" && !input.pointerDragging)) {
      const staticPinX = basePinX + curX;
      const staticPinY = basePinY + curY;
      return {
        x: curX,
        y: curY,
        vx: 0,
        vy: 0,
        rotationDeg,
        scale: 1,
        pinWorldX: staticPinX,
        pinWorldY: staticPinY,
      };
    }
  }

  // Reduced motion policy check
  const reducedPolicy = config.reducedMotionPolicy ?? "damped";
  if (input.reducedMotion && reducedPolicy === "off") {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rotationDeg: 0,
      scale: 1,
      pinWorldX: basePinX,
      pinWorldY: basePinY,
    };
  }

  // Resolve desired target point in page space
  let desiredTargetX = basePinX + curX;
  let desiredTargetY = basePinY + curY;

  if (config.target.kind === "layerPin") {
    const ref = input.layerBoxes?.[config.target.layerId];
    if (ref) {
      const [tx, ty] = pinOnPage(ref.box, config.target.pin, ref.pose ?? {});
      desiredTargetX = tx + (config.offsetX ?? 0);
      desiredTargetY = ty + (config.offsetY ?? 0);
    }
  } else if (input.pointerActive) {
    desiredTargetX = input.pointerX + (config.offsetX ?? 0);
    desiredTargetY = input.pointerY + (config.offsetY ?? 0);
  } else {
    const leave = config.leaveBehaviour ?? "stay";
    if (leave === "returnHome") {
      desiredTargetX = basePinX;
      desiredTargetY = basePinY;
    } else if (leave === "coast") {
      const decay = Math.exp(-5 * dt);
      const coastX = curX + vx * dt;
      const coastY = curY + vy * dt;
      vx *= decay;
      vy *= decay;
      return {
        x: config.axis === "y" ? 0 : coastX,
        y: config.axis === "x" ? 0 : coastY,
        vx,
        vy,
        rotationDeg,
        scale: 1,
        pinWorldX: basePinX + (config.axis === "y" ? 0 : coastX),
        pinWorldY: basePinY + (config.axis === "x" ? 0 : coastY),
      };
    } else {
      // "stay": keep current offset
      desiredTargetX = basePinX + curX;
      desiredTargetY = basePinY + curY;
    }
  }

  let goalX = desiredTargetX - basePinX;
  let goalY = desiredTargetY - basePinY;

  if (config.axis === "x") goalY = 0;
  if (config.axis === "y") goalX = 0;

  if (config.bounds) {
    goalX = clampValue(goalX, config.bounds.minX, config.bounds.maxX);
    goalY = clampValue(goalY, config.bounds.minY, config.bounds.maxY);
  }

  let nextX = curX;
  let nextY = curY;
  const timeSec = Math.max(0, config.timeSec ?? 0.25);
  const bounce = clampValue(config.bounce ?? 0.2, 0, 0.85);

  if (timeSec <= 1e-4 || (input.reducedMotion && reducedPolicy === "snap")) {
    vx = (goalX - curX) / dt;
    vy = (goalY - curY) / dt;
    nextX = goalX;
    nextY = goalY;
  } else {
    // Perceptual spring: stiffness & damping from (timeSec, bounce)
    const effectiveTime = input.reducedMotion && reducedPolicy === "damped" ? timeSec * 1.6 : timeSec;
    const effectiveBounce = input.reducedMotion && reducedPolicy === "damped" ? 0 : bounce;
    const omega = (2 * Math.PI) / Math.max(0.04, effectiveTime);
    const zeta = Math.max(0.12, 1 - effectiveBounce);

    const subSteps = 2;
    const h = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      const ax = (goalX - nextX) * (omega * omega) - 2 * zeta * omega * vx;
      const ay = (goalY - nextY) * (omega * omega) - 2 * zeta * omega * vy;
      vx += ax * h;
      vy += ay * h;
      nextX += vx * h;
      nextY += vy * h;
    }
  }

  if (config.axis === "x") {
    nextY = 0;
    vy = 0;
  }
  if (config.axis === "y") {
    nextX = 0;
    vx = 0;
  }

  const speed = Math.hypot(vx, vy);
  if (config.autoRotate && speed > 5) {
    rotationDeg = (Math.atan2(vy, vx) * 180) / Math.PI + (config.rotationOffsetDeg ?? 0);
  } else if (!config.autoRotate && config.rotationOffsetDeg !== undefined) {
    rotationDeg = config.rotationOffsetDeg;
  }

  let scale = 1;
  if (config.scaleBySpeed) {
    const ratio = clampValue(speed / Math.max(1, config.scaleBySpeed.referenceSpeedPxPerSec), 0, 1);
    scale = config.scaleBySpeed.minScale + (config.scaleBySpeed.maxScale - config.scaleBySpeed.minScale) * ratio;
  }

  return {
    x: nextX,
    y: nextY,
    vx,
    vy,
    rotationDeg,
    scale,
    pinWorldX: basePinX + nextX,
    pinWorldY: basePinY + nextY,
  };
}
