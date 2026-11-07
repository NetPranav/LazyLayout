/**
 * Phase 71: Onion skin configuration model, defaults, and opacity calculations.
 * Pure model with no evaluation kernel dependencies to prevent circular imports.
 */

export interface OnionSkinConfig {
  /** Master toggle for onion skin visualization on stage */
  enabled: boolean;
  /** Number of ghost frames sampled before the playhead (past) (0..5) */
  framesBefore: number;
  /** Number of ghost frames sampled after the playhead (future) (0..5) */
  framesAfter: number;
  /** Frame step multiplier (e.g. 1 = every frame, 2 = every 2nd frame) (1..10) */
  step: number;
  /** Base opacity of the ghost closest to the current playhead (0.05..1.0) */
  baseOpacity: number;
}

export const DEFAULT_ONION_SKIN_CONFIG: OnionSkinConfig = {
  enabled: false,
  framesBefore: 2,
  framesAfter: 3, // Total 5 ghosts across past + future to satisfy 5-ghost gate
  step: 1,
  baseOpacity: 0.4,
};

/**
 * Calculates the opacity falloff for a ghost frame.
 * Formula: alpha(k) = baseOpacity * (1 - (k - 1) / (N + 1)), clamped to [0, 1].
 * N is the total ghost count on that side (framesBefore or framesAfter).
 */
export function calculateGhostOpacity(
  k: number, // 1-based index (1 = closest to playhead)
  sideCount: number,
  baseOpacity: number
): number {
  if (sideCount <= 0 || k <= 0) return 0;
  const normalizedBase = Math.max(0, Math.min(1, baseOpacity));
  const falloff = 1 - (k - 1) / (sideCount + 1);
  return Math.max(0, Math.min(1, normalizedBase * falloff));
}

/**
 * Normalizes and clamps onion skin configuration to valid ranges.
 */
export function normalizeOnionSkinConfig(
  partial: Partial<OnionSkinConfig>
): OnionSkinConfig {
  return {
    enabled: Boolean(partial.enabled ?? DEFAULT_ONION_SKIN_CONFIG.enabled),
    framesBefore: Math.max(0, Math.min(5, Math.round(partial.framesBefore ?? DEFAULT_ONION_SKIN_CONFIG.framesBefore))),
    framesAfter: Math.max(0, Math.min(5, Math.round(partial.framesAfter ?? DEFAULT_ONION_SKIN_CONFIG.framesAfter))),
    step: Math.max(1, Math.min(10, Math.round(partial.step ?? DEFAULT_ONION_SKIN_CONFIG.step))),
    baseOpacity: Math.max(0.05, Math.min(1.0, partial.baseOpacity ?? DEFAULT_ONION_SKIN_CONFIG.baseOpacity)),
  };
}
