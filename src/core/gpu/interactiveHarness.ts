/**
 * Phase 137 — GPU & Interactive Verification Harness (`src/core/gpu/interactiveHarness.ts`).
 *
 * Combines deterministic Input Tape playback (`playTape`), perceptual GPU frame comparison
 * (`compare`, SSIM + neighbourhood error), particle distribution statistics, and GPU resource
 * leak verification (`GpuLedger`) with tolerance tiers (`software-ci`, `real-gpu`, `strict`)
 * and deliberate falsifier fixtures that must fail.
 */
import type { InputTape } from "../document/effects";
import type { Frame } from "../bindings/evaluate";
import { playTape } from "../bindings/tape";
import { compare, type CompareOptions, type CompareResult, type Rgba } from "./compare";
import { GpuLedger } from "./ledger";

export type VerificationTier = "strict" | "real-gpu" | "software-ci";

export const TIER_TOLERANCES: Record<VerificationTier, CompareOptions> = {
  strict: { channelTolerance: 2, radius: 0, maxBadFraction: 0, minSsim: 0.995 },
  "real-gpu": { channelTolerance: 6, radius: 1, maxBadFraction: 0.001, minSsim: 0.95 },
  "software-ci": { channelTolerance: 14, radius: 1, maxBadFraction: 0.005, minSsim: 0.88 },
};

export interface ParticleSample {
  x: number;
  y: number;
}

export interface ParticleStats {
  count: number;
  centroidX: number;
  centroidY: number;
  spread: number;
}

export function computeParticleStats(particles: readonly ParticleSample[]): ParticleStats {
  const count = particles.length;
  if (count === 0) return { count: 0, centroidX: 0, centroidY: 0, spread: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of particles) {
    sx += p.x;
    sy += p.y;
  }
  const centroidX = sx / count;
  const centroidY = sy / count;
  let sq = 0;
  for (const p of particles) {
    sq += (p.x - centroidX) ** 2 + (p.y - centroidY) ** 2;
  }
  return { count, centroidX, centroidY, spread: Math.sqrt(sq / count) };
}

export interface HarnessCheckpoint {
  readonly frameIndex: number;
  readonly golden: Rgba;
  readonly expectedParticles?: { count: number; centroidX: number; centroidY: number; tolerancePx: number };
}

export interface HarnessReport {
  readonly pass: boolean;
  readonly tier: VerificationTier;
  readonly leakedBytes: number;
  readonly leakedCount: number;
  readonly checkpoints: readonly {
    frameIndex: number;
    compare: CompareResult;
    particlesOk: boolean;
  }[];
  readonly failures: readonly string[];
}

/**
 * Runs a deterministic interactive scene over `tape`, captures checkpoint frames, checks
 * perceptual metrics against golden buffers, verifies particle statistics, runs teardown,
 * and asserts zero leaked GPU resources on `ledger`.
 */
export function verifyInteractiveTapeScene(options: {
  tape: InputTape;
  fps?: number;
  tier?: VerificationTier;
  ledger: GpuLedger;
  ownerPrefix?: string;
  checkpoints: readonly HarnessCheckpoint[];
  stepAndCapture: (frame: Frame, frameIndex: number, capture: boolean) => { image?: Rgba; particles?: readonly ParticleSample[] };
  teardown: () => void;
}): HarnessReport {
  const tier = options.tier ?? "software-ci";
  const tol = TIER_TOLERANCES[tier];
  const checkpointMap = new Map(options.checkpoints.map((c) => [c.frameIndex, c]));
  const results: { frameIndex: number; compare: CompareResult; particlesOk: boolean }[] = [];
  const failures: string[] = [];

  let idx = 0;
  const visited = new Set<number>();
  try {
    for (const frame of playTape(options.tape, options.fps ?? 60, options.tape.seed ?? 0)) {
      const cp = checkpointMap.get(idx);
      const out = options.stepAndCapture(frame, idx, !!cp);
      if (cp) {
        if (!out.image) {
          const empty: Rgba = { width: cp.golden.width, height: cp.golden.height, data: new Uint8Array(cp.golden.width * cp.golden.height * 4) };
          const cmp = compare(empty, cp.golden, tol);
          results.push({ frameIndex: idx, compare: cmp, particlesOk: false });
          failures.push(`frame ${idx}: missing rendered image`);
        } else {
          const cmp = compare(out.image, cp.golden, tol);
          let particlesOk = true;
          if (cp.expectedParticles) {
            const stats = computeParticleStats(out.particles ?? []);
            const dist = Math.hypot(stats.centroidX - cp.expectedParticles.centroidX, stats.centroidY - cp.expectedParticles.centroidY);
            particlesOk = stats.count === cp.expectedParticles.count && dist <= cp.expectedParticles.tolerancePx;
            if (!particlesOk) failures.push(`frame ${idx}: particle stats mismatch (count=${stats.count}, dist=${dist.toFixed(1)})`);
          }
          if (!cmp.pass) failures.push(`frame ${idx}: visual mismatch (ssim=${cmp.ssim.toFixed(3)}, bad=${cmp.badFraction.toFixed(4)})`);
          results.push({ frameIndex: idx, compare: cmp, particlesOk });
        }
      }
      if (cp) visited.add(idx);
      idx += 1;
    }
  } catch (err) {
    failures.push(`frame ${idx}: stepAndCapture threw: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    // Always tear down, so the leak check below also runs after a failure.
    options.teardown();
  }

  // A checkpoint the tape never reached was never checked: that is a failure, not a pass.
  for (const cp of options.checkpoints) {
    if (!visited.has(cp.frameIndex)) failures.push(`frame ${cp.frameIndex}: checkpoint never reached (the tape has ${idx} frames)`);
  }
  if (options.checkpoints.length === 0) failures.push("no checkpoints: nothing was compared");
  const prefix = options.ownerPrefix ?? "";
  const leakedBytes = options.ledger.totalBytes(prefix);
  const leakedCount = options.ledger.count(prefix);
  if (leakedBytes > 0 || leakedCount > 0) {
    failures.push(`gpu ledger leak after teardown: ${leakedCount} entries (${leakedBytes} bytes)`);
  }

  return {
    pass: failures.length === 0,
    tier,
    leakedBytes,
    leakedCount,
    checkpoints: results,
    failures,
  };
}

/** Builds a solid RGBA buffer for deterministic fixture/falsifier tests. */
export function solidRgba(width: number, height: number, rgba: readonly [number, number, number, number]): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = rgba[0];
    data[o + 1] = rgba[1];
    data[o + 2] = rgba[2];
    data[o + 3] = rgba[3];
  }
  return { width, height, data };
}
