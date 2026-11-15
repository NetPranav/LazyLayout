/**
 * Text motion (Design track D12, Main 84): the text a layer shows at a moment, from its words and a progress 0..1. One pure
 * function, so the kernel's answer, the stage, Preview and the export's script all show the same characters.
 *
 * - **scramble**: letters settle left to right; the unsettled ones are random characters that change about 30 times a second
 *   (seeded, so a scrub or a replay shows the same).
 * - **typewriter**: the text appears one character at a time, with an optional caret.
 * - **rotate**: shows each word of a list in turn.
 * - **countup**: the first number in the text counts from 0 up to its value, formatted by `Intl.NumberFormat`.
 */
export const TEXT_FX_MODES = ["off", "scramble", "typewriter", "rotate", "countup"] as const;
export type TextFxMode = (typeof TEXT_FX_MODES)[number];

export interface TextFx {
  mode: TextFxMode;
  progress: number;
  seed?: number;
  caret?: boolean;
  /** `rotate`: the words, comma separated. */
  words?: string;
  /** `countup`: digits after the point. */
  decimals?: number;
  locale?: string;
}

export const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=?";
export const SCRAMBLE_RATE = 30;
export const CARET = "▏";

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);

/** A small integer hash to a number in [0, 1): deterministic, no state. */
export function hash01(a: number, b: number, c: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const graphemes = (s: string): string[] => (typeof Intl !== "undefined" && "Segmenter" in Intl ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));

export function textFxText(text: string, fx: TextFx): string {
  const p = clamp01(fx.progress);
  if (fx.mode === "off" || p >= 1 && fx.mode !== "typewriter" && fx.mode !== "countup" && fx.mode !== "rotate") return text;
  if (fx.mode === "scramble") {
    const g = graphemes(text);
    const settled = Math.floor(p * g.length + 1e-9);
    const round = Math.floor(p * SCRAMBLE_RATE * 2);
    return g.map((ch, i) => (i < settled || /\s/.test(ch) ? ch : SCRAMBLE_CHARS[Math.floor(hash01(fx.seed ?? 0, i, round) * SCRAMBLE_CHARS.length)]).toString()).join("");
  }
  if (fx.mode === "typewriter") {
    const g = graphemes(text);
    const shown = Math.floor(p * g.length + 1e-9);
    return g.slice(0, shown).join("") + (fx.caret && p < 1 ? CARET : "");
  }
  if (fx.mode === "rotate") {
    const words = (fx.words ?? "").split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return text;
    return words[Math.min(words.length - 1, Math.floor(p * words.length))];
  }
  // countup
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(text);
  if (!m) return text;
  const target = Number(m[0].replace(/,/g, ""));
  if (!Number.isFinite(target)) return text;
  const d = Math.min(8, Math.max(0, Math.round(fx.decimals ?? (m[0].split(".")[1]?.length ?? 0))));
  const f = new Intl.NumberFormat(fx.locale ?? "en-US", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: m[0].includes(",") });
  return text.slice(0, m.index) + f.format(target * p) + text.slice(m.index + m[0].length);
}

/** The reading of a layer's `text.fx*` properties. */
export function textFxOf(read: (path: string) => unknown, progress?: number): TextFx | null {
  const mode = read("text.fx");
  if (typeof mode !== "string" || !(TEXT_FX_MODES as readonly string[]).includes(mode) || mode === "off") return null;
  const num = (p: string, d: number) => (typeof read(p) === "number" ? (read(p) as number) : d);
  return { mode: mode as TextFxMode, progress: progress ?? num("text.fxProgress", 1), seed: Math.floor(num("text.fxSeed", 0)), caret: read("text.fxCaret") === true, words: typeof read("text.fxWords") === "string" ? (read("text.fxWords") as string) : "", decimals: typeof read("text.fxDecimals") === "number" ? Math.floor(read("text.fxDecimals") as number) : undefined };
}
