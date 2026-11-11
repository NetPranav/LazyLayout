"use client";

/**
 * Test seam for counting React commits of the timeline panel and the stage artboard
 * during playback (ROADMAP Phase 56).
 * Exposed on window.__LL_COMMITS__ under the window.__LL_TEST__ guard.
 */
export interface CommitCounters {
  timeline: number;
  artboard: number;
  reset: () => void;
}

const counters: CommitCounters = {
  timeline: 0,
  artboard: 0,
  reset() {
    this.timeline = 0;
    this.artboard = 0;
  },
};

export function recordCommit(target: "timeline" | "artboard"): void {
  counters[target]++;
}

export function bindCommitCountersSeam(target: Window = typeof window !== "undefined" ? window : (globalThis as unknown as { window: Window }).window): void {
  if (!target) return;
  Object.defineProperty(target, "__LL_COMMITS__", {
    configurable: true,
    enumerable: true,
    get: () => {
      const w = target as unknown as { __LL_TEST__?: boolean };
      return w.__LL_TEST__ ? counters : undefined;
    },
  });
}

if (typeof window !== "undefined") {
  bindCommitCountersSeam(window);
}
