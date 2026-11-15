/**
 * ============================================================================
 * NOISE, GRAIN AND PATTERN FILLS (ROADMAP Phase 114)
 * ============================================================================
 * Paints the browser has no CSS for, drawn as a small SVG made here and used as a picture: a frame's fill is a CSS
 * background of it, a shape's fill is an SVG pattern holding it, and the export writes the same SVG, so the stage and
 * the export draw the same pixels.
 *
 * - Noise and grain: SVG fractal noise (`feTurbulence`, whose algorithm the SVG spec fixes) with a seed, tinted with a
 *   colour; contrast stretches it around the middle. Grain is one fine octave; noise is softer, three octaves.
 * - Pattern: shapes (path data and a colour each) repeated as a tile, with scale, spacing, offset and rotation. The
 *   tile is baked from a layer when the pattern is made (`patternTileFromLayer`); a live copy of a frame is Phase 116.
 *
 * Pure: no DOM, no store.
 * ============================================================================
 */

import { parseColor } from "./colorMath";

export interface NoiseSpec {
  kind: "noise" | "grain";
  /** Size of the noise's features in px (larger is coarser). */
  scale: number;
  /** 0 to 1: how strongly it varies around the middle. */
  contrast: number;
  color: string;
  seed: number;
}

export interface PatternShape {
  /** Path data in the tile's own px. */
  d: string;
  color: string;
}
export interface PatternSpec {
  tile: { w: number; h: number; shapes: PatternShape[] };
  /** The tile at this many times its size. */
  scale: number;
  /** Space between tiles, in px (before scaling). */
  spacing: number;
  offset: { x: number; y: number };
  /** Degrees. */
  rotation: number;
}

export const MAX_PATTERN_SHAPES = 64;
export const MAX_PATTERN_PATH = 20_000;
const f = (n: number) => Number(n.toFixed(3)).toString();
/** Path data we wrote: commands, numbers, separators only. */
export const safePathData = (d: unknown): string | null => (typeof d === "string" && d.length <= MAX_PATTERN_PATH && /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,\s-]*$/.test(d) && /[0-9]/.test(d) ? d : null);
const rgb = (color: string): [number, number, number] | null => {
  const c = parseColor(color);
  return c ? [c.r / 255, c.g / 255, c.b / 255] : null;
};
const esc = (c: string) => c.replace(/[^#0-9A-Za-z(),. %-]/g, "");

/** The noise as an SVG of the box's size. */
export function noiseSvg(n: NoiseSpec, w: number, h: number, opacity = 1): string {
  const [r, g, b] = rgb(n.color) ?? [0, 0, 0];
  const grain = n.kind === "grain";
  const freq = 1 / Math.max(0.5, n.scale);
  // alpha = contrast-stretched noise around 0.5: c·(N - 0.5) + 0.5, with c from 1 (soft) to 8 (hard)
  const c = 1 + 7 * Math.min(1, Math.max(0, n.contrast));
  const alpha = `${f(c)} 0 0 0 ${f(0.5 - 0.5 * c)}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(h)}" viewBox="0 0 ${f(w)} ${f(h)}" opacity="${f(opacity)}">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${f(freq)}" numOctaves="${grain ? 1 : 3}" seed="${Math.round(n.seed)}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 ${f(r)} 0 0 0 0 ${f(g)} 0 0 0 0 ${f(b)} ${alpha}"/>` +
    `</filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
  );
}

/** The pattern as an SVG of the box's size: the tile repeated across it. */
export function patternSvg(p: PatternSpec, w: number, h: number, opacity = 1): string {
  const s = Math.max(0.01, p.scale);
  const tw = (p.tile.w + p.spacing) * s;
  const th = (p.tile.h + p.spacing) * s;
  const shapes = p.tile.shapes.map((sh) => `<path d="${sh.d}" fill="${esc(sh.color)}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(h)}" viewBox="0 0 ${f(w)} ${f(h)}" opacity="${f(opacity)}">` +
    `<defs><pattern id="p" patternUnits="userSpaceOnUse" width="${f(tw)}" height="${f(th)}" patternTransform="translate(${f(p.offset.x)} ${f(p.offset.y)}) rotate(${f(p.rotation)})">` +
    `<g transform="scale(${f(s)})">${shapes}</g></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`
  );
}

/** An SVG as a CSS `url(...)` or `href` (percent-encoded, so it is safe inside quotes). */
export const svgDataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;
