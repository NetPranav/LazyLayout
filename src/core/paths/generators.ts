/**
 * ============================================================================
 * SHAPE GENERATORS (ROADMAP Phase 112)
 * ============================================================================
 * Modifiers for the stack in `modifiers.ts` that make shapes from a layer's outline: Scatter (copies of a small shape
 * inside the outline or along it), Cells (Voronoi cells or Delaunay triangles cracking the outline), Grid (square,
 * hex or triangle cells clipped to the outline), Rings (concentric copies) and Flow lines (lines following a seeded
 * field, stopping at the outline).
 *
 * Every generator is seeded: the same seed gives exactly the same shapes, and Shuffle is a new seed. Variety (0–100%)
 * is how much the pieces differ from one another. Pure functions, no DOM; paths are in the layer's own box (px).
 * ============================================================================
 */

import { BezPath, type Pt } from "../geometry/bezpath";
import { polylines } from "../geometry/measure";
import { fitCurve } from "./pathFit";
import { combineRegions, pathRegion, regionToPath, type Region } from "./pathOps";

type Params = Readonly<Record<string, number | string>>;
type Box = { w: number; h: number };
export interface GenInput {
  path: BezPath;
  closed: boolean;
}

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A small seeded generator (mulberry32): the same seed, the same sequence. */
export function seeded(seed: number): () => number {
  let s = (Math.round(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The outline flattened once, for fast inside tests (even-odd over all rings) and its bounds. */
interface Shape {
  rings: Pt[][];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Total length of the outline, and the rings' cumulative lengths, for points along it. */
  length: number;
}
function shapeOf(path: BezPath): Shape {
  const rings = (polylines(path, 200_000, 0.25) ?? []).map((l) => l.points).filter((r) => r.length >= 2);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let length = 0;
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const q = r[i];
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
      if (i > 0) length += Math.hypot(q.x - r[i - 1].x, q.y - r[i - 1].y);
    }
  }
  return { rings, x0, y0, x1, y1, length };
}
function inside(s: Shape, x: number, y: number): boolean {
  let odd = false;
  for (const r of s.rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i];
      const b = r[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) odd = !odd;
    }
  }
  return odd;
}
/** The point `d` px along the outline, and the direction there. */
function along(s: Shape, d: number): { p: Pt; dir: Pt } {
  let left = ((d % s.length) + s.length) % s.length;
  for (const r of s.rings) {
    for (let i = 1; i < r.length; i++) {
      const l = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
      if (left <= l || (r === s.rings[s.rings.length - 1] && i === r.length - 1)) {
        const t = l > 0 ? Math.min(1, left / l) : 0;
        return { p: { x: r[i - 1].x + (r[i].x - r[i - 1].x) * t, y: r[i - 1].y + (r[i].y - r[i - 1].y) * t }, dir: l > 0 ? { x: (r[i].x - r[i - 1].x) / l, y: (r[i].y - r[i - 1].y) / l } : { x: 1, y: 0 } };
      }
      left -= l;
    }
  }
  return { p: s.rings[0]?.[0] ?? { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
}
/** Up to `count` seeded points inside the outline (rejection sampling; a thin outline may give fewer). */
function pointsInside(s: Shape, count: number, rand: () => number): Pt[] {
  const out: Pt[] = [];
  for (let tries = 0; out.length < count && tries < count * 50; tries++) {
    const x = s.x0 + rand() * (s.x1 - s.x0);
    const y = s.y0 + rand() * (s.y1 - s.y0);
    if (inside(s, x, y)) out.push({ x, y });
  }
  return out;
}

// --- scatter ----------------------------------------------------------------------------------------------------------

/** A unit particle (radius 1, centred on the origin) as points: a star, a circle (16 sides), a square or a triangle. */
function particle(kind: string): Pt[] {
  if (kind === "star") return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  if (kind === "square") return [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
  if (kind === "triangle") return [0, 1, 2].map((i) => ({ x: Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 3), y: Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 3) }));
  return Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 8), y: Math.sin((i * Math.PI) / 8) }));
}

/**
 * Scatter: `count` copies of a small shape inside the outline (or along it), `size` px across, each turned and
 * sized at random by Variety.
 */
export function scatter(input: GenInput, p: Params): GenInput {
  const s = shapeOf(input.path);
  if (s.rings.length === 0) return input;
  const count = Math.round(clamp(num(p.count, 50), 1, 5000));
  const size = clamp(num(p.size, 8), 0.1, 1000) / 2;
  const variety = clamp(num(p.variety, 50), 0, 100) / 100;
  const rand = seeded(num(p.seed, 1));
  const base = particle(String(p.shape ?? "circle"));
  const spots: { p: Pt; turn: number }[] =
    p.place === "along" || !input.closed
      ? Array.from({ length: count }, (_, i) => {
          const a = along(s, ((i + 0.5) / count) * s.length + (rand() - 0.5) * variety * (s.length / count));
          return { p: a.p, turn: Math.atan2(a.dir.y, a.dir.x) };
        })
      : pointsInside(s, count, rand).map((q) => ({ p: q, turn: 0 }));
  const out = new BezPath();
  for (const spot of spots) {
    const r = size * (1 - variety * 0.75 * rand());
    const a = spot.turn + variety * rand() * Math.PI * 2;
    const c = Math.cos(a) * r;
    const sn = Math.sin(a) * r;
    base.forEach((q, i) => {
      const pt = { x: spot.p.x + q.x * c - q.y * sn, y: spot.p.y + q.x * sn + q.y * c };
      if (i === 0) out.moveTo(pt);
      else out.lineTo(pt);
    });
    out.closePath();
  }
  return { path: out, closed: true };
}

// --- cells: Voronoi and Delaunay ---------------------------------------------------------------------------------------

/** Clips a convex polygon to the half-plane where (q - o) · n ≤ 0. */
function clipHalf(poly: Pt[], o: Pt, n: Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.x - o.x) * n.x + (a.y - o.y) * n.y;
    const db = (b.x - o.x) * n.x + (b.y - o.y) * n.y;
    if (da <= 0) out.push(a);
    if (da < 0 !== db < 0) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Delaunay triangles (Bowyer–Watson) as index triples into `pts`. */
export function delaunay(pts: readonly Pt[]): [number, number, number][] {
  if (pts.length < 3) return [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  const d = Math.max(x1 - x0, y1 - y0) * 20 + 1;
  const all = [...pts, { x: x0 - d, y: y0 - d }, { x: x0 + d * 2, y: y0 - d }, { x: x0 - d, y: y0 + d * 2 }];
  const n = pts.length;
  type Tri = { a: number; b: number; c: number; cx: number; cy: number; r2: number };
  const make = (a: number, b: number, c: number): Tri => {
    const A = all[a];
    const B = all[b];
    const C = all[c];
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const ux = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / D;
    const uy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / D;
    return { a, b, c, cx: ux, cy: uy, r2: (A.x - ux) ** 2 + (A.y - uy) ** 2 };
  };
  let tris: Tri[] = [make(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const q = all[i];
    const bad: Tri[] = [];
    const keep: Tri[] = [];
    for (const t of tris) ((q.x - t.cx) ** 2 + (q.y - t.cy) ** 2 < t.r2 ? bad : keep).push(t);
    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) keep.push(make(u, v, i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

/**
 * Each piece clipped to the outline on its own (clipping them together would merge pieces that share an edge). A
 * convex piece with every corner inside the outline and no corner of the outline inside it needs no clipping.
 */
function clipPieces(pieces: readonly Pt[][], s: Shape, outline: Region): BezPath {
  const out: Region = [];
  const corners = s.rings.flat();
  for (const piece of pieces) {
    if (piece.length < 3) continue;
    const ring = asRegion([piece]);
    const within = piece.every((q) => inside(s, q.x, q.y)) && !corners.some((c) => insideConvex(piece, c));
    if (within) out.push(...ring);
    else out.push(...combineRegions(ring, outline, "intersect"));
  }
  return regionToPath(out);
}

/** Whether a point is strictly inside a convex polygon. */
function insideConvex(poly: readonly Pt[], q: Pt): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
    if (Math.abs(c) < 1e-12) return false;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

const asRegion = (polys: readonly Pt[][]): Region =>
  polys.filter((p) => p.length >= 3).map((p) => [[...p.map((q) => [q.x, q.y] as [number, number]), [p[0].x, p[0].y] as [number, number]]]);

/** Shrinks a convex polygon by `g` px on every side (each edge moved in), or returns null when nothing is left. */
function inset(poly: Pt[], g: number): Pt[] | null {
  if (g <= 0) return poly;
  // the polygon's own centre is inside it; each edge's inward normal points toward it
  const c = poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length }), { x: 0, y: 0 });
  let out = poly;
  for (let i = 0; i < poly.length && out.length >= 3; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-9) continue;
    let n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    if ((c.x - a.x) * n.x + (c.y - a.y) * n.y > 0) n = { x: -n.x, y: -n.y }; // n points out
    out = clipHalf(out, { x: a.x - n.x * g, y: a.y - n.y * g }, n);
  }
  return out.length >= 3 ? out : null;
}

/**
 * Cells: `count` seeded sites inside the outline; `mode` cells draws their Voronoi cells, triangles their Delaunay
 * triangles. Each piece is shrunk by half the gap (so the outline looks cracked) and clipped to the outline.
 */
export function cells(input: GenInput, p: Params): GenInput {
  if (!input.closed) return input;
  const s = shapeOf(input.path);
  if (s.rings.length === 0) return input;
  const count = Math.round(clamp(num(p.count, 24), 2, 600));
  const gap = clamp(num(p.gap, 2), 0, 200) / 2;
  const variety = clamp(num(p.variety, 100), 0, 100) / 100;
  const rand = seeded(num(p.seed, 1));
  // Variety 0 is an even, jittered grid; 100% is fully random
  const cols = Math.max(1, Math.round(Math.sqrt((count * (s.x1 - s.x0)) / Math.max(1e-6, s.y1 - s.y0))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const sites: Pt[] = [];
  for (let i = 0; i < cols * rows && sites.length < count * 4; i++) {
    const gx = s.x0 + ((i % cols) + 0.5) * ((s.x1 - s.x0) / cols);
    const gy = s.y0 + (Math.floor(i / cols) + 0.5) * ((s.y1 - s.y0) / rows);
    const x = gx + (rand() - 0.5) * variety * ((s.x1 - s.x0) / cols) * 2;
    const y = gy + (rand() - 0.5) * variety * ((s.y1 - s.y0) / rows) * 2;
    if (inside(s, x, y)) sites.push({ x, y });
  }
  if (sites.length < 2) return input;
  const pad = 2;
  const frame: Pt[] = [{ x: s.x0 - pad, y: s.y0 - pad }, { x: s.x1 + pad, y: s.y0 - pad }, { x: s.x1 + pad, y: s.y1 + pad }, { x: s.x0 - pad, y: s.y1 + pad }];
  const pieces: Pt[][] = [];
  if (p.mode === "triangles") {
    // sites along the outline too, so the triangles reach its edge instead of stopping at the inner sites
    const rim = Math.max(8, Math.round(Math.sqrt(sites.length) * 4));
    for (let k = 0; k < rim; k++) sites.push(along(s, (k / rim) * s.length).p);
    for (const [a, b, c] of delaunay(sites)) {
      const t = inset([sites[a], sites[b], sites[c]], gap);
      if (t) pieces.push(t);
    }
  } else {
    for (let i = 0; i < sites.length; i++) {
      let cell = frame.slice();
      for (let j = 0; j < sites.length && cell.length >= 3; j++) {
        if (j === i) continue;
        const n = { x: sites[j].x - sites[i].x, y: sites[j].y - sites[i].y };
        const l = Math.hypot(n.x, n.y);
        if (l < 1e-9) continue;
        const u = { x: n.x / l, y: n.y / l };
        // the bisector, moved toward this site by half the gap
        cell = clipHalf(cell, { x: (sites[i].x + sites[j].x) / 2 - u.x * gap, y: (sites[i].y + sites[j].y) / 2 - u.y * gap }, u);
      }
      if (cell.length >= 3) pieces.push(cell);
    }
  }
  return { path: clipPieces(pieces, s, pathRegion(input.path, "nonzero")), closed: true };
}

// --- grid --------------------------------------------------------------------------------------------------------------

/** Grid: square, hex or triangle cells `size` px across, `gap` px apart, clipped to the outline. */
export function grid(input: GenInput, p: Params): GenInput {
  if (!input.closed) return input;
  const s = shapeOf(input.path);
  if (s.rings.length === 0) return input;
  const size = clamp(num(p.size, 20), 2, 2000);
  const g = clamp(num(p.gap, 2), 0, 200) / 2;
  const kind = p.kind === "hex" || p.kind === "triangle" ? p.kind : "square";
  const pieces: Pt[][] = [];
  const limit = 20_000;
  if (kind === "square") {
    for (let y = s.y0; y < s.y1 && pieces.length < limit; y += size) for (let x = s.x0; x < s.x1 && pieces.length < limit; x += size) pieces.push([{ x: x + g, y: y + g }, { x: x + size - g, y: y + g }, { x: x + size - g, y: y + size - g }, { x: x + g, y: y + size - g }]);
  } else if (kind === "hex") {
    const r = size / 2;
    const w = Math.sqrt(3) * r;
    for (let row = 0, y = s.y0; y < s.y1 + r && pieces.length < limit; row++, y += 1.5 * r) {
      for (let x = s.x0 + (row % 2 ? w / 2 : 0); x < s.x1 + w && pieces.length < limit; x += w) {
        const hex = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * (r - g), y: y + Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * (r - g) }));
        pieces.push(hex);
      }
    }
  } else {
    const h = (size * Math.sqrt(3)) / 2;
    for (let row = 0, y = s.y0; y < s.y1 && pieces.length < limit; row++, y += h) {
      for (let k = 0, x = s.x0 - size / 2; x < s.x1 && pieces.length < limit; k++, x += size / 2) {
        const up = (k + row) % 2 === 0;
        const tri = up ? [{ x, y: y + h }, { x: x + size / 2, y }, { x: x + size, y: y + h }] : [{ x, y }, { x: x + size, y }, { x: x + size / 2, y: y + h }];
        const t = inset(tri, g);
        if (t) pieces.push(t);
      }
    }
  }
  return { path: clipPieces(pieces, s, pathRegion(input.path, "nonzero")), closed: true };
}

// --- rings and flow lines -------------------------------------------------------------------------------------------------

/** Rings: `count` concentric copies of the outline, each scaled toward the box's centre by an even step. */
export function rings(input: GenInput, p: Params, box: Box): GenInput {
  const count = Math.round(clamp(num(p.count, 5), 1, 200));
  const inner = clamp(num(p.inner, 10), 0, 100) / 100;
  const c = { x: box.w / 2, y: box.h / 2 };
  const out = new BezPath();
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 1 : 1 - ((1 - inner) * i) / (count - 1);
    out.extend(input.path.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k })));
  }
  return { path: out, closed: input.closed };
}

/** Smooth seeded 2D value noise in [-1, 1]. */
function noise2(seed: number, x: number, y: number): number {
  const h = (i: number, j: number) => {
    let v = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
    v = Math.imul(v ^ (v >>> 15), 0x85ebca6b) >>> 0;
    v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35) >>> 0;
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = h(i, j) * (1 - u) + h(i + 1, j) * u;
  const b = h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u;
  return (a * (1 - v) + b * v) * 2 - 1;
}

/**
 * Flow lines: `count` lines from seeded points inside the outline, each following a smooth seeded field (`scale` px
 * per swirl; Variety is how much it swirls) for up to `length` px, stopping where it would leave the outline.
 */
export function flow(input: GenInput, p: Params): GenInput {
  if (!input.closed) return input;
  const s = shapeOf(input.path);
  if (s.rings.length === 0) return input;
  const count = Math.round(clamp(num(p.count, 40), 1, 2000));
  const length = clamp(num(p.length, 80), 1, 5000);
  const scale = clamp(num(p.scale, 60), 1, 5000);
  const swirl = clamp(num(p.variety, 50), 0, 100) / 100;
  const seed = Math.round(num(p.seed, 1));
  const rand = seeded(seed);
  const step = 2;
  const out = new BezPath();
  for (const start of pointsInside(s, count, rand)) {
    const pts: Pt[] = [start];
    let q = start;
    for (let travelled = 0; travelled < length; travelled += step) {
      const a = noise2(seed, q.x / scale, q.y / scale) * Math.PI * (0.25 + 1.75 * swirl);
      const next = { x: q.x + Math.cos(a) * step, y: q.y + Math.sin(a) * step };
      if (!inside(s, next.x, next.y)) break;
      pts.push(next);
      q = next;
    }
    if (pts.length < 3) continue;
    out.moveTo(pts[0]);
    for (const f of fitCurve(pts, 0.25)) out.curveTo(f.c1, f.c2, pts[f.to]);
  }
  return { path: out, closed: false };
}
