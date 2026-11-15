/**
 * Pen input into stroke width (ROADMAP Phase 120). A drawn stroke's samples carry the pen's pressure and tilt and the
 * time they arrived. This turns them into a width profile along the stroke (the profile Phase 119's outliner draws):
 * - **pressure**: harder is wider;
 * - **tilt**: a pen laid flatter draws wider, like the side of a pencil lead;
 * - **speed**: faster is thinner, like ink. A mouse has no pressure, so "auto" uses speed for it.
 *
 * The widths are smoothed along the stroke and sampled at evenly spaced points (by length), so the same recorded
 * input always gives the same profile. Pure functions, no DOM.
 */

import { WIDTH_MAX_POINTS, type WidthPoint } from "./strokes";
import { roundPoints } from "./widthProfiles";

export interface PenSample {
  x: number;
  y: number;
  /** Milliseconds since the stroke began. */
  t: number;
  /** 0 to 1 (0.5 for a mouse, which has none). */
  p: number;
  /** The pen's tilt, in degrees from upright (-90..90), when the device reports it. */
  tiltX?: number;
  tiltY?: number;
}

export type WidthSource = "auto" | "pressure" | "tilt" | "speed" | "none";
export const WIDTH_SOURCES: readonly WidthSource[] = ["auto", "pressure", "tilt", "speed", "none"];

export interface PenWidthOptions {
  source?: WidthSource;
  /** 0 to 1: how much the widths are smoothed along the stroke (default 0.5). */
  smoothing?: number;
  /** The thinnest the stroke gets, as a share of its full width (default 0.1). */
  minScale?: number;
  /** Speed (px per ms) at which the stroke is thinnest (default 2.5). */
  fastSpeed?: number;
  /** How many points the profile has (default 32, at most 64). */
  points?: number;
}

/** Whether the samples come from a device that reports pressure (a pen, a pressure-sensitive touch). */
export const hasPressure = (s: readonly PenSample[]): boolean => {
  const ps = s.map((x) => x.p);
  return ps.some((p) => p > 0 && Math.abs(p - 0.5) > 1e-6) && Math.max(...ps) - Math.min(...ps) > 0.02;
};
const hasTilt = (s: readonly PenSample[]): boolean => s.some((x) => (x.tiltX ?? 0) !== 0 || (x.tiltY ?? 0) !== 0);

/** Which source "auto" means for these samples: pressure for a pen, speed for a mouse. */
export const resolveSource = (s: readonly PenSample[], source: WidthSource): Exclude<WidthSource, "auto"> => (source !== "auto" ? source : hasPressure(s) ? "pressure" : "speed");

/** The raw width of each sample (0..1) for a source. */
function rawWidths(s: readonly PenSample[], source: Exclude<WidthSource, "auto">, fast: number): number[] {
  if (source === "none") return s.map(() => 1);
  if (source === "pressure") return s.map((x) => Math.min(1, Math.max(0, x.p)));
  if (source === "tilt") {
    if (!hasTilt(s)) return s.map(() => 1);
    // upright is the narrowest; laid flat (90°) the widest
    return s.map((x) => Math.min(1, Math.hypot(x.tiltX ?? 0, x.tiltY ?? 0) / 90));
  }
  // speed, from each sample's neighbours (a window steadies the uneven timing of pointer events)
  return s.map((_, i) => {
    const a = s[Math.max(0, i - 2)];
    const b = s[Math.min(s.length - 1, i + 2)];
    const dt = Math.max(1, b.t - a.t);
    const v = Math.hypot(b.x - a.x, b.y - a.y) / dt;
    return 1 - Math.min(1, v / fast);
  });
}

/** Cumulative length of the samples (starts at 0). */
function lengths(s: readonly PenSample[]): number[] {
  const out = [0];
  for (let i = 1; i < s.length; i++) out.push(out[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  return out;
}

/**
 * The width profile drawn samples give (null when they don't vary it: the source is "none", or the stroke has no
 * length). Scales run from `minScale` to 1, so the layer's stroke weight is the widest the stroke gets.
 */
export function penWidthProfile(samples: readonly PenSample[], options: PenWidthOptions = {}): WidthPoint[] | null {
  const s = samples.filter((x) => Number.isFinite(x.x) && Number.isFinite(x.y) && Number.isFinite(x.t) && Number.isFinite(x.p));
  if (s.length < 2) return null;
  const source = resolveSource(s, options.source ?? "auto");
  if (source === "none") return null;
  const lens = lengths(s);
  const total = lens[lens.length - 1];
  if (total <= 1e-6) return null;
  const smooth = Math.min(1, Math.max(0, options.smoothing ?? 0.5));
  const floor = Math.min(1, Math.max(0, options.minScale ?? 0.1));
  const raw = rawWidths(s, source, Math.max(0.05, options.fastSpeed ?? 2.5));
  const n = Math.max(2, Math.min(WIDTH_MAX_POINTS, Math.round(options.points ?? 32)));
  // the width at a length, averaged over a window of the stroke (smoothing 1: a tenth of its length on each side)
  const radius = smooth * total * 0.1;
  const at = (d: number): number => {
    if (radius <= 1e-9) {
      let i = 1;
      while (i < lens.length - 1 && lens[i] < d) i++;
      const span = lens[i] - lens[i - 1];
      const u = span > 1e-9 ? (d - lens[i - 1]) / span : 0;
      return raw[i - 1] + (raw[i] - raw[i - 1]) * Math.min(1, Math.max(0, u));
    }
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < s.length; i++) {
      const k = 1 - Math.abs(lens[i] - d) / radius;
      if (k <= 0) continue;
      // each sample counts for the length it covers, so a slow, dense stretch doesn't outweigh a fast one
      const cover = Math.max(1e-6, ((lens[i + 1] ?? lens[i]) - (lens[i - 1] ?? lens[i])) / 2);
      sum += raw[i] * k * cover;
      weight += k * cover;
    }
    return weight > 0 ? sum / weight : raw[0];
  };
  const pts: WidthPoint[] = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    pts.push({ t, scale: floor + (1 - floor) * Math.min(1, Math.max(0, at(t * total))), bias: 0 });
  }
  // the widest is the stroke's weight
  const top = Math.max(...pts.map((p) => p.scale));
  return roundPoints(top > 1e-9 ? pts.map((p) => ({ ...p, scale: p.scale / top })) : pts);
}
