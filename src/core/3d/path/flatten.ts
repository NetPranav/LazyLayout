/**
 * ============================================================================
 * PATH FLATTENING & RING NORMALIZATION (ROADMAP Phase 3D-027)
 * ============================================================================
 * Adaptive subdivision of Bezier curves (quadratics and cubics) so maximum
 * geometric deviation from the true curve is <= tolerance.
 * Converts paths into closed polygonal rings, applies fill rules (even-odd and
 * non-zero) via polygon-clipping, and normalizes them into { outer, holes }[]
 * where outer rings are counter-clockwise and holes are clockwise.
 * ============================================================================
 */

import polygonClipping from "polygon-clipping";
import { BezPath, type Pt } from "../../geometry/bezpath";

export type Point2D = [number, number];
export type Ring = Point2D[];
export type FillRule = "nonzero" | "evenodd";

export interface NormalizedPolygon {
  outer: Ring;
  holes: Ring[];
}

/** Compute signed area using the shoelace formula. Positive is CCW, negative is CW. */
export function signedRingArea(ring: readonly Point2D[]): number {
  if (ring.length < 3) return 0;
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

/** The area of a ring (positive whichever way it turns). */
export function ringArea(ring: readonly Point2D[]): number {
  return Math.abs(signedRingArea(ring));
}

/** Ring orientation: "ccw" if signed area >= 0, otherwise "cw". */
export function ringOrientation(ring: readonly Point2D[]): "ccw" | "cw" {
  return signedRingArea(ring) >= 0 ? "ccw" : "cw";
}

/** Ensure a ring is closed (first point equals last point). */
export function closeRing(pts: readonly Point2D[]): Ring {
  if (pts.length === 0) return [];
  const out: Ring = pts.slice() as Ring;
  const [fx, fy] = out[0];
  const [lx, ly] = out[out.length - 1];
  if (fx !== lx || fy !== ly) {
    out.push([fx, fy]);
  }
  return out;
}

function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) {
    return Math.hypot(px - x0, py - y0);
  }
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function distToLine(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  if (l < 1e-12) return Math.hypot(px - x0, py - y0);
  return Math.abs((px - x0) * dy - (py - y0) * dx) / l;
}

/** Adaptively subdivide a quadratic Bezier segment so chord deviation <= tol. */
function subdivideQuad(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  tol: number,
  depth: number,
  out: Point2D[]
): void {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const l2 = dx * dx + dy * dy;

  let withinChord = true;
  if (l2 > 1e-12) {
    const t = ((p1.x - p0.x) * dx + (p1.y - p0.y) * dy) / l2;
    if (t < 0 || t > 1) withinChord = false;
  }

  const h = distToLine(p1.x, p1.y, p0.x, p0.y, p2.x, p2.y);
  const mx = 0.25 * p0.x + 0.5 * p1.x + 0.25 * p2.x;
  const my = 0.25 * p0.y + 0.5 * p1.y + 0.25 * p2.y;
  const midDev = distToSegment(mx, my, p0.x, p0.y, p2.x, p2.y);
  const dev = Math.max(0.5 * h, midDev);

  if ((withinChord && dev <= tol) || depth >= 18) {
    out.push([p2.x, p2.y]);
    return;
  }
  const p01: Pt = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
  const p12: Pt = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
  const mid: Pt = { x: (p01.x + p12.x) * 0.5, y: (p01.y + p12.y) * 0.5 };

  subdivideQuad(p0, p01, mid, tol, depth + 1, out);
  subdivideQuad(mid, p12, p2, tol, depth + 1, out);
}

/** Adaptively subdivide a cubic Bezier segment so chord deviation <= tol. */
function subdivideCubic(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  tol: number,
  depth: number,
  out: Point2D[]
): void {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const l2 = dx * dx + dy * dy;

  let withinChord = true;
  if (l2 > 1e-12) {
    const t1 = ((p1.x - p0.x) * dx + (p1.y - p0.y) * dy) / l2;
    const t2 = ((p2.x - p0.x) * dx + (p2.y - p0.y) * dy) / l2;
    if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) withinChord = false;
  }

  const h1 = distToLine(p1.x, p1.y, p0.x, p0.y, p3.x, p3.y);
  const h2 = distToLine(p2.x, p2.y, p0.x, p0.y, p3.x, p3.y);
  const flatness = Math.max(h1, h2);

  // Sample actual curve points: B(0.5), B(0.25), B(0.75)
  const mx = 0.125 * (p0.x + p3.x) + 0.375 * (p1.x + p2.x);
  const my = 0.125 * (p0.y + p3.y) + 0.375 * (p1.y + p2.y);
  const midDev = distToSegment(mx, my, p0.x, p0.y, p3.x, p3.y);

  const q1x = 0.421875 * p0.x + 0.421875 * p1.x + 0.140625 * p2.x + 0.015625 * p3.x;
  const q1y = 0.421875 * p0.y + 0.421875 * p1.y + 0.140625 * p2.y + 0.015625 * p3.y;
  const q1Dev = distToSegment(q1x, q1y, p0.x, p0.y, p3.x, p3.y);

  const q3x = 0.015625 * p0.x + 0.140625 * p1.x + 0.421875 * p2.x + 0.421875 * p3.x;
  const q3y = 0.015625 * p0.y + 0.140625 * p1.y + 0.421875 * p2.y + 0.421875 * p3.y;
  const q3Dev = distToSegment(q3x, q3y, p0.x, p0.y, p3.x, p3.y);

  const sampleDev = Math.max(midDev, q1Dev, q3Dev);
  const dev = Math.max(0.75 * flatness, sampleDev);

  if ((withinChord && dev <= tol) || depth >= 18) {
    out.push([p3.x, p3.y]);
    return;
  }
  const p01: Pt = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
  const p12: Pt = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
  const p23: Pt = { x: (p2.x + p3.x) * 0.5, y: (p2.y + p3.y) * 0.5 };
  const p012: Pt = { x: (p01.x + p12.x) * 0.5, y: (p01.y + p12.y) * 0.5 };
  const p123: Pt = { x: (p12.x + p23.x) * 0.5, y: (p12.y + p23.y) * 0.5 };
  const mid: Pt = { x: (p012.x + p123.x) * 0.5, y: (p012.y + p123.y) * 0.5 };

  subdivideCubic(p0, p01, p012, mid, tol, depth + 1, out);
  subdivideCubic(mid, p123, p23, p3, tol, depth + 1, out);
}

/** Winding number of a set of rings around (x, y). */
export function ringSetWinding(rings: readonly Ring[], x: number, y: number): number {
  let w = 0;
  for (const r of rings) {
    for (let i = 0; i + 1 < r.length; i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[i + 1];
      const side = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
      if (ay <= y) {
        if (by > y && side > 0) w++;
      } else if (by <= y && side < 0) {
        w--;
      }
    }
  }
  return w;
}

/** An interior point strictly inside a polygon, found via horizontal scanlines. */
function polygonInteriorPoint(poly: polygonClipping.Polygon): [number, number] | null {
  const outer = poly[0];
  if (!outer || outer.length < 4) return null;
  const ys = Array.from(new Set(poly.flat().map((p) => p[1]))).sort((a, b) => a - b);
  const gaps = ys.slice(1).map((y, i) => ({ y: (y + ys[i]) / 2, h: y - ys[i] })).sort((a, b) => b.h - a.h);
  for (const { y, h } of gaps) {
    if (h < 1e-9) break;
    const xs: number[] = [];
    for (const r of poly) {
      for (let i = 0; i + 1 < r.length; i++) {
        const [ax, ay] = r[i];
        const [bx, by] = r[i + 1];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
    }
    xs.sort((a, b) => a - b);
    let bestW = 0;
    let bestX = 0;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > bestW) {
        bestW = xs[i + 1] - xs[i];
        bestX = (xs[i] + xs[i + 1]) / 2;
      }
    }
    if (bestW > 1e-9) return [bestX, y];
  }
  return null;
}

/** Overlay rings to find non-overlapping faces. */
function overlayRings(rings: readonly Ring[]): polygonClipping.MultiPolygon {
  let faces: polygonClipping.MultiPolygon = [];
  let covered: polygonClipping.MultiPolygon = [];
  for (const r of rings) {
    const p: polygonClipping.MultiPolygon = [[[...r]]];
    const next: polygonClipping.MultiPolygon = [];
    for (const f of faces) {
      next.push(...polygonClipping.intersection([f], p), ...polygonClipping.difference([f], p));
    }
    next.push(...(covered.length ? polygonClipping.difference(p, covered) : p));
    faces = next;
    covered = covered.length ? polygonClipping.union(covered, p) : p;
  }
  return faces;
}

/**
 * Removes consecutive points that coincide (within a tiny tolerance of the ring's size). Arcs built next to straight
 * edges often repeat the joint (the same point twice, off by 1e-16); a zero-length edge has no direction, which
 * breaks offsets and bevels downstream.
 */
export function dedupeRing(ring: Ring): Ring {
  if (ring.length < 2) return ring;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const eps = Math.max(1e-9, 1e-7 * Math.max(maxX - minX, maxY - minY));
  const out: Ring = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  // keep the ring closed: the last point must equal the first
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) > eps) out.push([f[0], f[1]]);
    else out[out.length - 1] = [f[0], f[1]];
  }
  return out;
}

/**
 * Normalizes rings under the given fill rule into disjoint polygons with holes.
 * Guarantees outers are counter-clockwise (signed area > 0) and holes are clockwise (signed area < 0).
 */
export function normalizeRings(
  rings: readonly Ring[],
  rule: FillRule = "nonzero"
): NormalizedPolygon[] {
  const valid = rings
    .map(closeRing)
    .map(dedupeRing)
    .filter((r) => r.length >= 4 && ringArea(r) > 1e-9);

  if (valid.length === 0) return [];

  const polysAsMulti: polygonClipping.MultiPolygon[] = valid.map((r) => [[[...r]]]);

  let multi: polygonClipping.MultiPolygon;
  if (rule === "evenodd") {
    multi = valid.length === 1 ? polysAsMulti[0] : polygonClipping.xor(...(polysAsMulti as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]]));
  } else {
    const signs = valid.map((r) => Math.sign(signedRingArea(r)));
    if (signs.every((s) => s === signs[0])) {
      multi = valid.length === 1 ? polysAsMulti[0] : polygonClipping.union(...(polysAsMulti as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]]));
    } else {
      const faces = overlayRings(valid);
      const kept = faces.filter((f) => {
        const pt = polygonInteriorPoint(f);
        return pt !== null && ringSetWinding(valid, pt[0], pt[1]) !== 0;
      });
      multi = kept.length ? polygonClipping.union(...(kept.map((f) => [f]) as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]])) : [];
    }
  }

  const result: NormalizedPolygon[] = [];
  for (const poly of multi) {
    if (!poly || poly.length === 0) continue;
    let outer = closeRing(poly[0] as Point2D[]);
    if (ringArea(outer) < 1e-9) continue;
    // Outer rings must be counter-clockwise
    if (signedRingArea(outer) < 0) {
      outer = outer.slice().reverse();
    }
    const holes: Ring[] = [];
    for (let i = 1; i < poly.length; i++) {
      let hole = closeRing(poly[i] as Point2D[]);
      if (ringArea(hole) < 1e-9) continue;
      // Holes must be clockwise
      if (signedRingArea(hole) > 0) {
        hole = hole.slice().reverse();
      }
      holes.push(hole);
    }
    result.push({ outer, holes });
  }

  return result;
}

/**
 * Adaptively flattens BezPath curves into closed rings with deviation <= tolerance.
 * Resolves the fill rule and returns outer rings and holes with consistent winding.
 */
export function flattenPath(
  path: BezPath,
  tolerance = 0.1,
  rule: FillRule = "nonzero"
): Ring[] {
  const tol = Math.max(1e-4, tolerance);
  const rawRings: Ring[] = [];

  let currentPoints: Point2D[] = [];
  let pen: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };

  const finishRing = () => {
    if (currentPoints.length >= 3) {
      rawRings.push(closeRing(currentPoints));
    }
    currentPoints = [];
  };

  for (const el of path.els) {
    switch (el.t) {
      case "M":
        finishRing();
        pen = el.p;
        start = el.p;
        currentPoints.push([el.p.x, el.p.y]);
        break;
      case "L":
        pen = el.p;
        currentPoints.push([el.p.x, el.p.y]);
        break;
      case "Q":
        subdivideQuad(pen, el.p1, el.p2, tol, 0, currentPoints);
        pen = el.p2;
        break;
      case "C":
        subdivideCubic(pen, el.p1, el.p2, el.p3, tol, 0, currentPoints);
        pen = el.p3;
        break;
      case "Z":
        if (currentPoints.length > 0) {
          const [fx, fy] = currentPoints[0];
          if (pen.x !== fx || pen.y !== fy) {
            currentPoints.push([fx, fy]);
          }
        }
        pen = start;
        finishRing();
        break;
    }
  }
  finishRing();

  const normalized = normalizeRings(rawRings, rule);
  return normalized.flatMap((p) => [p.outer, ...p.holes]);
}
