/**
 * @file spawner.ts
 * @module core/physics2d/spawner
 * @description Phase 170: Pooled ephemeral layer & body spawner (`Spawn` action)
 * with per-tier caps (`T0..T3`), Variety randomness, lifetime + exit fade/scale,
 * optional physics bodies, bit-identical replay, and strict non-persistence guarantee.
 */

import type { PhysicsBodyState } from "./physicsCore";

export type DeviceTier = "T0" | "T1" | "T2" | "T3";

export const SPAWNER_TIER_CAPS: Readonly<Record<DeviceTier, number>> = {
  T0: 16,
  T1: 64,
  T2: 128,
  T3: 256,
};

export type SpawnOrigin =
  | { readonly kind: "pointer"; readonly x: number; readonly y: number }
  | { readonly kind: "pin"; readonly targetLayerId: string; readonly x: number; readonly y: number }
  | { readonly kind: "point"; readonly x: number; readonly y: number };

export interface SpawnTemplateConfig {
  readonly templateLayerId: string;
  readonly count: number;
  readonly speedMinPxPerSec: number;
  readonly speedMaxPxPerSec: number;
  readonly angleCenterDeg: number;
  readonly spreadDeg: number;
  readonly spinDegPerSec: number;
  /** Variety factor (0..1) varying size, spin, and velocity deterministically per spawn. */
  readonly variety: number;
  readonly lifetimeSec: number;
  readonly exitFadeSec: number;
  readonly attachPhysicsBody?: boolean;
  readonly gravityY?: number;
}

export interface SpawnedInstance {
  readonly poolId: string;
  readonly templateLayerId: string;
  readonly isEphemeral: true;
  readonly spawnedAtSec: number;
  readonly lifetimeSec: number;
  readonly exitFadeSec: number;
  readonly ageSec: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly angleDeg: number;
  readonly angularVelDeg: number;
  readonly scale: number;
  readonly opacity: number;
  readonly body: PhysicsBodyState | null;
}

function cleanZero(n: number): number {
  return Math.abs(n) < 1e-12 ? 0 : n;
}

export interface EphemeralSpawner {
  spawnBurst(origin: SpawnOrigin, config: SpawnTemplateConfig, nowSec: number): readonly SpawnedInstance[];
  step(dtSec: number, gravityY?: number): void;
  getActiveInstances(): readonly SpawnedInstance[];
  getPoolCap(): number;
  getTotalSpawnedCount(): number;
  reset(): void;
}

/**
 * Strip any transient spawned copies before serializing document layers
 * ("Never saved into the document" invariant).
 */
export function filterNonEphemeralDocumentLayers<T extends { readonly id: string; readonly isEphemeral?: boolean }>(
  layers: readonly T[]
): readonly T[] {
  return layers.filter((l) => !l.isEphemeral && !l.id.startsWith("__spawn_"));
}

export function createEphemeralSpawner(options?: {
  readonly tier?: DeviceTier;
  readonly seed?: number;
  readonly customCap?: number;
}): EphemeralSpawner {
  const tier = options?.tier ?? "T2";
  const poolCap = Math.max(1, options?.customCap ?? SPAWNER_TIER_CAPS[tier]);
  const initialSeed = (options?.seed ?? 170) >>> 0;

  let rng = initialSeed;
  let seq = 1;
  let totalSpawned = 0;
  let pool: SpawnedInstance[] = [];

  const rand = (): number => {
    rng = (rng + 0x6d2b79f5) | 0;
    let t = Math.imul(rng ^ (rng >>> 15), 1 | rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    spawnBurst(origin, config, nowSec): readonly SpawnedInstance[] {
      const requested = Math.max(0, Math.round(config.count));
      const variety = Math.max(0, Math.min(1, config.variety));
      const spawned: SpawnedInstance[] = [];

      for (let i = 0; i < requested; i++) {
        if (pool.length >= poolCap) {
          // Evict oldest slot in pool so pool cap is never exceeded
          pool.shift();
        }
        const angleJitter = (rand() - 0.5) * config.spreadDeg;
        const angleRad = ((config.angleCenterDeg + angleJitter) * Math.PI) / 180;
        const speed =
          config.speedMinPxPerSec +
          rand() * Math.max(0, config.speedMaxPxPerSec - config.speedMinPxPerSec);
        const speedScale = 1 + (rand() - 0.5) * variety;
        const vx = cleanZero(Math.cos(angleRad) * speed * speedScale);
        const vy = cleanZero(Math.sin(angleRad) * speed * speedScale);
        const scale = cleanZero(Math.max(0.25, 1 + (rand() - 0.5) * 0.6 * variety));
        const spin = cleanZero(config.spinDegPerSec * (1 + (rand() - 0.5) * variety));
        const poolId = `__spawn_${seq++}`;

        const body: PhysicsBodyState | null = config.attachPhysicsBody
          ? {
              id: poolId,
              kind: "dynamic",
              shape: { kind: "circle", radius: Math.max(2, 8 * scale) },
              x: cleanZero(origin.x),
              y: cleanZero(origin.y),
              vx,
              vy,
              angleRad: 0,
              angularVel: (spin * Math.PI) / 180,
              mass: 0.4 * scale,
              restitution: 0.6,
              friction: 0.2,
              linearDamping: 0.15,
              angularDamping: 0.1,
            }
          : null;

        const inst: SpawnedInstance = {
          poolId,
          templateLayerId: config.templateLayerId,
          isEphemeral: true,
          spawnedAtSec: nowSec,
          lifetimeSec: Math.max(0.05, config.lifetimeSec),
          exitFadeSec: Math.max(0.02, Math.min(config.lifetimeSec, config.exitFadeSec)),
          ageSec: 0,
          x: cleanZero(origin.x),
          y: cleanZero(origin.y),
          vx,
          vy,
          angleDeg: 0,
          angularVelDeg: spin,
          scale,
          opacity: 1,
          body,
        };
        pool.push(inst);
        spawned.push(inst);
        totalSpawned++;
      }

      return spawned;
    },

    step(dtSec: number, gravityY = 640): void {
      const dt = Math.max(0, Number.isFinite(dtSec) ? dtSec : 0);
      const next: SpawnedInstance[] = [];
      for (const item of pool) {
        const nextAge = item.ageSec + dt;
        if (nextAge >= item.lifetimeSec) continue;

        const nextVy = cleanZero(item.vy + gravityY * dt);
        const nextX = cleanZero(item.x + item.vx * dt);
        const nextY = cleanZero(item.y + nextVy * dt);
        const nextAngleDeg = cleanZero(item.angleDeg + item.angularVelDeg * dt);

        const remaining = item.lifetimeSec - nextAge;
        const opacity =
          remaining < item.exitFadeSec
            ? cleanZero(Math.max(0, remaining / item.exitFadeSec))
            : 1;

        const updatedBody: PhysicsBodyState | null = item.body
          ? {
              ...item.body,
              x: nextX,
              y: nextY,
              vx: item.vx,
              vy: nextVy,
              angleRad: cleanZero((nextAngleDeg * Math.PI) / 180),
            }
          : null;

        next.push({
          ...item,
          ageSec: nextAge,
          x: nextX,
          y: nextY,
          vy: nextVy,
          angleDeg: nextAngleDeg,
          opacity,
          body: updatedBody,
        });
      }
      pool = next;
    },

    getActiveInstances: () => pool,
    getPoolCap: () => poolCap,
    getTotalSpawnedCount: () => totalSpawned,

    reset(): void {
      rng = initialSeed;
      seq = 1;
      totalSpawned = 0;
      pool = [];
    },
  };
}
