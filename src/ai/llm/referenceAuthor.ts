import type { MdmJsonPatch } from "./types";

export interface ImageReferenceSpec {
  sourceLabel: string;
  dominantColors: readonly string[];
  aspectRatio: number;
  detectedBlocks: readonly ("header" | "hero" | "card_grid" | "cta" | "sidebar" | "footer")[];
  userPermitted: true;
}

export interface VideoFrameSample {
  timeMs: number;
  translateY: number;
  scale: number;
  opacity: number;
  rotateDeg: number;
  blurPx?: number;
}

export type ReferenceEffectCategory =
  | "entrance"
  | "hover"
  | "scroll"
  | "attention"
  | "ambient"
  | "transition";

export interface ReferenceMotionClassification {
  category: ReferenceEffectCategory;
  effectId: string;
  durationMs: number;
  easing: string;
  confidence: number;
  summary: string;
}

export interface ImageReferenceLayoutProposal {
  palette: readonly string[];
  layoutMode: "stack" | "split" | "grid";
  patches: MdmJsonPatch[];
  summary: string;
}

/**
 * Phase 249 image reference → layout & style proposal (strictly user-supplied references; no automatic scraping).
 */
export function authorFromImageReference(
  ref: ImageReferenceSpec,
  targetLayerId?: string,
): ImageReferenceLayoutProposal {
  const layoutMode: "stack" | "split" | "grid" = ref.detectedBlocks.includes("card_grid")
    ? "grid"
    : ref.aspectRatio >= 1.4
      ? "split"
      : "stack";

  const primaryColor = ref.dominantColors[0] ?? "#111827";
  const accentColor = ref.dominantColors[1] ?? "#6366f1";
  const patches: MdmJsonPatch[] = [];

  if (targetLayerId) {
    patches.push({
      op: "add",
      path: `/layers/${targetLayerId}/properties/referenceStyle`,
      value: {
        sourceLabel: ref.sourceLabel,
        layoutMode,
        primaryColor,
        accentColor,
        blocks: ref.detectedBlocks,
      },
    });
  }

  return {
    palette: ref.dominantColors,
    layoutMode,
    patches,
    summary: `Extracted ${layoutMode} layout and palette (${primaryColor}, ${accentColor}) from "${ref.sourceLabel}".`,
  };
}

/**
 * Phase 249 GIF / video sampled frames → closest library effect category and tuned parameters.
 */
export function classifySampledReferenceFrames(
  frames: readonly VideoFrameSample[],
): ReferenceMotionClassification {
  if (frames.length < 2) {
    return {
      category: "entrance",
      effectId: "fx_fade_up",
      durationMs: 360,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      confidence: 0.5,
      summary: "Insufficient frame samples; defaulted to fade-up entrance.",
    };
  }

  const first = frames[0];
  const last = frames[frames.length - 1];
  const totalMs = Math.max(120, last.timeMs - first.timeMs);

  const opacityDelta = last.opacity - first.opacity;
  const maxRotate = Math.max(...frames.map((f) => Math.abs(f.rotateDeg - first.rotateDeg)));
  const maxScaleSwing =
    Math.max(...frames.map((f) => f.scale)) - Math.min(...frames.map((f) => f.scale));
  const netY = last.translateY - first.translateY;
  const returnsToStart =
    Math.abs(last.translateY - first.translateY) < 2 &&
    Math.abs(last.scale - first.scale) < 0.03 &&
    frames.some((f) => Math.abs(f.translateY - first.translateY) > 4 || Math.abs(f.scale - first.scale) > 0.04);

  if (opacityDelta > 0.4 && Math.abs(netY) >= 8) {
    return {
      category: "entrance",
      effectId: "fx_fade_slide_up",
      durationMs: totalMs,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      confidence: 0.92,
      summary: `Classified as entrance (fade + ${Math.round(Math.abs(netY))}px slide over ${totalMs}ms).`,
    };
  }

  if (returnsToStart && maxScaleSwing > 0.05 && totalMs <= 700) {
    return {
      category: "attention",
      effectId: "fx_pulse_pop",
      durationMs: totalMs,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      confidence: 0.89,
      summary: `Classified as attention pulse/pop (${maxScaleSwing.toFixed(2)} scale swing over ${totalMs}ms).`,
    };
  }

  if (returnsToStart && totalMs > 700) {
    return {
      category: "ambient",
      effectId: "fx_float_loop",
      durationMs: totalMs,
      easing: "ease-in-out",
      confidence: 0.88,
      summary: `Classified as ambient float loop over ${totalMs}ms.`,
    };
  }

  if (maxRotate >= 8) {
    return {
      category: "hover",
      effectId: "fx_tilt_hover",
      durationMs: totalMs,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      confidence: 0.87,
      summary: `Classified as hover tilt (${maxRotate.toFixed(0)}deg rotation).`,
    };
  }

  if (Math.abs(netY) >= 30 && Math.abs(opacityDelta) < 0.15) {
    return {
      category: "scroll",
      effectId: "fx_scroll_parallax",
      durationMs: totalMs,
      easing: "linear",
      confidence: 0.85,
      summary: `Classified as scroll parallax (${Math.round(netY)}px travel).`,
    };
  }

  return {
    category: "transition",
    effectId: "fx_crossfade_scale",
    durationMs: totalMs,
    easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    confidence: 0.82,
    summary: `Classified as state transition over ${totalMs}ms.`,
  };
}
