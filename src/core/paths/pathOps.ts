/**
 * ============================================================================
 * PATH OPERATIONS ON BEZIER PATHS (FigCraft port, F3/F5)
 * ============================================================================
 * Booleans between whole paths with their fill rules (even-odd and non-zero), simplification of an overlapping
 * path into plain polygons, and the arrangement of several closed shapes into the faces their outlines cut the
 * plane into (what the Shape Builder and paint bucket pick from).
 *
 * FigCraft uses the `linesweeper` sweep-line library (`crates/pathops/src/lib.rs`). We keep the `polygon-clipping`
 * library Phase 40 already uses: curves are flattened (`geometry/measure.ts`, 0.05 px), polygons are combined, and a
 * non-zero path whose rings don't all turn the same way is resolved face by face by its winding number, so a ring
 * drawn as an outer contour and a reversed inner one stays a ring. The polygons are then turned back into pieces of
 * the input curves (`curveRefit.ts`, Phase 103), so results keep curves as curves.
 *
 * Behaviour translated from FigCraft (`crates/pathops/src/lib.rs`), commit 6ea44e9. MIT, Copyright (c) 2026
 * ArtCraft Team and the FigCraft contributors. See THIRD_PARTY_NOTICES.md.
 * ============================================================================
 */

import polygonClipping from "polygon-clipping";
import { BezPath } from "../geometry/bezpath";
import { MAX_SAMPLES, polylines } from "../geometry/measure";
import { refitCurves } from "./curveRefit";

type Ring = [number, number][];
type Polygon = Ring[];
type Multi = Polygon[];

export type FillRule = "nonzero" | "evenodd";
export type PathBoolOp = "union" | "subtract" | "intersect" | "exclude";

/** Booleans flatten curves finer than drawing does, so a result's edges sit within 0.002 px of the curves they came from. */
export const BOOLEAN_TOL = 0.002;

/**
 * The polygons a result was made from, kept by the result path's identity. A result used again (a face merged with its
 * neighbour, a boolean of a boolean) is then combined as those exact polygons: flattening its curves afresh would put
 * the points of a shared edge in slightly different places on each side, and the clipper fails on such near-misses.
 * A result path is not changed in place after it is returned.
 */
const polygonsOf = new WeakMap<BezPath, Multi>();
const curved = (region: Multi, inputs: readonly BezPath[]): BezPath => {
  const out = refitCurves(region, inputs);
  polygonsOf.set(out, region);
  return out;
};

/** Coordinates snapped to a grid of `1 / k` px. */
const snapped = (m: Multi, k: number): Multi => m.map((poly) => poly.map((ring) => ring.map(([x, y]) => [Math.round(x * k) / k, Math.round(y * k) / k] as [number, number])));

/**
 * Runs a clipper operation. The clipper can fail on edges that nearly coincide; when it does, the inputs are snapped
 * to a fine grid (1/1024 px, then 1/64 px), which makes near-misses exact, and it is tried again.
 */
function clip(op: (first: Multi, ...rest: Multi[]) => Multi, geoms: readonly Multi[]): Multi {
  const [first, ...rest] = geoms;
  try {
    return op(first, ...rest);
  } catch {
    for (const k of [1024, 64]) {
      try {
        const [f, ...r] = geoms.map((g) => snapped(g, k));
        return op(f, ...r);
      } catch {
        // try the coarser grid
      }
    }
    throw new Error("PATH_BOOLEAN_FAILED: the shapes could not be combined");
  }
}

/** The closed rings of a path: each subpath flattened and closed (open ones are closed by a straight line). */
export function pathRings(path: BezPath): Ring[] {
  const lines = polylines(path, MAX_SAMPLES * 4, BOOLEAN_TOL) ?? [];
  const out: Ring[] = [];
  for (const l of lines) {
    const pts = l.points.map((p) => [p.x, p.y] as [number, number]);
    if (pts.length < 3) continue;
    const [fx, fy] = pts[0];
    const [lx, ly] = pts[pts.length - 1];
    if (fx !== lx || fy !== ly) pts.push([fx, fy]);
    if (Math.abs(signedArea(pts)) < 1e-9) continue;
    out.push(pts);
  }
  return out;
}

function signedArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i + 1 < r.length; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return a / 2;
}

/** The winding number of a set of rings around a point. */
function windingOf(rings: readonly Ring[], x: number, y: number): number {
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

/** A point strictly inside a polygon (outer ring with holes), found on a horizontal scanline. */
export function interiorPoint(poly: Polygon): [number, number] | null {
  const outer = poly[0];
  if (!outer || outer.length < 4) return null;
  const ys = Array.from(new Set(poly.flat().map((p) => p[1]))).sort((a, b) => a - b);
  // try scanlines between consecutive vertex heights, widest gap first
  const gaps = ys.slice(1).map((y, i) => ({ y: (y + ys[i]) / 2, h: y - ys[i] })).sort((a, b) => b.h - a.h);
  for (const { y, h } of gaps) {
    if (h < 1e-9) break;
    const xs: number[] = [];
    for (const r of poly) {
      for (let i = 0; i + 1 < r.length; i++) {
        const [ax, ay] = r[i];
        const [bx, by] = r[i + 1];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
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

const asPolys = (rings: readonly Ring[]): Multi => rings.map((r) => [r]);

/** Splits rings into the faces of their arrangement: every region bounded by the rings' edges, each a polygon. */
function overlay(rings: readonly Ring[]): Multi {
  let faces: Multi = [];
  let covered: Multi = [];
  for (const r of rings) {
    const p: Multi = [[r]];
    const next: Multi = [];
    for (const f of faces) {
      next.push(...polygonClipping.intersection([f], p), ...polygonClipping.difference([f], p));
    }
    next.push(...(covered.length ? polygonClipping.difference(p, covered) : p));
    faces = next;
    covered = covered.length ? polygonClipping.union(covered, p) : p;
  }
  return faces;
}

/** The region a path fills under its fill rule, as plain polygons. */
export function pathRegion(path: BezPath, rule: FillRule): Multi {
  const made = polygonsOf.get(path);
  if (made) return made;
  const rings = pathRings(path);
  if (rings.length === 0) return [];
  if (rule === "evenodd") return rings.length === 1 ? asPolys(rings) : polygonClipping.xor(...(asPolys(rings).map((p) => [p]) as [Multi, ...Multi[]]));
  const signs = rings.map((r) => Math.sign(signedArea(r)));
  if (signs.every((s) => s === signs[0])) return rings.length === 1 ? asPolys(rings) : polygonClipping.union(...(asPolys(rings).map((p) => [p]) as [Multi, ...Multi[]]));
  // mixed orientation under non-zero: keep the faces whose winding isn't zero
  const kept = overlay(rings).filter((f) => {
    const q = interiorPoint(f);
    return q !== null && windingOf(rings, q[0], q[1]) !== 0;
  });
  return kept.length ? polygonClipping.union(...(kept.map((f) => [f]) as [Multi, ...Multi[]])) : [];
}

/** Polygons as a path: each ring a closed subpath (holes run as polygon-clipping returns them, which fills either way). */
export function regionToPath(region: Multi): BezPath {
  const out = new BezPath();
  for (const poly of region) {
    for (const ring of poly) {
      const pts = ring.slice(0, -1);
      if (pts.length < 3) continue;
      out.moveTo({ x: pts[0][0], y: pts[0][1] });
      for (const [x, y] of pts.slice(1)) out.lineTo({ x, y });
      out.closePath();
    }
  }
  return out;
}

/** The polygons a path fills (see `pathRegion`). */
export type Region = Multi;

/** Several regions as one: all of them united, intersected, or combined by exclusive or. */
export function mergeRegions(how: "union" | "intersect" | "exclude", regions: readonly Region[]): Region {
  if (regions.length === 0) return [];
  if (how === "intersect") {
    if (regions.some((r) => r.length === 0)) return [];
    return regions.length === 1 ? regions[0] : clip(polygonClipping.intersection, regions);
  }
  const full = regions.filter((r) => r.length > 0);
  if (full.length <= 1) return full[0] ?? [];
  return clip(how === "union" ? polygonClipping.union : polygonClipping.xor, full);
}

/** `a op b` on regions. */
export function combineRegions(a: Region, b: Region, op: PathBoolOp): Region {
  switch (op) {
    case "union":
      return a.length && b.length ? clip(polygonClipping.union, [a, b]) : a.length ? a : b;
    case "intersect":
      return a.length && b.length ? clip(polygonClipping.intersection, [a, b]) : [];
    case "subtract":
      return a.length && b.length ? clip(polygonClipping.difference, [a, b]) : a;
    case "exclude":
      return a.length && b.length ? clip(polygonClipping.xor, [a, b]) : a.length ? a : b;
  }
}

/** `a op b`, each read with its fill rule. The result fills the same under either rule. */
export function booleanPaths(a: BezPath, b: BezPath, op: PathBoolOp, ruleA: FillRule = "nonzero", ruleB: FillRule = "nonzero"): BezPath {
  const out = combineRegions(pathRegion(a, ruleA), pathRegion(b, ruleB), op);
  return curved(out, [a, b]);
}

/** A path's fill as plain, non-overlapping shapes (FigCraft `simplify`). */
export function simplifyPath(path: BezPath, rule: FillRule = "nonzero"): BezPath {
  return curved(pathRegion(path, rule), [path]);
}

/** One face of an arrangement: a connected area that the same set of inputs covers. */
export interface ArrangementFace {
  /** The face's outer contour and its holes (fills the same with either rule). */
  path: BezPath;
  /** Indices of the inputs covering the face, ascending. */
  cover: number[];
}

/** The most inputs `arrangementFaces` accepts, and the most faces it returns. */
export const MAX_ARRANGEMENT_INPUTS = 256;
const MAX_FACES = 4096;

/**
 * Splits the plane by the outlines of several closed shapes (each filled with its own rule) into faces: the
 * connected areas covered by the same inputs. Areas no input covers are left out; open subpaths are closed first.
 * Null for hostile input (too many shapes, non-finite coordinates).
 */
export function arrangementFaces(shapes: readonly { path: BezPath; evenOdd?: boolean }[]): ArrangementFace[] | null {
  if (shapes.length > MAX_ARRANGEMENT_INPUTS) return null;
  if (shapes.some((s) => polylines(s.path) === null)) return null;
  // every input is reduced to the plain polygons it fills first, so self-overlaps can't make faces overlap
  const inputs = shapes.map((s) => s.path);
  const regions = shapes.map((s) => pathRegion(s.path, s.evenOdd ? "evenodd" : "nonzero"));
  const rings: Ring[] = regions.flatMap((m) => m.flatMap((poly) => poly));
  if (rings.length === 0) return [];
  // overlay pieces, grouped by which inputs cover them
  const groups = new Map<string, { cover: number[]; pieces: Multi }>();
  for (const f of overlay(rings)) {
    const q = interiorPoint(f);
    if (!q) continue;
    const cover = regions.map((m, i) => (m.some((poly) => windingOf(poly, q[0], q[1]) % 2 !== 0) ? i : -1)).filter((i) => i >= 0);
    if (cover.length === 0) continue;
    const key = cover.join(",");
    const g = groups.get(key) ?? { cover, pieces: [] };
    g.pieces.push(f);
    groups.set(key, g);
  }
  // each group's pieces united: every resulting polygon is one connected face
  const out: ArrangementFace[] = [];
  for (const g of [...groups.values()].sort((a, b) => a.cover.join(",").localeCompare(b.cover.join(",")))) {
    const merged = g.pieces.length === 1 ? g.pieces : polygonClipping.union(...(g.pieces.map((p) => [p]) as [Multi, ...Multi[]]));
    for (const poly of merged) {
      out.push({ path: curved([poly], inputs), cover: g.cover });
      if (out.length >= MAX_FACES) return out;
    }
  }
  return out;
}

/** The union of several faces as one path (FigCraft `union_faces`). */
export function unionFaces(faces: readonly BezPath[]): BezPath {
  const regions = faces.map((f) => pathRegion(f, "nonzero")).filter((m) => m.length > 0);
  if (regions.length === 0) return new BezPath();
  return curved(mergeRegions("union", regions), faces);
}
