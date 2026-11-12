/**
 * ============================================================================
 * BOOLEAN OPERATIONS ON RINGS (ROADMAP Phase 3D-027)
 * ============================================================================
 * Union, intersection, difference, and XOR between sets of polygon rings with
 * fill rules (non-zero and even-odd) evaluated independently for each operand.
 * Returns normalized outer rings (CCW) and holes (CW).
 * ============================================================================
 */

import polygonClipping from "polygon-clipping";
import {
  closeRing,
  normalizeRings,
  ringArea,
  signedRingArea,
  type FillRule,
  type NormalizedPolygon,
  type Ring,
} from "./flatten";

export type RingBoolOp = "union" | "intersect" | "difference" | "subtract" | "xor" | "exclude";

/** Convert a set of rings into polygon-clipping MultiPolygon under a fill rule. */
function ringsToMulti(rings: readonly Ring[], rule: FillRule = "nonzero"): polygonClipping.MultiPolygon {
  const norm = normalizeRings(rings, rule);
  if (norm.length === 0) return [];
  const multi: polygonClipping.MultiPolygon = [];
  for (const p of norm) {
    const poly: polygonClipping.Polygon = [p.outer, ...p.holes];
    multi.push(poly);
  }
  return multi;
}

/** Convert polygon-clipping MultiPolygon into NormalizedPolygon[] with consistent winding. */
function multiToNormalized(multi: polygonClipping.MultiPolygon): NormalizedPolygon[] {
  const out: NormalizedPolygon[] = [];
  for (const p of multi) {
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

/** Boolean operation between two ring sets returning NormalizedPolygon[]. */
export function booleanRingsPolygons(
  a: readonly Ring[],
  b: readonly Ring[],
  op: RingBoolOp,
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): NormalizedPolygon[] {
  const ra = ringsToMulti(a, ruleA);
  const rb = ringsToMulti(b, ruleB);

  let out: polygonClipping.MultiPolygon;
  switch (op) {
    case "union":
      out = ra.length && rb.length ? polygonClipping.union(ra, rb) : ra.length ? ra : rb;
      break;
    case "intersect":
      out = ra.length && rb.length ? polygonClipping.intersection(ra, rb) : [];
      break;
    case "difference":
    case "subtract":
      out = ra.length && rb.length ? polygonClipping.difference(ra, rb) : ra;
      break;
    case "xor":
    case "exclude":
      out = ra.length && rb.length ? polygonClipping.xor(ra, rb) : ra.length ? ra : rb;
      break;
  }

  return multiToNormalized(out);
}

/** Boolean operation between two ring sets returning flat Ring[]. */
export function booleanRings(
  a: readonly Ring[],
  b: readonly Ring[],
  op: RingBoolOp,
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): Ring[] {
  return booleanRingsPolygons(a, b, op, ruleA, ruleB).flatMap((p) => [p.outer, ...p.holes]);
}

/** Union of two ring sets. */
export function unionRings(
  a: readonly Ring[],
  b: readonly Ring[],
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): Ring[] {
  return booleanRings(a, b, "union", ruleA, ruleB);
}

/** Intersection of two ring sets. */
export function intersectRings(
  a: readonly Ring[],
  b: readonly Ring[],
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): Ring[] {
  return booleanRings(a, b, "intersect", ruleA, ruleB);
}

/** Difference of two ring sets (a minus b). */
export function differenceRings(
  a: readonly Ring[],
  b: readonly Ring[],
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): Ring[] {
  return booleanRings(a, b, "difference", ruleA, ruleB);
}

/** XOR / symmetric difference of two ring sets. */
export function xorRings(
  a: readonly Ring[],
  b: readonly Ring[],
  ruleA: FillRule = "nonzero",
  ruleB: FillRule = "nonzero"
): Ring[] {
  return booleanRings(a, b, "xor", ruleA, ruleB);
}
