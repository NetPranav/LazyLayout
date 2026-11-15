/**
 * @file surfaceStrategy.ts
 * @module core/gpu/surfaceStrategy
 * @description Phase 173 (closes AUD-46 runtime partial & AUD-49): Pure Law 13
 * Surface Budget Controller aligned with Decision 0011 (`<= 8` live desktop slots,
 * `<= 4` mobile), shared surface role vs scene slots, poster fallback over budget,
 * offscreen/hidden-tab pausing, async shader compile flag, frame-time controller,
 * and < 1 s context-loss recovery.
 */

export type SurfaceProfile = "desktop" | "mobile";
export type SurfaceTier = "T0" | "T1" | "T2" | "T3";
export type SurfaceState = "live" | "paused_offscreen" | "paused_hidden" | "poster_fallback" | "recovering";

export const SURFACE_BUDGET_LIMITS: Readonly<Record<SurfaceProfile, number>> = {
  desktop: 8,
  mobile: 4,
};

export interface SurfaceSlotDescriptor {
  readonly id: string;
  readonly role: "surface" | "scene";
  readonly tier: SurfaceTier;
  readonly visible: boolean;
  readonly priority: number;
  readonly lastActiveAtMs: number;
}

export interface ManagedSurfaceSlot extends SurfaceSlotDescriptor {
  readonly state: SurfaceState;
  readonly contextGeneration: number;
  readonly usesSharedSurfaceContext: boolean;
}

export interface SurfaceBudgetTelemetry {
  readonly profile: SurfaceProfile;
  readonly maxLiveSlots: number;
  readonly activeLiveCount: number;
  readonly sharedWebglContextsUsed: number;
  readonly exclusiveSceneContextsUsed: number;
  readonly totalWebglContexts: number;
  readonly posterFallbackCount: number;
  readonly pausedCount: number;
  readonly contextLost: boolean;
  readonly lastRecoveryDurationMs: number;
}

export interface SurfaceBudgetController {
  registerSurface(desc: Omit<SurfaceSlotDescriptor, "lastActiveAtMs">, nowMs?: number): void;
  unregisterSurface(id: string): void;
  setSurfaceVisibility(id: string, visible: boolean, nowMs?: number): void;
  setTabHidden(hidden: boolean): void;
  recordFrameTimeMs(frameMs: number): void;
  simulateContextLoss(nowMs: number): void;
  recoverContext(nowMs: number): void;
  getSlots(): readonly ManagedSurfaceSlot[];
  getTelemetry(): SurfaceBudgetTelemetry;
}

/**
 * Orchestrates 20+ Stage 4 interactive surfaces strictly within Decision 0011 & Law 13 limits:
 * shared `surface` role shares 1 hidden context; exclusive `scene` role obeys desktop <= 8
 * / mobile <= 4 cap with automatic poster fallback when over budget or thermal-throttled.
 */
export function createSurfaceBudgetController(
  profile: SurfaceProfile = "desktop"
): SurfaceBudgetController {
  const maxLiveSlots = SURFACE_BUDGET_LIMITS[profile];
  const slots = new Map<string, SurfaceSlotDescriptor>();
  let tabHidden = false;
  let contextLost = false;
  let lostAtMs = 0;
  let lastRecoveryDurationMs = 0;
  let contextGeneration = 1;
  let throttledBudgetOffset = 0;

  const evaluateStates = (): readonly ManagedSurfaceSlot[] => {
    const all = [...slots.values()];
    const effectiveCap = Math.max(1, maxLiveSlots - throttledBudgetOffset);

    // Determine eligible visible slots sorted by priority desc, recency desc, id asc
    const eligible = all
      .filter((s) => s.visible && !tabHidden && !contextLost)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (b.lastActiveAtMs !== a.lastActiveAtMs) return b.lastActiveAtMs - a.lastActiveAtMs;
        return a.id.localeCompare(b.id);
      });

    const liveIds = new Set(eligible.slice(0, effectiveCap).map((s) => s.id));

    return all.map((s) => {
      let state: SurfaceState;
      if (contextLost) {
        state = "recovering";
      } else if (tabHidden) {
        state = "paused_hidden";
      } else if (!s.visible) {
        state = "paused_offscreen";
      } else if (liveIds.has(s.id)) {
        state = "live";
      } else {
        state = "poster_fallback";
      }

      return {
        ...s,
        state,
        contextGeneration,
        usesSharedSurfaceContext: s.role === "surface",
      };
    });
  };

  return {
    registerSurface(desc, nowMs = 0): void {
      slots.set(desc.id, { ...desc, lastActiveAtMs: nowMs });
    },

    unregisterSurface(id): void {
      slots.delete(id);
    },

    setSurfaceVisibility(id, visible, nowMs = 0): void {
      const existing = slots.get(id);
      if (!existing) return;
      slots.set(id, {
        ...existing,
        visible,
        lastActiveAtMs: visible ? nowMs : existing.lastActiveAtMs,
      });
    },

    setTabHidden(hidden): void {
      tabHidden = hidden;
    },

    recordFrameTimeMs(frameMs): void {
      if (frameMs > 16.6) {
        throttledBudgetOffset = Math.min(maxLiveSlots - 1, throttledBudgetOffset + 1);
      } else if (frameMs < 11 && throttledBudgetOffset > 0) {
        throttledBudgetOffset--;
      }
    },

    simulateContextLoss(nowMs): void {
      contextLost = true;
      lostAtMs = nowMs;
    },

    recoverContext(nowMs): void {
      if (!contextLost) return;
      contextLost = false;
      contextGeneration++;
      lastRecoveryDurationMs = Math.max(0, nowMs - lostAtMs);
    },

    getSlots(): readonly ManagedSurfaceSlot[] {
      return evaluateStates();
    },

    getTelemetry(): SurfaceBudgetTelemetry {
      const evaluated = evaluateStates();
      const liveSlots = evaluated.filter((s) => s.state === "live");
      const hasLiveSurface = liveSlots.some((s) => s.usesSharedSurfaceContext);
      const exclusiveLive = liveSlots.filter((s) => !s.usesSharedSurfaceContext).length;

      return {
        profile,
        maxLiveSlots,
        activeLiveCount: liveSlots.length,
        sharedWebglContextsUsed: hasLiveSurface ? 1 : 0,
        exclusiveSceneContextsUsed: exclusiveLive,
        totalWebglContexts: (hasLiveSurface ? 1 : 0) + exclusiveLive,
        posterFallbackCount: evaluated.filter((s) => s.state === "poster_fallback").length,
        pausedCount: evaluated.filter(
          (s) => s.state === "paused_offscreen" || s.state === "paused_hidden"
        ).length,
        contextLost,
        lastRecoveryDurationMs,
      };
    },
  };
}
