/**
 * Stage and artboard constants for Lazy Layout.
 * Centralizes all layout, geometry, animation, and preset values.
 * Zero magic px or ms literals in component files.
 */

export const STAGE_CONSTANTS = {
  // Artboard dimensions from prototype
  defaultArtboardWidth: 600,
  defaultArtboardHeight: 380,
  artboardTopPercent: "52%",
  artboardMotionTopPercent: "50%",
  artboardLeftPercent: "50%",
  artboardTitleHeight: 22,

  // Canvas size button (.lbl / #albl)
  sizeLabelHeight: 24,
  sizeLabelOffsetLeft: -6,
  sizeLabelOffsetTop: -30,
  sizeLabelIconSize: 12,
  sizeDropdownWidth: 160,

  // Selection box & 8 handles (.selbox)
  selectionBoxOffset: -6,
  selectionBorderWidth: 1,
  handleSize: 7,
  handleHalfSize: 3.5,
  handleCenterOffset: -3.5,
  handleOffset: -4,
  handleHoverScale: 1.25,

  // Dimension badge (.dim)
  dimBadgeOffsetLeft: -6,
  dimBadgeOffsetBottom: -26,
  dimBadgePaddingX: 6,
  dimBadgePaddingY: 2,

  // Snapping & thresholds
  defaultSnapThreshold: 6,
  snapDistanceHudMin: 0,
  nudgeStep: 1,
  nudgeShiftStep: 10,
  minElementSize: 16,

  // Zoom
  defaultZoom: 0.59,
  zoomScaleMultiplier: 0.9 / 0.59,

  // Sample elements layout from prototype
  headlineX: 36,
  headlineY: 70,
  headlineWidth: 340,
  headlineHeight: 82,

  buttonX: 36,
  buttonY: 226,
  buttonWidth: 112,
  buttonHeight: 34,

  imageX: 420,
  imageY: 70,
  imageWidth: 150,
  imageHeight: 170,

  // Lab frame sizing
  labFrameWidth: 1440,
  labFrameHeight: 900,
  labToolbarHeight: 48,
  iconSizeSm: 14,
  iconSizeMd: 16,
} as const;

export interface StagePresetDefinition {
  id: string;
  label: string;
  width: number;
  height: number;
  artboardWidth: number;
  artboardHeight: number;
}

export const STAGE_PRESETS: readonly StagePresetDefinition[] = [
  {
    id: "1440",
    label: "Desktop",
    width: 1440,
    height: 900,
    artboardWidth: 600,
    artboardHeight: 380,
  },
  {
    id: "768",
    label: "Tablet",
    width: 768,
    height: 1024,
    artboardWidth: 480,
    artboardHeight: 440,
  },
  {
    id: "375",
    label: "Mobile",
    width: 375,
    height: 812,
    artboardWidth: 320,
    artboardHeight: 480,
  },
] as const;

export const SIZES_MAP: Record<string, string> = {
  "1440": "Desktop",
  "768": "Tablet",
  "375": "Mobile",
};

export const RESIZE_HANDLE_NAMES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

export type ResizeHandleName = (typeof RESIZE_HANDLE_NAMES)[number];

export const RESIZE_HANDLE_CURSORS: Record<ResizeHandleName, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};
