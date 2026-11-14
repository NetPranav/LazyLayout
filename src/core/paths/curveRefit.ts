/**
 * ============================================================================
 * CURVES STAY CURVES (ROADMAP Phase 103)
 * ============================================================================
 * The boolean engine (`pathOps.ts`) combines flattened polygons. This turns its answer back into curves: every edge
 * of a result ring lies on one segment of an input path, so a run of edges on the same segment is that segment
 * between two parameters, cut exactly (de Casteljau), not a polyline. Where two inputs cross, the joint is refined
 * onto the true crossing of the two curves. An edge that lies on no input (the straight line that closes an open
 * subpath) stays a line.
 *
 * So a union of two circles is a handful of cubic pieces of the circles, not hundreds of straight ones.
 * Pure functions, no DOM.
 * ============================================================================
 */

import { BezPath, cubicSubsegment, segmentBounds, segmentEval, segmentNearest, type Cubic, type Pt, type Rect, type Segment } from "../geometry/bezpath";

type Ring = [number, number][];
type Multi = Ring[][];

/** An output edge this close to an input segment (px) came from it. Flattening is within 0.002 px (`BOOLEAN_TOL`). */
const ON_SEGMENT = 0.01;
/** A parameter this close to an end of a segment is that end. */
const END_T = 1e-6;

interface Source {
  seg: Segment;
  box: Rect;
}

const d2 = (a: Pt, b: Pt): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function asCubic(s: Segment): Cubic | null {
  if (s.kind === "cubic") return { p0: s.p0, p1: s.p1, p2: s.p2, p3: s.p3 };
  if (s.kind === "quad") {
    return {
      p0: s.p0,
      p1: { x: s.p0.x + (2 / 3) * (s.p1.x - s.p0.x), y: s.p0.y + (2 / 3) * (s.p1.y - s.p0.y) },
      p2: { x: s.p2.x + (2 / 3) * (s.p1.x - s.p2.x), y: s.p2.y + (2 / 3) * (s.p1.y - s.p2.y) },
      p3: s.p2,
    };
  }
  return null;
}

function derivative(s: Segment, t: number): Pt {
  if (s.kind === "line") return { x: s.p1.x - s.p0.x, y: s.p1.y - s.p0.y };
  const c = asCubic(s)!;
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const d = 3 * t * t;
  return {
    x: a * (c.p1.x - c.p0.x) + b * (c.p2.x - c.p1.x) + d * (c.p3.x - c.p2.x),
    y: a * (c.p1.y - c.p0.y) + b * (c.p2.y - c.p1.y) + d * (c.p3.y - c.p2.y),
  };
}

function sourcesOf(paths: readonly BezPath[]): Source[] {
  const out: Source[] = [];
  for (const p of paths) {
    for (const seg of p.segments()) {
      const b = segmentBounds(seg);
      if (b.x1 - b.x0 < 1e-12 && b.y1 - b.y0 < 1e-12) continue;
      out.push({ seg, box: { x0: b.x0 - ON_SEGMENT, y0: b.y0 - ON_SEGMENT, x1: b.x1 + ON_SEGMENT, y1: b.y1 + ON_SEGMENT } });
    }
  }
  return out;
}

const inBox = (b: Rect, p: Pt): boolean => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

/**
 * The squared distance from `p` to a segment, searched from a nearby parameter (a few Gauss–Newton steps). Much
 * cheaper than a full search, and enough for the next vertex along a curve the last one was on.
 */
function nearFrom(s: Segment, p: Pt, hint: number): { t: number; distanceSq: number } {
  let t = hint;
  for (let i = 0; i < 4; i++) {
    const q = segmentEval(s, t);
    const d = derivative(s, t);
    const len = d.x * d.x + d.y * d.y;
    if (len < 1e-18) break;
    const step = ((p.x - q.x) * d.x + (p.y - q.y) * d.y) / len;
    t = Math.min(1, Math.max(0, t + step));
    if (Math.abs(step) < 1e-7) break;
  }
  return { t, distanceSq: d2(segmentEval(s, t), p) };
}

/**
 * Which input segment an edge lies on (-1: none), and where its far end is on that segment. The segment the edge
 * before it lay on is tried first, from where that edge ended.
 */
function ownerOf(a: Pt, b: Pt, sources: readonly Source[], prev: number, prevT: number): { owner: number; t: number } {
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const lim = ON_SEGMENT * ON_SEGMENT;
  if (prev >= 0) {
    const s = sources[prev];
    if (inBox(s.box, m) && inBox(s.box, b)) {
      const nm = nearFrom(s.seg, m, prevT);
      if (nm.distanceSq <= lim) {
        const nb = nearFrom(s.seg, b, nm.t);
        if (nb.distanceSq <= lim) return { owner: prev, t: nb.t };
      }
    }
  }
  let best = -1;
  let bestD = Infinity;
  let bestT = 0;
  for (let k = 0; k < sources.length; k++) {
    const s = sources[k];
    if (!inBox(s.box, m) || !inBox(s.box, a) || !inBox(s.box, b)) continue;
    const dm = segmentNearest(s.seg, m).distanceSq;
    if (dm > lim || dm >= bestD) continue;
    // the ends too: an edge that only crosses a segment is not on it
    if (segmentNearest(s.seg, a).distanceSq > lim) continue;
    const nb = segmentNearest(s.seg, b);
    if (nb.distanceSq > lim) continue;
    bestD = dm;
    best = k;
    bestT = nb.t;
  }
  return { owner: best, t: bestT };
}

const snapT = (t: number): number => (t < END_T ? 0 : t > 1 - END_T ? 1 : t);

/** The parameter of `p` on a segment. When the segment starts and ends at `p`, `toward` (a point further along the run) picks the end. */
function paramAt(s: Segment, p: Pt, toward: Pt): number {
  const t = snapT(segmentNearest(s, p).t);
  if (t !== 0 && t !== 1) return t;
  const start = segmentEval(s, 0);
  const end = segmentEval(s, 1);
  if (d2(start, end) > ON_SEGMENT * ON_SEGMENT) return t;
  const tw = segmentNearest(s, toward).t;
  return tw < 0.5 ? 0 : 1;
}

/** The crossing of two segments near (t, u), by Newton's method. Null when it doesn't settle close by. */
function refineCrossing(a: Segment, t: number, b: Segment, u: number): { t: number; u: number; p: Pt } | null {
  let tt = t;
  let uu = u;
  for (let i = 0; i < 12; i++) {
    const pa = segmentEval(a, tt);
    const pb = segmentEval(b, uu);
    const fx = pa.x - pb.x;
    const fy = pa.y - pb.y;
    if (fx * fx + fy * fy < 1e-22) break;
    const da = derivative(a, tt);
    const db = derivative(b, uu);
    const det = da.x * -db.y - -db.x * da.y;
    if (Math.abs(det) < 1e-12) return null; // tangent curves: keep the polygon's vertex
    tt -= (fx * -db.y - -db.x * fy) / det;
    uu -= (da.x * fy - da.y * fx) / det;
    if (!Number.isFinite(tt) || !Number.isFinite(uu)) return null;
  }
  if (tt < -1e-3 || tt > 1 + 1e-3 || uu < -1e-3 || uu > 1 + 1e-3) return null;
  tt = Math.min(1, Math.max(0, tt));
  uu = Math.min(1, Math.max(0, uu));
  const pa = segmentEval(a, tt);
  const pb = segmentEval(b, uu);
  if (d2(pa, pb) > 1e-12) return null;
  return { t: snapT(tt), u: snapT(uu), p: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } };
}

interface Run {
  owner: number;
  /** Index of the run's first vertex, and how many edges it has. */
  from: number;
  edges: number;
  t0: number;
  t1: number;
  start: Pt;
  end: Pt;
}

function refitRing(ring: Ring, sources: readonly Source[], out: BezPath): void {
  const pts: Pt[] = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
  const n = pts.length;
  if (n < 3) return;
  const at = (i: number): Pt => pts[((i % n) + n) % n];

  const owner: number[] = new Array(n);
  let prev = -1;
  let prevT = 0;
  for (let i = 0; i < n; i++) {
    const o = ownerOf(at(i), at(i + 1), sources, prev, prevT);
    owner[i] = prev = o.owner;
    prevT = o.t;
  }

  // start at an edge whose owner differs from the edge before it, so no run wraps around the end of the list
  let first = 0;
  while (first < n && owner[first] === owner[(first - 1 + n) % n]) first++;
  const runs: Run[] = [];
  if (first === n) {
    // the whole ring is one segment (a closed loop made of a single curve), or no input at all: cut it in two
    const half = Math.floor(n / 2);
    runs.push({ owner: owner[0], from: 0, edges: half, t0: 0, t1: 0, start: at(0), end: at(half) });
    runs.push({ owner: owner[0], from: half, edges: n - half, t0: 0, t1: 0, start: at(half), end: at(0) });
  } else {
    let i = first;
    let left = n;
    while (left > 0) {
      let len = 1;
      while (len < left && owner[(i + len) % n] === owner[i % n]) len++;
      runs.push({ owner: owner[i % n], from: i % n, edges: len, t0: 0, t1: 0, start: at(i), end: at(i + len) });
      i += len;
      left -= len;
    }
  }

  for (const r of runs) {
    if (r.owner < 0) continue;
    const seg = sources[r.owner].seg;
    const mid = at(r.from + Math.max(1, Math.floor(r.edges / 2)));
    r.t0 = paramAt(seg, r.start, r.edges > 1 ? at(r.from + 1) : mid);
    r.t1 = paramAt(seg, r.end, r.edges > 1 ? at(r.from + r.edges - 1) : mid);
  }

  // joints: the end of each run and the start of the next are one point, on both curves where two inputs cross
  for (let k = 0; k < runs.length; k++) {
    const a = runs[k];
    const b = runs[(k + 1) % runs.length];
    let joint: Pt = a.end;
    if (a.owner >= 0 && b.owner >= 0) {
      const sa = sources[a.owner].seg;
      const sb = sources[b.owner].seg;
      const endA = a.t1 === 0 || a.t1 === 1;
      const endB = b.t0 === 0 || b.t0 === 1;
      if (endA) joint = segmentEval(sa, a.t1);
      else if (endB) joint = segmentEval(sb, b.t0);
      else if (a.owner !== b.owner) {
        const x = refineCrossing(sa, a.t1, sb, b.t0);
        if (x && Math.abs(x.t - a.t1) < 0.05 && Math.abs(x.u - b.t0) < 0.05) {
          a.t1 = x.t;
          b.t0 = x.u;
          joint = x.p;
        }
      }
    } else if (a.owner >= 0 && (a.t1 === 0 || a.t1 === 1)) {
      joint = segmentEval(sources[a.owner].seg, a.t1);
    } else if (b.owner >= 0 && (b.t0 === 0 || b.t0 === 1)) {
      joint = segmentEval(sources[b.owner].seg, b.t0);
    }
    a.end = joint;
    b.start = joint;
  }

  out.moveTo(runs[0].start);
  for (const r of runs) {
    if (r.owner < 0) {
      for (let e = 1; e < r.edges; e++) out.lineTo(at(r.from + e));
      out.lineTo(r.end);
      continue;
    }
    const cubic = asCubic(sources[r.owner].seg);
    if (!cubic || Math.abs(r.t1 - r.t0) < 1e-9) {
      out.lineTo(r.end);
      continue;
    }
    const piece = cubicSubsegment(cubic, r.t0, r.t1);
    out.curveTo(piece.p1, piece.p2, r.end);
  }
  out.closePath();
}

/**
 * The polygons of a boolean result as a path whose pieces are the input paths' own curves.
 * `inputs` are the paths the polygons were made from (any that contributed an edge).
 */
export function refitCurves(region: Multi, inputs: readonly BezPath[]): BezPath {
  const sources = sourcesOf(inputs);
  const out = new BezPath();
  for (const poly of region) for (const ring of poly) refitRing(ring, sources, out);
  return out;
}
