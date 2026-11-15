/**
 * @file jointsAndRopes.ts
 * @module core/physics2d/jointsAndRopes
 * @description Phase 165: Deterministic 2D constraint joints (hinge, spring,
 * distance, rope, weld) attaching bodies to bodies, fixed world points, or
 * live cursor targets, plus rope & chain generators with snapshot parity.
 */

import {
  FIXED_PHYSICS_DT,
  createPhysicsWorld2D,
  type PhysicsBodyState,
  type PhysicsWorldConfig,
} from "./physicsCore";
import { COLLISION_LAYER_BITS } from "./collidersAndBodies";

export type JointKind = "hinge" | "spring" | "distance" | "rope" | "weld";

export type JointEndpoint =
  | { readonly kind: "body"; readonly bodyId: string; readonly localX?: number; readonly localY?: number }
  | { readonly kind: "point"; readonly x: number; readonly y: number }
  | { readonly kind: "cursor" };

export interface PhysicsJointSpec {
  readonly id: string;
  readonly kind: JointKind;
  readonly a: JointEndpoint;
  readonly b: JointEndpoint;
  /** Target rest length (distance / spring) or maximum taut length (rope). */
  readonly length?: number;
  /** Spring stiffness (N/px equivalent). */
  readonly stiffness?: number;
  /** Damping factor for spring joints (0..1). */
  readonly damping?: number;
  /** Hinge/weld relative rest angle offset in radians. */
  readonly referenceAngleRad?: number;
}

export interface JointCursorTarget {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
}

interface MutableBody {
  id: string;
  kind: "static" | "kinematic" | "dynamic";
  shape: PhysicsBodyState["shape"];
  x: number;
  y: number;
  vx: number;
  vy: number;
  angleRad: number;
  angularVel: number;
  mass: number;
  restitution: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  isTrigger?: boolean;
  collisionLayer?: number;
  collisionMask?: number;
  homeX?: number;
  homeY?: number;
  homeStiffness?: number;
}

function cleanZero(n: number): number {
  return Math.abs(n) < 1e-12 ? 0 : n;
}

function rotateLocal(localX: number, localY: number, angleRad: number): { readonly x: number; readonly y: number } {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: localX * c - localY * s,
    y: localX * s + localY * c,
  };
}

interface ResolvedEndpoint {
  readonly body: MutableBody | null;
  readonly invMass: number;
  readonly wx: number;
  readonly wy: number;
}

function resolveEndpoint(
  ep: JointEndpoint,
  byId: Map<string, MutableBody>,
  cursor: JointCursorTarget | undefined
): ResolvedEndpoint | null {
  if (ep.kind === "point") {
    return { body: null, invMass: 0, wx: ep.x, wy: ep.y };
  }
  if (ep.kind === "cursor") {
    if (!cursor?.active) return null;
    return { body: null, invMass: 0, wx: cursor.x, wy: cursor.y };
  }
  const b = byId.get(ep.bodyId);
  if (!b) return null;
  const off = rotateLocal(ep.localX ?? 0, ep.localY ?? 0, b.angleRad);
  const invMass = b.kind === "dynamic" && b.mass > 1e-6 ? 1 / b.mass : 0;
  return { body: b, invMass, wx: b.x + off.x, wy: b.y + off.y };
}

/**
 * Apply one deterministic relaxation pass of all joints against mutable bodies.
 */
export function solveJointConstraints(
  bodies: readonly PhysicsBodyState[],
  joints: readonly PhysicsJointSpec[],
  options?: {
    readonly cursor?: JointCursorTarget;
    readonly dtSec?: number;
    readonly iterations?: number;
  }
): readonly PhysicsBodyState[] {
  const dt = options?.dtSec ?? FIXED_PHYSICS_DT;
  const iterations = Math.max(1, options?.iterations ?? 6);
  const working: MutableBody[] = bodies.map((b) => ({ ...b }));
  const byId = new Map<string, MutableBody>(working.map((b) => [b.id, b]));
  const sortedJoints = [...joints].sort((a, b) => a.id.localeCompare(b.id));

  for (let iter = 0; iter < iterations; iter++) {
    for (const joint of sortedJoints) {
      const ea = resolveEndpoint(joint.a, byId, options?.cursor);
      const eb = resolveEndpoint(joint.b, byId, options?.cursor);
      if (!ea || !eb) continue;
      const invSum = ea.invMass + eb.invMass;
      if (invSum <= 1e-9) continue;

      const dx = eb.wx - ea.wx;
      const dy = eb.wy - ea.wy;
      const dist = Math.hypot(dx, dy);

      if (joint.kind === "spring") {
        const rest = joint.length ?? 0;
        const stiffness = joint.stiffness ?? 60;
        const damping = joint.damping ?? 2;
        if (dist > 1e-7) {
          const nx = dx / dist;
          const ny = dy / dist;
          const stretch = dist - rest;
          const vax = ea.body?.vx ?? 0;
          const vay = ea.body?.vy ?? 0;
          const vbx = eb.body?.vx ?? 0;
          const vby = eb.body?.vy ?? 0;
          const relVelN = (vbx - vax) * nx + (vby - vay) * ny;
          const force = (stretch * stiffness + relVelN * damping) / iterations;
          if (ea.body && ea.invMass > 0) {
            ea.body.vx = cleanZero(ea.body.vx + nx * force * ea.invMass * dt);
            ea.body.vy = cleanZero(ea.body.vy + ny * force * ea.invMass * dt);
          }
          if (eb.body && eb.invMass > 0) {
            eb.body.vx = cleanZero(eb.body.vx - nx * force * eb.invMass * dt);
            eb.body.vy = cleanZero(eb.body.vy - ny * force * eb.invMass * dt);
          }
        }
        continue;
      }

      if (joint.kind === "hinge" || joint.kind === "distance" || joint.kind === "rope" || joint.kind === "weld") {
        const targetDist = joint.kind === "hinge" || joint.kind === "weld" ? 0 : (joint.length ?? 0);
        let error = 0;
        if (joint.kind === "rope") {
          error = dist > targetDist ? dist - targetDist : 0;
        } else {
          error = dist - targetDist;
        }
        if (Math.abs(error) > 1e-7 && dist > 1e-7) {
          const nx = dx / dist;
          const ny = dy / dist;
          const correction = error / invSum;
          if (ea.body && ea.invMass > 0) {
            const dpx = nx * correction * ea.invMass;
            const dpy = ny * correction * ea.invMass;
            ea.body.x = cleanZero(ea.body.x + dpx);
            ea.body.y = cleanZero(ea.body.y + dpy);
            ea.body.vx = cleanZero(ea.body.vx + (dpx / dt) * 0.25);
            ea.body.vy = cleanZero(ea.body.vy + (dpy / dt) * 0.25);
          }
          if (eb.body && eb.invMass > 0) {
            const dpx = nx * correction * eb.invMass;
            const dpy = ny * correction * eb.invMass;
            eb.body.x = cleanZero(eb.body.x - dpx);
            eb.body.y = cleanZero(eb.body.y - dpy);
            eb.body.vx = cleanZero(eb.body.vx - (dpx / dt) * 0.25);
            eb.body.vy = cleanZero(eb.body.vy - (dpy / dt) * 0.25);
          }
        }

        if (joint.kind === "weld" && ea.body && eb.body) {
          const refAngle = joint.referenceAngleRad ?? 0;
          const angleErr = eb.body.angleRad - ea.body.angleRad - refAngle;
          if (ea.invMass > 0 && eb.invMass > 0) {
            ea.body.angleRad = cleanZero(ea.body.angleRad + angleErr * 0.5);
            eb.body.angleRad = cleanZero(eb.body.angleRad - angleErr * 0.5);
            ea.body.angularVel = 0;
            eb.body.angularVel = 0;
          } else if (eb.invMass > 0) {
            eb.body.angleRad = cleanZero(ea.body.angleRad - angleErr);
            eb.body.angularVel = 0;
          } else if (ea.invMass > 0) {
            ea.body.angleRad = cleanZero(ea.body.angleRad + angleErr);
            ea.body.angularVel = 0;
          }
        }
      }
    }
  }

  return working.map((b) => ({
    ...b,
    x: cleanZero(b.x),
    y: cleanZero(b.y),
    vx: cleanZero(b.vx),
    vy: cleanZero(b.vy),
    angleRad: cleanZero(b.angleRad),
  }));
}

export interface RopeGeneratorConfig {
  readonly idPrefix: string;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly linkCount: number;
  readonly variant: "rope" | "chain";
  readonly linkRadiusPx?: number;
  readonly attachEndBody?: PhysicsBodyState;
}

export interface GeneratedRopeAssembly {
  readonly bodies: readonly PhysicsBodyState[];
  readonly joints: readonly PhysicsJointSpec[];
  readonly getPolyline: (currentBodies: readonly PhysicsBodyState[]) => readonly { readonly x: number; readonly y: number }[];
}

/** Generate linked bodies + joints + live spline/polyline extractor for ropes and chains. */
export function generateRopeOrChain(config: RopeGeneratorConfig): GeneratedRopeAssembly {
  const count = Math.max(2, Math.round(config.linkCount));
  const linkRadius = config.linkRadiusPx ?? (config.variant === "chain" ? 10 : 6);
  const dx = config.endX - config.startX;
  const dy = config.endY - config.startY;
  const totalDist = Math.hypot(dx, dy);
  const segLen = Math.max(2, totalDist / count);

  const bodies: PhysicsBodyState[] = [];
  const joints: PhysicsJointSpec[] = [];

  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const bx = cleanZero(config.startX + dx * t);
    const by = cleanZero(config.startY + dy * t);
    const bodyId = `${config.idPrefix}_link_${i}`;

    bodies.push({
      id: bodyId,
      kind: "dynamic",
      shape:
        config.variant === "chain"
          ? { kind: "box", halfWidth: linkRadius, halfHeight: Math.max(3, segLen * 0.45) }
          : { kind: "circle", radius: linkRadius },
      x: bx,
      y: by,
      vx: 0,
      vy: 0,
      angleRad: Math.atan2(dy, dx),
      angularVel: 0,
      mass: config.variant === "chain" ? 1.2 : 0.6,
      restitution: 0.1,
      friction: 0.3,
      linearDamping: 0.4,
      angularDamping: 0.6,
      collisionLayer: COLLISION_LAYER_BITS.props,
      collisionMask: COLLISION_LAYER_BITS.bounds,
    });

    if (i === 0) {
      joints.push({
        id: `${config.idPrefix}_joint_anchor`,
        kind: config.variant === "chain" ? "hinge" : "distance",
        a: { kind: "point", x: config.startX, y: config.startY },
        b: { kind: "body", bodyId },
        length: segLen,
      });
    } else {
      joints.push({
        id: `${config.idPrefix}_joint_${i}`,
        kind: config.variant === "chain" ? "distance" : "rope",
        a: { kind: "body", bodyId: `${config.idPrefix}_link_${i - 1}` },
        b: { kind: "body", bodyId },
        length: segLen,
      });
    }
  }

  if (config.attachEndBody) {
    const badge = {
      ...config.attachEndBody,
      x: cleanZero(config.endX),
      y: cleanZero(config.endY),
    };
    bodies.push(badge);
    joints.push({
      id: `${config.idPrefix}_joint_payload`,
      kind: "hinge",
      a: { kind: "body", bodyId: `${config.idPrefix}_link_${count - 1}` },
      b: { kind: "body", bodyId: badge.id },
      length: 0,
    });
  }

  return {
    bodies,
    joints,
    getPolyline(currentBodies: readonly PhysicsBodyState[]) {
      const byId = new Map(currentBodies.map((b) => [b.id, b]));
      const pts: { readonly x: number; readonly y: number }[] = [
        { x: config.startX, y: config.startY },
      ];
      for (let i = 0; i < count; i++) {
        const b = byId.get(`${config.idPrefix}_link_${i}`);
        if (b) pts.push({ x: b.x, y: b.y });
      }
      if (config.attachEndBody) {
        const end = byId.get(config.attachEndBody.id);
        if (end) pts.push({ x: end.x, y: end.y });
      }
      return pts;
    },
  };
}

export interface JointPhysicsSimulation {
  step(dtSec: number): void;
  stepFixedSubstep(): void;
  setCursor(cursor: JointCursorTarget): void;
  getBodies(): readonly PhysicsBodyState[];
  getTimeSec(): number;
  getStepIndex(): number;
}

/** Combined fixed-step physics + constraint solver wrapper with bit-identical replay. */
export function createJointPhysicsSimulation(
  initialBodies: readonly PhysicsBodyState[],
  joints: readonly PhysicsJointSpec[],
  config?: PhysicsWorldConfig
): JointPhysicsSimulation {
  const world = createPhysicsWorld2D(initialBodies, config);
  let cursor: JointCursorTarget = { active: false, x: 0, y: 0 };
  let accum = 0;

  const stepFixedSubstep = (): void => {
    world.stepFixedSubstep();
    const solved = solveJointConstraints(world.getBodies(), joints, {
      cursor,
      dtSec: FIXED_PHYSICS_DT,
      iterations: 6,
    });
    world.setBodies(solved);
  };

  return {
    stepFixedSubstep,
    step(dtSec: number): void {
      const clamped = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
      accum += clamped;
      let steps = 0;
      while (accum >= FIXED_PHYSICS_DT - 1e-9 && steps < 8) {
        stepFixedSubstep();
        accum -= FIXED_PHYSICS_DT;
        steps++;
      }
    },
    setCursor(next: JointCursorTarget): void {
      cursor = { ...next };
    },
    getBodies: () => world.getBodies(),
    getTimeSec: () => world.getTimeSec(),
    getStepIndex: () => world.getStepIndex(),
  };
}
