/**
 * ============================================================================
 * PAINTS AND EFFECTS (ROADMAP Phase 35)
 * ============================================================================
 * A layer's fills are a list of paints: solid colours and linear, radial and conic gradients, each with an opacity
 * and a visibility. Its shadows are a list of drop and inner shadows. Both are stored as JSON text in the layer's
 * properties (`paint.fills`, `paint.shadows`), first entry on top (the order CSS lists backgrounds and shadows).
 * Geometry is in fractions of the layer's box, so a gradient follows the layer when it is resized.
 *
 * This module parses and validates them (a hostile file can't make the renderer slow or inject style), and turns
 * them into CSS. Pure: no DOM, no store.
 *
 * FigCraft port F2 added: a blend mode per paint, the diamond gradient (drawn exactly as four quadrant gradients),
 * and the seven image adjustments (exposure, contrast, saturation, temperature, tint, highlights, shadows), whose
 * maths is `core/paint/color.ts`.
 * ============================================================================
 */

import { safeImageSrc } from "../render/limits";
import { parseColor, toCss, withOpacity } from "./colorMath";
import { MAX_MESH_SIDE, meshSvg, newMesh, type MeshSpec } from "./mesh";
import { MAX_PATTERN_SHAPES, noiseSvg, patternSvg, safePathData, svgDataUrl, type NoiseSpec, type PatternSpec } from "./procedural";
import { BLEND_MODES, blendCss, isIdentityAdjustment, sanitizeAdjustments, type BlendMode, type ImageAdjustments } from "./color";

export interface Point {
  x: number;
  y: number;
}
export interface GradientStop {
  /** Where along the gradient, 0 to 1. */
  at: number;
  color: string;
}

/**
 * A mask on one fill (Phase 113): a fade, fully shown at `start` and gone at `end` (fractions 0–1) along a linear
 * direction (`angle` in degrees, 0 is downward), outward from the centre (radial), or round it (conic, from `angle`);
 * or another layer's outline (a sibling), shown inside it, or outside it when `invert`.
 */
export type PaintMask =
  | { type: "linear" | "radial" | "conic"; start: number; end: number; angle: number }
  | { type: "layer"; id: string; invert: boolean };
export const PAINT_MASK_TYPES = ["linear", "radial", "conic", "layer"] as const;

interface PaintBase {
  /** 0 to 1. */
  opacity: number;
  visible: boolean;
  /** How the paint blends with what is under it (FigCraft port F2). Absent is normal. */
  blend?: BlendMode;
  /** A mask on this fill alone (Phase 113). Absent is none. */
  mask?: PaintMask;
  /** In a stroke list only (Phases 117–118): this stroke's own weight in px and alignment; absent uses the layer's. */
  weight?: number;
  align?: "inside" | "center" | "outside";
}

/** A stored mask, read safely; null when absent or unusable. */
export function parsePaintMask(v: unknown): PaintMask | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.type === "layer") return typeof o.id === "string" && o.id.length > 0 && o.id.length <= 64 ? { type: "layer", id: o.id, invert: o.invert === true } : null;
  if (o.type !== "linear" && o.type !== "radial" && o.type !== "conic") return null;
  return { type: o.type, start: num(o.start, 0, 0, 1), end: num(o.end, 1, 0, 1), angle: num(o.angle, 0, -720, 720) };
}
export type SolidPaint = PaintBase & { type: "solid"; color: string };
export type LinearPaint = PaintBase & { type: "linear"; stops: GradientStop[]; from: Point; to: Point };
export type RadialPaint = PaintBase & { type: "radial"; stops: GradientStop[]; center: Point; radius: Point };
export type ConicPaint = PaintBase & { type: "conic"; stops: GradientStop[]; center: Point; angle: number };
/** A diamond gradient (FigCraft port F2): the colour depends on |dx|/rx + |dy|/ry from the centre, so it spreads as a diamond. */
export type DiamondPaint = PaintBase & { type: "diamond"; stops: GradientStop[]; center: Point; radius: Point };
/**
 * A picture as a fill (Phase 37). `fill` covers the box, `fit` shows all of it, `crop` shows the part named by
 * `crop` (fractions of the picture: the box is the window), `tile` repeats it at `scale` times its own size.
 */
export type ImageMode = "fill" | "fit" | "crop" | "tile";
export const IMAGE_MODES: readonly ImageMode[] = ["fill", "fit", "crop", "tile"];
export interface ImageCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type ImagePaint = PaintBase & {
  type: "image";
  /** `asset:<sha256>` for an imported file, or any source `safeImageSrc` allows. Empty: nothing chosen yet. */
  src: string;
  mode: ImageMode;
  crop: ImageCrop;
  /** Tile size as a multiple of the picture's own size. */
  scale: number;
  /** The picture's own size in px, for tiling. */
  natural?: { w: number; h: number };
  /** 1 is unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** The seven adjustments, each -1..1 (FigCraft port F2); absent is none. Drawn by an SVG colour filter. */
  adjust?: ImageAdjustments;
};
/** Seeded noise or grain (Phase 114), drawn by `core/paint/procedural.ts`. */
export type NoisePaint = PaintBase & { type: "noise" } & NoiseSpec;
/** Shapes repeated as a tile (Phase 114), baked from a layer when the pattern is made. */
export type PatternPaint = PaintBase & { type: "pattern" } & PatternSpec;
/** A mesh gradient (Phase 115), drawn by `core/paint/mesh.ts`. */
export type MeshPaint = PaintBase & { type: "mesh" } & MeshSpec;
/**
 * A live fill (Phase 116): another frame or component drawn inside the shape, following every edit to it. `scale`
 * sizes it, `offset` (px) moves it, `tile` repeats it across the shape.
 */
export type LivePaint = PaintBase & { type: "live"; source: string; scale: number; offset: Point; tile: boolean };
export type Paint = SolidPaint | LinearPaint | RadialPaint | ConicPaint | DiamondPaint | ImagePaint | NoisePaint | PatternPaint | MeshPaint | LivePaint;
export type PaintType = Paint["type"];
export const PAINT_TYPES: readonly PaintType[] = ["solid", "linear", "radial", "conic", "diamond", "image", "noise", "pattern", "mesh", "live"];

/** The picture a procedural paint is drawn as, for a box of this size (null for other paints). */
export function proceduralSvg(p: Paint, w: number, h: number): string | null {
  if (p.type === "noise") return noiseSvg(p, w > 0 ? w : 100, h > 0 ? h : 100, p.opacity);
  if (p.type === "pattern") return patternSvg(p, w > 0 ? w : 100, h > 0 ? h : 100, p.opacity);
  if (p.type === "mesh") return meshSvg(p, w > 0 ? w : 100, h > 0 ? h : 100, p.opacity);
  return null;
}

export const FULL_CROP: ImageCrop = { x: 0, y: 0, w: 1, h: 1 };

export const MAX_PAINTS = 16;
export const MAX_STOPS = 32;
export const MAX_SHADOWS = 16;
export const MAX_PAINT_JSON = 100_000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

/** A colour the renderer may put in a style: one we can read. */
const safeColor = (v: unknown): string | null => (typeof v === "string" && v.length <= 64 && parseColor(v) !== null ? v.trim() : null);

const point = (v: unknown, fallback: Point): Point => {
  const o = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  return { x: num(o.x, fallback.x, -4, 5), y: num(o.y, fallback.y, -4, 5) };
};

export const DEFAULT_STOPS: readonly GradientStop[] = [
  { at: 0, color: "#ffffff" },
  { at: 1, color: "#000000" },
];

/** A fresh paint of a type, from a colour or the first stops of an existing one. */
export function newPaint(type: PaintType, color = "#cbd5e1"): Paint {
  const base = { opacity: 1, visible: true };
  if (type === "image") return { ...base, type, src: "", mode: "fill", crop: { ...FULL_CROP }, scale: 1, brightness: 1, contrast: 1, saturation: 1 };
  if (type === "live") return { ...base, type, source: "", scale: 1, offset: { x: 0, y: 0 }, tile: false };
  if (type === "mesh") return { ...base, type, ...newMesh(3, 3, color) };
  if (type === "noise") return { ...base, type, kind: "grain", scale: 2, contrast: 0.5, color: "#000000", seed: 1, opacity: 0.35 };
  if (type === "pattern") return { ...base, type, tile: { w: 16, h: 16, shapes: [{ d: "M8 4A4 4 0 1 1 8 12A4 4 0 1 1 8 4Z", color: color }] }, scale: 1, spacing: 0, offset: { x: 0, y: 0 }, rotation: 0 };
  const stops: GradientStop[] = [{ at: 0, color }, { at: 1, color: parseColor(color) && (parseColor(color)!.r + parseColor(color)!.g + parseColor(color)!.b) / 3 > 128 ? "#0f172a" : "#ffffff" }];
  switch (type) {
    case "solid": return { ...base, type, color };
    case "linear": return { ...base, type, stops, from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 } };
    case "radial": return { ...base, type, stops, center: { x: 0.5, y: 0.5 }, radius: { x: 0.5, y: 0.5 } };
    case "conic": return { ...base, type, stops, center: { x: 0.5, y: 0.5 }, angle: 0 };
    case "diamond": return { ...base, type, stops, center: { x: 0.5, y: 0.5 }, radius: { x: 0.5, y: 0.5 } };
  }
}

function parseStops(v: unknown): GradientStop[] | null {
  if (!Array.isArray(v)) return null;
  const stops: GradientStop[] = [];
  for (const s of v.slice(0, MAX_STOPS)) {
    const o = typeof s === "object" && s !== null ? (s as Record<string, unknown>) : null;
    const color = o ? safeColor(o.color) : null;
    if (!o || !color) continue;
    stops.push({ at: num(o.at, 0, 0, 1), color });
  }
  if (stops.length < 2) return null;
  return stops.sort((a, b) => a.at - b.at);
}

function parsePaint(v: unknown): Paint | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const blend = typeof o.blend === "string" && (BLEND_MODES as readonly string[]).includes(o.blend) && o.blend !== "normal" && o.blend !== "passThrough" ? (o.blend as BlendMode) : undefined;
  const mask = parsePaintMask(o.mask);
  const weight = typeof o.weight === "number" && Number.isFinite(o.weight) ? clamp(o.weight, 0, 200) : undefined;
  const align: PaintBase["align"] = o.align === "inside" || o.align === "center" || o.align === "outside" ? o.align : undefined;
  const base = { opacity: num(o.opacity, 1, 0, 1), visible: o.visible !== false, ...(blend ? { blend } : {}), ...(mask ? { mask } : {}), ...(weight !== undefined ? { weight } : {}), ...(align ? { align } : {}) };
  switch (o.type) {
    case "solid": {
      const color = safeColor(o.color);
      return color ? { ...base, type: "solid", color } : null;
    }
    case "linear": {
      const stops = parseStops(o.stops);
      return stops ? { ...base, type: "linear", stops, from: point(o.from, { x: 0.5, y: 0 }), to: point(o.to, { x: 0.5, y: 1 }) } : null;
    }
    case "radial": {
      const stops = parseStops(o.stops);
      const r = point(o.radius, { x: 0.5, y: 0.5 });
      return stops ? { ...base, type: "radial", stops, center: point(o.center, { x: 0.5, y: 0.5 }), radius: { x: Math.abs(r.x) || 0.01, y: Math.abs(r.y) || 0.01 } } : null;
    }
    case "conic": {
      const stops = parseStops(o.stops);
      return stops ? { ...base, type: "conic", stops, center: point(o.center, { x: 0.5, y: 0.5 }), angle: num(o.angle, 0, -720, 720) } : null;
    }
    case "diamond": {
      const stops = parseStops(o.stops);
      const r = point(o.radius, { x: 0.5, y: 0.5 });
      return stops ? { ...base, type: "diamond", stops, center: point(o.center, { x: 0.5, y: 0.5 }), radius: { x: Math.abs(r.x) || 0.01, y: Math.abs(r.y) || 0.01 } } : null;
    }
    case "live": {
      if (typeof o.source !== "string" || o.source.length > 64) return null;
      const off = typeof o.offset === "object" && o.offset !== null ? (o.offset as Record<string, unknown>) : {};
      return { ...base, type: "live", source: o.source, scale: num(o.scale, 1, 0.05, 20), offset: { x: num(off.x, 0, -10_000, 10_000), y: num(off.y, 0, -10_000, 10_000) }, tile: o.tile === true };
    }
    case "mesh": {
      const cols = Math.round(num(o.cols, 3, 2, MAX_MESH_SIDE));
      const rows = Math.round(num(o.rows, 3, 2, MAX_MESH_SIDE));
      const raw = Array.isArray(o.points) ? o.points : [];
      if (raw.length !== cols * rows) return null;
      const points = raw.map((q) => {
        const r = typeof q === "object" && q !== null ? (q as Record<string, unknown>) : {};
        return { x: num(r.x, 0, -1, 2), y: num(r.y, 0, -1, 2), color: safeColor(r.color) ?? "#000000" };
      });
      return { ...base, type: "mesh", cols, rows, points, smooth: o.smooth !== false };
    }
    case "noise": {
      const color = safeColor(o.color) ?? "#000000";
      return { ...base, type: "noise", kind: o.kind === "noise" ? "noise" : "grain", scale: num(o.scale, 2, 0.5, 2000), contrast: num(o.contrast, 0.5, 0, 1), color, seed: Math.round(num(o.seed, 1, 0, 1_000_000)) };
    }
    case "pattern": {
      const tile = typeof o.tile === "object" && o.tile !== null ? (o.tile as Record<string, unknown>) : {};
      const shapes = (Array.isArray(tile.shapes) ? tile.shapes : [])
        .slice(0, MAX_PATTERN_SHAPES)
        .map((s) => {
          const r = typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {};
          const d = safePathData(r.d);
          const color = safeColor(r.color);
          return d && color ? { d, color } : null;
        })
        .filter((s): s is { d: string; color: string } => s !== null);
      if (shapes.length === 0) return null;
      const off = typeof o.offset === "object" && o.offset !== null ? (o.offset as Record<string, unknown>) : {};
      return {
        ...base, type: "pattern", tile: { w: num(tile.w, 16, 1, 5000), h: num(tile.h, 16, 1, 5000), shapes },
        scale: num(o.scale, 1, 0.05, 20), spacing: num(o.spacing, 0, 0, 2000), offset: { x: num(off.x, 0, -5000, 5000), y: num(off.y, 0, -5000, 5000) }, rotation: num(o.rotation, 0, -360, 360),
      };
    }
    case "image": {
      const mode = IMAGE_MODES.includes(o.mode as ImageMode) ? (o.mode as ImageMode) : "fill";
      const c = typeof o.crop === "object" && o.crop !== null ? (o.crop as Record<string, unknown>) : {};
      const w = num(c.w, 1, 0.01, 1);
      const h = num(c.h, 1, 0.01, 1);
      const nat = typeof o.natural === "object" && o.natural !== null ? (o.natural as Record<string, unknown>) : null;
      const natural = nat && num(nat.w, 0, 0, 100_000) > 0 && num(nat.h, 0, 0, 100_000) > 0 ? { w: num(nat.w, 1, 1, 100_000), h: num(nat.h, 1, 1, 100_000) } : undefined;
      return {
        ...base, type: "image", mode, src: typeof o.src === "string" ? (safeImageSrc(o.src) ?? "") : "",
        crop: { x: num(c.x, 0, 0, 1 - w), y: num(c.y, 0, 0, 1 - h), w, h },
        scale: num(o.scale, 1, 0.05, 20), ...(natural ? { natural } : {}),
        brightness: num(o.brightness, 1, 0, 3), contrast: num(o.contrast, 1, 0, 3), saturation: num(o.saturation, 1, 0, 3),
        ...(adjustOf(o.adjust) ? { adjust: adjustOf(o.adjust)! } : {}),
      };
    }
    default:
      return null;
  }
}

/** Stored adjustments, sanitised; null when absent or all zero. */
function adjustOf(v: unknown): ImageAdjustments | null {
  if (typeof v !== "object" || v === null) return null;
  const a = sanitizeAdjustments(v as Record<string, unknown>);
  return isIdentityAdjustment(a) ? null : a;
}

/** Reads `paint.fills`. Returns null when it is absent, empty, malformed or too big (the layer then uses its plain colour). Invalid paints inside a valid list are skipped. */
export function parseFills(json: unknown): Paint[] | null {
  if (typeof json !== "string" || json === "" || json.length > MAX_PAINT_JSON) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const paints = raw.slice(0, MAX_PAINTS).map(parsePaint).filter((p): p is Paint => p !== null);
  return raw.length === 0 ? [] : paints;
}

const r3 = (n: number) => Number(n.toFixed(4));
const pt = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });

/** The JSON for `paint.fills`: compact, with defaults left out. */
export function serializeFills(fills: readonly Paint[]): string {
  return JSON.stringify(
    fills.slice(0, MAX_PAINTS).map((p) => {
      const base = { type: p.type, ...(p.opacity !== 1 ? { opacity: r3(p.opacity) } : {}), ...(p.visible ? {} : { visible: false }), ...(p.blend && p.blend !== "normal" ? { blend: p.blend } : {}), ...(p.weight !== undefined ? { weight: r3(p.weight) } : {}), ...(p.align ? { align: p.align } : {}), ...(p.mask ? { mask: p.mask.type === "layer" ? { type: "layer", id: p.mask.id, ...(p.mask.invert ? { invert: true } : {}) } : { type: p.mask.type, start: r3(p.mask.start), end: r3(p.mask.end), angle: r3(p.mask.angle) } } : {}) };
      switch (p.type) {
        case "solid": return { ...base, color: p.color };
        case "linear": return { ...base, stops: p.stops.map((s) => ({ at: r3(s.at), color: s.color })), from: pt(p.from), to: pt(p.to) };
        case "radial": return { ...base, stops: p.stops.map((s) => ({ at: r3(s.at), color: s.color })), center: pt(p.center), radius: pt(p.radius) };
        case "conic": return { ...base, stops: p.stops.map((s) => ({ at: r3(s.at), color: s.color })), center: pt(p.center), angle: r3(p.angle) };
        case "diamond": return { ...base, stops: p.stops.map((s) => ({ at: r3(s.at), color: s.color })), center: pt(p.center), radius: pt(p.radius) };
        case "live": return { ...base, source: p.source, ...(p.scale !== 1 ? { scale: r3(p.scale) } : {}), ...(p.offset.x || p.offset.y ? { offset: { x: r3(p.offset.x), y: r3(p.offset.y) } } : {}), ...(p.tile ? { tile: true } : {}) };
        case "mesh": return { ...base, cols: p.cols, rows: p.rows, points: p.points.map((q) => ({ x: r3(q.x), y: r3(q.y), color: q.color })), ...(p.smooth ? {} : { smooth: false }) };
        case "noise": return { ...base, kind: p.kind, scale: r3(p.scale), contrast: r3(p.contrast), color: p.color, seed: p.seed };
        case "pattern": return { ...base, tile: { w: r3(p.tile.w), h: r3(p.tile.h), shapes: p.tile.shapes }, scale: r3(p.scale), ...(p.spacing ? { spacing: r3(p.spacing) } : {}), ...(p.offset.x || p.offset.y ? { offset: pt(p.offset) } : {}), ...(p.rotation ? { rotation: r3(p.rotation) } : {}) };
        case "image":
          return {
            ...base, src: p.src, mode: p.mode,
            ...(p.mode === "crop" ? { crop: { x: r3(p.crop.x), y: r3(p.crop.y), w: r3(p.crop.w), h: r3(p.crop.h) } } : {}),
            ...(p.scale !== 1 ? { scale: r3(p.scale) } : {}), ...(p.natural ? { natural: p.natural } : {}),
            ...(p.brightness !== 1 ? { brightness: r3(p.brightness) } : {}), ...(p.contrast !== 1 ? { contrast: r3(p.contrast) } : {}), ...(p.saturation !== 1 ? { saturation: r3(p.saturation) } : {}),
            ...(p.adjust && !isIdentityAdjustment(p.adjust) ? { adjust: Object.fromEntries(Object.entries(p.adjust).filter(([, v]) => v !== 0).map(([k, v]) => [k, r3(v)])) } : {}),
          };
      }
    }),
  );
}

const isNoPaint = (c: string) => c.trim() === "" || ["none", "transparent"].includes(c.trim().toLowerCase());

/** The fills a layer draws: its `paint.fills` when it has them, else its plain colour as one solid fill (none for `none`). */
export function effectiveFills(fillsJson: unknown, plainColor: string | undefined): Paint[] {
  const list = parseFills(fillsJson);
  if (list !== null) return list;
  return plainColor && !isNoPaint(plainColor) ? [{ type: "solid", color: plainColor, opacity: 1, visible: true }] : [];
}

// --- CSS -----------------------------------------------------------------------

const f = (n: number) => Number(n.toFixed(3));

function stopList(stops: readonly GradientStop[], opacity: number, position: (s: GradientStop) => string): string {
  return stops.map((s) => `${withOpacity(s.color, opacity)} ${position(s)}`).join(", ");
}

/**
 * One paint as a CSS image for `background-image`. A gradient is mapped exactly onto the layer's box (`w` by `h`
 * px), so a linear gradient between any two points renders the same as the handles on the canvas show.
 */
export function paintCss(p: Paint, w: number, h: number, assetUrl?: (src: string) => string | null): string | null {
  if (!p.visible) return null;
  const W = w > 0 ? w : 100;
  const H = h > 0 ? h : 100;
  switch (p.type) {
    case "solid": {
      const c = withOpacity(p.color, p.opacity);
      return `linear-gradient(${c}, ${c})`;
    }
    case "linear": {
      const fx = p.from.x * W, fy = p.from.y * H, tx = p.to.x * W, ty = p.to.y * H;
      const dx = tx - fx, dy = ty - fy;
      if (Math.hypot(dx, dy) < 1e-6) {
        const last = withOpacity(p.stops[p.stops.length - 1].color, p.opacity);
        return `linear-gradient(${last}, ${last})`;
      }
      const theta = Math.atan2(dx, -dy); // CSS: 0deg points up, clockwise
      const ux = Math.sin(theta), uy = -Math.cos(theta);
      const length = Math.abs(W * Math.sin(theta)) + Math.abs(H * Math.cos(theta));
      const along = (at: number) => (((fx + at * dx - W / 2) * ux + (fy + at * dy - H / 2) * uy) / length + 0.5) * 100;
      return `linear-gradient(${f((theta * 180) / Math.PI)}deg, ${stopList(p.stops, p.opacity, (s) => `${f(along(s.at))}%`)})`;
    }
    case "radial":
      return `radial-gradient(${f(p.radius.x * W)}px ${f(p.radius.y * H)}px at ${f(p.center.x * W)}px ${f(p.center.y * H)}px, ${stopList(p.stops, p.opacity, (s) => `${f(s.at * 100)}%`)})`;
    case "conic":
      return `conic-gradient(from ${f(p.angle)}deg at ${f(p.center.x * W)}px ${f(p.center.y * H)}px, ${stopList(p.stops, p.opacity, (s) => `${f(s.at * 360)}deg`)})`;
    case "diamond":
      return diamondCss(p, W, H).map((q) => q.image).join(", ");
    case "noise":
    case "pattern":
    case "mesh":
      return `url("${svgDataUrl(proceduralSvg(p, W, H)!)}")`;
    case "live":
      return null; // drawn by shapes only (a CSS background can't hold layers)
    case "image": {
      const url = p.src ? (assetUrl ? assetUrl(p.src) : p.src) : null;
      return url ? `url("${url.replace(/["\\]/g, "\\$&").replace(/[\n\r]/g, "")}")` : null;
    }
  }
}

/**
 * A diamond gradient as four quadrant layers, each a CSS linear gradient (FigCraft port F2). In a quadrant the
 * diamond's iso-lines |dx|/rx + |dy|/ry = c are straight and parallel, so each quadrant *is* a linear gradient: this
 * is exact, not an approximation. Every layer is one quadrant's background tile (size and position in px, no repeat).
 */
export function diamondCss(p: DiamondPaint, W: number, H: number): { image: string; size: string; position: string }[] {
  const cx = p.center.x * W;
  const cy = p.center.y * H;
  const rx = Math.max(1e-6, p.radius.x * W);
  const ry = Math.max(1e-6, p.radius.y * H);
  // the four tiles: (x0, y0, x1, y1) and which way is "out" from the centre
  const quads: [number, number, number, number, number, number][] = [
    [0, 0, cx, cy, -1, -1],
    [cx, 0, W, cy, 1, -1],
    [cx, cy, W, H, 1, 1],
    [0, cy, cx, H, -1, 1],
  ];
  const out: { image: string; size: string; position: string }[] = [];
  for (const [x0, y0, x1, y1, sx, sy] of quads) {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 1e-6 || h <= 1e-6) continue;
    // n = (sx/rx, sy/ry): the direction the value grows; as a CSS angle (0deg up, clockwise)
    const nx = sx / rx;
    const ny = sy / ry;
    const nl = Math.hypot(nx, ny);
    const ux = nx / nl;
    const uy = ny / nl;
    const theta = Math.atan2(ux, -uy);
    const length = Math.abs(w * Math.sin(theta)) + Math.abs(h * Math.cos(theta));
    // tile centre relative to the diamond centre, projected on the gradient direction
    const c = (x0 + w / 2 - cx) * ux + (y0 + h / 2 - cy) * uy;
    const along = (sigma: number) => ((sigma / nl - c) / length + 0.5) * 100;
    out.push({ image: `linear-gradient(${f((theta * 180) / Math.PI)}deg, ${stopList(p.stops, p.opacity, (s) => `${f(along(s.at))}%`)})`, size: `${f(w)}px ${f(h)}px`, position: `${f(x0)}px ${f(y0)}px` });
  }
  return out;
}

/** Does this image paint change the picture's colours? Those can't be a `background-image`: they are drawn by a layer of their own. */
export const hasImageFilter = (p: Paint): boolean => p.type === "image" && (p.brightness !== 1 || p.contrast !== 1 || p.saturation !== 1 || (!!p.adjust && !isIdentityAdjustment(p.adjust)));

/** Whether the paint needs the SVG adjustment filter (FigCraft's seven adjustments), not only CSS filter functions. */
export const hasAdjustFilter = (p: Paint): p is ImagePaint => p.type === "image" && !!p.adjust && !isIdentityAdjustment(p.adjust);

/**
 * The CSS filter for an image paint, or "" when it is unchanged: `brightness() contrast() saturate()`, then the
 * adjustment filter by reference when the paint has adjustments (`adjustFilterId` names the SVG filter drawn next to it).
 */
export function imageFilterCss(p: Paint, adjustFilterId?: string): string {
  if (p.type !== "image" || !hasImageFilter(p)) return "";
  const basic = p.brightness !== 1 || p.contrast !== 1 || p.saturation !== 1 ? `brightness(${f(p.brightness)}) contrast(${f(p.contrast)}) saturate(${f(p.saturation)})` : "";
  const adjust = hasAdjustFilter(p) && adjustFilterId ? `url(#${adjustFilterId})` : "";
  return [basic, adjust].filter(Boolean).join(" ");
}

/** The CSS keyword for a paint's blend mode. */
export const paintBlendCss = (p: Paint): string => (p.blend ? blendCss(p.blend) : "normal");

/** How a picture sits in its box as CSS `background-size`, `-position` and `-repeat`. A crop is the box showing the named part of the picture. */
export function imageLayout(p: ImagePaint): { size: string; position: string; repeat: string } {
  switch (p.mode) {
    case "fill": return { size: "cover", position: "center", repeat: "no-repeat" };
    case "fit": return { size: "contain", position: "center", repeat: "no-repeat" };
    case "crop": {
      const { x, y, w, h } = p.crop;
      return { size: `${f(100 / w)}% ${f(100 / h)}%`, position: `${w >= 1 ? 0 : f((x / (1 - w)) * 100)}% ${h >= 1 ? 0 : f((y / (1 - h)) * 100)}%`, repeat: "no-repeat" };
    }
    case "tile": {
      const nw = (p.natural?.w ?? 128) * p.scale;
      const nh = (p.natural?.h ?? 128) * p.scale;
      return { size: `${f(nw)}px ${f(nh)}px`, position: "0 0", repeat: "repeat" };
    }
  }
}

export interface FillLayers {
  image: string;
  size: string;
  position: string;
  repeat: string;
  /** `background-blend-mode`, one per layer; absent when every paint is normal. */
  blend?: string;
}

/** The four background lists for fills, top first, and the image paints that need a layer of their own for their colour filters. */
export function fillLayers(fills: readonly Paint[], w: number, h: number, assetUrl?: (src: string) => string | null): { layers: FillLayers | undefined; filtered: ImagePaint[] } {
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  const filtered: ImagePaint[] = [];
  const blends: string[] = [];
  for (const p of fills) {
    if (!p.visible) continue;
    if (hasImageFilter(p)) {
      filtered.push(p as ImagePaint);
      continue;
    }
    if (p.type === "diamond") {
      for (const q of diamondCss(p, w > 0 ? w : 100, h > 0 ? h : 100)) {
        images.push(q.image);
        sizes.push(q.size);
        positions.push(q.position);
        repeats.push("no-repeat");
        blends.push(paintBlendCss(p));
      }
      continue;
    }
    const css = paintCss(p, w, h, assetUrl);
    if (!css) continue;
    images.push(css);
    const l = p.type === "image" ? imageLayout(p) : { size: "auto", position: "0 0", repeat: "no-repeat" };
    sizes.push(l.size);
    positions.push(l.position);
    repeats.push(l.repeat);
    blends.push(paintBlendCss(p));
  }
  const blend = blends.some((b) => b !== "normal") ? blends.join(", ") : undefined;
  return { layers: images.length ? { image: images.join(", "), size: sizes.join(", "), position: positions.join(", "), repeat: repeats.join(", "), ...(blend ? { blend } : {}) } : undefined, filtered };
}

/** The `background-image` for a list of fills (first is on top), or undefined when none is visible. */
export function fillsBackground(fills: readonly Paint[], w: number, h: number): string | undefined {
  const images = fills.map((p) => paintCss(p, w, h)).filter((c): c is string => c !== null);
  return images.length > 0 ? images.join(", ") : undefined;
}

// --- Shadows -------------------------------------------------------------------

export interface Shadow {
  kind: "drop" | "inner";
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  visible: boolean;
}

export const DEFAULT_SHADOW: Shadow = { kind: "drop", x: 0, y: 4, blur: 8, spread: 0, color: "rgba(0, 0, 0, 0.25)", visible: true };

export function parseShadows(json: unknown): Shadow[] {
  if (typeof json !== "string" || json === "" || json.length > MAX_PAINT_JSON) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: Shadow[] = [];
  for (const s of raw.slice(0, MAX_SHADOWS)) {
    const o = typeof s === "object" && s !== null ? (s as Record<string, unknown>) : null;
    const color = o ? safeColor(o.color) : null;
    if (!o || !color) continue;
    out.push({
      kind: o.kind === "inner" ? "inner" : "drop",
      x: num(o.x, 0, -1000, 1000), y: num(o.y, 0, -1000, 1000), blur: num(o.blur, 0, 0, 200), spread: num(o.spread, 0, -100, 100),
      color, visible: o.visible !== false,
    });
  }
  return out;
}

export function serializeShadows(shadows: readonly Shadow[]): string {
  return shadows.length === 0 ? "" : JSON.stringify(shadows.slice(0, MAX_SHADOWS).map((s) => ({ kind: s.kind, x: s.x, y: s.y, blur: s.blur, spread: s.spread, color: s.color, ...(s.visible ? {} : { visible: false }) })));
}

/** CSS `box-shadow` for the visible shadows (inner ones are `inset`), or undefined. */
export function boxShadowCss(shadows: readonly Shadow[]): string | undefined {
  const parts = shadows.filter((s) => s.visible).map((s) => `${s.kind === "inner" ? "inset " : ""}${f(s.x)}px ${f(s.y)}px ${f(s.blur)}px ${f(s.spread)}px ${toCss(parseColor(s.color)!)}`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** CSS `text-shadow`: text has drop shadows only (no spread, no inner). */
export function textShadowCss(shadows: readonly Shadow[]): string | undefined {
  const parts = shadows.filter((s) => s.visible && s.kind === "drop").map((s) => `${f(s.x)}px ${f(s.y)}px ${f(s.blur)}px ${toCss(parseColor(s.color)!)}`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

// --- Strokes -------------------------------------------------------------------

/** A dash pattern the renderer may use: numbers and separators only, at most 8 values; anything else is no dash. */
export function safeDashArray(value: string): string | undefined {
  const v = value.trim();
  if (v === "" || v === "none" || !/^[0-9.]+(?:[ ,]+[0-9.]+){0,7}$/.test(v)) return undefined;
  const nums = v.split(/[ ,]+/).map(Number);
  return nums.every((n) => Number.isFinite(n) && n >= 0) && nums.some((n) => n > 0) ? nums.join(" ") : undefined;
}

/** The dash patterns the picker offers, scaled to the stroke's width. */
export const DASH_PRESETS: readonly { id: "solid" | "dashed" | "dotted"; label: string; array: (width: number) => string }[] = [
  { id: "solid", label: "Solid", array: () => "none" },
  { id: "dashed", label: "Dashed", array: (w) => `${Math.max(1, w) * 4} ${Math.max(1, w) * 3}` },
  { id: "dotted", label: "Dotted", array: (w) => `${Math.max(1, w)} ${Math.max(1, w) * 2}` },
];
