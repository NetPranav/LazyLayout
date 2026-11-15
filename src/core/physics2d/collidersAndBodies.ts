/**
 * @file collidersAndBodies.ts
 * @module core/physics2d/collidersAndBodies
 * @description Phase 163: Collider derivation from vector/layout layers,
 * Simple physics face mapping (Weight/Bounce/Grip/Return/Gravity+direction),
 * collision layer/mask bitfield filtering, and drag-and-throw body tracking.
 */

import {
  FIXED_PHYSICS_DT,
  type BodyKind,
  type ColliderShape,
  type PhysicsBodyState,
} from "./physicsCore";

export type LayerShapeKind = "ellipse" | "rectangle" | "polygon" | "path" | "text" | "frame";

export interface LayerColliderSource {
  readonly id: string;
  readonly kind: LayerShapeKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotationDeg?: number;
  readonly bodyKind?: BodyKind;
  readonly isTrigger?: boolean;
  readonly collisionLayer?: number;
  readonly collisionMask?: number;
}

/**
 * Derive a 2D collider shape from a layer geometry:
 * ellipses map to circles (using average radius); rectangles and general
 * frames/text map to boxes centered on the layer bounds.
 */
export function deriveColliderFromLayer(layer: LayerColliderSource): ColliderShape {
  const w = Math.max(1, Math.abs(layer.width));
  const h = Math.max(1, Math.abs(layer.height));
  if (layer.kind === "ellipse") {
    return { kind: "circle", radius: Math.max(0.5, (w + h) * 0.25) };
  }
  return { kind: "box", halfWidth: w * 0.5, halfHeight: h * 0.5 };
}

/** Named collision layers for layer/mask filtering (32-bit bitmask). */
export const COLLISION_LAYER_BITS = {
  default: 1 << 0,
  ui: 1 << 1,
  props: 1 << 2,
  particles: 1 << 3,
  triggers: 1 << 4,
  bounds: 1 << 5,
} as const;

export function canLayersCollide(
  layerA: number = COLLISION_LAYER_BITS.default,
  maskA: number = 0xffffffff,
  layerB: number = COLLISION_LAYER_BITS.default,
  maskB: number = 0xffffffff
): boolean {
  return (maskA & layerB) !== 0 && (maskB & layerA) !== 0;
}

/**
 * Simple face parameters (Law 17: human words, no exposed equations).
 * Values are normalised 0..100 for Weight, Bounce, Grip, Return;
 * Gravity strength (0..2000 px/s^2) and directionDeg arrow (90 = down in canvas Y+).
 */
export interface SimplePhysicsFace {
  readonly weight: number;
  readonly bounce: number;
  readonly grip: number;
  readonly returnHome: number;
  readonly gravityStrength?: number;
  readonly gravityDirectionDeg?: number;
}

export interface MappedPhysicsParameters {
  readonly mass: number;
  readonly restitution: number;
  readonly friction: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly homeStiffness: number;
  readonly gravityX: number;
  readonly gravityY: number;
}

function clamp01Percent(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v)) / 100;
}

function cleanZero(n: number): number {
  return Math.abs(n) < 1e-12 ? 0 : n;
}

/** Convert Simple face sliders and gravity direction arrow into solver properties. */
export function mapSimplePhysicsFace(face: SimplePhysicsFace): MappedPhysicsParameters {
  const w = clamp01Percent(face.weight);
  const b = clamp01Percent(face.bounce);
  const g = clamp01Percent(face.grip);
  const r = clamp01Percent(face.returnHome);

  // Weight 0..100 -> exponential mass feel from feather (0.2) to heavy (20.0)
  const mass = cleanZero(0.2 * Math.pow(100, w));
  const restitution = cleanZero(Math.min(0.98, b * 0.96));
  const friction = cleanZero(g);
  const linearDamping = cleanZero(0.05 + g * 1.45);
  const angularDamping = cleanZero(0.08 + g * 1.6);
  const homeStiffness = cleanZero(r === 0 ? 0 : Math.pow(r, 1.5) * 48);

  const gravMag = Math.max(0, Number.isFinite(face.gravityStrength) ? (face.gravityStrength ?? 0) : 980);
  const gravRad = ((face.gravityDirectionDeg ?? 90) * Math.PI) / 180;
  const gravityX = cleanZero(Math.cos(gravRad) * gravMag);
  const gravityY = cleanZero(Math.sin(gravRad) * gravMag);

  return {
    mass,
    restitution,
    friction,
    linearDamping,
    angularDamping,
    homeStiffness,
    gravityX,
    gravityY,
  };
}

/** Build a `PhysicsBodyState` from a layer + Simple face + optional home anchor. */
export function createBodyFromLayer(
  layer: LayerColliderSource,
  face: SimplePhysicsFace,
  options?: {
    readonly homeX?: number;
    readonly homeY?: number;
    readonly vx?: number;
    readonly vy?: number;
  }
): PhysicsBodyState {
  const params = mapSimplePhysicsFace(face);
  const shape = deriveColliderFromLayer(layer);
  const cx = layer.x + layer.width * 0.5;
  const cy = layer.y + layer.height * 0.5;

  return {
    id: layer.id,
    kind: layer.bodyKind ?? "dynamic",
    shape,
    x: cleanZero(cx),
    y: cleanZero(cy),
    vx: cleanZero(options?.vx ?? 0),
    vy: cleanZero(options?.vy ?? 0),
    angleRad: cleanZero(((layer.rotationDeg ?? 0) * Math.PI) / 180),
    angularVel: 0,
    mass: layer.bodyKind === "static" ? 0 : params.mass,
    restitution: params.restitution,
    friction: params.friction,
    linearDamping: params.linearDamping,
    angularDamping: params.angularDamping,
    isTrigger: layer.isTrigger ?? false,
    collisionLayer: layer.collisionLayer ?? COLLISION_LAYER_BITS.default,
    collisionMask: layer.collisionMask ?? 0xffffffff,
    homeX: options?.homeX ?? (params.homeStiffness > 0 ? cleanZero(cx) : undefined),
    homeY: options?.homeY ?? (params.homeStiffness > 0 ? cleanZero(cy) : undefined),
    homeStiffness: params.homeStiffness,
  };
}

export interface DragThrowSample {
  readonly timeSec: number;
  readonly x: number;
  readonly y: number;
}

export interface DraggableBodySession {
  readonly bodyId: string;
  readonly originalKind: BodyKind;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly samples: readonly DragThrowSample[];
}

export interface DraggableBodyController {
  beginDrag(body: PhysicsBodyState, pointerX: number, pointerY: number, timeSec: number): PhysicsBodyState;
  moveDrag(
    body: PhysicsBodyState,
    pointerX: number,
    pointerY: number,
    timeSec: number
  ): PhysicsBodyState;
  endDrag(body: PhysicsBodyState, timeSec: number): PhysicsBodyState;
  isDragging(bodyId: string): boolean;
  getSession(bodyId: string): DraggableBodySession | undefined;
}

/**
 * Controller for draggable bodies: switches body to `kinematic` while dragged,
 * records a short ring buffer of recent pointer samples, and imparts throw velocity
 * when released back into `dynamic` (or original) simulation.
 */
export function createDraggableBodyController(options?: {
  readonly maxThrowSpeedPxPerSec?: number;
  readonly sampleWindowSec?: number;
}): DraggableBodyController {
  const maxSpeed = options?.maxThrowSpeedPxPerSec ?? 2400;
  const windowSec = options?.sampleWindowSec ?? 0.08;
  const sessions = new Map<string, DraggableBodySession>();

  return {
    beginDrag(body, pointerX, pointerY, timeSec): PhysicsBodyState {
      const originalKind: BodyKind = body.kind === "static" ? "static" : "dynamic";
      const offsetX = body.x - pointerX;
      const offsetY = body.y - pointerY;
      sessions.set(body.id, {
        bodyId: body.id,
        originalKind: body.kind === "kinematic" ? originalKind : body.kind,
        offsetX,
        offsetY,
        samples: [{ timeSec, x: pointerX + offsetX, y: pointerY + offsetY }],
      });
      return {
        ...body,
        kind: "kinematic",
        vx: 0,
        vy: 0,
        angularVel: 0,
      };
    },

    moveDrag(body, pointerX, pointerY, timeSec): PhysicsBodyState {
      const session = sessions.get(body.id);
      if (!session) return body;
      const nextX = cleanZero(pointerX + session.offsetX);
      const nextY = cleanZero(pointerY + session.offsetY);
      const nextSamples = [...session.samples, { timeSec, x: nextX, y: nextY }].filter(
        (s) => timeSec - s.timeSec <= windowSec
      );
      const prev = session.samples[session.samples.length - 1];
      const dt = prev ? Math.max(FIXED_PHYSICS_DT, timeSec - prev.timeSec) : FIXED_PHYSICS_DT;
      const instVx = prev ? (nextX - prev.x) / dt : 0;
      const instVy = prev ? (nextY - prev.y) / dt : 0;

      sessions.set(body.id, {
        ...session,
        samples: nextSamples.length > 0 ? nextSamples : [{ timeSec, x: nextX, y: nextY }],
      });

      return {
        ...body,
        kind: "kinematic",
        x: nextX,
        y: nextY,
        vx: cleanZero(instVx),
        vy: cleanZero(instVy),
      };
    },

    endDrag(body, timeSec): PhysicsBodyState {
      const session = sessions.get(body.id);
      if (!session) return body;
      sessions.delete(body.id);

      const recent = session.samples.filter((s) => timeSec - s.timeSec <= windowSec);
      const list = recent.length >= 2 ? recent : session.samples;
      let vx = 0;
      let vy = 0;
      if (list.length >= 2) {
        const first = list[0]!;
        const last = list[list.length - 1]!;
        const dt = last.timeSec - first.timeSec;
        if (dt > 1e-5) {
          vx = (last.x - first.x) / dt;
          vy = (last.y - first.y) / dt;
          const speed = Math.hypot(vx, vy);
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            vx *= scale;
            vy *= scale;
          }
        }
      }

      return {
        ...body,
        kind: session.originalKind === "static" ? "static" : "dynamic",
        vx: session.originalKind === "static" ? 0 : cleanZero(vx),
        vy: session.originalKind === "static" ? 0 : cleanZero(vy),
      };
    },

    isDragging(bodyId): boolean {
      return sessions.has(bodyId);
    },

    getSession(bodyId): DraggableBodySession | undefined {
      return sessions.get(bodyId);
    },
  };
}
