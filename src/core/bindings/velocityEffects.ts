import { BindingDraftSchema, type BindingDraft } from "../document/signals";
import type { Vec2 } from "./evaluate";

export interface VelocityDeformOptions {
  /** Max elongation factor along motion vector (e.g. 0.45 -> max 1.45x stretch). */
  readonly maxStretch?: number;
  /** Speed (px/s) at which half the max stretch is reached. */
  readonly referenceSpeed?: number;
  /** Impact squash boost when decelerating sharply. */
  readonly impactSquash?: number;
  /** Max lean tilt in degrees. */
  readonly maxLeanDeg?: number;
  /** Smoothness bounce parameter for Simple mode (0..100). */
  readonly bounce?: number;
}

export interface SquashStretchResult {
  readonly speed: number;
  readonly angleDeg: number;
  readonly scaleParallel: number;
  readonly scalePerp: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly skewX: number;
  readonly rotate: number;
}

export interface EchoCopyPose {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
  readonly scale: number;
}

export interface SpeedLineSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly opacity: number;
}

/**
 * Area-preserving squash & stretch along the current velocity vector, plus
 * turn banking (lean) when direction changes.
 */
export function computeVelocityDeform(
  vx: number,
  vy: number,
  prevSpeed: number,
  prevAngleDeg: number,
  dt: number,
  options: VelocityDeformOptions = {}
): SquashStretchResult {
  const speed = Math.hypot(vx, vy);
  const safeDt = Math.max(1 / 240, Math.min(dt, 1 / 15));
  const refSpeed = Math.max(1, options.referenceSpeed ?? 600);
  const maxStretch = Math.max(0, options.maxStretch ?? 0.4);
  const maxLeanDeg = options.maxLeanDeg ?? 18;
  const angleDeg = speed > 1e-3 ? (Math.atan2(vy, vx) * 180) / Math.PI : prevAngleDeg;

  const stretchT = speed / (speed + refSpeed);
  let scaleParallel = 1 + stretchT * maxStretch;

  // Sudden deceleration compresses along travel direction ("stop squash")
  const accel = (speed - prevSpeed) / safeDt;
  if (accel < -400 && (options.impactSquash ?? 0.25) > 0) {
    const impact = Math.min(0.35, ((-accel - 400) / 3000) * (options.impactSquash ?? 0.25));
    scaleParallel = Math.max(0.65, 1 - impact);
  }

  const scalePerp = 1 / scaleParallel;
  const dominantHorizontal = Math.abs(vx) >= Math.abs(vy);
  const scaleX = dominantHorizontal ? scaleParallel : scalePerp;
  const scaleY = dominantHorizontal ? scalePerp : scaleParallel;

  // Lean into turns & lateral speed
  let dAngle = angleDeg - prevAngleDeg;
  while (dAngle > 180) dAngle -= 360;
  while (dAngle < -180) dAngle += 360;
  const rawLean = (vx / refSpeed) * (maxLeanDeg * 0.65) + (dAngle / 90) * (maxLeanDeg * 0.35);
  const rotate = Math.max(-maxLeanDeg, Math.min(maxLeanDeg, rawLean));
  const skewX = Math.max(-16, Math.min(16, -(vx / refSpeed) * 10));

  return {
    speed,
    angleDeg,
    scaleParallel,
    scalePerp,
    scaleX,
    scaleY,
    skewX,
    rotate,
  };
}

/** Generates echo copy transforms and speed lines behind a moving trail. */
export function buildMotionEchoesAndSpeedLines(
  trail: readonly Vec2[],
  vx: number,
  vy: number,
  echoCount = 4
): { readonly echoes: readonly EchoCopyPose[]; readonly speedLines: readonly SpeedLineSegment[] } {
  const speed = Math.hypot(vx, vy);
  const ux = speed > 1e-3 ? vx / speed : 1;
  const uy = speed > 1e-3 ? vy / speed : 0;
  const echoes: EchoCopyPose[] = [];
  const count = Math.min(echoCount, trail.length);
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const pt = trail[i]!;
    echoes.push({
      index: i,
      x: pt[0],
      y: pt[1],
      opacity: Number((0.6 * (1 - t)).toFixed(3)),
      scale: Number((1 - t * 0.22).toFixed(3)),
    });
  }

  const lineLength = Math.min(80, speed * 0.08);
  const speedLines: SpeedLineSegment[] = [];
  if (trail.length > 0 && lineLength >= 4) {
    const head = trail[0]!;
    const px = -uy;
    const py = ux;
    for (const offset of [-14, 0, 14]) {
      const sx = head[0] + px * offset;
      const sy = head[1] + py * offset;
      speedLines.push({
        x1: sx,
        y1: sy,
        x2: sx - ux * lineLength,
        y2: sy - uy * lineLength,
        opacity: Math.min(0.85, speed / 1200),
      });
    }
  }

  return { echoes, speedLines };
}

/** Simple mode face: Bounce (0..100) + Stretch (0..100). */
export function mapBounceAndStretch(bounce: number, stretch: number): VelocityDeformOptions {
  const b = Math.max(0, Math.min(100, bounce)) / 100;
  const s = Math.max(0, Math.min(100, stretch)) / 100;
  return {
    bounce: bounce,
    maxStretch: Number((s * 0.55).toFixed(3)),
    impactSquash: Number((b * 0.35).toFixed(3)),
    maxLeanDeg: Number((6 + b * 18).toFixed(1)),
    referenceSpeed: 550,
  };
}

/** Synthesizes validated BindingDrafts for pointer-speed stretch & turn lean. */
export function buildVelocityPresetDrafts(
  layerId: string,
  bounce = 50,
  stretch = 60
): BindingDraft[] {
  const cfg = mapBounceAndStretch(bounce, stretch);
  const on = { kind: "layer" as const, ref: layerId };
  return [
    BindingDraftSchema.parse({
      expr: {
        signal: { kind: "pointer", channel: "speed" },
        operators: [
          { op: "remap", inMin: 0, inMax: 1500, outMin: 1, outMax: 1 + (cfg.maxStretch ?? 0.3), clamp: true },
          { op: "spring", spring: { bounce: Math.min(0.95, (cfg.bounce ?? 50) / 100), time: 0.32 } },
        ],
      },
      target: { kind: "property", on, path: "transform.scaleX" },
      blend: "multiply",
    }),
    BindingDraftSchema.parse({
      expr: {
        signal: { kind: "pointer", channel: "dx" },
        operators: [
          { op: "remap", inMin: -40, inMax: 40, outMin: -(cfg.maxLeanDeg ?? 14), outMax: cfg.maxLeanDeg ?? 14, clamp: true },
          { op: "smooth", tau: 0.08 },
        ],
      },
      target: { kind: "property", on, path: "transform.rotate" },
      blend: "add",
    }),
  ];
}
