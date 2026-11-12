import type { PropValue } from "../document/registry";
import type { FilterPrimitive } from "../paint/effects";
import type { PropReader } from "./compositing";

/**
 * ============================================================================
 * THE EFFECT STACK (ROADMAP Phase 75)
 * ============================================================================
 * An ordered list of up to eight effects per layer: blur, glow, drop shadow, colour adjust, displacement and noise,
 * each with parameters that can be keyframed. Effect N is the property group `fx.N.*` (`fx.2.radius`), and the order of
 * the list is the order of the slots, so reordering is rewriting slots (`layer.moveEffect`).
 *
 * Pure functions from a layer's resolved properties to what the browser is asked to draw, shared by the render
 * definitions (the stage and the export) and the animation engine's style writer so an animated effect is drawn by the
 * code that draws a still one:
 *  - blur, glow, drop shadow and colour adjust are CSS `filter` functions;
 *  - displacement and noise need an SVG filter (CSS has none), one `<filter>` per effect, which the engine keeps in the
 *    frame document and updates attribute by attribute as a parameter animates.
 * Which route an effect takes, and why, is `rules/effectRouting.ts`.
 *
 * Motion blur (the layer's switch plus the shutter angle) is a Gaussian blur along the layer's own velocity, drawn by one
 * more SVG filter; the kernel supplies the amount (`motion.blur.x`, `motion.blur.y`).
 * ============================================================================
 */

export const FX_SLOTS = 8;
export const FX_TYPES = ["blur", "glow", "dropShadow", "colorAdjust", "displacement", "noise"] as const;
export type FxType = (typeof FX_TYPES)[number];

export const FX_LABELS: Record<FxType, string> = { blur: "Blur", glow: "Glow", dropShadow: "Drop shadow", colorAdjust: "Colour adjust", displacement: "Displacement", noise: "Noise" };

/** The parameters each effect has (the rest of a slot's properties are ignored for it). */
export const FX_PARAMS: Record<FxType, readonly string[]> = {
  blur: ["radius"],
  glow: ["radius", "intensity", "color", "opacity"],
  dropShadow: ["x", "y", "radius", "color", "opacity"],
  colorAdjust: ["brightness", "contrast", "saturate", "hueRotate"],
  displacement: ["scale", "frequency", "seed"],
  noise: ["amount", "size", "seed"],
};

/** What a new effect starts with (`layer.addEffect`), so adding one shows something. */
export const FX_DEFAULTS: Record<FxType, Readonly<Record<string, number | string>>> = {
  blur: { radius: 8 },
  glow: { radius: 12, intensity: 1, color: "#ffffff", opacity: 1 },
  dropShadow: { x: 0, y: 8, radius: 12, color: "#000000", opacity: 0.35 },
  colorAdjust: { brightness: 1, contrast: 1, saturate: 1, hueRotate: 0 },
  displacement: { scale: 20, frequency: 0.02, seed: 1 },
  noise: { amount: 0.3, size: 1, seed: 1 },
};

/** The path of one parameter of one slot. */
export const fxPath = (slot: number, param: string): string => `fx.${slot}.${param}`;
export const isFxPath = (path: string): boolean => path.startsWith("fx.");
/** Every property of one slot, for clearing it. */
export const FX_SLOT_PARAMS = ["type", "enabled", "radius", "intensity", "x", "y", "opacity", "color", "brightness", "contrast", "saturate", "hueRotate", "scale", "frequency", "seed", "amount", "size"] as const;

export interface FxEffect {
  slot: number;
  type: FxType;
  enabled: boolean;
  params: Record<string, number | string>;
}

const isFxType = (v: unknown): v is FxType => typeof v === "string" && (FX_TYPES as readonly string[]).includes(v);

/** The effects a layer has, in order. A slot with no type, or an unknown one, is empty. Disabled effects are listed (with `enabled: false`) so a list can show them. */
export function readStack(read: PropReader): FxEffect[] {
  const out: FxEffect[] = [];
  for (let slot = 1; slot <= FX_SLOTS; slot++) {
    const type = read(fxPath(slot, "type"));
    if (!isFxType(type)) continue;
    const params: Record<string, number | string> = {};
    for (const name of FX_PARAMS[type]) {
      const v = read(fxPath(slot, name));
      if (typeof v === "number" && Number.isFinite(v)) params[name] = v;
      else if (typeof v === "string") params[name] = v;
    }
    out.push({ slot, type, enabled: read(fxPath(slot, "enabled")) !== false, params });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const num = (e: FxEffect, name: string, fallback = 0): number => (typeof e.params[name] === "number" ? (e.params[name] as number) : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const SAFE_COLOUR = /^(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-zA-Z]{3,20})$/;
const colourOf = (e: FxEffect, fallback: string): string => {
  const v = e.params.color;
  return typeof v === "string" && SAFE_COLOUR.test(v.trim()) ? v.trim() : fallback;
};
/** A colour at an opacity: `color-mix` keeps the colour's own alpha and works in every current browser. */
const withOpacity = (colour: string, opacity: number): string => (opacity >= 1 ? colour : `color-mix(in srgb, ${colour} ${round(clamp(opacity, 0, 1) * 100)}%, transparent)`);

/** Whether an effect is drawn by an SVG filter (the rest are CSS). */
export const isSvgEffect = (type: FxType): boolean => type === "displacement" || type === "noise";

/** The CSS `filter` functions one effect makes, or none when it would change nothing. */
export function fxCssFunctions(e: FxEffect): string[] {
  switch (e.type) {
    case "blur": {
      const r = clamp(num(e, "radius"), 0, 200);
      return r > 0 ? [`blur(${round(r)}px)`] : [];
    }
    case "glow": {
      const r = clamp(num(e, "radius"), 0, 200);
      const opacity = clamp(num(e, "opacity", 1), 0, 1);
      const copies = Math.round(clamp(num(e, "intensity", 1), 0, 4));
      if (r <= 0 || opacity <= 0 || copies < 1) return [];
      return Array.from({ length: copies }, () => `drop-shadow(0px 0px ${round(r)}px ${withOpacity(colourOf(e, "#ffffff"), opacity)})`);
    }
    case "dropShadow": {
      const opacity = clamp(num(e, "opacity", 1), 0, 1);
      if (opacity <= 0) return [];
      return [`drop-shadow(${round(num(e, "x"))}px ${round(num(e, "y"))}px ${round(clamp(num(e, "radius"), 0, 200))}px ${withOpacity(colourOf(e, "#000000"), opacity)})`];
    }
    case "colorAdjust": {
      const parts: string[] = [];
      const b = clamp(num(e, "brightness", 1), 0, 5);
      const c = clamp(num(e, "contrast", 1), 0, 5);
      const s = clamp(num(e, "saturate", 1), 0, 5);
      const h = num(e, "hueRotate");
      if (b !== 1) parts.push(`brightness(${round(b)})`);
      if (c !== 1) parts.push(`contrast(${round(c)})`);
      if (s !== 1) parts.push(`saturate(${round(s)})`);
      if (h !== 0) parts.push(`hue-rotate(${round(h)}deg)`);
      return parts;
    }
    default:
      return [];
  }
}

const safeId = (layerId: string) => layerId.replace(/[^A-Za-z0-9_-]/g, "_");
export const fxFilterId = (layerId: string, slot: number): string => `fxs-${safeId(layerId)}-${slot}`;
export const motionBlurFilterId = (layerId: string): string => `mb-${safeId(layerId)}`;

/** A filter the engine keeps in the frame document: its id, how far past the layer it reaches (px), and its primitives. */
export interface FxFilterSpec {
  id: string;
  /** How far the effect can move pixels outside the layer, in px (sizes the filter region). */
  region: number;
  primitives: FilterPrimitive[];
}

/** Grain frequency for a grain size: features about `size` px across. */
const grainFrequency = (size: number) => Math.min(2, 1 / Math.max(0.5, size * 2));

/** The SVG filter of one displacement or noise effect, or null for a CSS effect. */
export function fxFilterSpec(layerId: string, e: FxEffect): FxFilterSpec | null {
  const id = fxFilterId(layerId, e.slot);
  if (e.type === "displacement") {
    const scale = clamp(num(e, "scale"), 0, 500);
    const f = clamp(num(e, "frequency", 0.02), 0.001, 1);
    return {
      id,
      region: scale,
      primitives: [
        { tag: "feTurbulence", attrs: { type: "fractalNoise", baseFrequency: round(f), numOctaves: 2, seed: Math.round(num(e, "seed", 1)), result: "t" } },
        { tag: "feDisplacementMap", attrs: { in: "SourceGraphic", in2: "t", scale: round(scale), xChannelSelector: "R", yChannelSelector: "G" } },
      ],
    };
  }
  if (e.type === "noise") {
    const k = round(clamp(num(e, "amount", 0.3), 0, 1) / 1.5);
    return {
      id,
      region: 0,
      primitives: [
        { tag: "feTurbulence", attrs: { type: "fractalNoise", baseFrequency: round(grainFrequency(clamp(num(e, "size", 1), 0.5, 50))), numOctaves: 1, seed: Math.round(num(e, "seed", 1)), result: "n" } },
        { tag: "feColorMatrix", attrs: { in: "n", type: "matrix", values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${k} ${k} ${k} 0 0`, result: "g" } },
        { tag: "feComposite", attrs: { in: "g", in2: "SourceAlpha", operator: "in", result: "k" } },
        { tag: "feMerge", attrs: {}, children: [{ tag: "feMergeNode", attrs: { in: "SourceGraphic" } }, { tag: "feMergeNode", attrs: { in: "k" } }] },
      ],
    };
  }
  return null;
}

/** The motion blur filter: a Gaussian blur of `sx` px across and `sy` px down (the standard deviations). */
export function motionBlurSpec(layerId: string, sx: number, sy: number): FxFilterSpec {
  return { id: motionBlurFilterId(layerId), region: Math.ceil(Math.max(sx, sy) * 4), primitives: [{ tag: "feGaussianBlur", attrs: { stdDeviation: `${round(sx)} ${round(sy)}` } }] };
}

export interface FxResult {
  /** The CSS `filter` functions in order, with `url(#id)` where an SVG effect belongs (only when `svg` is asked for). */
  functions: string[];
  /** The SVG filters those `url()`s point at. */
  filters: FxFilterSpec[];
}

/**
 * The stack, as the pieces of a CSS `filter` and the SVG filters it refers to. Without `svg` the SVG effects are left
 * out (the export and the first paint before the engine runs); with it they are `url(#…)` in their place in the list.
 * `motionBlur` is the amount the kernel worked out (sigma across and down), or null.
 */
export function fxStyle(layerId: string, read: PropReader, options: { svg: boolean }): FxResult {
  const functions: string[] = [];
  const filters: FxFilterSpec[] = [];
  for (const e of readStack(read)) {
    if (!e.enabled) continue;
    if (isSvgEffect(e.type)) {
      if (!options.svg) continue;
      const spec = fxFilterSpec(layerId, e);
      if (spec) {
        functions.push(`url(#${spec.id})`);
        filters.push(spec);
      }
      continue;
    }
    functions.push(...fxCssFunctions(e));
  }
  if (options.svg) {
    const sx = read("motion.blur.x");
    const sy = read("motion.blur.y");
    if ((typeof sx === "number" && sx > 0) || (typeof sy === "number" && sy > 0)) {
      const spec = motionBlurSpec(layerId, typeof sx === "number" ? sx : 0, typeof sy === "number" ? sy : 0);
      functions.push(`url(#${spec.id})`);
      filters.push(spec);
    }
  }
  return { functions, filters };
}

/** Whether a layer has anything for the engine to draw: an enabled effect, or the motion blur switch. */
export function hasFx(props: Readonly<Record<string, PropValue>>, motionBlurOn: boolean): boolean {
  if (motionBlurOn) return true;
  for (let slot = 1; slot <= FX_SLOTS; slot++) {
    const type = props[fxPath(slot, "type")];
    if (isFxType(type) && props[fxPath(slot, "enabled")] !== false) return true;
  }
  return false;
}

/** Motion blur's standard deviations from the layer's velocity: a box blur of `speed × exposure` px has a deviation of about 0.2887 times that. */
export function motionBlurSigma(velocity: { x: number; y: number }, fps: number, shutterAngle: number): { x: number; y: number } {
  const exposure = clamp(shutterAngle, 0, 720) / 360 / Math.max(1, fps);
  return { x: round(Math.abs(velocity.x) * exposure * 0.2887), y: round(Math.abs(velocity.y) * exposure * 0.2887) };
}
