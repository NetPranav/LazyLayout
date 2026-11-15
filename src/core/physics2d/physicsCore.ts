/**
 * @file physicsCore.ts
 * @module core/physics2d/physicsCore
 * @description Phase 162: Decision Record 0006 deterministic 2D physics core:
 * fixed 1/120 s step accumulator, seeded PRNG, spatial-hash broadphase,
 * SAT circle/box narrowphase, positional stabilization, and snapshot timeline seeking.
 */

export const FIXED_PHYSICS_DT = 1 / 120;
export const MAX_PHYSICS_SUBSTEPS = 8;

export type BodyKind = "static" | "kinematic" | "dynamic";

export type ColliderShape =
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "box"; readonly halfWidth: number; readonly halfHeight: number };

export interface PhysicsBodyState {
  readonly id: string;
  readonly kind: BodyKind;
  readonly shape: ColliderShape;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly angleRad: number;
  readonly angularVel: number;
  readonly mass: number;
  readonly restitution: number;
  readonly friction: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly isTrigger?: boolean;
  readonly collisionLayer?: number;
  readonly collisionMask?: number;
  readonly homeX?: number;
  readonly homeY?: number;
  readonly homeStiffness?: number;
}

export interface PhysicsContactManifold {
  readonly idA: string;
  readonly idB: string;
  readonly nx: number;
  readonly ny: number;
  readonly penetration: number;
  readonly contactX: number;
  readonly contactY: number;
  readonly normalImpulse: number;
}

export interface PhysicsSnapshot {
  readonly stepIndex: number;
  readonly timeSec: number;
  readonly rngState: number;
  readonly bodies: readonly PhysicsBodyState[];
}

export interface PhysicsWorldConfig {
  readonly gravityX?: number;
  readonly gravityY?: number;
  readonly cellSizePx?: number;
  readonly seed?: number;
  readonly snapshotIntervalSteps?: number;
}

interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function bodyAabb(b: PhysicsBodyState): AABB {
  if (b.shape.kind === "circle") {
    return {
      minX: b.x - b.shape.radius,
      minY: b.y - b.shape.radius,
      maxX: b.x + b.shape.radius,
      maxY: b.y + b.shape.radius,
    };
  }
  const c = Math.abs(Math.cos(b.angleRad));
  const s = Math.abs(Math.sin(b.angleRad));
  const ex = b.shape.halfWidth * c + b.shape.halfHeight * s;
  const ey = b.shape.halfWidth * s + b.shape.halfHeight * c;
  return {
    minX: b.x - ex,
    minY: b.y - ey,
    maxX: b.x + ex,
    maxY: b.y + ey,
  };
}

function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Deterministic sorted broadphase pairs using a uniform spatial hash grid. */
export function broadphasePairs(
  bodies: readonly PhysicsBodyState[],
  cellSizePx = 64,
): readonly [number, number][] {
  const safeCell = Math.max(8, cellSizePx);
  const grid = new Map<string, number[]>();
  const boxes = bodies.map(bodyAabb);

  for (let i = 0; i < bodies.length; i++) {
    const box = boxes[i]!;
    const cx0 = Math.floor(box.minX / safeCell);
    const cy0 = Math.floor(box.minY / safeCell);
    const cx1 = Math.floor(box.maxX / safeCell);
    const cy1 = Math.floor(box.maxY / safeCell);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx},${cy}`;
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push(i);
      }
    }
  }

  const pairKeys = new Set<string>();
  const pairs: [number, number][] = [];
  for (const bucket of grid.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const aIdx = Math.min(bucket[i]!, bucket[j]!);
        const bIdx = Math.max(bucket[i]!, bucket[j]!);
        if (aIdx === bIdx) continue;
        const bodyA = bodies[aIdx]!;
        const bodyB = bodies[bIdx]!;
        if (bodyA.kind !== "dynamic" && bodyB.kind !== "dynamic") continue;
        const maskA = bodyA.collisionMask ?? 0xffffffff;
        const layerA = bodyA.collisionLayer ?? 1;
        const maskB = bodyB.collisionMask ?? 0xffffffff;
        const layerB = bodyB.collisionLayer ?? 1;
        if ((maskA & layerB) === 0 || (maskB & layerA) === 0) continue;
        if (!aabbsOverlap(boxes[aIdx]!, boxes[bIdx]!)) continue;

        const pairKey = `${aIdx}:${bIdx}`;
        if (!pairKeys.has(pairKey)) {
          pairKeys.add(pairKey);
          pairs.push([aIdx, bIdx]);
        }
      }
    }
  }

  pairs.sort((p1, p2) => (p1[0] !== p2[0] ? p1[0] - p2[0] : p1[1] - p2[1]));
  return pairs;
}

/** SAT narrowphase collision check between two physics bodies (normal points A -> B). */
export function detectSatCollision(
  a: PhysicsBodyState,
  b: PhysicsBodyState,
): PhysicsContactManifold | null {
  if (a.shape.kind === "circle" && b.shape.kind === "circle") {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.shape.radius + b.shape.radius;
    if (dist >= minDist) return null;
    const nx = dist > 1e-6 ? dx / dist : 1;
    const ny = dist > 1e-6 ? dy / dist : 0;
    const penetration = minDist - dist;
    return {
      idA: a.id,
      idB: b.id,
      nx,
      ny,
      penetration,
      contactX: a.x + nx * a.shape.radius,
      contactY: a.y + ny * a.shape.radius,
      normalImpulse: 0,
    };
  }

  if (a.shape.kind === "circle" && b.shape.kind === "box") {
    return circleVsBox(a, a.shape.radius, b, b.shape.halfWidth, b.shape.halfHeight, false);
  }
  if (a.shape.kind === "box" && b.shape.kind === "circle") {
    return circleVsBox(b, b.shape.radius, a, a.shape.halfWidth, a.shape.halfHeight, true);
  }

  // Oriented box vs box via 4 separating axes
  const boxA = a.shape as { readonly kind: "box"; readonly halfWidth: number; readonly halfHeight: number };
  const boxB = b.shape as { readonly kind: "box"; readonly halfWidth: number; readonly halfHeight: number };
  const axesA = [
    { x: Math.cos(a.angleRad), y: Math.sin(a.angleRad) },
    { x: -Math.sin(a.angleRad), y: Math.cos(a.angleRad) },
  ];
  const axesB = [
    { x: Math.cos(b.angleRad), y: Math.sin(b.angleRad) },
    { x: -Math.sin(b.angleRad), y: Math.cos(b.angleRad) },
  ];

  const cornersOf = (body: PhysicsBodyState, hw: number, hh: number, ax: typeof axesA) => {
    const u = ax[0]!;
    const v = ax[1]!;
    return [
      { x: body.x - u.x * hw - v.x * hh, y: body.y - u.y * hw - v.y * hh },
      { x: body.x + u.x * hw - v.x * hh, y: body.y + u.y * hw - v.y * hh },
      { x: body.x + u.x * hw + v.x * hh, y: body.y + u.y * hw + v.y * hh },
      { x: body.x - u.x * hw + v.x * hh, y: body.y - u.y * hw + v.y * hh },
    ];
  };

  const cornersA = cornersOf(a, boxA.halfWidth, boxA.halfHeight, axesA);
  const cornersB = cornersOf(b, boxB.halfWidth, boxB.halfHeight, axesB);
  const candidateAxes = [...axesA, ...axesB];

  let minOverlap = Infinity;
  let bestAxis = candidateAxes[0]!;
  for (const axis of candidateAxes) {
    let minA = Infinity;
    let maxA = -Infinity;
    for (const c of cornersA) {
      const p = c.x * axis.x + c.y * axis.y;
      if (p < minA) minA = p;
      if (p > maxA) maxA = p;
    }
    let minB = Infinity;
    let maxB = -Infinity;
    for (const c of cornersB) {
      const p = c.x * axis.x + c.y * axis.y;
      if (p < minB) minB = p;
      if (p > maxB) maxB = p;
    }
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAxis = axis;
    }
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sign = dx * bestAxis.x + dy * bestAxis.y < 0 ? -1 : 1;
  const nx = bestAxis.x * sign;
  const ny = bestAxis.y * sign;

  return {
    idA: a.id,
    idB: b.id,
    nx,
    ny,
    penetration: minOverlap,
    contactX: (a.x + b.x) * 0.5,
    contactY: (a.y + b.y) * 0.5,
    normalImpulse: 0,
  };
}

function circleVsBox(
  circleBody: PhysicsBodyState,
  radius: number,
  boxBody: PhysicsBodyState,
  halfW: number,
  halfH: number,
  flipNormal: boolean,
): PhysicsContactManifold | null {
  const cos = Math.cos(-boxBody.angleRad);
  const sin = Math.sin(-boxBody.angleRad);
  const relX = circleBody.x - boxBody.x;
  const relY = circleBody.y - boxBody.y;
  const localX = relX * cos - relY * sin;
  const localY = relX * sin + relY * cos;

  const clampedX = Math.max(-halfW, Math.min(halfW, localX));
  const clampedY = Math.max(-halfH, Math.min(halfH, localY));

  let lnx = localX - clampedX;
  let lny = localY - clampedY;
  let dist = Math.hypot(lnx, lny);

  // Inside box interior
  if (dist < 1e-6) {
    const penX = halfW - Math.abs(localX);
    const penY = halfH - Math.abs(localY);
    if (penX < penY) {
      lnx = localX >= 0 ? 1 : -1;
      lny = 0;
      dist = -penX;
    } else {
      lnx = 0;
      lny = localY >= 0 ? 1 : -1;
      dist = -penY;
    }
  } else {
    lnx /= dist;
    lny /= dist;
  }

  const penetration = radius - dist;
  if (penetration <= 0) return null;

  const invCos = Math.cos(boxBody.angleRad);
  const invSin = Math.sin(boxBody.angleRad);
  // Circle -> Box inward normal is opposite box outward normal
  let nx = -(lnx * invCos - lny * invSin);
  let ny = -(lnx * invSin + lny * invCos);
  if (flipNormal) {
    nx = -nx;
    ny = -ny;
  }

  const worldClosestX = boxBody.x + (clampedX * invCos - clampedY * invSin);
  const worldClosestY = boxBody.y + (clampedX * invSin + clampedY * invCos);

  return {
    idA: flipNormal ? boxBody.id : circleBody.id,
    idB: flipNormal ? circleBody.id : boxBody.id,
    nx,
    ny,
    penetration,
    contactX: worldClosestX,
    contactY: worldClosestY,
    normalImpulse: 0,
  };
}

export interface PhysicsWorld2D {
  addBody(body: PhysicsBodyState): void;
  setBodies(bodies: readonly PhysicsBodyState[]): void;
  getBodies(): readonly PhysicsBodyState[];
  getBody(id: string): PhysicsBodyState | undefined;
  step(dtSec: number): readonly PhysicsContactManifold[];
  stepFixedSubstep(): readonly PhysicsContactManifold[];
  getStepIndex(): number;
  getTimeSec(): number;
  nextRandom(): number;
  createSnapshot(): PhysicsSnapshot;
  restoreSnapshot(snapshot: PhysicsSnapshot): void;
  getSavedSnapshots(): readonly PhysicsSnapshot[];
  seekToTime(targetTimeSec: number): readonly PhysicsSnapshot | PhysicsSnapshot;
}

/**
 * Creates a deterministic 2D physics simulation world governed by Decision Record 0006.
 */
export function createPhysicsWorld2D(
  initialBodies: readonly PhysicsBodyState[] = [],
  config: PhysicsWorldConfig = {},
): PhysicsWorld2D {
  const gravityX = config.gravityX ?? 0;
  const gravityY = config.gravityY ?? 980;
  const cellSizePx = config.cellSizePx ?? 64;
  const snapshotInterval = Math.max(1, config.snapshotIntervalSteps ?? 30);

  let rngState = (config.seed ?? 0x9e3779b9) >>> 0;
  let stepIndex = 0;
  let accumulator = 0;
  let bodies: PhysicsBodyState[] = initialBodies.map((b) => ({ ...b })).sort((a, b) => a.id.localeCompare(b.id));
  const snapshots: PhysicsSnapshot[] = [];

  const nextRandom = (): number => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const createSnapshot = (): PhysicsSnapshot => ({
    stepIndex,
    timeSec: stepIndex * FIXED_PHYSICS_DT,
    rngState,
    bodies: bodies.map((b) => ({ ...b })),
  });

  const restoreSnapshot = (snap: PhysicsSnapshot): void => {
    stepIndex = snap.stepIndex;
    rngState = snap.rngState;
    accumulator = 0;
    bodies = snap.bodies.map((b) => ({ ...b }));
  };

  snapshots.push(createSnapshot());

  const stepFixedSubstep = (): readonly PhysicsContactManifold[] => {
    const working = bodies.map((b) => ({ ...b }));

    // 1) Forces & semi-implicit Euler integration
    for (const b of working) {
      if (b.kind === "static") continue;
      if (b.kind === "dynamic") {
        let fx = gravityX * b.mass;
        let fy = gravityY * b.mass;
        if (b.homeX !== undefined && b.homeY !== undefined && (b.homeStiffness ?? 0) > 0) {
          fx += (b.homeX - b.x) * (b.homeStiffness ?? 0);
          fy += (b.homeY - b.y) * (b.homeStiffness ?? 0);
        }
        const invM = b.mass > 1e-6 ? 1 / b.mass : 0;
        b.vx += fx * invM * FIXED_PHYSICS_DT;
        b.vy += fy * invM * FIXED_PHYSICS_DT;
        const dampLin = Math.max(0, 1 - b.linearDamping * FIXED_PHYSICS_DT);
        const dampAng = Math.max(0, 1 - b.angularDamping * FIXED_PHYSICS_DT);
        b.vx *= dampLin;
        b.vy *= dampLin;
        b.angularVel *= dampAng;
      }
      b.x += b.vx * FIXED_PHYSICS_DT;
      b.y += b.vy * FIXED_PHYSICS_DT;
      b.angleRad += b.angularVel * FIXED_PHYSICS_DT;
    }

    // 2) Broadphase + SAT Narrowphase + Impulse/Position Resolution
    const pairs = broadphasePairs(working, cellSizePx);
    const manifolds: PhysicsContactManifold[] = [];

    for (const [iA, iB] of pairs) {
      const a = working[iA]!;
      const b = working[iB]!;
      const layerA = a.collisionLayer ?? 1;
      const maskA = a.collisionMask ?? 0xffffffff;
      const layerB = b.collisionLayer ?? 1;
      const maskB = b.collisionMask ?? 0xffffffff;
      if ((maskA & layerB) === 0 || (maskB & layerA) === 0) continue;
      const hit = detectSatCollision(a, b);
      if (!hit) continue;

      if (a.isTrigger || b.isTrigger) {
        manifolds.push(hit);
        continue;
      }

      const invMA = a.kind === "dynamic" && a.mass > 1e-6 ? 1 / a.mass : 0;
      const invMB = b.kind === "dynamic" && b.mass > 1e-6 ? 1 / b.mass : 0;
      const invMassSum = invMA + invMB;
      if (invMassSum <= 1e-9) continue;

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velAlongNormal = rvx * hit.nx + rvy * hit.ny;

      let j = 0;
      if (velAlongNormal < 0) {
        const e = Math.min(a.restitution, b.restitution);
        j = (-(1 + e) * velAlongNormal) / invMassSum;
        const impulseX = j * hit.nx;
        const impulseY = j * hit.ny;
        a.vx -= impulseX * invMA;
        a.vy -= impulseY * invMA;
        b.vx += impulseX * invMB;
        b.vy += impulseY * invMB;

        // Tangent Coulomb friction
        const txRaw = rvx - velAlongNormal * hit.nx;
        const tyRaw = rvy - velAlongNormal * hit.ny;
        const tLen = Math.hypot(txRaw, tyRaw);
        if (tLen > 1e-6) {
          const tx = txRaw / tLen;
          const ty = tyRaw / tLen;
          const jt = -(rvx * tx + rvy * ty) / invMassSum;
          const mu = Math.sqrt(Math.max(0, a.friction * b.friction));
          const frictionImpulse = Math.max(-j * mu, Math.min(j * mu, jt));
          a.vx -= frictionImpulse * tx * invMA;
          a.vy -= frictionImpulse * ty * invMA;
          b.vx += frictionImpulse * tx * invMB;
          b.vy += frictionImpulse * ty * invMB;
        }
      }

      // Baumgarte positional correction
      const percent = 0.8;
      const slop = 0.01;
      const corrMag = (Math.max(hit.penetration - slop, 0) / invMassSum) * percent;
      a.x -= corrMag * hit.nx * invMA;
      a.y -= corrMag * hit.ny * invMA;
      b.x += corrMag * hit.nx * invMB;
      b.y += corrMag * hit.ny * invMB;

      manifolds.push({ ...hit, normalImpulse: j });
    }

    bodies = working;
    stepIndex++;

    if (stepIndex % snapshotInterval === 0) {
      snapshots.push(createSnapshot());
    }
    return manifolds;
  };

  return {
    addBody(body: PhysicsBodyState): void {
      bodies = [...bodies.filter((b) => b.id !== body.id), { ...body }].sort((a, b) => a.id.localeCompare(b.id));
    },

    setBodies(nextBodies: readonly PhysicsBodyState[]): void {
      bodies = nextBodies.map((b) => ({ ...b })).sort((a, b) => a.id.localeCompare(b.id));
    },

    getBodies(): readonly PhysicsBodyState[] {
      return bodies;
    },

    getBody(id: string): PhysicsBodyState | undefined {
      return bodies.find((b) => b.id === id);
    },

    stepFixedSubstep,

    step(dtSec: number): readonly PhysicsContactManifold[] {
      const clampedDt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
      accumulator += clampedDt;
      let steps = 0;
      let lastManifolds: readonly PhysicsContactManifold[] = [];
      while (accumulator >= FIXED_PHYSICS_DT - 1e-9 && steps < MAX_PHYSICS_SUBSTEPS) {
        lastManifolds = stepFixedSubstep();
        accumulator -= FIXED_PHYSICS_DT;
        steps++;
      }
      return lastManifolds;
    },

    getStepIndex(): number {
      return stepIndex;
    },

    getTimeSec(): number {
      return stepIndex * FIXED_PHYSICS_DT;
    },

    nextRandom,
    createSnapshot,
    restoreSnapshot,

    getSavedSnapshots(): readonly PhysicsSnapshot[] {
      return snapshots;
    },

    seekToTime(targetTimeSec: number): PhysicsSnapshot {
      const targetStep = Math.max(0, Math.round(targetTimeSec / FIXED_PHYSICS_DT));
      let best = snapshots[0]!;
      for (const s of snapshots) {
        if (s.stepIndex <= targetStep && s.stepIndex >= best.stepIndex) {
          best = s;
        }
      }
      restoreSnapshot(best);
      while (stepIndex < targetStep) {
        stepFixedSubstep();
      }
      return createSnapshot();
    },
  };
}
