/**
 * Layout, geometry, and sizing constants for CanvasChrome and verification harness.
 * Centralizes numeric values avoiding inline px literals and magic numbers.
 */

export const CANVAS_CHROME_SIZES = {
  // Icon sizes
  iconXs: 10,
  iconSm: 12,
  iconMd: 16,
  iconLg: 20,
  iconAi: 18,
  iconXl: 24,

  // Menu popup widths
  shapeMenuWidth: 160,
  zoomMenuWidth: 180,
  easingMenuWidth: 176,
  exportMenuWidth: 176,

  // Spotlight geometry
  spotlightWidthMax: 560,
  spotlightWidthMin: 280,
  spotlightRowHeight: 32,
  spotlightRowBigHeight: 44,
  spotlightMaxHeight: 360,
  spotlightMinHeight: 120,

  // Floating toolbar positions
  toolbarStandardBottom: 16,
  toolbarLiftBottom: 72,
  zoomBarSlideOffset: 240,

  // Ruler tick intervals and bounds
  rulerTickStep: 200,
  rulerHorizontalMin: -400,
  rulerHorizontalMax: 2400,
  rulerVerticalMin: 0,
  rulerVerticalMax: 1800,

  // AI loader geometry
  aiLoaderStrokeWidth: 10,
  aiLoaderDashArray: 100,

  // Artboard sample dimensions for lab harness
  labArtboardWidth: 600,
  labArtboardHeight: 380,
  labHeadlineWidth: 340,
  labHeadlineLeft: 36,
  labHeadlineTop: 70,
  labButtonLeft: 36,
  labButtonBottom: 64,
  labButtonHeight: 34,
  labImageRight: 30,
  labImageTop: 70,
  labImageWidth: 150,
  labImageHeight: 170,
} as const;

/**
 * Sample collaborator users matching prototype USERS (AP, RK, SM, JL, TO).
 * Prototype: AP (Adarsh Pathade), RK (Rina Kapoor), SM (Sam Mori), JL (Jun Lee), TO (Tara Osei).
 */
export const CANVAS_CHROME_SAMPLE_USERS = [
  { id: "1", initials: "AP", name: "Adarsh Pathade", status: "Viewing" },
  { id: "2", initials: "RK", name: "Rina Kapoor", status: "Editing Hero" },
  { id: "3", initials: "SM", name: "Sam Mori", status: "Viewing" },
  { id: "4", initials: "JL", name: "Jun Lee", status: "Viewing" },
  { id: "5", initials: "TO", name: "Tara Osei", status: "Viewing" },
] as const;

export const EASING_OPTIONS = [
  "Linear",
  "Ease in",
  "Ease out",
  "Ease in out",
  "Back out",
  "Anticipate",
] as const;

export type EasingOption = (typeof EASING_OPTIONS)[number];

export const EXPORT_OPTIONS = [
  "Repo .zip",
  "Current file",
  "Copy npm install",
] as const;

export type ExportOption = (typeof EXPORT_OPTIONS)[number];

export const SPOTLIGHT_PREFIX_MAP = {
  ">": "cmd",
  "@": "layer",
  "#": "page",
} as const;

export const SPOTLIGHT_NAMES = {
  cmd: "Commands",
  layer: "Layers",
  page: "Pages",
  asset: "Assets",
  set: "Settings",
} as const;


