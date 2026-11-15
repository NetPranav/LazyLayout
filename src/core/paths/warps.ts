/**
 * ============================================================================
 * WARP MODIFIERS (ROADMAP Phase 111)
 * ============================================================================
 * Twist, bend, wiggle, zig-zag, pucker & bloat, and spherize: modifiers for the stack in `modifiers.ts`. A warp that
 * moves every point (twist, bend, spherize, wiggle) resamples the outline every 2 px along its length, moves each
 * sample, and fits curves back within 0.1 px, so the result follows the warp, not just its corners. Zig-zag places
 * peaks along each segment; pucker & bloat bends each segment's handles toward or away from the centre (as
 * Illustrator's does, the anchors stay).
 *
 * Every warp is deterministic: wiggle draws from a seeded noise, so a design looks the same each time it opens.
 * Pure functions, no DOM. Paths are in the layer's own box (px).
 * ============================================================================
 */

import { BezPath, segmentEval, splitSubpaths, type Pt, type Segment } from "../geometry/bezpath";
import { fitCurve } from "./pathFit";

export interface WarpInput {
  path: BezPath;
  closed: boolean;
}
type Params = Readonly<Record<string, number | string>>;
type Box = { w: number; h: number };

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const STEP = 2;
const MAX_SAMPLES = 20_000;

/** A subpath as samples about `STEP` px apart along its length, with the arc length and direction at each. */
interface Run {
  pts: Pt[];
  /** Arc length from the subpath's start, per sample. */
  at: number[];
  /** Unit direction of travel, per sample. */
  dir: Pt[];
  closed: boolean;
}

function segLen(s: Segment): number {
  if (s.kind === "line") return Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y);
  let len = 0;
  let prev = segmentEval(s, 0);
  for (let i = 1; i <= 24; i++) {
    const q = segmentEval(s, i / 24);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

function sample(path: BezPath): Run[] {
  const runs: Run[] = [];
  let budget = MAX_SAMPLES;
  for (const sp of splitSubpaths(path)) {
    const closed = sp.els[sp.els.length - 1]?.t === "Z";
    const segs = sp.segments();
    if (segs.length === 0) continue;
    const pts: Pt[] = [segmentEval(segs[0], 0)];
    const at: number[] = [0];
    let total = 0;
    for (const s of segs) {
      const l = segLen(s);
      const n = Math.max(1, Math.min(budget, Math.ceil(l / STEP)));
      budget = Math.max(1, budget - n);
      let prev = pts[pts.length - 1];
      for (let k = 1; k <= n; k++) {
        const q = segmentEval(s, k / n);
        total += Math.hypot(q.x - prev.x, q.y - prev.y);
        pts.push(q);
        at.push(total);
        prev = q;
      }
    }
    const dir = pts.map((_, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    });
    runs.push({ pts, at, dir, closed });
  }
  return runs;
}

/** Fits curves through warped samples (within 0.1 px), one subpath per run. */
function rebuild(runs: readonly { pts: Pt[]; closed: boolean }[]): BezPath {
  const out = new BezPath();
  for (const r of runs) {
    if (r.pts.length < 2) continue;
    out.moveTo(r.pts[0]);
    for (const f of fitCurve(r.pts, 0.1)) out.curveTo(f.c1, f.c2, r.pts[f.to]);
    if (r.closed) out.closePath();
  }
  return out;
}

const warpPoints = (input: WarpInput, f: (p: Pt) => Pt): WarpInput => ({
  path: rebuild(sample(input.path).map((r) => ({ pts: r.pts.map(f), closed: r.closed }))),
  closed: input.closed,
});

// --- twist, bend, spherize -------------------------------------------------------------------------------------------

/** Turns each point about the box's centre by `angle` degrees times its distance from the centre over the half-diagonal. */
export function twist(input: WarpInput, p: Params, box: Box): WarpInput {
  const angle = num(p.angle, 90);
  if (angle === 0) return input;
  const c = { x: box.w / 2, y: box.h / 2 };
  const reach = Math.max(1e-6, Math.hypot(box.w, box.h) / 2);
  return warpPoints(input, (q) => {
    const dx = q.x - c.x;
    const dy = q.y - c.y;
    const a = ((angle * Math.hypot(dx, dy)) / reach) * (Math.PI / 180);
    return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
  });
}

/**
 * Bends the shape round an arc: the box's width becomes an arc of `angle` degrees (positive arches it up, negative
 * down). The centre line keeps its length; a point above or below it lands on a larger or smaller circle.
 */
export function bend(input: WarpInput, p: Params, box: Box): WarpInput {
  const angle = clamp(num(p.angle, 45), -359, 359);
  if (Math.abs(angle) < 1e-6 || box.w <= 0) return input;
  const phi = (angle * Math.PI) / 180;
  const R = box.w / phi;
  const c = { x: box.w / 2, y: box.h / 2 };
  return warpPoints(input, (q) => {
    const theta = (q.x - c.x) / R;
    const r = R - (q.y - c.y);
    return { x: c.x + r * Math.sin(theta), y: c.y + R - r * Math.cos(theta) };
  });
}

/** Bulges (amount > 0) or pinches (< 0) the shape about the box's centre, most in the middle, nothing at its edge. */
export function spherize(input: WarpInput, p: Params, box: Box): WarpInput {
  const a = clamp(num(p.amount, 50), -100, 100) / 100;
  if (a === 0) return input;
  const c = { x: box.w / 2, y: box.h / 2 };
  const reach = Math.max(1e-6, Math.hypot(box.w, box.h) / 2);
  return warpPoints(input, (q) => {
    const dx = q.x - c.x;
    const dy = q.y - c.y;
    const d = Math.hypot(dx, dy) / reach;
    if (d >= 1 || d === 0) return q;
    const k = (d + a * d * (1 - d)) / d;
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
}

// --- wiggle -----------------------------------------------------------------------------------------------------------

/** A seeded hash of an integer to [-1, 1]. */
function hash(seed: number, i: number): number {
  let h = (Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth 1D value noise: seeded values at whole numbers, eased between. */
function noise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - u) + hash(seed, i + 1) * u;
}

/**
 * A hand-drawn wobble: each point moves across the outline by seeded noise, at most `size` px, with `detail`
 * wobbles per 100 px. On a closed outline the wobble wraps round, so the start and end still meet. `speed` is kept for
 * when the clock plays (it scrolls the noise); a still design ignores it.
 */
export function wiggle(input: WarpInput, p: Params): WarpInput {
  const size = clamp(num(p.size, 4), 0, 500);
  if (size === 0) return input;
  const detail = clamp(num(p.detail, 6), 0.1, 200) / 100;
  const seed = Math.round(num(p.seed, 1));
  const runs = sample(input.path).map((r, ri) => {
    const total = r.at[r.at.length - 1] || 1;
    // on a loop, a whole number of wobbles, so the noise meets itself at the closing point
    const waves = r.closed ? Math.max(1, Math.round(total * detail)) : total * detail;
    const val = (s: number) => {
      const x = (s / total) * waves;
      if (!r.closed) return noise(seed + ri * 7919, x);
      // wrap: blend the noise near the end with the noise near the start
      const w = x / waves;
      return noise(seed + ri * 7919, x) * (1 - w) + noise(seed + ri * 7919, x - waves) * w;
    };
    const pts = r.pts.map((q, i) => {
      const n = val(r.at[i]) * size;
      return { x: q.x - r.dir[i].y * n, y: q.y + r.dir[i].x * n };
    });
    if (r.closed && pts.length > 1) pts[pts.length - 1] = pts[0];
    return { pts, closed: r.closed };
  });
  return { path: rebuild(runs), closed: input.closed };
}

// --- zig-zag ----------------------------------------------------------------------------------------------------------

/**
 * After Effects' Zig Zag: `ridges` peaks on every segment, `size` px either side of it in turn; `points` corner draws
 * straight teeth, smooth draws waves through the same peaks. The segment's ends stay on the outline.
 */
export function zigzag(input: WarpInput, p: Params): WarpInput {
  const size = clamp(num(p.size, 6), 0, 500);
  const ridges = Math.round(clamp(num(p.ridges, 5), 1, 200));
  const smooth = p.points === "smooth";
  if (size === 0) return input;
  const out = new BezPath();
  for (const sp of splitSubpaths(input.path)) {
    const closed = sp.els[sp.els.length - 1]?.t === "Z";
    const segs = sp.segments();
    if (segs.length === 0) continue;
    const pts: Pt[] = [segmentEval(segs[0], 0)];
    let sign = 1;
    for (const s of segs) {
      // samples at even arc-length fractions: peaks at the odd ones, the end at the last
      const table = [0];
      let prev = segmentEval(s, 0);
      const N = s.kind === "line" ? 1 : 48;
      for (let i = 1; i <= N; i++) {
        const q = segmentEval(s, i / N);
        table.push(table[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y));
        prev = q;
      }
      const total = table[N];
      const tAt = (len: number) => {
        let k = 1;
        while (k < N && table[k] < len) k++;
        const span = table[k] - table[k - 1];
        return (k - 1 + (span > 0 ? (len - table[k - 1]) / span : 0)) / N;
      };
      for (let j = 0; j < ridges; j++) {
        const t = tAt(((2 * j + 1) / (2 * ridges)) * total);
        const a = segmentEval(s, Math.max(0, t - 1e-3));
        const b = segmentEval(s, Math.min(1, t + 1e-3));
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const q = segmentEval(s, t);
        pts.push({ x: q.x - ((b.y - a.y) / l) * size * sign, y: q.y + ((b.x - a.x) / l) * size * sign });
        sign = -sign;
      }
      pts.push(segmentEval(s, 1));
    }
    out.moveTo(pts[0]);
    if (!smooth) for (const q of pts.slice(1)) out.lineTo(q);
    else {
      // Catmull–Rom through the points, as cubic curves
      const at = (i: number) => pts[closed ? (i + pts.length - 1) % (pts.length - 1) : clamp(i, 0, pts.length - 1)];
      for (let i = 0; i + 1 < pts.length; i++) {
        const p0 = at(i - 1);
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = at(i + 2);
        out.curveTo({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }, p2);
      }
    }
    if (closed) out.closePath();
  }
  return { path: out, closed: input.closed };
}

// --- pucker & bloat ---------------------------------------------------------------------------------------------------

/**
 * Illustrator's Pucker & Bloat: the anchors stay; every segment's handles move away from the box's centre by
 * `amount`% of their distance to it (bloat, > 0: the sides puff out) or toward it (pucker, < 0: the sides pinch in and
 * the corners go spiky). A straight side is first given handles at a third and two thirds of its length.
 */
export function puckerBloat(input: WarpInput, p: Params, box: Box): WarpInput {
  const a = clamp(num(p.amount, 30), -200, 200) / 100;
  if (a === 0) return input;
  const c = { x: box.w / 2, y: box.h / 2 };
  const push = (q: Pt): Pt => ({ x: q.x + (q.x - c.x) * a, y: q.y + (q.y - c.y) * a });
  const out = new BezPath();
  for (const sp of splitSubpaths(input.path)) {
    const segs = sp.segments();
    if (segs.length === 0) continue;
    out.moveTo(segmentEval(segs[0], 0));
    for (const s of segs) {
      const [p0, c1, c2, p3] =
        s.kind === "line"
          ? [s.p0, { x: s.p0.x + (s.p1.x - s.p0.x) / 3, y: s.p0.y + (s.p1.y - s.p0.y) / 3 }, { x: s.p0.x + (2 * (s.p1.x - s.p0.x)) / 3, y: s.p0.y + (2 * (s.p1.y - s.p0.y)) / 3 }, s.p1]
          : s.kind === "quad"
            ? [s.p0, { x: s.p0.x + (2 / 3) * (s.p1.x - s.p0.x), y: s.p0.y + (2 / 3) * (s.p1.y - s.p0.y) }, { x: s.p2.x + (2 / 3) * (s.p1.x - s.p2.x), y: s.p2.y + (2 / 3) * (s.p1.y - s.p2.y) }, s.p2]
            : [s.p0, s.p1, s.p2, s.p3];
      void p0;
      out.curveTo(push(c1), push(c2), p3);
    }
    if (sp.els[sp.els.length - 1]?.t === "Z") out.closePath();
  }
  return { path: out, closed: input.closed };
}
