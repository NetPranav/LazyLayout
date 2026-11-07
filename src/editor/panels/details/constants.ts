import { GOOGLE_FONTS, SYSTEM_FONTS } from "@/core/fonts/catalog";
/**
 * Named constants for Details Inspector fields and sections.
 * Enforces no magic numbers or inline px/ms literals across inspector code.
 */

export const INSPECTOR_CONSTANTS = {
  // Field sizes
  FIELD_SIZE_SM: "sm" as const,
  FIELD_SIZE_MD: "md" as const,

  // Default coordinate and dimension values
  DEFAULT_POS_X: 0,
  DEFAULT_POS_Y: 0,
  DEFAULT_ROTATION: 0,
  DEFAULT_WIDTH: 100,
  DEFAULT_HEIGHT: 100,
  DEFAULT_OPACITY: 100,
  DEFAULT_CORNER_RADIUS: 0,
  DEFAULT_FONT_SIZE: 16,
  DEFAULT_LINE_HEIGHT: 1.4,
  DEFAULT_LETTER_SPACING: 0,
  DEFAULT_STROKE_WIDTH: 1,

  // Stepping precision
  STEP_INTEGER: 1,
  STEP_DECIMAL: 0.1,
  STEP_FINE: 0.01,
  STEP_ROTATION: 1,
  STEP_OPACITY: 1,

  // Color defaults
  DEFAULT_FILL_HEX: "FFFFFF",
  DEFAULT_STROKE_HEX: "444444",
  DEFAULT_SHADOW_HEX: "000000",
  DEFAULT_TEXT_HEX: "22231E",

  // Geometry / limits
  MIN_OPACITY: 0,
  MAX_OPACITY: 100,
  MIN_RADIUS: 0,
  MAX_RADIUS: 999,
  MIN_FONT_SIZE: 1,
  MAX_FONT_SIZE: 500,

  // Easing curve SVG canvas geometry
  CURVE_VIEWBOX_SIZE: 100,
  CURVE_PAD_START: 6,
  CURVE_PAD_END: 94,
  CURVE_RANGE: 88, // 94 - 6

  // Timing
  ANIMATION_DURATION_DEFAULT: 0.6,
  POPOVER_ENTER_DURATION_MS: 120,
} as const;

/** Every font the engine can load and export: the editor's own, then the catalog, then what every computer has. */
export const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Geist", label: "Geist" },
  ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: f.family })),
  ...SYSTEM_FONTS.map((f) => ({ value: f.family, label: f.family })),
].filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i);

export const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "100 Thin" },
  { value: "200", label: "200 X-Light" },
  { value: "300", label: "300 Light" },
  { value: "400", label: "400 Regular" },
  { value: "500", label: "500 Medium" },
  { value: "600", label: "600 Semi" },
  { value: "700", label: "700 Bold" },
  { value: "800", label: "800 X-Bold" },
  { value: "900", label: "900 Black" },
] as const;

export const POSITION_TYPE_OPTIONS = [
  { value: "static", label: "Static" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
] as const;

export const TRANSFORM_ORIGIN_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "topLeft", label: "Top Left" },
  { value: "top", label: "Top" },
  { value: "topRight", label: "Top Right" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "bottomLeft", label: "Bottom Left" },
  { value: "bottom", label: "Bottom" },
  { value: "bottomRight", label: "Bottom Right" },
  { value: "top left", label: "Top left (legacy)" },
  { value: "top right", label: "Top right (legacy)" },
  { value: "bottom left", label: "Bottom left (legacy)" },
  { value: "bottom right", label: "Bottom right (legacy)" },
  { value: "bottom center", label: "Bottom center (legacy)" },
] as const;

export const SIZING_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "hug", label: "Hug" },
  { value: "fill", label: "Fill" },
] as const;

export const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
] as const;

export const CURSOR_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "pointer", label: "Pointer" },
  { value: "text", label: "Text" },
  { value: "move", label: "Move" },
  { value: "not-allowed", label: "Not allowed" },
] as const;

export const POINTER_EVENTS_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
] as const;

export const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
] as const;

export const UNIT_OPTIONS = [
  { value: "px", label: "px" },
  { value: "%", label: "%" },
  { value: "vw", label: "vw" },
  { value: "vh", label: "vh" },
] as const;

export const BOX_SIZING_OPTIONS = [
  { value: "border-box", label: "Border box" },
  { value: "content-box", label: "Content box" },
] as const;

export const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "stretch", label: "Stretch" },
] as const;

export const TEXT_OVERFLOW_OPTIONS = [
  { value: "clip", label: "Clip" },
  { value: "ellipsis", label: "Ellipsis" },
] as const;

export const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No wrap" },
  { value: "pre", label: "Pre" },
] as const;

export const FONT_LOADING_OPTIONS = [
  { value: "swap", label: "Swap" },
  { value: "block", label: "Block" },
  { value: "fallback", label: "Fallback" },
  { value: "optional", label: "Optional" },
] as const;

export const PAINT_TYPE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" },
  { value: "image", label: "Image" },
] as const;

export const EFFECT_TYPE_OPTIONS = [
  { value: "drop-shadow", label: "Drop shadow" },
  { value: "inner-shadow", label: "Inner shadow" },
  { value: "layer-blur", label: "Layer blur" },
  { value: "background-blur", label: "Background blur" },
] as const;

export const ANIMATION_PRESET_OPTIONS = [
  { value: "fade-in", label: "Fade in" },
  { value: "slide-up", label: "Slide up" },
  { value: "scale-in", label: "Scale in" },
  { value: "pop-in", label: "Pop in" },
  { value: "spin-in", label: "Spin in" },
] as const;

export const ANIMATION_TRIGGER_OPTIONS = [
  { value: "load", label: "On load" },
  { value: "scroll", label: "On scroll" },
  { value: "hover", label: "On hover" },
  { value: "click", label: "On click" },
] as const;

export const BLUEPRINT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "onClick", label: "onClick" },
  { value: "onSubmit", label: "onSubmit" },
  { value: "onHover", label: "onHover" },
] as const;

export const ACCESSIBILITY_ROLE_OPTIONS = [
  { value: "auto", label: "Auto (default)" },
  { value: "button", label: "Button" },
  { value: "link", label: "Link" },
  { value: "heading", label: "Heading" },
  { value: "image", label: "Image" },
  { value: "banner", label: "Banner" },
  { value: "navigation", label: "Navigation" },
  { value: "article", label: "Article" },
  { value: "complementary", label: "Complementary" },
] as const;

export interface CubicBezierCurve {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const EASING_PRESETS: readonly CubicBezierCurve[] = [
  { name: "Ease", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 },
  { name: "Ease in", x1: 0.42, y1: 0.0, x2: 1.0, y2: 1.0 },
  { name: "Ease out", x1: 0.0, y1: 0.0, x2: 0.58, y2: 1.0 },
  { name: "Ease in out", x1: 0.42, y1: 0.0, x2: 0.58, y2: 1.0 },
  { name: "Linear", x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
] as const;
