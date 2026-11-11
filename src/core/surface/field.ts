/**
 * Surfaces (ROADMAP S2, S4): the pure maths of an inflated surface, on a grid of `cell` px.
 *
 * - The shape: an analytic signed distance (rectangles, rounded rectangles, ellipses) or any mask.
 * - The height: a pressurised membrane fixed at the shape's edge, the solution of ∇²h = -1 with h = 0 outside
 *   (solved coarse to fine with over-relaxation), normalised to 0..1 and shaped by Fullness.
 * - Creases: folds along the shape's medial axis near its corners (where an inflated pillow runs short of material).
 * - Wrinkles: short ridges across the edge, seeded, parametrised by arc length along the traced contour.
 *
 * No DOM, no store: the editor and the exported site's runtime both use these.
 */

export type SurfaceShape =
  | { kind: "roundedRect"; width: number; height: number; radius: number }
  | { kind: "ellipse"; width: number; height: number }
  | { kind: "mask"; width: number; height: number; mask: Uint8Array; maskWidth: number; maskHeight: number };

/** Signed distance in px from the shape's edge at (x, y) in the shape's own box: positive inside. */
export function shapeDistance(shape: SurfaceShape, x: number, y: number): number {
  if (shape.kind === "roundedRect") {
    const hw = shape.width / 2;
    const hh = shape.height / 2;
    const r = Math.max(0, Math.min(shape.radius, hw, hh));
    const qx = Math.abs(x - hw) - (hw - r);
    const qy = Math.abs(y - hh) - (hh - r);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    return -outside;
  }
  if (shape.kind === "ellipse") {
    // a close approximation for an ellipse (exact for circles): scale to a unit circle and back by the gradient
    const a = shape.width / 2;
    const b = shape.height / 2;
    const px = (x - a) / a;
    const py = (y - b) / b;
    const k0 = Math.hypot(px, py);
    const k1 = Math.hypot(px / a, py / b);
    if (k1 === 0) return Math.min(a, b);
    return -(k0 * (k0 - 1)) / k1;
  }
  const mx = Math.floor((x / shape.width) * shape.maskWidth);
  const my = Math.floor((y / shape.height) * shape.maskHeight);
  const inside = mx >= 0 && my >= 0 && mx < shape.maskWidth && my < shape.maskHeight && shape.mask[my * shape.maskWidth + mx] > 0;
  return inside ? 0.5 : -0.5;
}

export interface Grid {
  /** Cells across and down. */
  w: number;
  h: number;
  /** Size of a cell in px. */
  cell: number;
}

export function gridFor(width: number, height: number, cell: number): Grid {
  return { w: Math.max(2, Math.ceil(width / cell)), h: Math.max(2, Math.ceil(height / cell)), cell };
}

/** 1 inside the shape, 0 outside, sampled at cell centres. */
export function rasterMask(shape: SurfaceShape, g: Grid): Uint8Array {
  const m = new Uint8Array(g.w * g.h);
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) m[j * g.w + i] = shapeDistance(shape, (i + 0.5) * g.cell, (j + 0.5) * g.cell) > 0 ? 1 : 0;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// Distance transform (exact Euclidean, Felzenszwalb & Huttenlocher) with the nearest outside cell
// ---------------------------------------------------------------------------------------------------------------------

const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, arg: Int32Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    arg[q] = v[k];
  }
}

export interface DistanceField {
  /** Distance in px to the nearest outside cell, for inside cells; 0 outside. */
  dist: Float32Array;
  /** Index of the nearest outside cell (the feature), for inside cells; -1 outside. */
  nearest: Int32Array;
}

/** Distance from every inside cell to the outside, and which outside cell is nearest (cells outside the grid count as outside). */
export function distanceField(mask: Uint8Array, g: Grid): DistanceField {
  // pad by one cell of outside on every side
  const W = g.w + 2;
  const H = g.h + 2;
  const n = Math.max(W, H);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const arg = new Int32Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const colD = new Float64Array(W * H);
  const colArg = new Int32Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const inside = x > 0 && y > 0 && x <= g.w && y <= g.h && mask[(y - 1) * g.w + (x - 1)] > 0;
      f[y] = inside ? INF : 0;
    }
    edt1d(f, H, d, arg, v, z);
    for (let y = 0; y < H; y++) {
      colD[y * W + x] = d[y];
      colArg[y * W + x] = arg[y];
    }
  }
  const dist = new Float32Array(g.w * g.h);
  const nearest = new Int32Array(g.w * g.h).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = colD[y * W + x];
    edt1d(f, W, d, arg, v, z);
    if (y === 0 || y > g.h) continue;
    for (let x = 1; x <= g.w; x++) {
      const idx = (y - 1) * g.w + (x - 1);
      if (!mask[idx]) continue;
      dist[idx] = Math.sqrt(d[x]) * g.cell;
      const fx = arg[x];
      const fy = colArg[y * W + fx];
      // the feature in grid coordinates (it may sit in the padding: clamp to the grid's edge)
      nearest[idx] = Math.min(g.h - 1, Math.max(0, fy - 1)) * g.w + Math.min(g.w - 1, Math.max(0, fx - 1));
    }
  }
  return { dist, nearest };
}

// ---------------------------------------------------------------------------------------------------------------------
// Membrane height: ∇²h = -1, h = 0 outside, solved coarse to fine (SOR)
// ---------------------------------------------------------------------------------------------------------------------

function sor(h: Float32Array, mask: Uint8Array, w: number, hh: number, cell: number, iterations: number, omega = 1.9): void {
  const c2 = cell * cell;
  for (let it = 0; it < iterations; it++) {
    for (let parity = 0; parity < 2; parity++) {
      for (let y = 0; y < hh; y++) {
        for (let x = (y + parity) & 1; x < w; x += 2) {
          const i = y * w + x;
          if (!mask[i]) continue;
          const l = x > 0 ? h[i - 1] : 0;
          const r = x < w - 1 ? h[i + 1] : 0;
          const u = y > 0 ? h[i - w] : 0;
          const dn = y < hh - 1 ? h[i + w] : 0;
          const next = (l + r + u + dn + c2) / 4;
          h[i] += omega * (next - h[i]);
        }
      }
    }
  }
}

/** The membrane's height on grid `g`, normalised so the highest point is 1. */
export function membraneHeight(shape: SurfaceShape, g: Grid): Float32Array {
  // levels: coarse grids first, each upsampled as the start of the next
  const levels: Grid[] = [];
  for (let cell = g.cell, guard = 0; guard < 6; guard++, cell *= 2) {
    const lg = gridFor(g.w * g.cell, g.h * g.cell, cell);
    levels.unshift(lg);
    if (lg.w <= 24 || lg.h <= 12) break;
  }
  let prev: { grid: Grid; h: Float32Array } | null = null;
  for (const lg of levels) {
    const mask = rasterMask(shape, lg);
    const h = new Float32Array(lg.w * lg.h);
    if (prev) {
      const p: { grid: Grid; h: Float32Array } = prev;
      for (let y = 0; y < lg.h; y++)
        for (let x = 0; x < lg.w; x++) {
          if (!mask[y * lg.w + x]) continue;
          const px = Math.min(p.grid.w - 1, Math.floor(((x + 0.5) * lg.cell) / p.grid.cell));
          const py = Math.min(p.grid.h - 1, Math.floor(((y + 0.5) * lg.cell) / p.grid.cell));
          h[y * lg.w + x] = p.h[py * p.grid.w + px];
        }
    }
    const iterations = lg === levels[0] ? 400 : 60;
    sor(h, mask, lg.w, lg.h, lg.cell, iterations);
    prev = { grid: lg, h };
  }
  const out = prev!.h;
  let max = 0;
  for (let i = 0; i < out.length; i++) if (out[i] > max) max = out[i];
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Seeded noise
// ---------------------------------------------------------------------------------------------------------------------

function hash(n: number, seed: number): number {
  let x = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Smooth 1D value noise in 0..1. */
export function noise1(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - s) + hash(i + 1, seed) * s;
}

/** Smooth 2D value noise in 0..1. */
export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash(a * 374761393 + b * 668265263, seed);
  const a = h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx;
  const b = h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx;
  return a * (1 - sy) + b * sy;
}

// ---------------------------------------------------------------------------------------------------------------------
// The contour (for wrinkles' arc length)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Arc length (px) along the shape's outline for every outside cell that touches the inside, by walking the outline
 * in order; other cells get -1. Wrinkles are laid out along this.
 */
export function contourArcLength(mask: Uint8Array, g: Grid): { s: Float32Array; length: number } {
  const s = new Float32Array(g.w * g.h).fill(-1);
  const isRim = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return false;
    // an inside cell on the grid's border is on the outline (the shape fills its box to the edge)
    if (mask[y * g.w + x]) return x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && mask[ny * g.w + nx]) return true;
      }
    return false;
  };
  // rim cells, ordered by angle round the centroid of the inside, then smoothed into a running length
  let cx = 0;
  let cy = 0;
  let count = 0;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (mask[y * g.w + x]) {
        cx += x;
        cy += y;
        count++;
      }
  if (count === 0) return { s, length: 0 };
  cx /= count;
  cy /= count;
  const rim: Array<{ i: number; x: number; y: number; a: number }> = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (isRim(x, y)) rim.push({ i: y * g.w + x, x, y, a: Math.atan2(y - cy, x - cx) });
  rim.sort((p, q) => p.a - q.a);
  let length = 0;
  for (let k = 0; k < rim.length; k++) {
    if (k > 0) length += Math.hypot(rim[k].x - rim[k - 1].x, rim[k].y - rim[k - 1].y) * g.cell;
    s[rim[k].i] = length;
  }
  // the rim of a padded grid edge: cells on the grid's border that are inside count their own position
  return { s, length };
}

// ---------------------------------------------------------------------------------------------------------------------
// The resting surface
// ---------------------------------------------------------------------------------------------------------------------

export interface SurfaceLook {
  /** Height of the highest point, px. */
  depth: number;
  /** 0: a soft dome; 1: a full pillow with steep sides and a flat top. */
  fullness: number;
  /** Strength of the corner creases, 0..1. */
  creases: number;
  /** How far the creases reach in from the corners, px. */
  creaseLength: number;
  /** Strength of the wrinkles across the edges, 0..1. */
  wrinkles: number;
  /** Spacing of the wrinkles along the edge, px. */
  wrinkleSize: number;
  /** How far the wrinkles reach in from the edge, px. */
  wrinkleLength: number;
  /** Fine crinkle over the whole surface, 0..1. */
  crinkle: number;
  seed: number;
}

export const DEFAULT_LOOK: SurfaceLook = {
  depth: 22,
  fullness: 0.6,
  creases: 0.6,
  creaseLength: 70,
  wrinkles: 0.6,
  wrinkleSize: 12,
  wrinkleLength: 22,
  crinkle: 0.25,
  seed: 1,
};

export interface RestingSurface {
  grid: Grid;
  /** Height in px at every cell (0 outside). */
  height: Float32Array;
  /** Distance to the edge in px (0 outside). */
  dist: Float32Array;
  mask: Uint8Array;
}

/** The resting height of an inflated surface: the membrane, shaped by Fullness, with its creases and wrinkles. */
export function restingSurface(shape: SurfaceShape, look: SurfaceLook, cell = 1): RestingSurface {
  const g = gridFor(shape.width, shape.height, cell);
  const mask = rasterMask(shape, g);
  const base = membraneHeight(shape, g);
  const { dist, nearest } = distanceField(mask, g);
  const { s: arc } = contourArcLength(mask, g);
  const height = new Float32Array(g.w * g.h);
  const exponent = 1 + look.fullness * 3;
  const seed = Math.round(look.seed);

  // the crest of the distance field (its medial axis): where the Laplacian of the distance is strongly negative
  const crest = new Float32Array(g.w * g.h);
  for (let y = 1; y < g.h - 1; y++)
    for (let x = 1; x < g.w - 1; x++) {
      const i = y * g.w + x;
      if (!mask[i]) continue;
      const lap = (dist[i - 1] + dist[i + 1] + dist[i - g.w] + dist[i + g.w] - 4 * dist[i]) / g.cell;
      crest[i] = Math.max(0, Math.min(1, -lap * 0.9));
    }
  // soften the crest so the fold is a ridge a few px wide (three box passes ≈ a Gaussian)
  let soft = crest;
  const passes = Math.max(1, Math.round(2.5 / g.cell));
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(crest.length);
    for (let y = 1; y < g.h - 1; y++)
      for (let x = 1; x < g.w - 1; x++) {
        const i = y * g.w + x;
        next[i] = (soft[i] * 2 + soft[i - 1] + soft[i + 1] + soft[i - g.w] + soft[i + g.w]) / 6;
      }
    soft = next;
  }

  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      if (!mask[i]) continue;
      const hn = base[i];
      let h = 1 - Math.pow(1 - hn, exponent);
      const d = dist[i];
      // creases: the medial axis near the corners, fading in over creaseLength
      if (look.creases > 0) {
        const reach = Math.max(1, look.creaseLength);
        const k = Math.max(0, 1 - d / reach);
        const near = k * k * (3 - 2 * k);
        h += look.creases * 0.35 * soft[i] * near;
      }
      // wrinkles across the edge: ridges along the outline, each its own length
      if (look.wrinkles > 0 && nearest[i] >= 0) {
        const sArc = arc[nearest[i]];
        if (sArc >= 0) {
          const t = sArc / Math.max(2, look.wrinkleSize);
          const ridge = 1 - Math.abs(2 * noise1(t, seed) - 1);
          const sharp = ridge * ridge * ridge;
          const reach = look.wrinkleLength * (0.45 + 1.1 * noise1(t * 0.37 + 11, seed + 7));
          // fades to exactly nothing by three reaches in, so the pattern never jumps where the nearest edge changes
          const cut = Math.max(0, 1 - d / (3 * Math.max(1, reach)));
          const across = Math.exp(-d / Math.max(1, reach)) * (1 - Math.exp(-d / 2.5)) * cut * cut;
          h += look.wrinkles * 0.2 * (sharp - 0.35) * across;
        }
      }
      // crinkle: fine 2D noise, stronger on the flank than on the top
      if (look.crinkle > 0) {
        const n = noise2((x * g.cell) / 9, (y * g.cell) / 9, seed + 3) - 0.5;
        const m = noise2((x * g.cell) / 3.5, (y * g.cell) / 3.5, seed + 5) - 0.5;
        h += look.crinkle * 0.02 * (n + 0.5 * m) * (0.4 + 0.6 * (1 - hn));
      }
      height[i] = Math.max(0, h) * look.depth;
    }
  return { grid: g, height, dist, mask };
}
