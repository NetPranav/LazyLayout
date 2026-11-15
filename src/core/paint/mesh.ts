/**
 * ============================================================================
 * MESH GRADIENTS (ROADMAP Phase 115)
 * ============================================================================
 * A grid of colour points (`cols` × `rows`, positions as fractions of the box) that can be dragged anywhere; the
 * colour between them is blended linearly (bilinear in each cell) or smoothly (Catmull–Rom across the whole grid).
 *
 * CSS has no mesh gradient, so the mesh is drawn into a small picture here (each cell split into fine triangles,
 * positions and colours carried across them) and the browser stretches it over the box, which its image smoothing
 * keeps soft. That picture is the same on the canvas, in a frame's CSS background, in a shape's SVG and in the
 * export. Pure: no DOM.
 * ============================================================================
 */

import { parseColor } from "./colorMath";

export interface MeshPoint {
  /** Where the point is, as fractions of the box. */
  x: number;
  y: number;
  color: string;
}
export interface MeshSpec {
  cols: number;
  rows: number;
  /** Row by row, `cols × rows` of them. */
  points: MeshPoint[];
  smooth: boolean;
}

export const MAX_MESH_SIDE = 8;
/** The picture's size: soft enough to stretch over any box, small enough to make every edit. */
export const MESH_RASTER = 96;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A fresh mesh: `cols × rows` points evenly spread, coloured from a corner gradient between two colours. */
export function newMesh(cols = 3, rows = 3, a = "#ff7a59", b = "#4f46e5"): MeshSpec {
  const ca = parseColor(a)!;
  const cb = parseColor(b)!;
  const points: MeshPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = (c / (cols - 1) + r / (rows - 1)) / 2;
      const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
      points.push({ x: c / (cols - 1), y: r / (rows - 1), color: `#${hex(lerp(ca.r, cb.r, t))}${hex(lerp(ca.g, cb.g, t))}${hex(lerp(ca.b, cb.b, t))}` });
    }
  }
  return { cols, rows, points, smooth: true };
}

/** Each point's colour as r, g, b, a (0–255), parsed once per list of points. */
const parsed = new WeakMap<readonly MeshPoint[], number[][]>();
function colorsOf(points: readonly MeshPoint[]): number[][] {
  let out = parsed.get(points);
  if (!out) {
    out = points.map((p) => {
      const k = parseColor(p.color) ?? { r: 0, g: 0, b: 0, a: 1 };
      return [k.r, k.g, k.b, k.a * 255];
    });
    parsed.set(points, out);
  }
  return out;
}

/** Catmull–Rom through four values at t (0..1 between the middle two). */
const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** The mesh's colour (r, g, b, a in 0–255) and position (fractions) at grid coordinates (u across, v down). */
export function meshAt(m: MeshSpec, u: number, v: number): { x: number; y: number; rgba: [number, number, number, number] } {
  const cols = m.cols;
  const rows = m.rows;
  const cu = Math.min(cols - 2, Math.max(0, Math.floor(u)));
  const cv = Math.min(rows - 2, Math.max(0, Math.floor(v)));
  const fu = u - cu;
  const fv = v - cv;
  const at = (c: number, r: number) => Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c));
  const P = (c: number, r: number) => m.points[at(c, r)];
  const colors = colorsOf(m.points);
  const rgba = (c: number, r: number) => colors[at(c, r)];
  // positions are always bilinear in the cell, so a straight grid stays straight
  const p00 = P(cu, cv);
  const p10 = P(cu + 1, cv);
  const p01 = P(cu, cv + 1);
  const p11 = P(cu + 1, cv + 1);
  const x = lerp(lerp(p00.x, p10.x, fu), lerp(p01.x, p11.x, fu), fv);
  const y = lerp(lerp(p00.y, p10.y, fu), lerp(p01.y, p11.y, fu), fv);
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let ch = 0; ch < 4; ch++) {
    if (!m.smooth) {
      out[ch] = lerp(lerp(rgba(cu, cv)[ch], rgba(cu + 1, cv)[ch], fu), lerp(rgba(cu, cv + 1)[ch], rgba(cu + 1, cv + 1)[ch], fu), fv);
    } else {
      const row = (r: number) => cr(rgba(cu - 1, r)[ch], rgba(cu, r)[ch], rgba(cu + 1, r)[ch], rgba(cu + 2, r)[ch], fu);
      out[ch] = cr(row(cv - 1), row(cv), row(cv + 1), row(cv + 2), fv);
    }
    out[ch] = Math.min(255, Math.max(0, out[ch]));
  }
  return { x, y, rgba: out };
}

/**
 * The mesh drawn into a `size × size` RGBA picture: each cell split into 12 × 12 pieces of two triangles, colours
 * carried across each triangle. Where a dragged edge leaves part of the box uncovered, the nearest covered colour
 * is spread into it, so the picture stays opaque when stretched.
 */
export function rasterizeMesh(m: MeshSpec, size = MESH_RASTER): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const covered = new Uint8Array(size * size);
  const SUB = 12;
  type V = { x: number; y: number; c: [number, number, number, number] };
  const tri = (a: V, b: V, c: V) => {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(det) < 1e-12) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sx = x + 0.5;
        const sy = y + 0.5;
        const l1 = ((b.y - c.y) * (sx - c.x) + (c.x - b.x) * (sy - c.y)) / det;
        const l2 = ((c.y - a.y) * (sx - c.x) + (a.x - c.x) * (sy - c.y)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        const k = (y * size + x) * 4;
        for (let ch = 0; ch < 4; ch++) px[k + ch] = a.c[ch] * l1 + b.c[ch] * l2 + c.c[ch] * l3;
        covered[y * size + x] = 1;
      }
    }
  };
  for (let r = 0; r < m.rows - 1; r++) {
    for (let c = 0; c < m.cols - 1; c++) {
      const grid: V[][] = [];
      for (let j = 0; j <= SUB; j++) {
        grid.push([]);
        for (let i = 0; i <= SUB; i++) {
          const s = meshAt(m, c + i / SUB, r + j / SUB);
          grid[j].push({ x: s.x * size, y: s.y * size, c: s.rgba });
        }
      }
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          tri(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1]);
          tri(grid[j][i], grid[j + 1][i + 1], grid[j + 1][i]);
        }
      }
    }
  }
  // spread covered colours into uncovered pixels (a few passes reach any gap a dragged edge leaves)
  for (let pass = 0; pass < size && covered.includes(0); pass++) {
    const next = covered.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (covered[y * size + x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size || !covered[ny * size + nx]) continue;
          const k = (y * size + x) * 4;
          const n = (ny * size + nx) * 4;
          for (let ch = 0; ch < 4; ch++) px[k + ch] = px[n + ch];
          next[y * size + x] = 1;
          break;
        }
      }
    }
    covered.set(next);
  }
  return px;
}

/** RGBA pixels as a 32-bit BMP (bottom-up, with an alpha mask), base64 in a data URL. */
export function bmpDataUrl(px: Uint8ClampedArray, w: number, h: number): string {
  const header = 14 + 108;
  const size = header + w * h * 4;
  const b = new Uint8Array(size);
  const dv = new DataView(b.buffer);
  b[0] = 0x42;
  b[1] = 0x4d;
  dv.setUint32(2, size, true);
  dv.setUint32(10, header, true);
  dv.setUint32(14, 108, true); // BITMAPV4HEADER
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 32, true);
  dv.setUint32(30, 3, true); // BI_BITFIELDS
  dv.setUint32(34, w * h * 4, true);
  dv.setUint32(54, 0x00ff0000, true); // red
  dv.setUint32(58, 0x0000ff00, true); // green
  dv.setUint32(62, 0x000000ff, true); // blue
  dv.setUint32(66, 0xff000000, true); // alpha
  dv.setUint32(70, 0x73524742, true); // 'sRGB'
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4;
      const d = header + (y * w + x) * 4;
      b[d] = px[s + 2];
      b[d + 1] = px[s + 1];
      b[d + 2] = px[s];
      b[d + 3] = px[s + 3];
    }
  }
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:image/bmp;base64,${btoa(bin)}`;
}

/** Pictures already made, by mesh (a mesh is drawn on every render; making its picture is the costly part). */
const pictures = new Map<string, string>();

/** The mesh as an SVG of the box's size: its picture stretched over the box. */
export function meshSvg(m: MeshSpec, w: number, h: number, opacity = 1): string {
  const key = JSON.stringify([m.cols, m.rows, m.smooth, m.points]);
  let href = pictures.get(key);
  if (!href) {
    href = bmpDataUrl(rasterizeMesh(m), MESH_RASTER, MESH_RASTER);
    if (pictures.size >= 64) pictures.delete(pictures.keys().next().value!);
    pictures.set(key, href);
  }
  const f = (n: number) => Number(n.toFixed(3)).toString();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(h)}" viewBox="0 0 ${f(w)} ${f(h)}" opacity="${f(opacity)}"><image href="${href}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="none"/></svg>`;
}
