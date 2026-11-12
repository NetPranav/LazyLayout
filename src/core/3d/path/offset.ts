/**
 * ============================================================================
 * POLYGON & RING OFFSET ENGINE (ROADMAP Phase 3D-027)
 * ============================================================================
 * Offsetting of 2D polygon rings with support for round, mitre, and bevel joins.
 * Positive delta grows outer contours and shrinks holes; negative delta shrinks
 * outer contours and expands holes.
 *
 * Implemented by offsetting each edge into a quad, connecting adjacent edges with
 * corner joins (arc fans, miter wedges, or bevel triangles), and resolving topology
 * with polygon-clipping union. Inward erosion is computed via complement dilation
 * to guarantee robust topological handling for arbitrary geometries and holes.
 * ============================================================================
 */

import polygonClipping from "polygon-clipping";
import {
  closeRing,
  normalizeRings,
  ringArea,
  signedRingArea,
  type NormalizedPolygon,
  type Point2D,
  type Ring,
} from "./flatten";

export interface OffsetOptions {
  join?: "round" | "mitre" | "bevel";
  miterLimit?: number;
  arcTolerance?: number;
}

/** Dilate a single simple counter-clockwise ring outward by delta > 0. */
function dilateSimpleRing(
  ring: readonly Point2D[],
  delta: number,
  opts: Required<OffsetOptions>
): polygonClipping.MultiPolygon {
  const closed = closeRing(ring);
  if (closed.length < 4 || ringArea(closed) < 1e-9) return [];

  // Guarantee CCW orientation for outward normal convention
  const ccw = signedRingArea(closed) >= 0 ? closed : closed.slice().reverse();
  const n = ccw.length - 1; // number of distinct vertices

  const quads: polygonClipping.MultiPolygon[] = [];
  const corners: polygonClipping.MultiPolygon[] = [];

  const normals: Point2D[] = [];
  const tangents: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      normals.push([0, 0]);
      tangents.push([0, 0]);
    } else {
      const tx = dx / len;
      const ty = dy / len;
      tangents.push([tx, ty]);
      // Right normal for CCW path points outward
      normals.push([ty, -tx]);
    }
  }

  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[i + 1];
    const norm = normals[i];
    if (norm[0] === 0 && norm[1] === 0) continue;

    const aOff: Point2D = [a[0] + norm[0] * delta, a[1] + norm[1] * delta];
    const bOff: Point2D = [b[0] + norm[0] * delta, b[1] + norm[1] * delta];

    const quadRing: Ring = [
      [a[0], a[1]],
      [b[0], b[1]],
      bOff,
      aOff,
      [a[0], a[1]],
    ];
    quads.push([[[...quadRing]]]);
  }

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const nPrev = normals[prevIdx];
    const nCurr = normals[i];
    const tPrev = tangents[prevIdx];
    const tCurr = tangents[i];
    const pt = ccw[i];

    // Cross product of tangents (or normals) to check turning direction
    const cross = tPrev[0] * tCurr[1] - tPrev[1] * tCurr[0];

    // Left turn (cross > 0) is a convex exterior corner needing a join
    if (cross > 1e-6) {
      const p1: Point2D = [pt[0] + nPrev[0] * delta, pt[1] + nPrev[1] * delta];
      const p2: Point2D = [pt[0] + nCurr[0] * delta, pt[1] + nCurr[1] * delta];

      if (opts.join === "bevel") {
        const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
        corners.push([[[...tri]]]);
      } else if (opts.join === "mitre") {
        const nAvg: Point2D = [nPrev[0] + nCurr[0], nPrev[1] + nCurr[1]];
        const avgLen = Math.hypot(nAvg[0], nAvg[1]);
        if (avgLen > 1e-4) {
          const m = 2 / (avgLen * avgLen);
          const miterRatio = 2 / avgLen;
          if (miterRatio <= opts.miterLimit) {
            const pm: Point2D = [pt[0] + nAvg[0] * delta * m, pt[1] + nAvg[1] * delta * m];
            const poly: Ring = [[pt[0], pt[1]], p1, pm, p2, [pt[0], pt[1]]];
            corners.push([[[...poly]]]);
          } else {
            // Miter limit exceeded: bevel join
            const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
            corners.push([[[...tri]]]);
          }
        } else {
          const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
          corners.push([[[...tri]]]);
        }
      } else {
        // "round" join: arc fan
        const th0 = Math.atan2(nPrev[1], nPrev[0]);
        const th1 = Math.atan2(nCurr[1], nCurr[0]);
        let sweep = th1 - th0;
        while (sweep < 0) sweep += 2 * Math.PI;

        const maxStepAngle = 2 * Math.sqrt(Math.max(1e-4, 2 * opts.arcTolerance / delta));
        const steps = Math.max(2, Math.ceil(sweep / maxStepAngle));

        const fan: Point2D[] = [[pt[0], pt[1]], p1];
        for (let s = 1; s < steps; s++) {
          const aAngle = th0 + (sweep * s) / steps;
          fan.push([pt[0] + Math.cos(aAngle) * delta, pt[1] + Math.sin(aAngle) * delta]);
        }
        fan.push(p2);
        fan.push([pt[0], pt[1]]);
        corners.push([[[...fan]]]);
      }
    }
  }

  const allPieces: polygonClipping.MultiPolygon[] = [[[[...ccw]]], ...quads, ...corners];
  return polygonClipping.union(...(allPieces as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]]));
}

/** Erode a simple counter-clockwise ring inward by delta > 0. */
function erodeSimpleRing(
  ring: readonly Point2D[],
  delta: number,
  opts: Required<OffsetOptions>
): polygonClipping.MultiPolygon {
  const closed = closeRing(ring);
  if (closed.length < 4 || ringArea(closed) < 1e-9) return [];

  // Guarantee CCW orientation for normal convention
  const ccw = signedRingArea(closed) >= 0 ? closed : closed.slice().reverse();
  const n = ccw.length - 1;

  const quads: polygonClipping.MultiPolygon[] = [];
  const corners: polygonClipping.MultiPolygon[] = [];

  const normals: Point2D[] = [];
  const tangents: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      normals.push([0, 0]);
      tangents.push([0, 0]);
    } else {
      const tx = dx / len;
      const ty = dy / len;
      tangents.push([tx, ty]);
      // Right normal for CCW path points outward (ty, -tx); inward normal is (-ty, tx)
      normals.push([-ty, tx]);
    }
  }

  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[i + 1];
    const norm = normals[i];
    if (norm[0] === 0 && norm[1] === 0) continue;

    const aOff: Point2D = [a[0] + norm[0] * delta, a[1] + norm[1] * delta];
    const bOff: Point2D = [b[0] + norm[0] * delta, b[1] + norm[1] * delta];

    const quadRing: Ring = [
      [a[0], a[1]],
      [b[0], b[1]],
      bOff,
      aOff,
      [a[0], a[1]],
    ];
    quads.push([[quadRing]] as unknown as polygonClipping.MultiPolygon);
  }

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const nPrev = normals[prevIdx];
    const nCurr = normals[i];
    const tPrev = tangents[prevIdx];
    const tCurr = tangents[i];
    const pt = ccw[i];

    // Cross product of tangents: for CCW ring, cross < 0 is a concave/reflex corner
    // where inward normals diverge and leave an un-eroded gap
    const cross = tPrev[0] * tCurr[1] - tPrev[1] * tCurr[0];

    if (cross < -1e-6) {
      const p1: Point2D = [pt[0] + nPrev[0] * delta, pt[1] + nPrev[1] * delta];
      const p2: Point2D = [pt[0] + nCurr[0] * delta, pt[1] + nCurr[1] * delta];

      if (opts.join === "bevel") {
        const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
        corners.push([[tri]] as unknown as polygonClipping.MultiPolygon);
      } else if (opts.join === "mitre") {
        const nAvg: Point2D = [nPrev[0] + nCurr[0], nPrev[1] + nCurr[1]];
        const avgLen = Math.hypot(nAvg[0], nAvg[1]);
        if (avgLen > 1e-4) {
          const m = 2 / (avgLen * avgLen);
          const miterRatio = 2 / avgLen;
          if (miterRatio <= opts.miterLimit) {
            const pm: Point2D = [pt[0] + nAvg[0] * delta * m, pt[1] + nAvg[1] * delta * m];
            const poly: Ring = [[pt[0], pt[1]], p1, pm, p2, [pt[0], pt[1]]];
            corners.push([[poly]] as unknown as polygonClipping.MultiPolygon);
          } else {
            const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
            corners.push([[tri]] as unknown as polygonClipping.MultiPolygon);
          }
        } else {
          const tri: Ring = [[pt[0], pt[1]], p1, p2, [pt[0], pt[1]]];
          corners.push([[tri]] as unknown as polygonClipping.MultiPolygon);
        }
      } else {
        // "round" fillet join
        const th0 = Math.atan2(nPrev[1], nPrev[0]);
        const th1 = Math.atan2(nCurr[1], nCurr[0]);
        let sweep = th1 - th0;
        while (sweep < 0) sweep += 2 * Math.PI;

        const maxStepAngle = 2 * Math.sqrt(Math.max(1e-4, (2 * opts.arcTolerance) / delta));
        const steps = Math.max(2, Math.ceil(sweep / maxStepAngle));

        const fan: Point2D[] = [[pt[0], pt[1]], p1];
        for (let s = 1; s < steps; s++) {
          const aAngle = th0 + (sweep * s) / steps;
          fan.push([pt[0] + Math.cos(aAngle) * delta, pt[1] + Math.sin(aAngle) * delta]);
        }
        fan.push(p2);
        fan.push([pt[0], pt[1]]);
        corners.push([[fan]] as unknown as polygonClipping.MultiPolygon);
      }
    }
  }

  const allBands = [...quads, ...corners];
  if (allBands.length === 0) return [[closeRing(ccw)]] as unknown as polygonClipping.MultiPolygon;

  const borderBand = polygonClipping.union(
    ...(allBands as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]])
  );

  const origMulti = [[closeRing(ccw)]] as unknown as polygonClipping.MultiPolygon;
  return polygonClipping.difference(origMulti, borderBand);
}

/** Offset a normalized polygon ({outer, holes}) by delta (+ grows, - shrinks). */
export function offsetPolygon(
  poly: NormalizedPolygon,
  delta: number,
  options?: OffsetOptions
): NormalizedPolygon[] {
  if (Math.abs(delta) < 1e-9) {
    return [poly];
  }

  const opts: Required<OffsetOptions> = {
    join: options?.join ?? "round",
    miterLimit: options?.miterLimit ?? 2,
    arcTolerance: options?.arcTolerance ?? 0.1,
  };

  let resultMulti: polygonClipping.MultiPolygon;

  if (delta > 0) {
    // Grow outer
    const grownOuter = dilateSimpleRing(poly.outer, delta, opts);
    if (grownOuter.length === 0) return [];

    if (poly.holes.length === 0) {
      resultMulti = grownOuter;
    } else {
      // Shrink each hole
      const shrunkHoleParts: polygonClipping.MultiPolygon[] = [];
      for (const hole of poly.holes) {
        const shrunk = erodeSimpleRing(hole, delta, opts);
        if (shrunk.length > 0) {
          shrunkHoleParts.push(shrunk);
        }
      }

      if (shrunkHoleParts.length === 0) {
        resultMulti = grownOuter;
      } else {
        const combinedHoles = polygonClipping.union(
          ...(shrunkHoleParts as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]])
        );
        resultMulti = polygonClipping.difference(grownOuter, combinedHoles);
      }
    }
  } else {
    // delta < 0: Shrink outer, grow holes
    const d = Math.abs(delta);
    const shrunkOuter = erodeSimpleRing(poly.outer, d, opts);
    if (shrunkOuter.length === 0) return [];

    if (poly.holes.length === 0) {
      resultMulti = shrunkOuter;
    } else {
      // Grow each hole
      const grownHoleParts: polygonClipping.MultiPolygon[] = [];
      for (const hole of poly.holes) {
        const grown = dilateSimpleRing(hole, d, opts);
        if (grown.length > 0) {
          grownHoleParts.push(grown);
        }
      }

      if (grownHoleParts.length === 0) {
        resultMulti = shrunkOuter;
      } else {
        const combinedHoles = polygonClipping.union(
          ...(grownHoleParts as [polygonClipping.MultiPolygon, ...polygonClipping.MultiPolygon[]])
        );
        resultMulti = polygonClipping.difference(shrunkOuter, combinedHoles);
      }
    }
  }

  const out: NormalizedPolygon[] = [];
  for (const p of resultMulti) {
    if (!p || p.length === 0) continue;
    let outer = closeRing(p[0]);
    if (ringArea(outer) < 1e-9) continue;
    if (signedRingArea(outer) < 0) outer = outer.slice().reverse();

    const holes: Ring[] = [];
    for (let i = 1; i < p.length; i++) {
      let h = closeRing(p[i]);
      if (ringArea(h) < 1e-9) continue;
      if (signedRingArea(h) > 0) h = h.slice().reverse();
      holes.push(h);
    }
    out.push({ outer, holes });
  }

  return out;
}

/**
 * Offsets a set of rings by delta.
 * Positive delta grows outer contours and shrinks holes;
 * Negative delta shrinks outer contours and grows holes.
 * Returns outer rings and holes with consistent winding.
 */
export function offsetRings(
  rings: readonly Ring[] | readonly NormalizedPolygon[],
  delta: number,
  options?: OffsetOptions
): Ring[] {
  if (rings.length === 0) return [];

  // Determine if input is NormalizedPolygon[] or Ring[]
  const isNorm = typeof (rings[0] as NormalizedPolygon).outer !== "undefined";
  const normalized: NormalizedPolygon[] = isNorm
    ? (rings as NormalizedPolygon[])
    : normalizeRings(rings as Ring[]);

  const results: NormalizedPolygon[] = [];
  for (const poly of normalized) {
    results.push(...offsetPolygon(poly, delta, options));
  }

  return results.flatMap((p) => [p.outer, ...p.holes]);
}
