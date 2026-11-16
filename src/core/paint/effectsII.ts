/**
 * Layer effects II (ROADMAP Phase 121), built on Phase 35's shadows and the FigCraft port's effect list (F7):
 *
 * - **Glow**: an outer or inner glow is a shadow with no offset (`glow: true` in `paint.shadows`), so it draws exactly
 *   as a shadow does, on the stage and in the export.
 * - **Progressive blur**: a layer or background blur whose radius ramps along a direction (the effect list's
 *   progressive blur, drawn as stepped backdrop bands); `directionPoints` gives the ramp for a direction.
 * - **Grain**: a mono noise over the layer, its strength the grains' opacity.
 * - **Frosted glass**: a preset of a background blur, a light tint, an edge light (a thin inner glow) and a little grain.
 * - **Fallback**: where the browser has no `backdrop-filter`, a layer that blurs what is behind it shows a more opaque
 *   tint instead, so text on it stays readable (`BACKDROP_FALLBACK_CSS`, `backdropFallback`).
 */

import { parseCss, toCss } from "./color";
import { DEFAULT_NOISE, parseEffects, serializeEffects, type Effect, type Point } from "./effects";
import { parseShadows, serializeShadows, type Shadow } from "./paints";

// --- progressive blur ---------------------------------------------------------------------------

/** Which way a progressive blur gets stronger: towards the top, bottom, left or right edge. */
export type BlurDirection = "up" | "down" | "left" | "right";
export const BLUR_DIRECTIONS: readonly BlurDirection[] = ["up", "down", "left", "right"];

/** The ramp's start and end points (unit box) for a direction: weakest at the start, strongest at the end. */
export function directionPoints(d: BlurDirection): { start: Point; end: Point } {
  switch (d) {
    case "up":
      return { start: [0.5, 1], end: [0.5, 0] };
    case "left":
      return { start: [1, 0.5], end: [0, 0.5] };
    case "right":
      return { start: [0, 0.5], end: [1, 0.5] };
    default:
      return { start: [0.5, 0], end: [0.5, 1] };
  }
}

/** The direction a ramp runs in (the nearest of the four). */
export function directionOf(start: Point, end: Point): BlurDirection {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

export interface ProgressiveBlur {
  /** The radius at the strong end (px). */
  radius: number;
  /** The radius at the weak end (px). */
  startRadius: number;
  direction: BlurDirection;
}

/** The effect list with its `kind` blur set to a progressive one, or removed (null). Other effects are kept. */
export function withProgressiveBlur(effects: readonly Effect[], kind: "layerBlur" | "backgroundBlur", blur: ProgressiveBlur | null): Effect[] {
  const rest = effects.filter((e) => e.type !== kind);
  if (!blur) return rest;
  const { start, end } = directionPoints(blur.direction);
  const e = { type: kind, visible: true, blurType: "progressive", radius: Math.max(0, blur.radius), startRadius: Math.max(0, blur.startRadius), start, end } as Effect;
  return [...rest, e];
}

// --- grain --------------------------------------------------------------------------------------

/** The grain (a mono noise) in an effect list: its size (px) and strength (0..1), or null. */
export function grainIn(effects: readonly Effect[]): { size: number; amount: number } | null {
  const n = effects.find((e) => e.type === "noise" && e.mode === "mono");
  if (!n || n.type !== "noise") return null;
  return { size: n.size, amount: parseCss(n.color)?.a ?? 0.25 };
}

/** The effect list with its grain set (black grains at `amount` opacity) or removed. Other noises are kept. */
export function withGrain(effects: readonly Effect[], grain: { size: number; amount: number } | null): Effect[] {
  const i = effects.findIndex((e) => e.type === "noise" && e.mode === "mono");
  const rest = effects.filter((_, j) => j !== i);
  if (!grain) return rest;
  const e: Effect = { type: "noise", visible: true, ...DEFAULT_NOISE, mode: "mono", size: Math.min(100, Math.max(0.05, grain.size)), density: 0.5, color: toCss({ r: 0, g: 0, b: 0, a: Math.min(1, Math.max(0, grain.amount)) }) };
  return i < 0 ? [...rest, e] : [...rest.slice(0, i), e, ...rest.slice(i)];
}

// --- glow ---------------------------------------------------------------------------------------

export const DEFAULT_GLOW: Shadow = { kind: "drop", x: 0, y: 0, blur: 16, spread: 0, color: "rgba(255, 210, 74, 0.8)", visible: true, glow: true };

/** A glow as the shadow it draws: no offset. */
export const glowShadow = (inner: boolean, color: string, size: number, spread: number, visible = true): Shadow => ({ kind: inner ? "inner" : "drop", x: 0, y: 0, blur: Math.max(0, size), spread, color, visible, glow: true });

// --- frosted glass ------------------------------------------------------------------------------

export const FROSTED_GLASS = { blur: 20, tint: "rgba(255, 255, 255, 0.18)", edge: "rgba(255, 255, 255, 0.6)", grain: 0.06 } as const;

/**
 * The properties that make a layer frosted glass: a background blur, a light tint (unless it already has a
 * background), an edge light (a thin inner glow) and a little grain. Shadows and effects it already has are kept.
 */
export function frostedGlassProps(props: Readonly<Record<string, unknown>>): Record<string, string | number> {
  const bg = props["appearance.background.color"];
  const c = typeof bg === "string" ? parseCss(bg) : null;
  const shadows = parseShadows(props["paint.shadows"]).filter((s) => !(s.glow && s.kind === "inner"));
  const effects = withGrain(parseEffects(props["paint.effects"]).filter((e) => e.type !== "backgroundBlur"), { size: 0.5, amount: FROSTED_GLASS.grain });
  return {
    "paint.backgroundBlur": FROSTED_GLASS.blur,
    ...(!c || c.a === 0 ? { "appearance.background.color": FROSTED_GLASS.tint } : {}),
    "paint.shadows": serializeShadows([...shadows, glowShadow(true, FROSTED_GLASS.edge, 2, 0)]),
    "paint.effects": serializeEffects(effects),
  };
}

// --- no backdrop-filter -------------------------------------------------------------------------

/** The rule that swaps in the fallback tint where the browser can't blur what's behind an element. */
export const BACKDROP_FALLBACK_CSS =
  "@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { [data-backdrop-fallback] { background-color: var(--ll-backdrop-fallback) !important; } [data-effect-band] { display: none; } }";

/** Whether a layer reads what is behind it (a background blur, plain or in the effect list, or glass). */
export function readsBackdrop(get: (path: string) => unknown): boolean {
  const plain = get("paint.backgroundBlur");
  if (typeof plain === "number" && plain > 0) return true;
  return parseEffects(get("paint.effects")).some((e) => e.visible && (e.type === "backgroundBlur" || e.type === "glass"));
}

/**
 * The tint shown instead of the blur where `backdrop-filter` is missing: the layer's own background colour made at
 * least 85% opaque (a white one when it has none). Null when the layer doesn't read its backdrop.
 */
export function backdropFallback(get: (path: string) => unknown): string | null {
  if (!readsBackdrop(get)) return null;
  const bg = get("appearance.background.color");
  const c = typeof bg === "string" ? parseCss(bg) : null;
  return toCss(c && c.a > 0 ? { ...c, a: Math.max(0.85, c.a) } : { r: 1, g: 1, b: 1, a: 0.85 });
}
