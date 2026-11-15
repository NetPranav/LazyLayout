/**
 * Colour tools (ROADMAP Phase 123): contrast checks, the nearest colour that passes, harmony rules, tints and shades,
 * and a palette from a picture. Pure functions on colours (0–255 channels, `colorMath.ts`); saving them as colour
 * tokens is `editing/colorToolOps.ts`.
 *
 * - **WCAG 2** contrast ratio, (L1 + 0.05) / (L2 + 0.05), with the AA and AAA levels for normal and large text.
 * - **APCA** lightness contrast Lc (APCA-W3 0.0.98G-4g, the constants of `apca-w3`): signed, positive for dark text
 *   on a light background, negative for light text on a dark one.
 * - A **suggestion** keeps the colour's hue and chroma (OKLCH) and moves only its lightness, to the nearest value
 *   that passes; it is checked again before it is returned, so a suggestion always passes (or there is none).
 */

import { oklchToRgb, rgbToOklch, toHex, type Oklch, type Rgba } from "./colorMath";

// --- WCAG 2 ------------------------------------------------------------------------------------------

/** Relative luminance (WCAG 2), channels 0–255. */
export function relativeLuminance(c: Rgba): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** The WCAG 2 contrast ratio, 1 to 21. */
export function wcagContrast(a: Rgba, b: Rgba): number {
  const x = relativeLuminance(a) + 0.05;
  const y = relativeLuminance(b) + 0.05;
  return x > y ? x / y : y / x;
}

export type WcagLevel = "AAA" | "AA" | "AA large" | "fail";

/** The best WCAG level a ratio meets, for normal text (or large text: 18 pt, or 14 pt bold). */
export function wcagLevel(ratio: number, large = false): WcagLevel {
  if (ratio >= (large ? 4.5 : 7)) return "AAA";
  if (ratio >= (large ? 3 : 4.5)) return "AA";
  if (!large && ratio >= 3) return "AA large";
  return "fail";
}

// --- APCA ------------------------------------------------------------------------------------------

const APCA = { mainTRC: 2.4, sR: 0.2126729, sG: 0.7151522, sB: 0.072175, normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65, blkThrs: 0.022, blkClmp: 1.414, scaleBoW: 1.14, scaleWoB: 1.14, loBoWoffset: 0.027, loWoBoffset: 0.027, deltaYmin: 0.0005, loClip: 0.1 } as const;

/** APCA's screen luminance Y of a colour (its simple 2.4 power curve, not the sRGB piecewise one). */
export function apcaY(c: Rgba): number {
  const ch = (v: number) => Math.pow(v / 255, APCA.mainTRC);
  return APCA.sR * ch(c.r) + APCA.sG * ch(c.g) + APCA.sB * ch(c.b);
}

/** The APCA lightness contrast Lc of `text` on `background` (about -108 to 106; 0 when they are too close). */
export function apcaContrast(text: Rgba, background: Rgba): number {
  const clamp = (y: number) => (y > APCA.blkThrs ? y : y + Math.pow(APCA.blkThrs - y, APCA.blkClmp));
  const txt = clamp(apcaY(text));
  const bg = clamp(apcaY(background));
  if (Math.abs(bg - txt) < APCA.deltaYmin) return 0;
  if (bg > txt) {
    const sapc = (Math.pow(bg, APCA.normBG) - Math.pow(txt, APCA.normTXT)) * APCA.scaleBoW;
    return sapc < APCA.loClip ? 0 : (sapc - APCA.loBoWoffset) * 100;
  }
  const sapc = (Math.pow(bg, APCA.revBG) - Math.pow(txt, APCA.revTXT)) * APCA.scaleWoB;
  return sapc > -APCA.loClip ? 0 : (sapc + APCA.loWoBoffset) * 100;
}

// --- checking and suggesting -------------------------------------------------------------------------

/** What a pair must reach: a WCAG ratio, an APCA |Lc|, or both. */
export interface ContrastTarget {
  wcag?: number;
  apca?: number;
}

export const DEFAULT_TARGET: ContrastTarget = { wcag: 4.5 };

export interface ContrastReport {
  wcag: number;
  level: WcagLevel;
  apca: number;
  passes: boolean;
}

export function checkContrast(text: Rgba, background: Rgba, target: ContrastTarget = DEFAULT_TARGET, large = false): ContrastReport {
  const wcag = wcagContrast(text, background);
  const apca = apcaContrast(text, background);
  return { wcag, level: wcagLevel(wcag, large), apca, passes: meets(text, background, target) };
}

/** Whether a pair reaches the target. */
export function meets(text: Rgba, background: Rgba, target: ContrastTarget): boolean {
  if (target.wcag !== undefined && wcagContrast(text, background) < target.wcag) return false;
  if (target.apca !== undefined && Math.abs(apcaContrast(text, background)) < target.apca) return false;
  return true;
}

const rgbKey = (c: Rgba) => `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`;

/**
 * The colour nearest to `text` (same hue and chroma, lightness moved as little as it can be) that reaches the target
 * on `background`; `text` itself when it already does; null when no lightness reaches it (an AAA ratio on a mid grey).
 * What it returns always passes: each candidate is rounded to whole channels and checked again.
 */
export function suggestPassing(text: Rgba, background: Rgba, target: ContrastTarget = DEFAULT_TARGET): Rgba | null {
  const round = (c: Rgba): Rgba => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: c.a });
  const t = round(text);
  if (meets(t, background, target)) return t;
  const base = rgbToOklch(t);
  const at = (l: number) => round(oklchToRgb({ ...base, l }, t.a));
  const found: { c: Rgba; dl: number }[] = [];
  for (const end of [0, 1]) {
    // walk from the colour's own lightness towards black (0) or white (1); find the first lightness that passes
    if (!meets(at(end), background, target)) continue;
    let lo = base.l;
    let hi = end;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (meets(at(mid), background, target)) hi = mid;
      else lo = mid;
    }
    const c = at(hi);
    if (meets(c, background, target)) found.push({ c, dl: Math.abs(hi - base.l) });
  }
  found.sort((a, b) => a.dl - b.dl);
  return found[0]?.c ?? null;
}

// --- harmony -----------------------------------------------------------------------------------------

export type HarmonyRule = "complementary" | "splitComplementary" | "analogous" | "triad" | "tetrad" | "monochrome";
export const HARMONY_RULES: readonly HarmonyRule[] = ["complementary", "splitComplementary", "analogous", "triad", "tetrad", "monochrome"];
export const HARMONY_LABEL: Record<HarmonyRule, string> = { complementary: "Complementary", splitComplementary: "Split complementary", analogous: "Analogous", triad: "Triad", tetrad: "Tetrad", monochrome: "Monochrome" };

const HUE_OFFSETS: Record<Exclude<HarmonyRule, "monochrome">, number[]> = {
  complementary: [0, 180],
  splitComplementary: [0, 150, 210],
  analogous: [-30, 0, 30],
  triad: [0, 120, 240],
  tetrad: [0, 90, 180, 270],
};

/** The colours of a harmony rule around `base` (the base included, in the rule's order), turned in OKLCH so lightness holds. */
export function harmony(base: Rgba, rule: HarmonyRule): Rgba[] {
  const o = rgbToOklch(base);
  if (rule === "monochrome") return [0.3, 0.45, o.l, 0.75, 0.9].map((l) => oklchToRgb({ ...o, l }, base.a)).map(roundRgb);
  return HUE_OFFSETS[rule].map((d) => (d === 0 ? roundRgb(base) : roundRgb(oklchToRgb({ ...o, h: (((o.h + d) % 360) + 360) % 360 }, base.a))));
}

const roundRgb = (c: Rgba): Rgba => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: c.a });

// --- tints and shades --------------------------------------------------------------------------------

/** The steps of a tint-and-shade scale, lightest first, with the OKLCH lightness each stands at. */
export const SCALE_STEPS: readonly [number, number][] = [[50, 0.97], [100, 0.93], [200, 0.87], [300, 0.79], [400, 0.7], [500, 0.61], [600, 0.52], [700, 0.44], [800, 0.36], [900, 0.28], [950, 0.2]];

/**
 * Tints and shades of `base`: the scale's steps at their lightness, keeping the base's hue; chroma eases off towards
 * the light and dark ends (as a hand-made scale does), and the step nearest the base's own lightness is the base.
 */
export function tintsAndShades(base: Rgba): { step: number; color: Rgba }[] {
  const o: Oklch = rgbToOklch(base);
  const nearest = SCALE_STEPS.reduce((best, s) => (Math.abs(s[1] - o.l) < Math.abs(best[1] - o.l) ? s : best), SCALE_STEPS[0]);
  return SCALE_STEPS.map(([step, l]) => {
    if (step === nearest[0]) return { step, color: roundRgb(base) };
    const ease = 1 - Math.pow(Math.abs(l - 0.6) / 0.45, 2) * 0.6;
    return { step, color: roundRgb(oklchToRgb({ l, c: o.c * Math.max(0.2, ease), h: o.h }, 1)) };
  });
}

// --- a palette from a picture -----------------------------------------------------------------------

export interface Swatch {
  color: Rgba;
  /** Share of the picture's pixels (0–1). */
  share: number;
}

/**
 * The `count` main colours of a picture (RGBA pixels), most common first: k-means in OKLab on at most ~4,000 evenly
 * spaced, opaque pixels, started from the farthest-apart pixels, so the same picture always gives the same palette.
 */
export function paletteFromPixels(data: Uint8ClampedArray | Uint8Array, width: number, height: number, count = 6): Swatch[] {
  const k = Math.max(1, Math.min(16, Math.round(count)));
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  const pts: [number, number, number][] = [];
  const rgb: Rgba[] = [];
  for (let y = 0; y < height; y += stride)
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const c = { r: data[i], g: data[i + 1], b: data[i + 2], a: 1 };
      const o = rgbToOklch(c);
      const h = (o.h * Math.PI) / 180;
      pts.push([o.l, o.c * Math.cos(h), o.c * Math.sin(h)]);
      rgb.push(c);
    }
  if (pts.length === 0) return [];
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // farthest-point start: the pixel nearest the mean, then each next the farthest from those chosen
  const mean = [0, 1, 2].map((j) => pts.reduce((s, p) => s + p[j], 0) / pts.length);
  const centres: number[][] = [pts.reduce((best, p) => (d2(p, mean) < d2(best, mean) ? p : best), pts[0]).slice()];
  const near = pts.map((p) => d2(p, centres[0]));
  while (centres.length < Math.min(k, pts.length)) {
    let far = 0;
    for (let i = 1; i < pts.length; i++) if (near[i] > near[far]) far = i;
    if (near[far] <= 1e-9) break;
    centres.push(pts[far].slice());
    for (let i = 0; i < pts.length; i++) near[i] = Math.min(near[i], d2(pts[i], pts[far]));
  }
  const label = new Int32Array(pts.length);
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      for (let c = 1; c < centres.length; c++) if (d2(pts[i], centres[c]) < d2(pts[i], centres[best])) best = c;
      if (label[i] !== best) {
        label[i] = best;
        moved = true;
      }
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sums[label[i]];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      s[3]++;
    }
    sums.forEach((s, c) => s[3] > 0 && (centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
    if (!moved && iter > 0) break;
  }
  // each swatch is the mean of its pixels in sRGB (a colour that is really in the picture's range)
  const groups = centres.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
  for (let i = 0; i < pts.length; i++) {
    const g = groups[label[i]];
    g.r += rgb[i].r;
    g.g += rgb[i].g;
    g.b += rgb[i].b;
    g.n++;
  }
  return groups
    .filter((g) => g.n > 0)
    .map((g) => ({ color: { r: Math.round(g.r / g.n), g: Math.round(g.g / g.n), b: Math.round(g.b / g.n), a: 1 }, share: g.n / pts.length }))
    .sort((a, b) => b.share - a.share || rgbKey(a.color).localeCompare(rgbKey(b.color)));
}

export const hexOf = (c: Rgba): string => toHex(c).slice(0, 7).toUpperCase();
