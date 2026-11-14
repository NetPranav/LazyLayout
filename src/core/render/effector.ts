/**
 * Effectors (Design track D10): vary each copy of a repeater or cloner by a field, so a grid is not uniform. A field gives
 * each copy an influence f in 0..1; `scale`, `fade` and the offset then move that copy from "as made" (f = 0) to the full
 * setting (f = 1).
 *
 * - **index**: f runs 0..1 along the copies in drawing order (the layer itself is 0, the last copy is 1): a ramp.
 * - **noise**: f is a seeded noise of the copy's index: organic variation, the same every time for the same seed.
 * - **pointer**: f falls off with the copy's distance to the pointer (1 under it, 0 at `radius`): dots that grow near the
 *   cursor. Live, so it is applied by the stage's driver while the page is running, not by the renderer.
 * - **scroll**: a wave runs along the copies as the page scrolls: the copy at the scroll position has f = 1, and f falls
 *   off over `spread` copies either side (so the dots ripple one after another as you scroll). Live, like the pointer.
 *
 * Pure: the renderer applies `index` and `noise`, the driver applies `pointer`, both through `effectCopy`.
 */
import { falloffOf, noise1 } from "../bindings/evaluate";

export type EffectorMode = "off" | "index" | "noise" | "pointer" | "scroll";
export const FALLOFFS = ["linear", "smoothstep", "gaussian", "inverse-square"] as const;
export type Falloff = (typeof FALLOFFS)[number];

export interface EffectorSettings {
  mode: Exclude<EffectorMode, "off">;
  /** The copy's size at f = 1, as a multiple of its size at f = 0. 1 changes nothing. */
  scale: number;
  /** The copy's opacity at f = 1, as a multiple of its opacity at f = 0. */
  fade: number;
  /** The copy's shift at f = 1, in px. */
  offsetX: number;
  offsetY: number;
  /** The copy's colour turn at f = 1, in degrees (a hue rotation, so it works on any fill). */
  hue: number;
  /** Pointer mode: the distance at which the influence has fallen to 0, in px. */
  radius: number;
  /** Scroll mode: how many copies either side of the wave still feel it. */
  spread: number;
  falloff: Falloff;
  seed: number;
}

export interface EffectedCopy {
  /** Multiplier on the copy's size. */
  scale: number;
  opacity: number;
  dx: number;
  dy: number;
  /** Degrees of hue turn. */
  hue: number;
}

const finite = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function readEffector(get: (path: string) => unknown): EffectorSettings | null {
  const mode = get("effector.mode");
  if (mode !== "index" && mode !== "noise" && mode !== "pointer" && mode !== "scroll") return null;
  const falloff = get("effector.falloff");
  return {
    mode,
    scale: Math.max(0, finite(get("effector.scale"), 1)),
    fade: Math.min(1, Math.max(0, finite(get("effector.fade"), 1))),
    offsetX: finite(get("effector.offsetX"), 0),
    offsetY: finite(get("effector.offsetY"), 0),
    hue: finite(get("effector.hue"), 0),
    radius: Math.max(1, finite(get("effector.radius"), 200)),
    spread: Math.max(0.5, finite(get("effector.spread"), 3)),
    falloff: (FALLOFFS as readonly unknown[]).includes(falloff) ? (falloff as Falloff) : "smoothstep",
    seed: Math.floor(finite(get("effector.seed"), 1)),
  };
}

/**
 * The influence of the field on copy `index` of `count` (the layer is 0). `distance` is the copy's distance to the pointer, in
 * px; `progress` is how far the page is scrolled, 0..1. A live field with no reading leaves the copies as made.
 */
export function influence(s: EffectorSettings, index: number, count: number, distance?: number, progress?: number): number {
  if (s.mode === "index") return count <= 1 ? 0 : Math.min(1, Math.max(0, index / (count - 1)));
  if (s.mode === "noise") return (noise1(index * 7.13, s.seed) + 1) / 2;
  if (s.mode === "scroll") {
    if (progress === undefined || count <= 1) return 0;
    const at = Math.min(1, Math.max(0, progress)) * (count - 1); // the scroll position as a copy number
    return falloffOf(s.falloff, Math.abs(index - at), s.spread);
  }
  return distance === undefined ? 0 : falloffOf(s.falloff, distance, s.radius);
}

/** What the field does to one copy. */
export function effectCopy(s: EffectorSettings, f: number): EffectedCopy {
  return { scale: 1 + (s.scale - 1) * f, opacity: 1 + (s.fade - 1) * f, dx: s.offsetX * f + 0, dy: s.offsetY * f + 0, hue: s.hue * f + 0 }; // + 0 turns -0 into 0
}
