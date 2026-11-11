export type ColorMode = "Solid" | "Linear" | "Radial" | "Conic" | "Image";
export type ColorModel = "Hex" | "RGB" | "HSL" | "OKLCH";
export type ImageFit = "Fill" | "Fit" | "Crop" | "Tile";

export interface ColorStop {
  id: string;
  p: number; // 0 to 1 position
  h: number; // 0 to 360
  s: number; // 0 to 1
  v: number; // 0 to 1
  a: number; // 0 to 1
}

export interface TokenItem {
  token: string;
  name: string;
}

export const COLOR_TOKENS: readonly TokenItem[] = [
  { token: "canvas", name: "Canvas" },
  { token: "panel", name: "Panel" },
  { token: "bar", name: "Bar" },
  { token: "seg", name: "Segment" },
  { token: "border", name: "Border" },
  { token: "swline", name: "Swatch line" },
  { token: "text", name: "Text" },
  { token: "text2", name: "Text 2" },
  { token: "muted", name: "Muted" },
  { token: "ctl", name: "Control" },
  { token: "sel", name: "Selection" },
  { token: "label-1", name: "Label 1" },
  { token: "label-2", name: "Label 2" },
  { token: "label-3", name: "Label 3" },
  { token: "label-4", name: "Label 4" },
  { token: "label-5", name: "Label 5" },
  { token: "label-6", name: "Label 6" },
];

/** The real CSS custom property behind a picker token (the picker's short names map onto the theme tokens). */
const TOKEN_VARS: Record<string, string> = {
  canvas: "surface-canvas",
  panel: "surface-panel",
  bar: "surface-bar",
  seg: "control-active",
  border: "border-color",
  swline: "swatch-line",
  text: "text-primary",
  text2: "text-secondary",
  muted: "text-muted",
  ctl: "control-primary-bg",
  sel: "select-bg",
};

export function tokenCssVar(token: string): string {
  return `--ll-${TOKEN_VARS[token] ?? token}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [
    Math.round(f(5) * 255),
    Math.round(f(3) * 255),
    Math.round(f(1) * 255),
  ];
}

export function rgb2hsv(
  r: number,
  g: number,
  b: number,
  h0 = 0
): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = h0;
  if (d) {
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}

function hx2(n: number): string {
  return (n < 16 ? "0" : "") + n.toString(16);
}

export function rgb2hex(rgb: [number, number, number]): string {
  return (hx2(rgb[0]) + hx2(rgb[1]) + hx2(rgb[2])).toUpperCase();
}

export function hex2rgb(hex: string): [number, number, number] {
  let s = hex.replace("#", "").trim();
  if (s.length === 3) s = s.replace(/./g, "$&$&");
  if (s.length < 6) s = s.padEnd(6, "0");
  return [
    parseInt(s.slice(0, 2), 16) || 0,
    parseInt(s.slice(2, 4), 16) || 0,
    parseInt(s.slice(4, 6), 16) || 0,
  ];
}

export function rgb2hsl(rgb: [number, number, number]): [number, number, number] {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

function lin(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function gam(c: number): number {
  c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp(c, 0, 1) * 255);
}

export function rgb2ok(rgb: [number, number, number]): [number, number, number] {
  const r = lin(rgb[0]);
  const g = lin(rgb[1]);
  const b = lin(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [
    L * 100,
    Math.hypot(A, B),
    (Math.atan2(B, A) * 180 / Math.PI + 360) % 360,
  ];
}

export function ok2rgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  L /= 100;
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function parseCssColor(str: string): { rgb: [number, number, number]; a: number } | null {
  if (!str) return null;
  const hexMatch = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    return { rgb: hex2rgb(hexMatch[1]), a: 1 };
  }
  const m = str.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/);
  if (!m) return null;
  const a = m[4] == null ? 1 : m[4].includes("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return {
    rgb: [parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0, parseInt(m[3], 10) || 0],
    a: clamp(a, 0, 1),
  };
}

export function formatCssString(
  model: ColorModel,
  rgb: [number, number, number],
  alpha: number,
  linkedToken: string | null
): string {
  if (linkedToken) return `var(${tokenCssVar(linkedToken)})`;
  const aStr = alpha < 1 ? ` / ${Math.round(alpha * 100)}%` : "";
  if (model === "RGB") return `rgb(${rgb.join(" ")}${aStr})`;
  if (model === "HSL") {
    const hsl = rgb2hsl(rgb);
    return `hsl(${Math.round(hsl[0])} ${Math.round(hsl[1])}% ${Math.round(hsl[2])}%${aStr})`;
  }
  if (model === "OKLCH") {
    const ok = rgb2ok(rgb);
    return `oklch(${(ok[0] / 100).toFixed(2)} ${ok[1].toFixed(2)} ${Math.round(ok[2])}${aStr})`;
  }
  return alpha < 1 ? `#${rgb2hex(rgb)}${hx2(Math.round(alpha * 255))}` : `#${rgb2hex(rgb)}`;
}
