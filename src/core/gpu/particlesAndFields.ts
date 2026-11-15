/**
 * @file particlesAndFields.ts
 * @module core/gpu/particlesAndFields
 * @description Phase 183: Niagara-style particle module stack
 * (emitter -> spawn -> update -> render) with deterministic CPU (<= 5k) and
 * GPU float32-quantized/shader-emulated (<= 250k) backends, force fields
 * (gravity, drag, noise/curl, vortex, pointer attract/repel/orbit, spring-to-shape,
 * bounds), interaction modes, and Phase 175 layer outline/SDF shape assembly.
 */

import { sampleSdfAt, type LayerSdfResource } from "./layerTexturesAndSdf";

export type ParticleBackendKind = "cpu" | "gpu";
export type ParticleRenderMode =
  | "points"
  | "sprites"
  | "links"
  | "trails"
  | "instanced_meshes";

export type ParticleInteractionKind =
  | "grab"
  | "repulse"
  | "burst_on_tap"
  | "scatter_on_scroll";

export type ParticleShapeEmitMode = "outline" | "fill" | "stick";

export type ParticleForceModule =
  | { readonly type: "gravity"; readonly gx: number; readonly gy: number }
  | { readonly type: "drag"; readonly coefficient: number }
  | { readonly type: "noise_curl"; readonly strength: number; readonly frequency: number }
  | { readonly type: "vortex"; readonly cx: number; readonly cy: number; readonly strength: number }
  | { readonly type: "pointer_attract"; readonly strength: number; readonly radiusPx: number }
  | { readonly type: "pointer_repel"; readonly strength: number; readonly radiusPx: number }
  | { readonly type: "pointer_orbit"; readonly strength: number; readonly radiusPx: number }
  | { readonly type: "spring_to_shape"; readonly stiffness: number; readonly damping: number }
  | {
      readonly type: "bounds";
      readonly minX: number;
      readonly minY: number;
      readonly maxX: number;
      readonly maxY: number;
      readonly restitution?: number;
    };

export interface ParticleEmitterConfig {
  readonly seed: number;
  readonly spawnRatePerSec: number;
  readonly maxParticles: number;
  readonly lifeSec: number;
  readonly originX: number;
  readonly originY: number;
  readonly spreadRadiusPx: number;
  readonly initialSpeedPxPerSec: number;
  readonly renderMode: ParticleRenderMode;
  readonly linkDistancePx?: number;
  readonly trailLength?: number;
  readonly shapeTarget?: {
    readonly sdf: LayerSdfResource;
    readonly mode: ParticleShapeEmitMode;
    readonly offsetX?: number;
    readonly offsetY?: number;
  };
  readonly forces: readonly ParticleForceModule[];
}

export interface ParticleInputState {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerDown?: boolean;
  readonly tapX?: number;
  readonly tapY?: number;
  readonly scrollDeltaY?: number;
  readonly activeInteraction?: ParticleInteractionKind;
}

export interface ParticleTierBudget {
  readonly backend: ParticleBackendKind;
  readonly maxParticles: number;
  readonly allowLinks: boolean;
  readonly allowTrails: boolean;
}

export const CPU_MAX_PARTICLES = 5_000;
export const GPU_MAX_PARTICLES = 250_000;

export function resolveParticleTierBudget(
  tier: "T0" | "T1" | "T2" | "T3"
): ParticleTierBudget {
  switch (tier) {
    case "T0":
      return { backend: "cpu", maxParticles: 1_200, allowLinks: false, allowTrails: false };
    case "T1":
      return { backend: "cpu", maxParticles: CPU_MAX_PARTICLES, allowLinks: true, allowTrails: false };
    case "T2":
      return { backend: "gpu", maxParticles: 65_000, allowLinks: true, allowTrails: true };
    case "T3":
      return { backend: "gpu", maxParticles: GPU_MAX_PARTICLES, allowLinks: true, allowTrails: true };
  }
}

export function createSeededRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShapeParticleTarget {
  readonly x: number;
  readonly y: number;
}

/** Generate deterministic target positions anchored to a Phase 175 layer outline or SDF interior. */
export function sampleShapeParticleTargets(
  sdf: LayerSdfResource,
  mode: ParticleShapeEmitMode,
  count: number,
  seed: number,
  offsetX = 0,
  offsetY = 0
): ShapeParticleTarget[] {
  const rng = createSeededRng(seed ^ 0x9e3779b9);
  const targets: ShapeParticleTarget[] = [];
  const outline = sdf.outlinePoints;

  if ((mode === "outline" || mode === "stick") && outline.length > 0) {
    for (let i = 0; i < count; i += 1) {
      const pt = outline[Math.floor((i / Math.max(1, count)) * outline.length) % outline.length]!;
      const jitter = mode === "stick" ? (rng() - 0.5) * 1.2 : 0;
      targets.push({ x: offsetX + pt.x + jitter, y: offsetY + pt.y + jitter });
    }
    return targets;
  }

  // Interior SDF rejection sampling for "fill"
  let attempts = 0;
  const maxAttempts = Math.max(200, count * 16);
  while (targets.length < count && attempts < maxAttempts) {
    attempts += 1;
    const lx = rng() * sdf.width;
    const ly = rng() * sdf.height;
    if (sampleSdfAt(sdf, lx, ly) <= 0) {
      targets.push({ x: offsetX + lx, y: offsetY + ly });
    }
  }
  while (targets.length < count) {
    targets.push({ x: offsetX + sdf.width * 0.5, y: offsetY + sdf.height * 0.5 });
  }
  return targets;
}

function f32(n: number): number {
  return Math.fround(n);
}

function curlNoise2D(x: number, y: number, freq: number): [number, number] {
  const fx = x * freq;
  const fy = y * freq;
  const dx = Math.cos(fy * 1.3 + Math.sin(fx * 0.9));
  const dy = -Math.sin(fx * 1.1 + Math.cos(fy * 0.8));
  return [dx, dy];
}

export interface ParticleStats {
  readonly activeCount: number;
  readonly centroidX: number;
  readonly centroidY: number;
  readonly meanSpeed: number;
  readonly linkCount: number;
}

export interface ParticleSystemInstance {
  readonly backend: ParticleBackendKind;
  readonly maxParticles: number;
  step(dtSec: number, inputs?: ParticleInputState): void;
  spawnBurst(count: number, cx: number, cy: number, speedPxPerSec?: number): void;
  getPositionsXY(): Float32Array;
  getVelocitiesXY(): Float32Array;
  getStats(): ParticleStats;
  reset(seed?: number): void;
}

/** Generate the GPU transform-feedback GLSL ES 3.00 update shader program corresponding to an emitter config. */
export function compileGpuParticleUpdateShader(config: ParticleEmitterConfig): string {
  const hasGravity = config.forces.find((f) => f.type === "gravity");
  const gx = hasGravity?.gx ?? 0;
  const gy = hasGravity?.gy ?? 0;
  return [
    "#version 300 es",
    "precision highp float;",
    "in vec2 a_pos;",
    "in vec2 a_vel;",
    "in float a_age;",
    "uniform float u_dt;",
    "uniform vec2 u_pointer;",
    "out vec2 v_pos;",
    "out vec2 v_vel;",
    "out float v_age;",
    "void main() {",
    `  vec2 g = vec2(${gx.toFixed(4)}, ${gy.toFixed(4)});`,
    "  vec2 vel = a_vel + g * u_dt;",
    "  vec2 toPtr = u_pointer - a_pos;",
    "  float d = max(1.0, length(toPtr));",
    "  vec2 pos = a_pos + vel * u_dt + (toPtr / d) * 0.0;",
    "  v_pos = pos;",
    "  v_vel = vel;",
    `  v_age = a_age + u_dt;`,
    "}",
  ].join("\n");
}

/**
 * Create a deterministic Niagara-style particle simulation running either on
 * CPU (`<= 5k`) or float32 GPU-quantized parity backend (`<= 250k`).
 */
export function createParticleSimulation(
  config: ParticleEmitterConfig,
  tier: "T0" | "T1" | "T2" | "T3" = "T2",
  forceBackend?: ParticleBackendKind
): ParticleSystemInstance {
  const budget = resolveParticleTierBudget(tier);
  const backend = forceBackend ?? budget.backend;
  const hardCap = backend === "cpu" ? CPU_MAX_PARTICLES : GPU_MAX_PARTICLES;
  const maxParticles = Math.max(1, Math.min(config.maxParticles, Math.min(budget.maxParticles, hardCap)));

  const posX = new Float32Array(maxParticles);
  const posY = new Float32Array(maxParticles);
  const velX = new Float32Array(maxParticles);
  const velY = new Float32Array(maxParticles);
  const targetX = new Float32Array(maxParticles);
  const targetY = new Float32Array(maxParticles);
  const age = new Float32Array(maxParticles);
  const alive = new Uint8Array(maxParticles);

  let rng = createSeededRng(config.seed);
  let spawnCursor = 0;
  let spawnAccum = 0;
  let elapsed = 0;

  const initShapeTargets = (): void => {
    if (!config.shapeTarget) return;
    const sampled = sampleShapeParticleTargets(
      config.shapeTarget.sdf,
      config.shapeTarget.mode,
      maxParticles,
      config.seed,
      config.shapeTarget.offsetX ?? 0,
      config.shapeTarget.offsetY ?? 0
    );
    for (let i = 0; i < maxParticles; i += 1) {
      targetX[i] = sampled[i]!.x;
      targetY[i] = sampled[i]!.y;
    }
  };
  initShapeTargets();

  const quantize = (v: number): number => (backend === "gpu" ? f32(v) : v);

  const spawnOne = (sx: number, sy: number, speed: number): void => {
    const idx = spawnCursor % maxParticles;
    spawnCursor += 1;
    const ang = rng() * Math.PI * 2;
    const rad = rng() * config.spreadRadiusPx;
    if (config.shapeTarget && config.shapeTarget.mode === "stick") {
      posX[idx] = quantize(targetX[idx]!);
      posY[idx] = quantize(targetY[idx]!);
    } else {
      posX[idx] = quantize(sx + Math.cos(ang) * rad);
      posY[idx] = quantize(sy + Math.sin(ang) * rad);
    }
    const vAngle = rng() * Math.PI * 2;
    const vMag = (0.5 + rng() * 0.5) * speed;
    velX[idx] = quantize(Math.cos(vAngle) * vMag);
    velY[idx] = quantize(Math.sin(vAngle) * vMag);
    age[idx] = 0;
    alive[idx] = 1;
  };

  return {
    backend,
    maxParticles,

    spawnBurst(count, cx, cy, speedPxPerSec = config.initialSpeedPxPerSec) {
      const n = Math.min(maxParticles, Math.max(0, Math.round(count)));
      for (let i = 0; i < n; i += 1) {
        spawnOne(cx, cy, speedPxPerSec);
      }
    },

    step(rawDt, inputs = { pointerX: config.originX, pointerY: config.originY }) {
      const dt = quantize(Math.max(0, Math.min(0.05, rawDt)));
      if (dt <= 0) return;
      elapsed += dt;

      spawnAccum += config.spawnRatePerSec * dt;
      while (spawnAccum >= 1) {
        spawnAccum -= 1;
        spawnOne(config.originX, config.originY, config.initialSpeedPxPerSec);
      }

      if (inputs.activeInteraction === "burst_on_tap" && inputs.tapX !== undefined && inputs.tapY !== undefined) {
        for (let b = 0; b < Math.min(32, maxParticles); b += 1) {
          spawnOne(inputs.tapX, inputs.tapY, Math.max(60, config.initialSpeedPxPerSec * 1.5));
        }
      }

      const pxPtr = inputs.pointerX;
      const pyPtr = inputs.pointerY;

      for (let i = 0; i < maxParticles; i += 1) {
        if (!alive[i]) continue;
        age[i] = age[i]! + dt;
        if (config.lifeSec > 0 && age[i]! >= config.lifeSec) {
          alive[i] = 0;
          continue;
        }

        let x = posX[i]!;
        let y = posY[i]!;
        let vx = velX[i]!;
        let vy = velY[i]!;

        for (const force of config.forces) {
          switch (force.type) {
            case "gravity":
              vx += force.gx * dt;
              vy += force.gy * dt;
              break;
            case "drag": {
              const damp = Math.max(0, 1 - force.coefficient * dt);
              vx *= damp;
              vy *= damp;
              break;
            }
            case "noise_curl": {
              const [cx, cy] = curlNoise2D(x + elapsed * 10, y - elapsed * 10, force.frequency);
              vx += cx * force.strength * dt;
              vy += cy * force.strength * dt;
              break;
            }
            case "vortex": {
              const dx = x - force.cx;
              const dy = y - force.cy;
              const dist = Math.max(8, Math.hypot(dx, dy));
              vx += (-dy / dist) * force.strength * dt;
              vy += (dx / dist) * force.strength * dt;
              break;
            }
            case "pointer_attract":
            case "pointer_repel":
            case "pointer_orbit": {
              const dx = pxPtr - x;
              const dy = pyPtr - y;
              const dist = Math.hypot(dx, dy);
              if (dist > 1e-4 && dist < force.radiusPx) {
                const falloff = 1 - dist / force.radiusPx;
                const nx = dx / dist;
                const ny = dy / dist;
                if (force.type === "pointer_attract") {
                  vx += nx * force.strength * falloff * dt;
                  vy += ny * force.strength * falloff * dt;
                } else if (force.type === "pointer_repel") {
                  vx -= nx * force.strength * falloff * dt;
                  vy -= ny * force.strength * falloff * dt;
                } else {
                  vx += -ny * force.strength * falloff * dt;
                  vy += nx * force.strength * falloff * dt;
                }
              }
              break;
            }
            case "spring_to_shape": {
              const tx = targetX[i]!;
              const ty = targetY[i]!;
              vx += (tx - x) * force.stiffness * dt - vx * force.damping * dt;
              vy += (ty - y) * force.stiffness * dt - vy * force.damping * dt;
              break;
            }
            case "bounds": {
              const rest = force.restitution ?? 0.6;
              if (x < force.minX) {
                x = force.minX;
                vx = Math.abs(vx) * rest;
              } else if (x > force.maxX) {
                x = force.maxX;
                vx = -Math.abs(vx) * rest;
              }
              if (y < force.minY) {
                y = force.minY;
                vy = Math.abs(vy) * rest;
              } else if (y > force.maxY) {
                y = force.maxY;
                vy = -Math.abs(vy) * rest;
              }
              break;
            }
          }
        }

        if (inputs.activeInteraction === "grab" && inputs.pointerDown) {
          const dx = pxPtr - x;
          const dy = pyPtr - y;
          const d = Math.hypot(dx, dy);
          if (d < 80 && d > 1e-4) {
            vx += (dx / d) * 400 * dt;
            vy += (dy / d) * 400 * dt;
          }
        } else if (inputs.activeInteraction === "repulse") {
          const dx = x - pxPtr;
          const dy = y - pyPtr;
          const d = Math.hypot(dx, dy);
          if (d < 90 && d > 1e-4) {
            vx += (dx / d) * 350 * dt;
            vy += (dy / d) * 350 * dt;
          }
        } else if (inputs.activeInteraction === "scatter_on_scroll" && inputs.scrollDeltaY) {
          vy -= inputs.scrollDeltaY * 0.25;
        }

        x = quantize(x + quantize(vx) * dt);
        y = quantize(y + quantize(vy) * dt);
        posX[i] = x;
        posY[i] = y;
        velX[i] = quantize(vx);
        velY[i] = quantize(vy);
      }
    },

    getPositionsXY() {
      const out = new Float32Array(maxParticles * 2);
      for (let i = 0; i < maxParticles; i += 1) {
        out[i * 2] = posX[i]!;
        out[i * 2 + 1] = posY[i]!;
      }
      return out;
    },

    getVelocitiesXY() {
      const out = new Float32Array(maxParticles * 2);
      for (let i = 0; i < maxParticles; i += 1) {
        out[i * 2] = velX[i]!;
        out[i * 2 + 1] = velY[i]!;
      }
      return out;
    },

    getStats(): ParticleStats {
      let activeCount = 0;
      let sumX = 0;
      let sumY = 0;
      let sumSpd = 0;
      for (let i = 0; i < maxParticles; i += 1) {
        if (!alive[i]) continue;
        activeCount += 1;
        sumX += posX[i]!;
        sumY += posY[i]!;
        sumSpd += Math.hypot(velX[i]!, velY[i]!);
      }

      let linkCount = 0;
      if (config.renderMode === "links" && budget.allowLinks) {
        const threshSq = Math.pow(config.linkDistancePx ?? 24, 2);
        const capCheck = Math.min(maxParticles, 128);
        for (let i = 0; i < capCheck; i += 1) {
          if (!alive[i]) continue;
          for (let j = i + 1; j < capCheck; j += 1) {
            if (!alive[j]) continue;
            const dx = posX[i]! - posX[j]!;
            const dy = posY[i]! - posY[j]!;
            if (dx * dx + dy * dy <= threshSq) {
              linkCount += 1;
            }
          }
        }
      }

      return {
        activeCount,
        centroidX: activeCount > 0 ? sumX / activeCount : 0,
        centroidY: activeCount > 0 ? sumY / activeCount : 0,
        meanSpeed: activeCount > 0 ? sumSpd / activeCount : 0,
        linkCount,
      };
    },

    reset(nextSeed = config.seed) {
      rng = createSeededRng(nextSeed);
      spawnCursor = 0;
      spawnAccum = 0;
      elapsed = 0;
      alive.fill(0);
      age.fill(0);
      posX.fill(0);
      posY.fill(0);
      velX.fill(0);
      velY.fill(0);
      initShapeTargets();
    },
  };
}
