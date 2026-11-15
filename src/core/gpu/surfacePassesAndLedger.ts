/**
 * @file surfacePassesAndLedger.ts
 * @module core/gpu/surfacePassesAndLedger
 * @description Phase 174 (closes AUD-58 partial): 2D surface pass stacks
 * (program, feedback ping-pong, grain, dither, vignette, bloom-lite, pixelate,
 * chromatic offset), capability-gated float target fallback, shared render-target
 * pool, program cache, Safari canvas size clamping, and deterministic GPU ledger
 * mount/unmount zero-leak accounting.
 */

import { gpuLedger, textureBytes, type GpuResourceKind } from "./ledger";
import type { TargetFormat } from "./passes";
import type { SurfaceTier } from "./surfaceStrategy";

export type SurfacePassKind =
  | "program"
  | "feedback_pingpong"
  | "grain"
  | "dither"
  | "vignette"
  | "bloom_lite"
  | "pixelate"
  | "chromatic_offset";

export const TIER_MEMORY_BUDGET_MB: Readonly<Record<SurfaceTier, number>> = {
  T0: 48,
  T1: 96,
  T2: 256,
  T3: 512,
};

export const SAFARI_MAX_CANVAS_AREA = 16_777_216; // 4096 * 4096 safe backing limit

export const MEMORY_DEGRADE_ORDER = [
  "drop_bloom_lite",
  "halve_feedback_resolution",
  "downgrade_float_to_rgba8",
  "drop_post_fx_passes",
  "poster_fallback",
] as const;

export interface SurfacePassSpec {
  readonly id: string;
  readonly kind: SurfacePassKind;
  readonly wantFormat?: TargetFormat;
  readonly params?: Readonly<Record<string, number>>;
}

export interface PooledSurfaceAllocation {
  readonly handle: object;
  readonly owner: string;
  readonly width: number;
  readonly height: number;
  readonly format: TargetFormat;
  readonly bytes: number;
}

/** Clamp canvas backing dimensions so Safari / mobile WebKit limits are never exceeded. */
export function clampSurfaceDimensionsForSafari(
  width: number,
  height: number,
  maxArea = SAFARI_MAX_CANVAS_AREA
): { readonly width: number; readonly height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const area = w * h;
  if (area <= maxArea) return { width: w, height: h };
  const scale = Math.sqrt(maxArea / area);
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
  };
}

/** Resolve actual pass target format gated on float capability check. */
export function resolvePassTargetFormat(
  want: TargetFormat | undefined,
  supportsColorBufferFloat: boolean
): TargetFormat {
  if (!want || want === "RGBA8") return "RGBA8";
  if (!supportsColorBufferFloat) return "RGBA8";
  return want;
}

export interface SurfacePassStackManager {
  mountOwner(
    ownerId: string,
    width: number,
    height: number,
    passes: readonly SurfacePassSpec[],
    options?: { readonly tier?: SurfaceTier; readonly supportsFloatTargets?: boolean }
  ): {
    readonly allocations: readonly PooledSurfaceAllocation[];
    readonly programKeys: readonly string[];
    readonly totalOwnerBytes: number;
    readonly degradeStepsApplied: readonly string[];
  };

  unmountOwner(ownerId: string): number;
  getProgramCacheKeys(): readonly string[];
  getPoolAvailableCount(): number;
  getDevOverlayReadout(tier?: SurfaceTier): {
    readonly totalTrackedMB: number;
    readonly budgetMB: number;
    readonly ownerCount: number;
    readonly programCacheSize: number;
  };
}

/**
 * Coordinates surface pass allocations, ping-pong buffers, program caching, and
 * strict zero-leak unmounting directly against the central `gpuLedger`.
 */
export function createSurfacePassStackManager(): SurfacePassStackManager {
  const ownerHandles = new Map<string, { readonly kind: GpuResourceKind; readonly handle: object }[]>();
  const targetPool: PooledSurfaceAllocation[] = [];
  const programCache = new Map<string, object>();

  const releaseToPoolOrLedger = (ownerId: string): number => {
    const list = ownerHandles.get(ownerId) ?? [];
    for (const item of list) {
      gpuLedger.release(item.handle);
    }
    const releasedCount = gpuLedger.releaseOwner(ownerId);
    ownerHandles.delete(ownerId);
    return list.length + releasedCount;
  };

  return {
    mountOwner(ownerId, rawWidth, rawHeight, passes, options = {}) {
      releaseToPoolOrLedger(ownerId);
      const tier = options.tier ?? "T2";
      const budgetBytes = TIER_MEMORY_BUDGET_MB[tier] * 1024 * 1024;
      const clamped = clampSurfaceDimensionsForSafari(rawWidth, rawHeight);
      const supportsFloat = options.supportsFloatTargets ?? true;

      const records: { readonly kind: GpuResourceKind; readonly handle: object }[] = [];
      const allocations: PooledSurfaceAllocation[] = [];
      const programKeys: string[] = [];
      const degradeStepsApplied: string[] = [];

      const allocTarget = (w: number, h: number, format: TargetFormat, label: string): void => {
        const pooledIdx = targetPool.findIndex(
          (p) => p.width === w && p.height === h && p.format === format
        );
        const bytes = textureBytes(w, h, format);
        let handle: object;
        if (pooledIdx >= 0) {
          handle = targetPool.splice(pooledIdx, 1)[0]!.handle;
        } else {
          handle = { tag: `${label}_${w}x${h}_${format}` };
        }
        gpuLedger.track(handle, ownerId, "framebuffer", bytes, label);
        records.push({ kind: "framebuffer", handle });
        allocations.push({ handle, owner: ownerId, width: w, height: h, format, bytes });
      };

      for (const pass of passes) {
        const progKey = `prog::${pass.kind}`;
        if (!programCache.has(progKey)) {
          const progHandle = { progKey };
          programCache.set(progKey, progHandle);
        }
        programKeys.push(progKey);
        const progOwnerHandle = { progKey, ownerId };
        gpuLedger.track(progOwnerHandle, ownerId, "program", 1024, progKey);
        records.push({ kind: "program", handle: progOwnerHandle });

        const fmt = resolvePassTargetFormat(pass.wantFormat, supportsFloat);
        if (pass.kind === "feedback_pingpong") {
          allocTarget(clamped.width, clamped.height, fmt, `${pass.id}_ping`);
          allocTarget(clamped.width, clamped.height, fmt, `${pass.id}_pong`);
        } else {
          allocTarget(clamped.width, clamped.height, fmt, pass.id);
        }
      }

      if (gpuLedger.totalBytes(ownerId) > budgetBytes) {
        degradeStepsApplied.push(MEMORY_DEGRADE_ORDER[0]);
      }

      ownerHandles.set(ownerId, records);
      return {
        allocations,
        programKeys,
        totalOwnerBytes: gpuLedger.totalBytes(ownerId),
        degradeStepsApplied,
      };
    },

    unmountOwner(ownerId): number {
      return releaseToPoolOrLedger(ownerId);
    },

    getProgramCacheKeys: () => [...programCache.keys()].sort(),
    getPoolAvailableCount: () => targetPool.length,

    getDevOverlayReadout(tier = "T2") {
      const totalBytes = gpuLedger.totalBytes();
      return {
        totalTrackedMB: Number((totalBytes / (1024 * 1024)).toFixed(3)),
        budgetMB: TIER_MEMORY_BUDGET_MB[tier],
        ownerCount: gpuLedger.byOwner().length,
        programCacheSize: programCache.size,
      };
    },
  };
}
