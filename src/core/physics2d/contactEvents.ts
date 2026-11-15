/**
 * @file contactEvents.ts
 * @module core/physics2d/contactEvents
 * @description Phase 164 (closes AUD-56): Fixed-step overlap/hit/field event
 * emission (`OverlapBegin`, `OverlapStay`, `OverlapEnd`, `Hit`, `FieldEnter`, `FieldExit`)
 * and "Show collision" debug overlay primitives (colliders, contacts, normals, velocities).
 */

import type { PhysicsBodyState, PhysicsContactManifold } from "./physicsCore";

export type PhysicsEventKind =
  | "OverlapBegin"
  | "OverlapStay"
  | "OverlapEnd"
  | "Hit"
  | "FieldEnter"
  | "FieldExit";

export interface PhysicsContactEvent {
  readonly kind: PhysicsEventKind;
  readonly stepIndex: number;
  readonly timeSec: number;
  readonly selfId: string;
  readonly otherId: string;
  readonly contactX: number;
  readonly contactY: number;
  readonly nx: number;
  readonly ny: number;
  readonly impulse: number;
}

export interface PhysicsFieldRegion {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function pairKey(a: string, b: string): string {
  return a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

export interface ContactEventTracker {
  /**
   * Advance one fixed physics step and return deterministic contact & field events.
   * Must be called right after `world.stepFixedSubstep()` using the returned manifolds.
   */
  processFixedStep(options: {
    readonly stepIndex: number;
    readonly timeSec: number;
    readonly bodies: readonly PhysicsBodyState[];
    readonly manifolds: readonly PhysicsContactManifold[];
    readonly fields?: readonly PhysicsFieldRegion[];
    readonly hitImpulseThreshold?: number;
  }): readonly PhysicsContactEvent[];

  reset(): void;
  getActiveOverlaps(): readonly string[];
  getActiveFieldMemberships(): readonly string[];
}

/**
 * Stateful fixed-step contact tracker producing symmetric `OverlapBegin/Stay/End`
 * and directed `Hit` + `FieldEnter/FieldExit` events with contact pins.
 */
export function createContactEventTracker(): ContactEventTracker {
  const prevContacts = new Map<string, PhysicsContactManifold>();
  const prevFields = new Map<string, { readonly fieldId: string; readonly bodyId: string }>();

  return {
    processFixedStep(options): readonly PhysicsContactEvent[] {
      const {
        stepIndex,
        timeSec,
        bodies,
        manifolds,
        fields = [],
        hitImpulseThreshold = 0.01,
      } = options;
      const events: PhysicsContactEvent[] = [];
      const currentContacts = new Map<string, PhysicsContactManifold>();

      for (const m of manifolds) {
        const key = pairKey(m.idA, m.idB);
        currentContacts.set(key, m);
      }

      const sortedKeys = [...new Set([...prevContacts.keys(), ...currentContacts.keys()])].sort();
      for (const key of sortedKeys) {
        const curr = currentContacts.get(key);
        const prev = prevContacts.get(key);
        if (curr && !prev) {
          events.push({
            kind: "OverlapBegin",
            stepIndex,
            timeSec,
            selfId: curr.idA,
            otherId: curr.idB,
            contactX: curr.contactX,
            contactY: curr.contactY,
            nx: curr.nx,
            ny: curr.ny,
            impulse: curr.normalImpulse,
          });
          if (curr.normalImpulse > hitImpulseThreshold) {
            events.push({
              kind: "Hit",
              stepIndex,
              timeSec,
              selfId: curr.idA,
              otherId: curr.idB,
              contactX: curr.contactX,
              contactY: curr.contactY,
              nx: curr.nx,
              ny: curr.ny,
              impulse: curr.normalImpulse,
            });
          }
        } else if (curr && prev) {
          events.push({
            kind: "OverlapStay",
            stepIndex,
            timeSec,
            selfId: curr.idA,
            otherId: curr.idB,
            contactX: curr.contactX,
            contactY: curr.contactY,
            nx: curr.nx,
            ny: curr.ny,
            impulse: curr.normalImpulse,
          });
          if (curr.normalImpulse > hitImpulseThreshold && prev.normalImpulse <= hitImpulseThreshold) {
            events.push({
              kind: "Hit",
              stepIndex,
              timeSec,
              selfId: curr.idA,
              otherId: curr.idB,
              contactX: curr.contactX,
              contactY: curr.contactY,
              nx: curr.nx,
              ny: curr.ny,
              impulse: curr.normalImpulse,
            });
          }
        } else if (!curr && prev) {
          events.push({
            kind: "OverlapEnd",
            stepIndex,
            timeSec,
            selfId: prev.idA,
            otherId: prev.idB,
            contactX: prev.contactX,
            contactY: prev.contactY,
            nx: prev.nx,
            ny: prev.ny,
            impulse: 0,
          });
        }
      }

      prevContacts.clear();
      for (const [k, v] of currentContacts) {
        prevContacts.set(k, v);
      }

      // FieldEnter / FieldExit against radial field regions
      const currFields = new Map<string, { readonly fieldId: string; readonly bodyId: string; readonly bx: number; readonly by: number }>();
      for (const field of fields) {
        for (const body of bodies) {
          const rBody = body.shape.kind === "circle"
            ? body.shape.radius
            : Math.max(body.shape.halfWidth, body.shape.halfHeight);
          const dx = body.x - field.x;
          const dy = body.y - field.y;
          if (dx * dx + dy * dy <= (field.radius + rBody) * (field.radius + rBody)) {
            currFields.set(`${field.id}\u0000${body.id}`, {
              fieldId: field.id,
              bodyId: body.id,
              bx: body.x,
              by: body.y,
            });
          }
        }
      }

      const sortedFieldKeys = [...new Set([...prevFields.keys(), ...currFields.keys()])].sort();
      for (const fk of sortedFieldKeys) {
        const curr = currFields.get(fk);
        const prev = prevFields.get(fk);
        if (curr && !prev) {
          const field = fields.find((f) => f.id === curr.fieldId)!;
          const dx = curr.bx - field.x;
          const dy = curr.by - field.y;
          const len = Math.hypot(dx, dy) || 1;
          events.push({
            kind: "FieldEnter",
            stepIndex,
            timeSec,
            selfId: curr.bodyId,
            otherId: curr.fieldId,
            contactX: curr.bx,
            contactY: curr.by,
            nx: dx / len,
            ny: dy / len,
            impulse: 0,
          });
        } else if (!curr && prev) {
          const body = bodies.find((b) => b.id === prev.bodyId);
          events.push({
            kind: "FieldExit",
            stepIndex,
            timeSec,
            selfId: prev.bodyId,
            otherId: prev.fieldId,
            contactX: body?.x ?? 0,
            contactY: body?.y ?? 0,
            nx: 0,
            ny: -1,
            impulse: 0,
          });
        }
      }

      prevFields.clear();
      for (const [k, v] of currFields) {
        prevFields.set(k, { fieldId: v.fieldId, bodyId: v.bodyId });
      }

      return events;
    },

    reset(): void {
      prevContacts.clear();
      prevFields.clear();
    },

    getActiveOverlaps(): readonly string[] {
      return [...prevContacts.keys()].sort();
    },

    getActiveFieldMemberships(): readonly string[] {
      return [...prevFields.keys()].sort();
    },
  };
}

export interface DebugColliderPrimitive {
  readonly bodyId: string;
  readonly shapeKind: "circle" | "box";
  readonly x: number;
  readonly y: number;
  readonly radius?: number;
  readonly halfWidth?: number;
  readonly halfHeight?: number;
  readonly angleRad: number;
  readonly isTrigger: boolean;
}

export interface DebugContactPrimitive {
  readonly idA: string;
  readonly idB: string;
  readonly x: number;
  readonly y: number;
  readonly normalEndX: number;
  readonly normalEndY: number;
  readonly impulse: number;
}

export interface DebugVelocityVector {
  readonly bodyId: string;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

export interface CollisionDebugView {
  readonly stepIndex: number;
  readonly timeSec: number;
  readonly colliders: readonly DebugColliderPrimitive[];
  readonly contacts: readonly DebugContactPrimitive[];
  readonly velocities: readonly DebugVelocityVector[];
}

/** Build a deterministic "Show collision" debug overlay snapshot for Preview rendering. */
export function buildCollisionDebugView(options: {
  readonly stepIndex: number;
  readonly timeSec: number;
  readonly bodies: readonly PhysicsBodyState[];
  readonly manifolds: readonly PhysicsContactManifold[];
  readonly normalScalePx?: number;
  readonly velocityScaleSec?: number;
}): CollisionDebugView {
  const normalScale = options.normalScalePx ?? 24;
  const velScale = options.velocityScaleSec ?? 0.08;

  const colliders: DebugColliderPrimitive[] = options.bodies.map((b) =>
    b.shape.kind === "circle"
      ? {
          bodyId: b.id,
          shapeKind: "circle",
          x: b.x,
          y: b.y,
          radius: b.shape.radius,
          angleRad: b.angleRad,
          isTrigger: b.isTrigger ?? false,
        }
      : {
          bodyId: b.id,
          shapeKind: "box",
          x: b.x,
          y: b.y,
          halfWidth: b.shape.halfWidth,
          halfHeight: b.shape.halfHeight,
          angleRad: b.angleRad,
          isTrigger: b.isTrigger ?? false,
        }
  );

  const contacts: DebugContactPrimitive[] = options.manifolds.map((m) => ({
    idA: m.idA,
    idB: m.idB,
    x: m.contactX,
    y: m.contactY,
    normalEndX: m.contactX + m.nx * normalScale,
    normalEndY: m.contactY + m.ny * normalScale,
    impulse: m.normalImpulse,
  }));

  const velocities: DebugVelocityVector[] = options.bodies
    .filter((b) => b.kind !== "static")
    .map((b) => ({
      bodyId: b.id,
      startX: b.x,
      startY: b.y,
      endX: b.x + b.vx * velScale,
      endY: b.y + b.vy * velScale,
    }));

  return {
    stepIndex: options.stepIndex,
    timeSec: options.timeSec,
    colliders,
    contacts,
    velocities,
  };
}
