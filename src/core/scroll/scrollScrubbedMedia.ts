/**
 * @file scrollScrubbedMedia.ts
 * @module core/scroll/scrollScrubbedMedia
 * @description Phase 188: Scroll-scrubbed image sequences and video stories
 * with pinned section ranges, per-tier frame preloading windows, LRU memory
 * budgets, and poster fallbacks for low tiers or unbuffered jumps.
 */

export type ScrubMediaKind = "image_sequence" | "video";

export interface ScrollScrubMediaSpec {
  readonly id: string;
  readonly kind: ScrubMediaKind;
  readonly frameCount: number;
  readonly durationSec?: number;
  readonly posterUrl: string;
  readonly bytesPerDecodedFrame: number;
  readonly pinStartPx: number;
  readonly pinEndPx: number;
}

export interface ScrollMediaTierBudget {
  readonly preloadRadiusFrames: number;
  readonly maxCachedFrames: number;
  readonly maxMemoryBytes: number;
  readonly posterOnlyFallback: boolean;
}

export interface ScrollMediaEvalState {
  readonly scrollY: number;
  readonly progress: number; // 0..1
  readonly isPinned: boolean;
  readonly pinTranslatePx: number;
  readonly frameIndex: number;
  readonly videoTimestampSec: number;
  readonly cachedFrameCount: number;
  readonly cachedMemoryBytes: number;
  readonly withinMemoryBudget: boolean;
  readonly usingPosterFallback: boolean;
  readonly activeUrl: string;
  readonly preloadWindowIndices: readonly number[];
}

export function resolveScrollMediaTierBudget(
  tier: "T0" | "T1" | "T2" | "T3"
): ScrollMediaTierBudget {
  switch (tier) {
    case "T0":
      return {
        preloadRadiusFrames: 2,
        maxCachedFrames: 12,
        maxMemoryBytes: 16 * 1024 * 1024,
        posterOnlyFallback: true,
      };
    case "T1":
      return {
        preloadRadiusFrames: 6,
        maxCachedFrames: 28,
        maxMemoryBytes: 48 * 1024 * 1024,
        posterOnlyFallback: false,
      };
    case "T2":
      return {
        preloadRadiusFrames: 16,
        maxCachedFrames: 72,
        maxMemoryBytes: 128 * 1024 * 1024,
        posterOnlyFallback: false,
      };
    case "T3":
      return {
        preloadRadiusFrames: 32,
        maxCachedFrames: 180,
        maxMemoryBytes: 256 * 1024 * 1024,
        posterOnlyFallback: false,
      };
  }
}

export interface ScrollScrubMediaController {
  evaluateAtScroll(scrollY: number, overrideInput01?: number): ScrollMediaEvalState;
  markFrameDecoded(frameIndex: number): void;
  getCachedFrames(): readonly number[];
  clearCache(): void;
}

export function createScrollScrubMediaController(
  spec: ScrollScrubMediaSpec,
  tier: "T0" | "T1" | "T2" | "T3" = "T2",
  frameUrlPattern = (idx: number) => `frames/${spec.id}/${String(idx).padStart(4, "0")}.webp`
): ScrollScrubMediaController {
  const budget = resolveScrollMediaTierBudget(tier);
  const totalFrames = Math.max(1, spec.frameCount);
  const bytesPerFrame = Math.max(1024, spec.bytesPerDecodedFrame);
  const durationSec = Math.max(0.1, spec.durationSec ?? totalFrames / 30);

  // Ordered LRU cache of decoded frame indices
  const lruFrames: number[] = [];

  const evictIfNeeded = (): void => {
    const budgetFrameCap = Math.max(
      1,
      Math.min(budget.maxCachedFrames, Math.floor(budget.maxMemoryBytes / bytesPerFrame))
    );
    while (lruFrames.length > budgetFrameCap) {
      lruFrames.shift();
    }
  };

  const touchFrame = (idx: number): void => {
    const pos = lruFrames.indexOf(idx);
    if (pos >= 0) {
      lruFrames.splice(pos, 1);
    }
    lruFrames.push(idx);
    evictIfNeeded();
  };

  return {
    markFrameDecoded(frameIndex) {
      const clamped = Math.max(0, Math.min(totalFrames - 1, frameIndex));
      touchFrame(clamped);
    },

    getCachedFrames: () => [...lruFrames],

    clearCache: () => {
      lruFrames.length = 0;
    },

    evaluateAtScroll(scrollY, overrideInput01) {
      const span = Math.max(1, spec.pinEndPx - spec.pinStartPx);
      const rawProgress =
        overrideInput01 !== undefined
          ? overrideInput01
          : (scrollY - spec.pinStartPx) / span;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const isPinned = scrollY >= spec.pinStartPx && scrollY <= spec.pinEndPx;
      const pinTranslatePx = isPinned
        ? scrollY - spec.pinStartPx
        : scrollY > spec.pinEndPx
          ? span
          : 0;

      const frameIndex = Math.min(
        totalFrames - 1,
        Math.max(0, Math.round(progress * (totalFrames - 1)))
      );
      const videoTimestampSec = progress * durationSec;

      const preloadWindowIndices: number[] = [];
      const radius = budget.preloadRadiusFrames;
      for (let d = 0; d <= radius; d += 1) {
        const fwd = frameIndex + d;
        if (fwd < totalFrames) preloadWindowIndices.push(fwd);
        if (d > 0) {
          const bwd = frameIndex - d;
          if (bwd >= 0) preloadWindowIndices.push(bwd);
        }
      }

      if (!budget.posterOnlyFallback) {
        for (const fIdx of preloadWindowIndices) {
          touchFrame(fIdx);
        }
      }

      const cachedMemoryBytes = lruFrames.length * bytesPerFrame;
      const usingPosterFallback =
        budget.posterOnlyFallback && !lruFrames.includes(frameIndex);

      return {
        scrollY,
        progress,
        isPinned,
        pinTranslatePx,
        frameIndex,
        videoTimestampSec,
        cachedFrameCount: lruFrames.length,
        cachedMemoryBytes,
        withinMemoryBudget: cachedMemoryBytes <= budget.maxMemoryBytes,
        usingPosterFallback,
        activeUrl: usingPosterFallback ? spec.posterUrl : frameUrlPattern(frameIndex),
        preloadWindowIndices,
      };
    },
  };
}
