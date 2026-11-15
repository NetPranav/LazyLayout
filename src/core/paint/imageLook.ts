/**
 * Image adjustments and filters (ROADMAP Phase 122), on top of FigCraft's seven adjustments (port F2: exposure,
 * contrast, saturation, temperature, tint, highlights and shadows, in `color.ts`). A picture's **look** adds:
 * - a simple tone **curve** (outputs at five inputs, 0, ¼, ½, ¾ and 1);
 * - a **gradient map** (the picture's brightness mapped onto colour stops; **duotone** is a map with two stops);
 * - **sharpen** and **blur**;
 * - **show original** (`bypass`): every adjustment kept but none drawn.
 *
 * Nothing here touches the picture's file. The look is drawn as one SVG filter by the browser (`imageFilterPrimitives`),
 * the same on the stage and in the export. `referenceImage` works the same chain out pixel by pixel; the tests
 * check the browser against it.
 */

import { adjustmentMatrix, adjustmentToneTable, isIdentityAdjustment, parseCss, sanitizeAdjustments, type ImageAdjustments } from "./color";

export interface MapStop {
  at: number;
  color: string;
}

export interface ImageLook {
  /** The curve's outputs (0..1) at inputs 0, 0.25, 0.5, 0.75 and 1; absent: straight. */
  curve?: number[];
  /** A gradient map, darkest first (two stops: a duotone); absent: none. */
  map?: MapStop[];
  /** 0..1. */
  sharpen?: number;
  /** px, 0..100. */
  blur?: number;
  /** Show the original picture: the adjustments stay, none is drawn. */
  bypass?: boolean;
}

export const CURVE_INPUTS = [0, 0.25, 0.5, 0.75, 1] as const;
const TABLE_STEPS = 32;

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A look made safe: curve of five values in 0..1, at most 8 stops with colours, sharpen 0..1, blur 0..100. */
export function sanitizeLook(raw: unknown): ImageLook {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: ImageLook = {};
  if (Array.isArray(o.curve) && o.curve.length === 5 && o.curve.every(fin)) {
    const c = (o.curve as number[]).map((v) => Math.round(clamp01(v) * 1e4) / 1e4);
    if (c.some((v, i) => Math.abs(v - CURVE_INPUTS[i]) > 1e-9)) out.curve = c;
  }
  if (Array.isArray(o.map)) {
    const stops = (o.map as unknown[])
      .slice(0, 8)
      .map((s) => (typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {}))
      .filter((s) => fin(s.at) && typeof s.color === "string" && s.color.length <= 64 && parseCss(s.color))
      .map((s) => ({ at: clamp01(s.at as number), color: String(s.color).trim() }))
      .sort((a, b) => a.at - b.at);
    if (stops.length >= 2) out.map = stops;
  }
  if (fin(o.sharpen) && o.sharpen > 0) out.sharpen = Math.min(1, o.sharpen);
  if (fin(o.blur) && o.blur > 0) out.blur = Math.min(100, o.blur);
  if (o.bypass === true) out.bypass = true;
  return out;
}

/** A look that changes nothing it draws (bypass aside). */
export const isIdentityLook = (l: ImageLook | null | undefined): boolean => !l || (!l.curve && !l.map && !l.sharpen && !l.blur);

/** Stored looks, sanitised; null when absent or empty (a bypass alone is kept). */
export function lookOf(v: unknown): ImageLook | null {
  if (typeof v !== "object" || v === null) return null;
  const l = sanitizeLook(v);
  return isIdentityLook(l) && !l.bypass ? null : l;
}

// --- tables -------------------------------------------------------------------------------------

/** The curve through its five points (monotone cubic, so it never overshoots), as a table of 33 values. */
export function curveTable(curve: readonly number[], steps = TABLE_STEPS): number[] {
  const x = CURVE_INPUTS;
  const y = curve;
  const n = x.length;
  const d = Array.from({ length: n - 1 }, (_, i) => (y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  const m = y.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps;
    let i = Math.min(n - 2, Math.floor(t * (n - 1)));
    while (i > 0 && t < x[i]) i--;
    const h = x[i + 1] - x[i];
    const u = (t - x[i]) / h;
    const v = (2 * u ** 3 - 3 * u ** 2 + 1) * y[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * y[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
    return Number(clamp01(v).toFixed(4));
  });
}

/** A gradient map as three tables (red, green, blue), each the stops' colour at evenly spaced brightnesses. */
export function mapTables(stops: readonly MapStop[], steps = TABLE_STEPS): [number[], number[], number[]] {
  const cs = stops.map((s) => ({ at: s.at, c: parseCss(s.color)! }));
  const at = (t: number) => {
    if (t <= cs[0].at) return cs[0].c;
    const last = cs[cs.length - 1];
    if (t >= last.at) return last.c;
    let i = 0;
    while (i + 1 < cs.length && cs[i + 1].at < t) i++;
    const a = cs[i];
    const b = cs[i + 1];
    const u = b.at - a.at > 1e-9 ? (t - a.at) / (b.at - a.at) : 0;
    return { r: a.c.r + (b.c.r - a.c.r) * u, g: a.c.g + (b.c.g - a.c.g) * u, b: a.c.b + (b.c.b - a.c.b) * u, a: 1 };
  };
  const t = Array.from({ length: steps + 1 }, (_, k) => at(k / steps));
  const fix = (v: number) => Number(clamp01(v).toFixed(4));
  return [t.map((c) => fix(c.r)), t.map((c) => fix(c.g)), t.map((c) => fix(c.b))];
}

/** A value through a table, as SVG's `feComponentTransfer type="table"` does (linear between entries). */
export function throughTable(table: readonly number[], v: number): number {
  const n = table.length - 1;
  const x = clamp01(v);
  if (x >= 1) return table[n];
  const k = Math.floor(x * n);
  return table[k] + (x * n - k) * (table[k + 1] - table[k]);
}

/** The sharpen kernel (3 × 3): the centre pushed up by 4·a, its four neighbours down by a. */
export const sharpenKernel = (a: number): number[] => {
  const k = 1.5 * a;
  return [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0].map((v) => Number(v.toFixed(4)));
};

// --- the SVG filter -----------------------------------------------------------------------------

export interface Primitive {
  tag: string;
  attrs: Record<string, string | number>;
  children?: Primitive[];
}

const LUMA = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
const transfer = (r: readonly number[], g = r, b = r): Primitive => ({
  tag: "feComponentTransfer",
  attrs: {},
  children: [
    { tag: "feFuncR", attrs: { type: "table", tableValues: r.join(" ") } },
    { tag: "feFuncG", attrs: { type: "table", tableValues: g.join(" ") } },
    { tag: "feFuncB", attrs: { type: "table", tableValues: b.join(" ") } },
  ],
});

/**
 * The filter's steps, in order: the seven adjustments (the colour matrix, then highlights and shadows), the curve, the
 * gradient map, sharpen, blur. Empty when nothing is drawn (no adjustments, or the original is shown).
 */
export function imageFilterPrimitives(adjust: ImageAdjustments | null | undefined, look: ImageLook | null | undefined): Primitive[] {
  if (look?.bypass) return [];
  const out: Primitive[] = [];
  const a = adjust ? sanitizeAdjustments(adjust) : null;
  if (a && !isIdentityAdjustment(a)) {
    out.push({ tag: "feColorMatrix", attrs: { type: "matrix", values: adjustmentMatrix(a).join(" ") } });
    const tone = adjustmentToneTable(a);
    if (tone) out.push(transfer(tone));
  }
  if (look?.curve) out.push(transfer(curveTable(look.curve)));
  if (look?.map) {
    out.push({ tag: "feColorMatrix", attrs: { type: "matrix", values: LUMA } });
    const [r, g, b] = mapTables(look.map);
    out.push(transfer(r, g, b));
  }
  if (look?.sharpen) out.push({ tag: "feConvolveMatrix", attrs: { order: 3, kernelMatrix: sharpenKernel(look.sharpen).join(" "), edgeMode: "duplicate", preserveAlpha: "true" } });
  if (look?.blur) out.push({ tag: "feGaussianBlur", attrs: { stdDeviation: Number(look.blur.toFixed(2)), edgeMode: "duplicate" } });
  return out;
}

/** Whether a picture with these adjustments draws through the filter. */
export const needsImageFilter = (adjust: ImageAdjustments | null | undefined, look: ImageLook | null | undefined): boolean => imageFilterPrimitives(adjust, look).length > 0;

// --- the reference, pixel by pixel ---------------------------------------------------------------

/**
 * The filter worked out on RGBA pixels (0–255, in place of the browser): each step as the SVG filter defines it, in
 * sRGB, every step's result clamped. Returns a new buffer; `src` (the picture) is never changed.
 */
export function referenceImage(src: Uint8Array | Uint8ClampedArray, w: number, h: number, adjust: ImageAdjustments | null, look: ImageLook | null): Uint8ClampedArray {
  const steps = imageFilterPrimitives(adjust, look);
  let px = Float64Array.from(src, (v) => v / 255);
  for (const s of steps) {
    if (s.tag === "feColorMatrix") {
      const m = String(s.attrs.values).split(" ").map(Number);
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        for (let c = 0; c < 3; c++) px[i + c] = clamp01(m[c * 5] * r + m[c * 5 + 1] * g + m[c * 5 + 2] * b + m[c * 5 + 3] * a + m[c * 5 + 4]);
      }
    } else if (s.tag === "feComponentTransfer") {
      const tables = s.children!.map((f) => String(f.attrs.tableValues).split(" ").map(Number));
      for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = throughTable(tables[c], px[i + c]);
    } else if (s.tag === "feConvolveMatrix") {
      const k = String(s.attrs.kernelMatrix).split(" ").map(Number);
      const out = new Float64Array(px.length);
      const at = (x: number, y: number, c: number) => px[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          // SVG's kernel is applied rotated half a turn; this one is symmetric, so it's the same
          for (let c = 0; c < 3; c++) {
            let v = 0;
            for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) v += k[j * 3 + q] * at(x + q - 1, y + j - 1, c);
            out[i + c] = clamp01(v);
          }
          out[i + 3] = px[i + 3];
        }
      px = out;
    } else if (s.tag === "feGaussianBlur") {
      const sd = Number(s.attrs.stdDeviation);
      const r = Math.ceil(sd * 3);
      const kern = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sd * sd)));
      const sum = kern.reduce((a, b) => a + b, 0);
      const pass = (src: Float64Array, dx: number, dy: number) => {
        const out = new Float64Array(src.length);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            for (let c = 0; c < 4; c++) {
              let v = 0;
              for (let t = -r; t <= r; t++) {
                const xx = Math.min(w - 1, Math.max(0, x + t * dx));
                const yy = Math.min(h - 1, Math.max(0, y + t * dy));
                v += kern[t + r] * src[(yy * w + xx) * 4 + c];
              }
              out[(y * w + x) * 4 + c] = v / sum;
            }
        return out;
      };
      px = pass(pass(px, 1, 0), 0, 1);
    }
  }
  return Uint8ClampedArray.from(px, (v) => Math.round(v * 255));
}

// --- an image layer's own --------------------------------------------------------------------------

/** An image layer's adjustments (`media.adjust`) and look (`media.look`), read from their JSON text. */
export function imageEditOf(adjustJson: unknown, lookJson: unknown): { adjust: ImageAdjustments | null; look: ImageLook | null; filtered: boolean; bypass: boolean } {
  const parse = (v: unknown): unknown => {
    if (typeof v !== "string" || v === "" || v.length > 10_000) return null;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };
  const raw = parse(adjustJson);
  const a = raw && typeof raw === "object" ? sanitizeAdjustments(raw as Record<string, unknown>) : null;
  const adjust = a && !isIdentityAdjustment(a) ? a : null;
  const look = lookOf(parse(lookJson));
  return { adjust, look, filtered: needsImageFilter(adjust, look), bypass: look?.bypass === true };
}

// --- presets ------------------------------------------------------------------------------------

export const LOOK_PRESETS: readonly { id: string; label: string; look: ImageLook }[] = [
  { id: "duotoneNight", label: "Duotone: night", look: { map: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ff5c8a" }] } },
  { id: "duotoneLime", label: "Duotone: lime", look: { map: [{ at: 0, color: "#0f3d3e" }, { at: 1, color: "#d4f75c" }] } },
  { id: "sepiaMap", label: "Sepia", look: { map: [{ at: 0, color: "#2b1d0e" }, { at: 0.55, color: "#a67c52" }, { at: 1, color: "#f5e6c8" }] } },
  { id: "punchy", label: "Punchy curve", look: { curve: [0, 0.18, 0.5, 0.82, 1] } },
  { id: "matte", label: "Matte", look: { curve: [0.12, 0.3, 0.52, 0.76, 0.94] } },
  { id: "crisp", label: "Crisp", look: { sharpen: 0.5 } },
  { id: "soft", label: "Soft focus", look: { blur: 2 } },
];

/** A preset's look by id or label, ignoring case and anything that isn't a letter or digit. */
export function lookPreset(name: string): ImageLook | null {
  const key = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  return LOOK_PRESETS.find((p) => key(p.id) === key(name) || key(p.label) === key(name))?.look ?? null;
}
