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
  iconXl: 24,

  // Menu popup widths
  shapeMenuWidth: 160,
  zoomMenuWidth: 180,

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

