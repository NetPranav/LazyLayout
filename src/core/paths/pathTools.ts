/**
 * ============================================================================
 * PATH OPERATIONS (ROADMAP Phase 106)
 * ============================================================================
 * Offset a shape outward or inward (round, mitre or bevel corners), simplify and smooth a path by a strength,
 * divide overlapping shapes into their pieces, cut a shape with a knife line, join two open paths, and reverse a
 * path. Outlining a stroke is `strokeOutline` (`strokes.ts`). Everything works on curve paths and gives curves
 * back (Phase 103). Pure functions, no DOM; the layer-level work is in `core/editing/pathToolOps.ts`.
 * ============================================================================
 */

import { BezPath, segmentEnd, segmentEval, segmentStart, splitSubpaths, type Pt, type Segment } from "../geometry/bezpath";
import { winding } from "../geometry/measure";
import { fitCurve } from "./pathFit";
import { arrangementFaces, booleanPaths, piecesOf, type FillRule } from "./pathOps";
import { defaultStroke, strokeOutline, type StrokeJoin } from "./strokes";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

// --- offset -----------------------------------------------------------------------

/** The furthest a shape can be offset in one go, in px. */
export const MAX_OFFSET = 2_000;

/**
 * A closed shape grown (`distance` > 0) or shrunk (`distance` < 0) by a distance, with the chosen corners. The shape
 * is combined with the band a stroke of twice that width paints along its outline, so corners are the stroker's.
 * Empty when shrinking leaves nothing.
 */
export function offsetPath(path: BezPath, distance: number, join: StrokeJoin = "round", miterLimit = 4, rule: FillRule = "nonzero"): BezPath {
  if (!Number.isFinite(distance) || path.isEmpty()) return new BezPath();
  const d = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, distance));
  if (Math.abs(d) < 1e-6) return booleanPaths(path, new BezPath(), "union", rule);
  const band = strokeOutline(path, { ...defaultStroke(), weight: Math.abs(d) * 2, align: "center", join, miterLimit }, true);
  const raw = booleanPaths(path, band, d > 0 ? "union" : "subtract", rule, "nonzero");
  // The band's edges are the stroker's short straight pieces: fitted back into curves (within 0.05 px), with the
  // corners of a mitre or bevel join kept as corners.
  return refit(raw, 0.05, 30, 0);
}

// --- simplify and smooth -------------------------------------------------------------

const tangentAt = (s: Segment, end: boolean): Pt => {
  // the direction of travel at an end, taken a little inside so a handle of no length still gives one
  const a = segmentEval(s, end ? 0.98 : 0);
  const b = segmentEval(s, end ? 1 : 0.02);
  const l = dist(a, b) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};

/** The turn between two segments at their joint, in degrees (0: straight on). */
function turnAt(a: Segment, b: Segment): number {
  const u = tangentAt(a, true);
  const v = tangentAt(b, false);
  return (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) * 180) / Math.PI;
}

/** Points along a run of segments, about `step` px apart (straight pieces too), starting with the run's start. */
function sampleRun(run: readonly Segment[], step: number): Pt[] {
  const pts: Pt[] = [segmentStart(run[0])];
  for (const s of run) {
    // a segment's length, roughly, from its control polygon (an upper bound, so the spacing is never too coarse)
    const ctrl = s.kind === "line" ? [s.p0, s.p1] : s.kind === "quad" ? [s.p0, s.p1, s.p2] : [s.p0, s.p1, s.p2, s.p3];
    let len = 0;
    for (let k = 1; k < ctrl.length; k++) len += dist(ctrl[k - 1], ctrl[k]);
    const n = Math.max(1, Math.min(2_000, Math.ceil(len / step)));
    for (let k = 1; k <= n; k++) pts.push(segmentEval(s, k / n));
  }
  return pts;
}

/**
 * Moving-average smoothing of a run of points, `passes` times over a window of `radius` points on each side. The
 * ends stay put (they are corners, or the ends of an open path); a closed run with no corner wraps round.
 */
function relax(pts: Pt[], radius: number, passes: number, loop: boolean): Pt[] {
  if (radius < 1 || passes < 1 || pts.length < 3) return pts;
  let cur = pts;
  const n = pts.length;
  for (let p = 0; p < passes; p++) {
    const next: Pt[] = new Array(n);
    for (let i = 0; i < n; i++) {
      if (!loop && (i === 0 || i === n - 1)) {
        next[i] = cur[i];
        continue;
      }
      let sx = 0;
      let sy = 0;
      let c = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = loop ? (((i + k) % (n - 1)) + (n - 1)) % (n - 1) : Math.min(n - 1, Math.max(0, i + k));
        sx += cur[j].x;
        sy += cur[j].y;
        c++;
      }
      next[i] = { x: sx / c, y: sy / c };
    }
    if (loop) next[n - 1] = next[0];
    cur = next;
  }
  return cur;
}

function refit(path: BezPath, tolerance: number, cornerAngle: number, smoothRadius: number): BezPath {
  const out = new BezPath();
  for (const sp of splitSubpaths(path)) {
    const closed = sp.els[sp.els.length - 1]?.t === "Z";
    const segs = sp.segments().filter((s) => dist(segmentStart(s), segmentEnd(s)) > 1e-9 || s.kind !== "line");
    if (segs.length === 0) continue;
    const n = segs.length;
    // a joint is a corner when the path turns sharply there; a corner is kept, and curves are fitted between corners
    const corner: boolean[] = segs.map((s, i) => {
      if (i === 0 && !closed) return true;
      return turnAt(segs[(i - 1 + n) % n], s) > cornerAngle;
    });
    const loop = closed && !corner.includes(true);
    let first = corner.indexOf(true);
    if (first < 0) first = 0; // a smooth loop starts where it was drawn
    let started = false;
    let i = 0;
    while (i < n) {
      let len = 1;
      while (i + len < n && !corner[(first + i + len) % n]) len++;
      const run = Array.from({ length: len }, (_, k) => segs[(first + i + k) % n]);
      const end = segmentEnd(run[run.length - 1]);
      if (run.length === 1 && run[0].kind === "line") {
        if (!started) out.moveTo(segmentStart(run[0]));
        started = true;
        out.lineTo(end);
      } else {
        const step = Math.max(0.25, Math.min(2, tolerance / 2));
        let pts = sampleRun(run, step);
        if (smoothRadius > 0) pts = relax(pts, Math.round(smoothRadius / step), 3, loop);
        if (!started) out.moveTo(pts[0]);
        started = true;
        if (pts.length < 2) out.lineTo(end);
        else for (const fit of fitCurve(pts, tolerance)) out.curveTo(fit.c1, fit.c2, pts[fit.to]);
      }
      i += len;
    }
    if (closed) out.closePath();
  }
  return out;
}

/** How far from the original a simplified path may stray, for a strength of 0 to 1: 0.05 px to 8 px. */
export const simplifyTolerance = (strength: number): number => 0.05 + clamp01(strength) ** 2 * 7.95;

/**
 * A path with fewer points: curves are fitted again to within a tolerance that grows with `strength` (0 to 1).
 * Corners stay corners and straight sides stay straight.
 */
export function simplifyCurves(path: BezPath, strength: number): BezPath {
  const tol = simplifyTolerance(strength);
  return refit(path, tol, 30, 0);
}

/**
 * A smoother path: as `strength` grows (0 to 1), sharper and sharper corners are rounded, wobbles are averaged out
 * over a wider stretch (up to 20 px either side), and the curve is fitted more loosely. Strength 0 changes nothing a
 * person could see.
 */
export function smoothCurves(path: BezPath, strength: number): BezPath {
  const s = clamp01(strength);
  return refit(path, 0.1 + s * 1.5, 30 + s * 150, s * 20);
}

// --- divide ---------------------------------------------------------------------------

export interface DividedPiece {
  path: BezPath;
  /** Indices of the shapes covering the piece, ascending. */
  cover: number[];
}

/** Every overlap as its own piece: the connected areas covered by the same shapes. Null for hostile input. */
export function dividePaths(shapes: readonly { path: BezPath; evenOdd?: boolean }[]): DividedPiece[] | null {
  return arrangementFaces(shapes);
}

// --- knife ----------------------------------------------------------------------------

/**
 * Cuts a closed shape along a knife line (two or more points). The line must start and end outside the shape; it is
 * carried straight on past both ends, and the shape falls into the pieces on either side. Null when the knife does
 * not cut the shape in two.
 */
export function knifeCut(shape: BezPath, knife: readonly Pt[], rule: FillRule = "nonzero"): BezPath[] | null {
  const pts = knife.filter((p, i) => Number.isFinite(p.x) && Number.isFinite(p.y) && (i === 0 || dist(p, knife[i - 1]) > 1e-6));
  if (pts.length < 2 || shape.isEmpty()) return null;
  const inside = (p: Pt): boolean => {
    const w = winding(shape, p);
    return rule === "evenodd" ? w % 2 !== 0 : w !== 0;
  };
  if (inside(pts[0]) || inside(pts[pts.length - 1])) return null;
  const bb = shape.boundingBox();
  const far = 4 * Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) + 100 + Math.max(...pts.map((p) => Math.max(Math.abs(p.x - bb.x0), Math.abs(p.y - bb.y0))));
  const dir = (a: Pt, b: Pt): Pt => {
    const l = dist(a, b);
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  const d0 = dir(pts[0], pts[1]);
  const d1 = dir(pts[pts.length - 2], pts[pts.length - 1]);
  const start = { x: pts[0].x - d0.x * far, y: pts[0].y - d0.y * far };
  const end = { x: pts[pts.length - 1].x + d1.x * far, y: pts[pts.length - 1].y + d1.y * far };
  // everything to the left of the knife, as one large polygon
  const side = new BezPath().moveTo(start);
  for (const p of pts) side.lineTo(p);
  side.lineTo(end);
  side.lineTo({ x: end.x - d1.y * far, y: end.y + d1.x * far });
  side.lineTo({ x: start.x - d0.y * far, y: start.y + d0.x * far });
  side.closePath();
  const left = piecesOf(booleanPaths(shape, side, "intersect", rule, "nonzero"));
  const right = piecesOf(booleanPaths(shape, side, "subtract", rule, "nonzero"));
  if (left.length === 0 || right.length === 0) return null;
  return [...left, ...right];
}

// --- join and reverse -------------------------------------------------------------------

/** A path drawn the other way round. */
export const reversePath = (path: BezPath): BezPath => path.reverseSubpaths();

const openEnds = (p: BezPath): { start: Pt; end: Pt } | null => {
  const subs = splitSubpaths(p);
  if (subs.length !== 1 || subs[0].els[subs[0].els.length - 1]?.t === "Z") return null;
  const segs = subs[0].segments();
  return segs.length ? { start: segmentStart(segs[0]), end: segmentEnd(segs[segs.length - 1]) } : null;
};

/**
 * Two open paths as one: their nearest ends are joined (by a straight line when they are apart). When the other two
 * ends meet as well, the result is closed. Null unless both are single open paths.
 */
export function joinPaths(a: BezPath, b: BezPath): BezPath | null {
  const ea = openEnds(a);
  const eb = openEnds(b);
  if (!ea || !eb) return null;
  const options = [
    { d: dist(ea.end, eb.start), a, b },
    { d: dist(ea.end, eb.end), a, b: reversePath(b) },
    { d: dist(ea.start, eb.start), a: reversePath(a), b },
    { d: dist(ea.start, eb.end), a: reversePath(a), b: reversePath(b) },
  ].sort((x, y) => x.d - y.d)[0];
  const first = openEnds(options.a)!;
  const second = openEnds(options.b)!;
  const out = BezPath.from(options.a.els);
  if (options.d > 1e-6) out.lineTo(second.start);
  out.extend(options.b.els.slice(1));
  if (dist(second.end, first.start) < 1e-6) out.closePath();
  return out;
}
