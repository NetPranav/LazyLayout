/**
 * ROADMAP_3D 3D-005: device tiers and budgets, in pure code. Every 3D feature declares what it costs and what it gives
 * up first when a device can't afford it (its downgrade order). `fitScene` checks a scene's features against a tier and,
 * when it is over budget, names the feature to drop and drops them in a documented order until it fits.
 */

export type Tier = "low" | "mid" | "high";

/** What a scene uses, or what a tier allows. Frame and simulation times are per frame, in ms. */
export interface Cost {
  /** GPU time per frame. */
  frameMs: number;
  /** GPU memory (textures, targets, buffers), MB. */
  gpuMB: number;
  drawCalls: number;
  /** Triangles drawn per frame, in thousands. */
  kTriangles: number;
  /** CPU time per frame for simulation and animation, ms. */
  simMs: number;
}

export const ZERO_COST: Cost = { frameMs: 0, gpuMB: 0, drawCalls: 0, kTriangles: 0, simMs: 0 };

/** What one scene may use at 60 fps on each tier. The low tier is a mid-range phone, the mid tier a thin laptop. */
export const TIER_BUDGETS: Record<Tier, Cost & { sceneContexts: number; maxPixelRatio: number }> = {
  low: { frameMs: 6, gpuMB: 96, drawCalls: 80, kTriangles: 120, simMs: 3, sceneContexts: 3, maxPixelRatio: 1.5 },
  mid: { frameMs: 8, gpuMB: 256, drawCalls: 250, kTriangles: 600, simMs: 5, sceneContexts: 6, maxPixelRatio: 2 },
  high: { frameMs: 10, gpuMB: 768, drawCalls: 800, kTriangles: 3000, simMs: 8, sceneContexts: 10, maxPixelRatio: 3 },
};

export interface FeatureCost {
  id: string;
  label: string;
  cost: Cost;
  /** Lower number drops first. `Infinity` (the default for essential features) never drops. */
  dropOrder?: number;
  /** What dropping it gives up, in words, shown by the meter. */
  downgrade?: string;
}

export interface FitResult {
  tier: Tier;
  fits: boolean;
  used: Cost;
  budget: Cost;
  /** Budget lines that are over (names of `Cost` keys). */
  over: Array<keyof Cost>;
  /** What to drop, in order, to fit (empty when it already fits). */
  drop: FeatureCost[];
  /** Still over after dropping everything droppable: the scene itself is too heavy for this tier. */
  hopeless: boolean;
}

const KEYS: Array<keyof Cost> = ["frameMs", "gpuMB", "drawCalls", "kTriangles", "simMs"];

export function addCosts(items: readonly FeatureCost[]): Cost {
  const out = { ...ZERO_COST };
  for (const f of items) for (const k of KEYS) out[k] += f.cost[k];
  return out;
}

const overKeys = (used: Cost, budget: Cost): Array<keyof Cost> => KEYS.filter((k) => used[k] > budget[k] + 1e-9);

/**
 * Does the scene fit `tier`? If not, the features to drop: the lowest `dropOrder` that helps with a line that is over,
 * one at a time, until it fits.
 */
export function fitScene(features: readonly FeatureCost[], tier: Tier): FitResult {
  const budget = TIER_BUDGETS[tier];
  let kept = [...features];
  const drop: FeatureCost[] = [];
  let used = addCosts(kept);
  let over = overKeys(used, budget);
  const first = { used, over };
  while (over.length > 0) {
    const candidates = kept
      .filter((f) => Number.isFinite(f.dropOrder ?? Infinity) && over.some((k) => f.cost[k] > 0))
      .sort((a, b) => (a.dropOrder ?? 0) - (b.dropOrder ?? 0));
    if (candidates.length === 0) break;
    drop.push(candidates[0]);
    kept = kept.filter((f) => f !== candidates[0]);
    used = addCosts(kept);
    over = overKeys(used, budget);
  }
  return { tier, fits: first.over.length === 0, used: first.used, budget, over: first.over, drop, hopeless: over.length > 0 };
}

/** How full each line is, 0..1+ (for the meter). */
export function fill(used: Cost, budget: Cost): Record<keyof Cost, number> {
  const out = {} as Record<keyof Cost, number>;
  for (const k of KEYS) out[k] = budget[k] > 0 ? used[k] / budget[k] : 0;
  return out;
}

export interface DeviceHints {
  /** `navigator.deviceMemory` (GB), when the browser says. */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** The unmasked GPU string, when readable. */
  renderer?: string;
  /** `matchMedia("(pointer: coarse)")`: a touch device. */
  coarsePointer?: boolean;
  /** Saves-data or reduced-motion preferences push the tier down. */
  saveData?: boolean;
}

/** A first guess at the tier from what the browser says. The user can always override it. */
export function guessTier(h: DeviceHints): Tier {
  const gpu = (h.renderer ?? "").toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return "low";
  if (h.saveData) return "low";
  const mem = h.deviceMemory ?? 4;
  const cores = h.hardwareConcurrency ?? 4;
  if (h.coarsePointer && (mem <= 4 || cores <= 6)) return "low";
  if (h.coarsePointer) return "mid";
  if (mem >= 8 && cores >= 8) return "high";
  if (mem <= 2) return "low";
  return "mid";
}
