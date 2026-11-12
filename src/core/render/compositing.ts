import type { PropValue } from "../document/registry";
import { getPropertyDefinition } from "../document/properties";
import { safePathData } from "./limits";

/**
 * ============================================================================
 * COMPOSITING (ROADMAP Phase 74)
 * ============================================================================
 * Pure functions from a layer's resolved properties to CSS: blend mode and isolation, an adjustment layer's
 * `backdrop-filter`, and a mask drawn as an SVG image used as `mask-image`. The stage's render definitions
 * (`layerBoxStyle`) and the animation engine's style writer (`styleWrites`) both call these, so a mask that animates is
 * drawn by exactly the code that draws a still one, and the export uses them too. No DOM, no React.
 *
 * A mask is an SVG image whose alpha is the matte (so it works in every browser, with no `mask-mode`). Its shape is a
 * rectangle, an ellipse or a path in the layer's own pixels; `alpha` shows where the shape is, `luma` shows as much as
 * the shape's brightness, and the inverted modes show everything else. Feather blurs its edge and expansion grows it.
 * ============================================================================
 */

/** Anything that answers "what is this property" (a `ResolvedProps`, or a plain record plus the registry's defaults). */
export type PropReader = (path: string) => PropValue | undefined;

/** Reads from a plain record, falling back to the property registry's default (the kernel's output has no defaults filled in). */
export function readerOf(record: Readonly<Record<string, PropValue>>): PropReader {
  return (path) => record[path] ?? (getPropertyDefinition(path)?.default as PropValue | undefined);
}

const num = (read: PropReader, path: string, fallback = 0): number => {
  const v = read(path);
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
const text = (read: PropReader, path: string, fallback = ""): string => {
  const v = read(path);
  return typeof v === "string" ? v : fallback;
};

// ---------------------------------------------------------------------------
// Blend mode and isolation
// ---------------------------------------------------------------------------

/** The blend modes (CSS `mix-blend-mode`). `plus-darker` and `plus-lighter` are left out: they aren't portable. */
export const BLEND_MODE_VALUES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"] as const;
export type BlendMode = (typeof BLEND_MODE_VALUES)[number];

export const isBlendMode = (value: unknown): value is BlendMode => typeof value === "string" && (BLEND_MODE_VALUES as readonly string[]).includes(value);

/** `mix-blend-mode` and `isolation` for a layer. A `normal` blend and an `auto` isolation write nothing. */
export function blendStyle(read: PropReader): { mixBlendMode?: BlendMode; isolation?: "isolate" } {
  const out: { mixBlendMode?: BlendMode; isolation?: "isolate" } = {};
  const blend = read("appearance.blendMode");
  if (isBlendMode(blend) && blend !== "normal") out.mixBlendMode = blend;
  if (read("appearance.isolation") === "isolate") out.isolation = "isolate";
  return out;
}

// ---------------------------------------------------------------------------
// Adjustment: filters on what is behind
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The `backdrop-filter` an adjustment makes from the `adjust.*` properties, or "" when every one is at its neutral
 * value. The order is fixed so the same values always give the same string (a keyframed adjustment compares equal to
 * what `evaluate()` says).
 */
export function adjustmentFilter(read: PropReader): string {
  const parts: string[] = [];
  const blur = clamp(num(read, "adjust.blur"), 0, 200);
  const brightness = clamp(num(read, "adjust.brightness", 1), 0, 5);
  const contrast = clamp(num(read, "adjust.contrast", 1), 0, 5);
  const saturate = clamp(num(read, "adjust.saturate", 1), 0, 5);
  const hue = num(read, "adjust.hueRotate");
  const grayscale = clamp(num(read, "adjust.grayscale"), 0, 1);
  const sepia = clamp(num(read, "adjust.sepia"), 0, 1);
  const invert = clamp(num(read, "adjust.invert"), 0, 1);
  if (blur > 0) parts.push(`blur(${round(blur)}px)`);
  if (brightness !== 1) parts.push(`brightness(${round(brightness)})`);
  if (contrast !== 1) parts.push(`contrast(${round(contrast)})`);
  if (saturate !== 1) parts.push(`saturate(${round(saturate)})`);
  if (hue !== 0) parts.push(`hue-rotate(${round(hue)}deg)`);
  if (grayscale > 0) parts.push(`grayscale(${round(grayscale)})`);
  if (sepia > 0) parts.push(`sepia(${round(sepia)})`);
  if (invert > 0) parts.push(`invert(${round(invert)})`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Masks
// ---------------------------------------------------------------------------

export const MASK_MODES = ["none", "alpha", "alphaInverted", "luma", "lumaInverted"] as const;
export type MaskMode = (typeof MASK_MODES)[number];

export interface MaskSpec {
  mode: Exclude<MaskMode, "none">;
  shape: "rect" | "ellipse" | "path";
  path: string;
  /** The shape's box in layer pixels (width and height already filled in from the layer when 0). */
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  feather: number;
  expansion: number;
  fill: string;
  opacity: number;
}

/** A colour the mask may use: hex, rgb(), rgba(), hsl(), hsla() or a plain name. Anything else is white. */
const SAFE_COLOUR = /^(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-zA-Z]{3,20})$/;
export const safeMaskColour = (value: string): string => (SAFE_COLOUR.test(value.trim()) ? value.trim() : "#ffffff");

/** The mask a layer's properties describe, or null when it has none. `size` is the layer's box in px (used where the mask leaves a size at 0). */
export function maskSpec(read: PropReader, size: { width: number; height: number }): MaskSpec | null {
  const mode = text(read, "mask.mode", "none");
  if (!(MASK_MODES as readonly string[]).includes(mode) || mode === "none") return null;
  const shape = text(read, "mask.shape", "rect");
  const width = num(read, "mask.width", -1);
  const height = num(read, "mask.height", -1);
  return {
    mode: mode as MaskSpec["mode"],
    shape: shape === "ellipse" || shape === "path" ? shape : "rect",
    path: safePathData(text(read, "mask.path")),
    x: num(read, "mask.x"),
    y: num(read, "mask.y"),
    width: width >= 0 ? width : size.width,
    height: height >= 0 ? height : size.height,
    radius: Math.max(0, num(read, "mask.radius")),
    feather: clamp(num(read, "mask.feather"), 0, 200),
    expansion: clamp(num(read, "mask.expansion"), 0, 200),
    fill: safeMaskColour(text(read, "mask.fill", "#ffffff")),
    opacity: clamp(num(read, "mask.opacity", 1), 0, 1),
  };
}

const FALLBACK_SIZE = 100;

/**
 * The mask as SVG markup. Its alpha channel is the matte. `alpha` modes use a solid shape; `luma` modes read the shape's
 * brightness (luminance to alpha) so a grey shape shows partway. Inverted modes cut the shape out of a full rectangle.
 */
export function maskSvg(spec: MaskSpec, size: { width: number; height: number }): string {
  const w = size.width > 0 ? size.width : FALLBACK_SIZE;
  const h = size.height > 0 ? size.height : FALLBACK_SIZE;
  const luma = spec.mode === "luma" || spec.mode === "lumaInverted";
  const inverted = spec.mode === "alphaInverted" || spec.mode === "lumaInverted";
  const paint = luma ? spec.fill : "#000";
  const grow = spec.expansion > 0 ? ` stroke="${paint}" stroke-width="${round(spec.expansion * 2)}" stroke-linejoin="round"` : "";
  let shape: string;
  if (spec.shape === "path") shape = spec.path ? `<path d="${spec.path}" fill="${paint}"${grow}/>` : "";
  else if (spec.shape === "ellipse") shape = `<ellipse cx="${round(spec.x + spec.width / 2)}" cy="${round(spec.y + spec.height / 2)}" rx="${round(spec.width / 2)}" ry="${round(spec.height / 2)}" fill="${paint}"${grow}/>`;
  else shape = `<rect x="${round(spec.x)}" y="${round(spec.y)}" width="${round(spec.width)}" height="${round(spec.height)}" rx="${round(spec.radius)}" fill="${paint}"${grow}/>`;
  const feather = spec.feather > 0 ? ` filter="url(#f)"` : "";
  const defs: string[] = [];
  if (spec.feather > 0) defs.push(`<filter id="f" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${round(spec.feather / 2)}"/></filter>`);
  const opacity = spec.opacity < 1 ? ` opacity="${round(spec.opacity)}"` : "";
  const shapeGroup = `<g${feather}${opacity}>${shape}</g>`;
  let body: string;
  if (luma) {
    // Brightness decides how much shows: black behind, the shape on it, then luminance becomes alpha (and is flipped for the inverted mode).
    defs.push(`<filter id="l" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="luminanceToAlpha"/>${inverted ? `<feComponentTransfer><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>` : ""}</filter>`);
    body = `<g filter="url(#l)"><rect width="${w}" height="${h}" fill="#000"/>${shapeGroup}</g>`;
  } else if (inverted) {
    defs.push(`<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${shapeGroup}</g></mask>`);
    body = `<rect width="${w}" height="${h}" fill="#000" mask="url(#m)"/>`;
  } else body = shapeGroup;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

/** The CSS for a mask: the SVG as a data URI, stretched over the layer's box. Null when the layer has no mask. */
export function maskStyle(read: PropReader, layerSize: { width: number; height: number }): { maskImage: string; WebkitMaskImage: string; maskSize: string; WebkitMaskSize: string; maskRepeat: string; WebkitMaskRepeat: string } | null {
  // A layer whose size isn't a number of pixels (it hugs its content) is drawn as a 100 by 100 box stretched over it, so
  // the mask's shapes stay in proportion.
  const size = { width: layerSize.width > 0 ? layerSize.width : FALLBACK_SIZE, height: layerSize.height > 0 ? layerSize.height : FALLBACK_SIZE };
  const spec = maskSpec(read, size);
  if (!spec) return null;
  const image = `url("data:image/svg+xml;utf8,${encodeURIComponent(maskSvg(spec, size))}")`;
  return { maskImage: image, WebkitMaskImage: image, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" };
}

/** Which properties make up the mask and the adjustment, so a style writer knows when to redraw them. */
export const isMaskPath = (path: string): boolean => path.startsWith("mask.");
export const isAdjustPath = (path: string): boolean => path.startsWith("adjust.");
