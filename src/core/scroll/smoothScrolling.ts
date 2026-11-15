/**
 * @file smoothScrolling.ts
 * @module core/scroll/smoothScrolling
 * @description Phase 189: Page-wide inertia smooth scrolling with native scroll
 * fallback, section snapping, scroll-velocity signal, and unconditional respect
 * for `reducedMotion`, keyboard scrolling, anchor jumps, and find-in-page.
 */

export interface SmoothScrollConfig {
  readonly maxScrollY: number;
  readonly smoothTimeConstantSec?: number; // exponential ease tau, default 0.11s
  readonly snapSectionsPx?: readonly number[];
  readonly snapThresholdVelocity?: number;
  readonly reducedMotion?: boolean;
  readonly nativeFallbackOnly?: boolean;
}

export interface SmoothScrollState {
  readonly currentY: number;
  readonly targetY: number;
  readonly velocityPxPerSec: number;
  readonly normalizedVelocity: number; // -1..1
  readonly smoothingActive: boolean;
  readonly snappedSectionIndex: number | null;
}

export type SmoothScrollKeyboardKey =
  | "PageDown"
  | "PageUp"
  | "Space"
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End";

export interface SmoothScrollController {
  wheelDelta(deltaY: number): void;
  keyboardJump(key: SmoothScrollKeyboardKey, viewportHeightPx: number): void;
  jumpToAnchor(anchorY: number): void;
  syncNativeScrollFromFindInPage(nativeScrollY: number): void;
  setReducedMotion(enabled: boolean): void;
  step(dtSec: number): SmoothScrollState;
  getState(): SmoothScrollState;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createSmoothScrollController(
  config: SmoothScrollConfig
): SmoothScrollController {
  const maxY = Math.max(0, config.maxScrollY);
  const tau = Math.max(0.02, config.smoothTimeConstantSec ?? 0.11);
  const snapList = [...(config.snapSectionsPx ?? [])].sort((a, b) => a - b);
  const snapThresh = config.snapThresholdVelocity ?? 18;

  let reducedMotion = config.reducedMotion ?? false;
  const nativeOnly = config.nativeFallbackOnly ?? false;
  let currentY = 0;
  let targetY = 0;
  let velocity = 0;
  let snappedIndex: number | null = null;
  let bypassSmoothingForNativeJump = false;

  const isSmoothingDisabled = (): boolean => reducedMotion || nativeOnly;

  const findNearestSnap = (y: number): { readonly idx: number; readonly y: number } | null => {
    if (snapList.length === 0) return null;
    let bestIdx = 0;
    let bestDist = Math.abs(y - snapList[0]!);
    for (let i = 1; i < snapList.length; i += 1) {
      const d = Math.abs(y - snapList[i]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { idx: bestIdx, y: clamp(snapList[bestIdx]!, 0, maxY) };
  };

  const applyInstantJump = (nextY: number): void => {
    const clamped = clamp(nextY, 0, maxY);
    targetY = clamped;
    currentY = clamped;
    velocity = 0;
    bypassSmoothingForNativeJump = true;
    const snap = findNearestSnap(clamped);
    snappedIndex = snap && Math.abs(snap.y - clamped) < 1 ? snap.idx : null;
  };

  const getSnapshot = (): SmoothScrollState => ({
    currentY,
    targetY,
    velocityPxPerSec: velocity,
    normalizedVelocity: clamp(velocity / 2400, -1, 1),
    smoothingActive: !isSmoothingDisabled(),
    snappedSectionIndex: snappedIndex,
  });

  return {
    wheelDelta(deltaY) {
      bypassSmoothingForNativeJump = false;
      snappedIndex = null;
      targetY = clamp(targetY + deltaY, 0, maxY);
      if (isSmoothingDisabled()) {
        currentY = targetY;
        velocity = 0;
      }
    },

    keyboardJump(key, viewportHeightPx) {
      const pageStep = Math.max(120, viewportHeightPx * 0.85);
      const lineStep = 64;
      let delta = 0;
      if (key === "PageDown" || key === "Space") delta = pageStep;
      else if (key === "PageUp") delta = -pageStep;
      else if (key === "ArrowDown") delta = lineStep;
      else if (key === "ArrowUp") delta = -lineStep;
      else if (key === "Home") {
        applyInstantJump(0);
        return;
      } else if (key === "End") {
        applyInstantJump(maxY);
        return;
      }

      const next = clamp(targetY + delta, 0, maxY);
      if (isSmoothingDisabled()) {
        applyInstantJump(next);
      } else {
        targetY = next;
        snappedIndex = null;
      }
    },

    jumpToAnchor(anchorY) {
      applyInstantJump(anchorY);
    },

    syncNativeScrollFromFindInPage(nativeScrollY) {
      applyInstantJump(nativeScrollY);
    },

    setReducedMotion(enabled) {
      reducedMotion = enabled;
      if (reducedMotion) {
        currentY = targetY;
        velocity = 0;
      }
    },

    step(dtSec) {
      const dt = Math.max(0, Math.min(0.05, dtSec));
      if (dt <= 0) return getSnapshot();

      if (isSmoothingDisabled() || bypassSmoothingForNativeJump) {
        currentY = targetY;
        velocity = 0;
        bypassSmoothingForNativeJump = false;
        return getSnapshot();
      }

      const alpha = 1 - Math.exp(-dt / tau);
      const nextY = currentY + (targetY - currentY) * alpha;
      velocity = (nextY - currentY) / dt;
      currentY = nextY;

      // Section snapping engages once inertia settles below threshold
      if (Math.abs(targetY - currentY) < 4 && Math.abs(velocity) < snapThresh) {
        const snap = findNearestSnap(targetY);
        if (snap) {
          targetY = snap.y;
          snappedIndex = snap.idx;
        }
      }

      if (Math.abs(targetY - currentY) < 0.05 && Math.abs(velocity) < 0.5) {
        currentY = targetY;
        velocity = 0;
      }

      return getSnapshot();
    },

    getState: getSnapshot,
  };
}
