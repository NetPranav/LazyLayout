/**
 * ADAPTER: the Pen and Vector UI's only door to the engine.
 *
 * Everything here is built on what `src/core` already has (`useVectorEditStore`, `pathEdit`, `vectorOps`, `createPath`,
 * the document commands), read-only. Where the engine has no operation, this file does it locally and says so:
 *
 *   ADAPTER-ONLY (no engine command; each one is a single undo step, written through `applyPathEdit` or `transaction`):
 *     - point type (Straight / Mirrored / Free): derived from the handles, since a node stores no type
 *     - round corners: a one-shot edit of the nodes, not a live corner-radius property (a path has none)
 *     - join two open paths: composed from `createPathLayer` and `deleteLayers`
 *   WIRED (an engine command or store exists): enter/leave path edit, move/insert/delete points, close, fill rule,
 *     the four boolean operations, and finishing/closing/undoing a pen draft (through the Stage's own draft state).
 *
 * Missing engine needs are listed in DOCS/UI/INTEGRATION.md under "Pen and vector".
 */

import { applyPathEdit, booleanLayers, editablePath, type LayerBox } from "@/core/editing/vectorOps";
import { deleteLayers, setLayerProps, transaction } from "@/core/editing/editOps";
import type { BooleanOp } from "@/core/paths/booleans";
import { createPathLayer, type PathStyle } from "@/core/paths/createPath";
import { deleteNodes, setClosed, toggleSmooth, type EditPath } from "@/core/paths/pathEdit";
import type { PathNode } from "@/core/paths/pathFit";
import { getDocument } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { editablePathSelection, useVectorEditStore } from "@/core/store/useVectorEditStore";

export type PointType = "straight" | "mirrored" | "free";
export type FillRule = "nonzero" | "evenodd";

// --- the stage hands in where layers are -----------------------------------------------------------------------

type BoxResolver = (id: string) => LayerBox | null;
let resolver: BoxResolver | null = null;

/** The stage registers how to find a layer's box on the canvas (it measures the page; the engine does not). Returns the unregister function. */
export function registerBoxResolver(fn: BoxResolver): () => void {
  resolver = fn;
  return () => {
    if (resolver === fn) resolver = null;
  };
}

export const boxOfLayer = (id: string): LayerBox | null => resolver?.(id) ?? null;

// --- the stage hands in the pen draft's controls ----------------------------------------------------------------

export interface DraftControls {
  /** Finishes the draft as an open path (or as drawn). */
  finish: () => void;
  /** Drops the draft. */
  cancel: () => void;
  /** Closes the draft on its first point. */
  close: () => void;
  /** Takes back the last point. */
  removeLast: () => void;
}

let draftControls: DraftControls | null = null;

export function registerDraftControls(c: DraftControls): () => void {
  draftControls = c;
  return () => {
    if (draftControls === c) draftControls = null;
  };
}

let finishedAt = 0;
/** Called when a pen draft becomes a layer; the click that ends the gesture must not deselect it. */
export const markPenFinished = (): void => {
  finishedAt = Date.now();
};
export const penJustFinished = (): boolean => Date.now() - finishedAt < 400;

export const getDraftControls = (): DraftControls | null => draftControls;

// --- path edit mode ---------------------------------------------------------------------------------------------

/** Starts editing a path layer point by point. False when it cannot be edited (a compound path, a locked layer, nothing measured yet). */
export function enterPathEdit(id: string): boolean {
  const layer = getDocument().layers[id];
  const box = boxOfLayer(id);
  if (!layer || !box || layer.locked === true) return false;
  const sub = editablePath(layer, box);
  if (!sub) return false;
  useSelectionStore.getState().select(id, "element");
  useVectorEditStore.getState().enter(id, sub.nodes, sub.closed, box);
  return true;
}

/** Enters edit mode for the selected path, trying again for a moment when the layer was only just made and not measured. */
export function enterSelectedPathEdit(): void {
  const id = editablePathSelection();
  if (!id || enterPathEdit(id)) return;
  let tries = 0;
  const again = () => {
    if (useSelectionStore.getState().selectedIds[0] !== id || useVectorEditStore.getState().layerId) return;
    if (!enterPathEdit(id) && ++tries < 20) window.setTimeout(again, 50);
  };
  window.setTimeout(again, 50);
}

export const exitPathEdit = (): void => useVectorEditStore.getState().exit();

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Writes the edited nodes to the layer (one undo step) and moves the stored box to the layer's new frame. */
export function commitPathEdit(path: EditPath): boolean {
  const st = useVectorEditStore.getState();
  if (!st.layerId || !st.box) return false;
  const layer = getDocument().layers[st.layerId];
  if (!layer) return false;
  const origin = { x: st.box.cx - st.box.w / 2 - num(layer.properties["frame.x"]), y: st.box.cy - st.box.h / 2 - num(layer.properties["frame.y"]) };
  if (!applyPathEdit(st.layerId, st.box, path.nodes, path.closed)) return false;
  const next = getDocument().layers[st.layerId];
  if (!next) return false;
  const w = num(next.properties["frame.width"]);
  const h = num(next.properties["frame.height"]);
  st.setBox({ cx: origin.x + num(next.properties["frame.x"]) + w / 2, cy: origin.y + num(next.properties["frame.y"]) + h / 2, w, h, rot: st.box.rot });
  return true;
}

const current = (): EditPath => {
  const st = useVectorEditStore.getState();
  return { nodes: st.nodes, closed: st.closed };
};

/** Delete point: removes the selected points. A path left with fewer than two points is deleted with its layer. */
export function deleteSelectedPoints(): void {
  const st = useVectorEditStore.getState();
  if (!st.layerId || st.selected.length === 0) return;
  const next = deleteNodes(current(), st.selected);
  if (next.nodes.length < 2) {
    const id = st.layerId;
    st.exit();
    deleteLayers([id]);
    return;
  }
  st.set(next.nodes, next.closed, []);
  commitPathEdit(next);
}

/** Close path: joins the last point to the first. Needs three points. */
export function closeEditedPath(): void {
  const path = current();
  if (path.closed || path.nodes.length < 3) return;
  const closed = setClosed(path, true);
  useVectorEditStore.getState().set(closed.nodes, true);
  commitPathEdit(closed);
}

// --- point type (adapter-only) ----------------------------------------------------------------------------------

/** What a point is, read from its handles: no handles is Straight, two opposite equal ones Mirrored, anything else Free. */
export function pointTypeOf(n: PathNode): PointType {
  if (!n.hin && !n.hout) return "straight";
  if (n.hin && n.hout) {
    const a = { x: n.hin.x - n.x, y: n.hin.y - n.y };
    const b = { x: n.hout.x - n.x, y: n.hout.y - n.y };
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    const opposite = la > 1e-9 && lb > 1e-9 && Math.abs((a.x * b.y - a.y * b.x) / (la * lb)) < 0.02 && a.x * b.x + a.y * b.y < 0;
    if (opposite && Math.abs(la - lb) / Math.max(la, lb) < 0.01) return "mirrored";
  }
  return "free";
}

/** The type shared by the points at `indices`, or null when they differ (or there are none). */
export function sharedPointType(nodes: readonly PathNode[], indices: readonly number[]): PointType | null {
  const types = new Set(indices.map((i) => (nodes[i] ? pointTypeOf(nodes[i]) : null)));
  return types.size === 1 ? ([...types][0] as PointType | null) : null;
}

function withType(path: EditPath, index: number, type: PointType): EditPath {
  const n = path.nodes[index];
  if (!n) return path;
  const patch = (node: PathNode): EditPath => ({ ...path, nodes: path.nodes.map((m, i) => (i === index ? node : m)) });
  if (type === "straight") {
    const { hin: _a, hout: _b, ...rest } = n;
    void _a;
    void _b;
    return patch(rest);
  }
  const p = n.hin || n.hout ? path : toggleSmooth(path, index);
  const m = p.nodes[index];
  const hin = m.hin;
  const hout = m.hout;
  const out = hout ?? (hin ? { x: 2 * m.x - hin.x, y: 2 * m.y - hin.y } : undefined);
  if (!out) return p;
  if (type === "mirrored") {
    const v = { x: out.x - m.x, y: out.y - m.y };
    const mirrored: PathNode = { ...m, hout: { x: m.x + v.x, y: m.y + v.y }, hin: { x: m.x - v.x, y: m.y - v.y } };
    return { ...p, nodes: p.nodes.map((q, i) => (i === index ? mirrored : q)) };
  }
  // free: the two handles become independent, so a pair that was mirrored gets a shorter incoming handle
  const next = pointTypeOf(m) === "mirrored" && hin ? { ...m, hin: { x: m.x + (hin.x - m.x) * 0.7, y: m.y + (hin.y - m.y) * 0.7 } } : m;
  return { ...p, nodes: p.nodes.map((q, i) => (i === index ? next : q)) };
}

/** Applies a point type to the selected points of the path being edited (one undo step). */
export function setSelectedPointType(type: PointType): void {
  const st = useVectorEditStore.getState();
  if (!st.layerId || st.selected.length === 0) return;
  let path = current();
  for (const i of st.selected) path = withType(path, i, type);
  st.set(path.nodes, path.closed);
  commitPathEdit(path);
}

// --- round corners (adapter-only) -------------------------------------------------------------------------------

const KAPPA = 0.5523;

/** Replaces each sharp corner between two straight segments by a short curve of about `radius`. Ends of an open path stay. */
export function roundCornerNodes(path: EditPath, radius: number): EditPath {
  const { nodes, closed } = path;
  const n = nodes.length;
  if (radius <= 0 || n < 3) return path;
  const out: PathNode[] = [];
  nodes.forEach((node, i) => {
    const prev = i > 0 ? nodes[i - 1] : closed ? nodes[n - 1] : null;
    const next = i < n - 1 ? nodes[i + 1] : closed ? nodes[0] : null;
    const sharp = !node.hin && !node.hout;
    if (!prev || !next || !sharp || prev.hout || next.hin) {
      out.push(node);
      return;
    }
    const dp = Math.hypot(prev.x - node.x, prev.y - node.y);
    const dn = Math.hypot(next.x - node.x, next.y - node.y);
    if (dp < 1e-6 || dn < 1e-6) {
      out.push(node);
      return;
    }
    const r1 = Math.min(radius, dp / 2);
    const r2 = Math.min(radius, dn / 2);
    const a = { x: node.x + ((prev.x - node.x) / dp) * r1, y: node.y + ((prev.y - node.y) / dp) * r1 };
    const b = { x: node.x + ((next.x - node.x) / dn) * r2, y: node.y + ((next.y - node.y) / dn) * r2 };
    out.push({ x: a.x, y: a.y, hout: { x: a.x + (node.x - a.x) * KAPPA, y: a.y + (node.y - a.y) * KAPPA } });
    out.push({ x: b.x, y: b.y, hin: { x: b.x + (node.x - b.x) * KAPPA, y: b.y + (node.y - b.y) * KAPPA } });
  });
  return { nodes: out, closed };
}

/** How many points rounding would add (0 when the path has no sharp corner between straight segments). */
export function roundableCorners(layerId: string): number {
  const layer = getDocument().layers[layerId];
  const box = boxOfLayer(layerId);
  const sub = layer && box ? editablePath(layer, box) : null;
  return sub ? roundCornerNodes(sub, 1).nodes.length - sub.nodes.length : 0;
}

/** Rounds the corners of a path layer (one undo step). Returns false when nothing changed. */
export function roundPathCorners(layerId: string, radius: number): boolean {
  const layer = getDocument().layers[layerId];
  const box = boxOfLayer(layerId);
  const sub = layer && box ? editablePath(layer, box) : null;
  if (!sub) return false;
  const next = roundCornerNodes(sub, radius);
  if (next.nodes.length === sub.nodes.length) return false;
  const editing = useVectorEditStore.getState().layerId === layerId;
  if (editing) {
    useVectorEditStore.getState().set(next.nodes, next.closed, []);
    return commitPathEdit(next);
  }
  return applyPathEdit(layerId, box as LayerBox, next.nodes, next.closed);
}

// --- fill rule and booleans (wired) -----------------------------------------------------------------------------

/** `svg.fillRule` is a real property of path layers: written through the document commands. */
export const setFillRule = (ids: readonly string[], rule: FillRule): void => void setLayerProps(ids, { "svg.fillRule": rule }, "Fill rule");

/** Union, subtract, intersect or exclude the selected vector layers into one new path layer. Returns its id, or null. */
export function combineSelection(op: BooleanOp, ids: readonly string[]): string | null {
  const id = booleanLayers(op, ids, boxOfLayer);
  if (id) useSelectionStore.getState().select(id, "element");
  return id;
}

// --- join (adapter-only) ----------------------------------------------------------------------------------------

const reversed = (nodes: readonly PathNode[]): PathNode[] =>
  [...nodes].reverse().map((n) => {
    const { hin, hout, ...rest } = n;
    return { ...rest, ...(hout ? { hin: hout } : {}), ...(hin ? { hout: hin } : {}) };
  });

const dist = (a: PathNode, b: PathNode) => Math.hypot(a.x - b.x, a.y - b.y);

/** The ids among `ids` that are open, editable path layers. */
export function openPathLayers(ids: readonly string[]): string[] {
  return ids.filter((id) => {
    const layer = getDocument().layers[id];
    const box = boxOfLayer(id);
    const sub = layer && box ? editablePath(layer, box) : null;
    return !!sub && !sub.closed;
  });
}

/** Joins two open paths end to end into one new path layer (the first one's look), replacing both. One undo step. Returns the new id, or null. */
export function joinOpenPaths(a: string, b: string): string | null {
  const docA = getDocument().layers[a];
  const docB = getDocument().layers[b];
  const boxA = boxOfLayer(a);
  const boxB = boxOfLayer(b);
  if (!docA || !docB || !boxA || !boxB || docA.parentId === null) return null;
  const pa = editablePath(docA, boxA);
  const pb = editablePath(docB, boxB);
  if (!pa || !pb || pa.closed || pb.closed) return null;
  // join the closest pair of ends: put them in order A..., B...
  const aEnd = pa.nodes[pa.nodes.length - 1];
  const aStart = pa.nodes[0];
  const bStart = pb.nodes[0];
  const bEnd = pb.nodes[pb.nodes.length - 1];
  const options = [
    { first: pa.nodes, second: pb.nodes, d: dist(aEnd, bStart) },
    { first: pa.nodes, second: reversed(pb.nodes), d: dist(aEnd, bEnd) },
    { first: reversed(pa.nodes), second: pb.nodes, d: dist(aStart, bStart) },
    { first: reversed(pa.nodes), second: reversed(pb.nodes), d: dist(aStart, bEnd) },
  ].sort((x, y) => x.d - y.d)[0];
  const tail = options.first[options.first.length - 1];
  const head = options.second[0];
  const merged: PathNode[] =
    options.d < 0.5
      ? [...options.first.slice(0, -1), { ...tail, ...(head.hout ? { hout: head.hout } : {}) }, ...options.second.slice(1)]
      : [...options.first, ...options.second];
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v !== "" ? v : fallback);
  const style: PathStyle = {
    stroke: str(docA.properties["svg.stroke"], "#0f172a"),
    strokeWidth: num(docA.properties["svg.strokeWidth"]) || 2,
    cap: (["butt", "round", "square"].includes(String(docA.properties["svg.strokeLinecap"])) ? docA.properties["svg.strokeLinecap"] : "butt") as PathStyle["cap"],
    join: (["miter", "round", "bevel"].includes(String(docA.properties["svg.strokeLinejoin"])) ? docA.properties["svg.strokeLinejoin"] : "miter") as PathStyle["join"],
    fill: "#cbd5e1",
  };
  const origin = { x: boxA.cx - boxA.w / 2 - num(docA.properties["frame.x"]), y: boxA.cy - boxA.h / 2 - num(docA.properties["frame.y"]) };
  let created: string | null = null;
  transaction("Join paths", () => {
    created = createPathLayer(merged, false, { id: docA.parentId as string, origin }, style, docA.name);
    if (created) deleteLayers([a, b]);
  });
  if (created) useSelectionStore.getState().select(created, "element");
  return created;
}

/**
 * Join, from path edit mode: the open path (another layer) whose end lies within `reach` canvas px of the selected end
 * point of the path being edited. Null when no end point is selected or nothing is that close.
 */
export function joinNeighbour(reach = 40): string | null {
  const st = useVectorEditStore.getState();
  if (!st.layerId || st.closed || st.selected.length !== 1) return null;
  const i = st.selected[0];
  const last = st.nodes.length - 1;
  if (i !== 0 && i !== last) return null;
  const end = st.nodes[i];
  let best: { id: string; d: number } | null = null;
  for (const layer of Object.values(getDocument().layers)) {
    if (layer.id === st.layerId || layer.archetype !== "svgPath" || layer.locked === true) continue;
    const box = boxOfLayer(layer.id);
    const sub = box ? editablePath(layer, box) : null;
    if (!sub || sub.closed || sub.nodes.length < 2) continue;
    const d = Math.min(dist(end, sub.nodes[0]), dist(end, sub.nodes[sub.nodes.length - 1]));
    if (d <= reach && (!best || d < best.d)) best = { id: layer.id, d };
  }
  return best?.id ?? null;
}

/** Joins the path being edited to its neighbour (see `joinNeighbour`), then carries on editing the joined path. */
export function joinEditedPath(): void {
  const id = useVectorEditStore.getState().layerId;
  const other = joinNeighbour();
  if (!id || !other) return;
  const joined = joinOpenPaths(id, other);
  if (joined) enterSelectedPathEdit();
}
