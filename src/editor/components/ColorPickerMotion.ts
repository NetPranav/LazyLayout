"use client";

/**
 * Shared motion constants and helpers for B1 Pickers (ColorPicker, FontPicker, FramePresetsPanel, OptionsPopover).
 * Sourced directly from prototype P (editor-design-mode-blocks-dark.html).
 * Centralizes morph clip-path values, entry/exit transforms, and spring durations.
 */

// Morph border radii
export const MORPH_TRIGGER_RADIUS = "round 4px";
export const MORPH_PANEL_RADIUS = "round 8px";

// Morph expanded inset
export const MORPH_EXPANDED_INSET = "-48px";
export const MORPH_EXPANDED_CLIP = `inset(${MORPH_EXPANDED_INSET} ${MORPH_PANEL_RADIUS})`;

// Fallback popover scale & translate transforms
export const POP_EXIT_SCALE = 0.92;
export const POP_EXIT_Y_PX = 8;
export const POP_ENTER_TRANSFORM = `scale(${POP_EXIT_SCALE}) translateY(${POP_EXIT_Y_PX}px)`;
export const POP_SETTLE_TRANSFORM = "scale(1) translateY(0)";
export const POP_CLOSE_TRANSFORM = "scale(0.94)";

// Row cascading transform for OptionsPopover and FontPicker
export const ROW_CASCADE_Y_PX = 6;
export const rowCascadeInitialTransform = (scale: number | string): string =>
  `scale(${scale}) translate(0, ${ROW_CASCADE_Y_PX}px)`;
export const rowCascadeSettleTransform = "scale(1) translate(0, 0)";

// Row cascade blur filters for OptionsPopover and FontPicker
export const ROW_CASCADE_BLUR_ENTER = "blur(4px)";
export const ROW_CASCADE_BLUR_SETTLE = "blur(0px)";

// Edge fade mask for FontPicker scrollable list
export const LIST_EDGE_MASK_IMAGE =
  "linear-gradient(to bottom, transparent, black 8px, black calc(100% - 8px), transparent)";

// ColorPicker layout & background sizing constants
export const GRADIENT_STOP_OFFSET_PX = 12;
export const gradientStopLeftCalc = (p: number): string =>
  `calc((100% - ${GRADIENT_STOP_OFFSET_PX}px) * ${p})`;

export const IMAGE_TILE_SIZE = "24px";
export const OPACITY_SLIDER_BG_SIZE = "100% 100%, 8px 8px";

// Durations in milliseconds
export const REDUCED_DURATION = 120;
export const CLOSE_DURATION = 180;

/**
 * Builds the clipPath inset string from the trigger bounding rect relative to the popover panel.
 */
export function buildTriggerMorphClip(
  triggerRect: { top: number; right: number; bottom: number; left: number },
  panelRect: { top: number; right: number; bottom: number; left: number }
): string {
  const top = triggerRect.top - panelRect.top;
  const right = panelRect.right - triggerRect.right;
  const bottom = panelRect.bottom - triggerRect.bottom;
  const left = triggerRect.left - panelRect.left;
  return `inset(${top}px ${right}px ${bottom}px ${left}px ${MORPH_TRIGGER_RADIUS})`;
}
