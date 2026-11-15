/**
 * Path operations on layers (ROADMAP Phase 106): offset, simplify, smooth, divide, knife, join and reverse, each one
 * undo step. Closed shapes (rectangles, ellipses, polygons, stars, closed paths, boolean groups) are read as the area
 * they fill on the canvas and replaced by the result, keeping their place and style (as the Shape Builder does). Open
 * paths are edited as their nodes. The maths is in `core/paths/pathTools.ts`.
 */

import type { Pt } from "../geometry/bezpath";
import { bezToSubPaths, subPathsToBez } from "../paths/bezBridge";
import { dividePaths, joinPaths, knifeCut, offsetPath, reversePath, simplifyCurves, smoothCurves } from "../paths/pathTools";
import type { StrokeJoin } from "../paths/strokes";
import { documentCommands, getDocument } from "../store/useDocumentStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { transaction } from "./editOps";
import { worldBox } from "./layerBoxes";
import { addShapeAbove, canReshape, eligible, layerCanvasArea, reshapeLayer } from "./shapeBuilder";
import { applyPathEdit, editablePath } from "./vectorOps";

const layers = () => getDocument().layers;

/** An open path layer's single subpath on the canvas, with its box; null for anything else. */
function openPath(id: string) {
  const l = layers()[id];
  const box = l ? worldBox(id) : null;
  if (!l || !box || l.locked === true || l.visible === false) return null;
  const sub = editablePath(l, box);
  return sub && !sub.closed ? { sub, box } : null;
}

/** Applies `op` to each closed shape's canvas area (and, if `open` is given, to each open path). Returns the ids changed. */
function eachShape(label: string, ids: readonly string[], closedOp: ((area: ReturnType<typeof layerCanvasArea> & object) => import("../geometry/bezpath").BezPath | null) | null, openOp?: (path: import("../geometry/bezpath").BezPath) => import("../geometry/bezpath").BezPath | null): string[] {
  const changed: string[] = [];
  transaction(label, () => {
    for (const id of ids) {
      const open = openOp ? openPath(id) : null;
      if (open && openOp) {
        const out = openOp(subPathsToBez([open.sub]));
        const sub = out ? bezToSubPaths(out)[0] : null;
        if (sub && sub.nodes.length >= 2 && applyPathEdit(id, open.box, sub.nodes, sub.closed)) changed.push(id);
        continue;
      }
      if (!closedOp || !canReshape(id)) continue;
      const area = layerCanvasArea(id);
      if (!area) continue;
      const out = closedOp(area);
      if (!out || out.isEmpty()) continue;
      const holder = reshapeLayer(id, out);
      if (holder) changed.push(holder);
    }
    if (changed.length) useSelectionStore.getState().selectMultiple(changed, "element");
  });
  return changed;
}

/** Grows (`distance` > 0) or shrinks each shape by a distance. A shape shrunk to nothing is left as it was. */
export function offsetLayers(ids: readonly string[], distance: number, join: StrokeJoin = "round"): string[] {
  return eachShape("Offset path", eligible(ids), (a) => offsetPath(a.path, distance, join, 4, a.evenOdd ? "evenodd" : "nonzero"));
}

/** Fewer points, within a tolerance that grows with `strength` (0 to 1). Works on open paths too. */
export function simplifyLayers(ids: readonly string[], strength: number): string[] {
  return eachShape("Simplify path", ids, (a) => simplifyCurves(a.path, strength), (p) => simplifyCurves(p, strength));
}

/** Smoother outlines: corners rounded and wobbles averaged out as `strength` (0 to 1) grows. Works on open paths too. */
export function smoothLayers(ids: readonly string[], strength: number): string[] {
  return eachShape("Smooth path", ids, (a) => smoothCurves(a.path, strength), (p) => smoothCurves(p, strength));
}

/** Draws each path the other way round (where it starts and which way it winds). */
export function reverseLayers(ids: readonly string[]): string[] {
  return eachShape("Reverse path", ids, (a) => reversePath(a.path), (p) => reversePath(p));
}

/**
 * Cuts the shapes `ids` apart where they overlap: every piece becomes a layer of its own, styled like the top-most
 * shape over it, and the shapes are removed. Returns the pieces (empty when fewer than two shapes overlap).
 */
export function divideLayers(ids: readonly string[]): string[] {
  const src = eligible(ids).filter((id) => layerCanvasArea(id));
  if (src.length < 2) return [];
  const pieces = dividePaths(src.map((id) => {
    const a = layerCanvasArea(id)!;
    return { path: a.path, evenOdd: a.evenOdd };
  }));
  if (!pieces || pieces.length <= src.length) return [];
  const made: string[] = [];
  transaction("Divide", () => {
    // bottom pieces first, each above the top-most shape covering it, so the stacking stays as it looked
    for (const piece of pieces) {
      const top = src[piece.cover[piece.cover.length - 1]];
      const id = addShapeAbove(top, piece.path);
      if (id) made.push(id);
    }
    for (const id of src) if (layers()[id]) documentCommands.removeLayer(id, "Divide");
    useSelectionStore.getState().selectMultiple(made, "element");
  });
  return made;
}

/**
 * Cuts each closed shape that the knife line (canvas points) crosses. The first piece keeps the layer; the others
 * become layers just above it, in the same style. Returns every layer that holds a piece.
 */
export function knifeLayers(ids: readonly string[], knife: readonly Pt[]): string[] {
  const out: string[] = [];
  const pts = knife.slice(0, 10_000);
  transaction("Knife", () => {
    for (const id of eligible(ids)) {
      const area = layerCanvasArea(id);
      if (!area) continue;
      const pieces = knifeCut(area.path, pts, area.evenOdd ? "evenodd" : "nonzero");
      if (!pieces) continue;
      const holder = reshapeLayer(id, pieces[0]);
      if (!holder) continue;
      out.push(holder);
      for (const p of pieces.slice(1).reverse()) {
        const extra = addShapeAbove(holder, p);
        if (extra) out.push(extra);
      }
    }
    if (out.length) useSelectionStore.getState().selectMultiple(out, "element");
  });
  return out;
}

/** Joins two open path layers into the first one at their nearest ends (closing it if the other ends meet too). */
export function joinLayers(ids: readonly string[]): string | null {
  if (ids.length !== 2) return null;
  const a = openPath(ids[0]);
  const b = openPath(ids[1]);
  if (!a || !b) return null;
  const joined = joinPaths(subPathsToBez([a.sub]), subPathsToBez([b.sub]));
  const sub = joined ? bezToSubPaths(joined)[0] : null;
  if (!sub) return null;
  let ok = false;
  transaction("Join paths", () => {
    ok = applyPathEdit(ids[0], a.box, sub.nodes, sub.closed);
    if (ok) documentCommands.removeLayer(ids[1], "Join paths");
  });
  if (ok) useSelectionStore.getState().selectMultiple([ids[0]], "element");
  return ok ? ids[0] : null;
}
