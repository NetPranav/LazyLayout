"use client";

import React, { useEffect, useRef, useState } from "react";
import { nodesToPathData, type PathNode } from "@/core/paths/pathFit";
import { hitHandle, hitNode, hitSegment, insertNode, moveHandle, moveNodes, setClosed, toggleSmooth, type EditPath, type HandleSide } from "@/core/paths/pathEdit";
import { getDocument } from "@/core/store/documentState";
import { subscribeToDocumentChanges } from "@/core/store/useDocumentStore";
import { useDraftPathStore } from "@/core/store/useDraftPathStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { editablePathSelection, useVectorEditStore } from "@/core/store/useVectorEditStore";
import type { StageElement } from "../types";
import { AnchorMark } from "./AnchorMark";
import { commitPathEdit, deleteSelectedPoints, enterSelectedPathEdit, exitPathEdit, getDraftControls, registerBoxResolver } from "./penAdapter";

const HIT_PX = 8; // screen px around a point, handle or segment
const MOVE_SLOP_PX = 2;

type Drag =
  | { kind: "nodes"; start: { x: number; y: number }; base: EditPath; indices: number[]; moved: boolean }
  | { kind: "handle"; base: EditPath; index: number; side: HandleSide; moved: boolean };

export interface PathEditLayerProps {
  /** The artboard element the layer's coordinates are in. */
  containerRef: React.RefObject<HTMLElement | null>;
  elements: Record<string, StageElement>;
  /** The active canvas tool: the Anchor tool starts editing a path as soon as one is selected. */
  activeTool?: string;
  /** The artboard's zoom: marks keep their screen size. */
  zoom: number;
}

export const PathEditLayer: React.FC<PathEditLayerProps> = ({ containerRef, elements, activeTool, zoom }) => {
  const layerId = useVectorEditStore((s) => s.layerId);
  const nodes = useVectorEditStore((s) => s.nodes);
  const closed = useVectorEditStore((s) => s.closed);
  const selected = useVectorEditStore((s) => s.selected);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  });

  // where layers are: the stage measured them
  useEffect(
    () =>
      registerBoxResolver((id) => {
        const el = elementsRef.current[id];
        return el ? { cx: el.x + el.width / 2, cy: el.y + el.height / 2, w: el.width, h: el.height, rot: el.rotation ?? 0 } : null;
      }),
    [],
  );

  // the Anchor tool edits whatever path is selected (the dependency is the selection and the tool, not the mode: leaving the mode must not re-enter it)
  const selectedId = useSelectionStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  useEffect(() => {
    if (activeTool === "anchor" && selectedId && editablePathSelection() === selectedId && !useVectorEditStore.getState().layerId) enterSelectedPathEdit();
  }, [activeTool, selectedId]);

  // keyboard: Enter starts or ends editing, Escape ends it, Backspace and Delete remove the selected points
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const editing = useVectorEditStore.getState().layerId !== null;
      // a pen draft: Enter and Esc keep what is drawn (a lone point is dropped), Backspace takes back the last point
      const draft = useDraftPathStore.getState();
      const controls = draft.kind === "pen" ? getDraftControls() : null;
      if (controls) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (draft.nodes.length >= 2) controls.finish();
          else controls.cancel();
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          e.stopImmediatePropagation();
          controls.removeLast();
        }
        return;
      }
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (editing && (e.key === "Escape" || e.key === "Enter")) {
        stop();
        exitPathEdit();
      } else if (editing && (e.key === "Backspace" || e.key === "Delete")) {
        stop();
        deleteSelectedPoints();
      } else if (!editing && e.key === "Enter" && useDraftPathStore.getState().kind === null && editablePathSelection() !== null) {
        stop();
        enterSelectedPathEdit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // pointer gestures. They exist only while a path is being edited, and take the pointer only on a point, a handle or the outline: the middle of a layer stays the layer's.
  useEffect(() => {
    if (!layerId) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const store = useVectorEditStore;
    const metrics = () => {
      const r = el.getBoundingClientRect();
      const s = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
      return { r, s };
    };
    const worldOf = (e: { clientX: number; clientY: number }) => {
      const { r, s } = metrics();
      return { x: (e.clientX - r.left) / s - el.clientLeft, y: (e.clientY - r.top) / s - el.clientTop };
    };
    const tol = () => HIT_PX / (metrics().s || 1);
    const current = (): EditPath => ({ nodes: store.getState().nodes, closed: store.getState().closed });
    let drag: Drag | null = null;

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const w = worldOf(e);
      if (drag.kind === "nodes") {
        let dx = w.x - drag.start.x;
        let dy = w.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) * metrics().s < MOVE_SLOP_PX) return;
        drag.moved = true;
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        const next = moveNodes(drag.base, drag.indices, dx, dy);
        store.getState().set(next.nodes, next.closed);
      } else {
        drag.moved = true;
        const next = moveHandle(drag.base, drag.index, drag.side, w, e.altKey);
        store.getState().set(next.nodes, next.closed);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      const d = drag;
      drag = null;
      if (d?.moved) commitPathEdit(current());
    };
    const begin = (d: Drag) => {
      drag = d;
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement | null)?.closest?.("[data-pen-ui]")) return;
      const st = store.getState();
      const path = current();
      const w = worldOf(e);
      const take = () => {
        e.stopPropagation();
        e.preventDefault();
      };
      const handle = hitHandle(path, w, tol(), st.selected);
      if (handle) {
        take();
        begin({ kind: "handle", base: path, index: handle.index, side: handle.side, moved: false });
        return;
      }
      const node = hitNode(path, w, tol());
      if (node !== null) {
        take();
        const last = path.nodes.length - 1;
        // an end point clicked while the other end is the selection closes the path
        if (!path.closed && path.nodes.length > 2 && st.selected.length === 1 && ((node === 0 && st.selected[0] === last) || (node === last && st.selected[0] === 0))) {
          const done = setClosed(path, true);
          st.set(done.nodes, true, [node]);
          commitPathEdit(done);
          return;
        }
        let next = st.selected;
        if (e.shiftKey) next = next.includes(node) ? next.filter((i) => i !== node) : [...next, node];
        else if (!next.includes(node)) next = [node];
        st.select(next);
        if (next.includes(node)) begin({ kind: "nodes", start: w, base: path, indices: next, moved: false });
        return;
      }
      const seg = hitSegment(path, w, tol() * 0.75);
      if (seg) {
        take();
        const added = insertNode(path, seg.seg, seg.t);
        if (added.index >= 0) {
          st.set(added.path.nodes, added.path.closed, [added.index]);
          commitPathEdit(added.path);
          begin({ kind: "nodes", start: w, base: added.path, indices: [added.index], moved: false });
        }
        return;
      }
      // anywhere else the press belongs to the canvas (it selects or moves a layer): leave edit mode and let it through
      exitPathEdit();
    };

    const onDouble = (e: MouseEvent) => {
      const path = current();
      const node = hitNode(path, worldOf(e), tol());
      if (node === null) return;
      e.stopPropagation();
      e.preventDefault();
      const next = toggleSmooth(path, node);
      store.getState().set(next.nodes, next.closed, [node]);
      commitPathEdit(next);
    };

    const onHover = (e: PointerEvent) => {
      if (drag) {
        setHover(null);
        return;
      }
      const path = current();
      const w = worldOf(e);
      if (hitNode(path, w, tol()) !== null || hitHandle(path, w, tol(), store.getState().selected)) {
        setHover(null);
        return;
      }
      const seg = hitSegment(path, w, tol() * 0.75);
      setHover(seg ? insertPoint(path, seg.seg, seg.t) : null);
    };

    const onLeave = () => setHover(null);
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("dblclick", onDouble, true);
    el.addEventListener("pointermove", onHover);
    el.addEventListener("pointerleave", onLeave);
    // the selection moved to something else: leave
    const offSel = useSelectionStore.subscribe((s) => {
      if (s.selectedIds.length !== 1 || s.selectedIds[0] !== layerId) store.getState().exit();
    });
    // the layer is gone, or undo and redo changed it under the draft: leave
    const offDoc = subscribeToDocumentChanges((change) => {
      if (change.source === "undo" || change.source === "redo" || change.source === "history" || !getDocument().layers[layerId]) store.getState().exit();
    });
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("dblclick", onDouble, true);
      el.removeEventListener("pointermove", onHover);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      offSel();
      offDoc();
    };
  }, [layerId, containerRef]);

  if (!layerId) return null;
  const px = 1 / (zoom > 0 ? zoom : 1);
  const last = nodes.length - 1;
  const endSelected = !closed && nodes.length > 2 && selected.length === 1 && (selected[0] === 0 || selected[0] === last);
  const ringAt: PathNode | undefined = endSelected ? nodes[selected[0] === 0 ? last : 0] : undefined;

  return (
    <svg data-testid="path-edit" aria-hidden="true" className="ll:absolute ll:pointer-events-none" style={{ left: 0, top: 0, width: 1, height: 1, overflow: "visible", zIndex: 41 }}>
      <path d={nodesToPathData(nodes, closed)} fill="none" style={{ stroke: "var(--ll-pen-mark)", strokeWidth: 1.5 * px }} />
      {hover && <rect data-testid="path-insert-ghost" x={hover.x - 3 * px} y={hover.y - 3 * px} width={6 * px} height={6 * px} rx={px} style={{ fill: "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: px, opacity: 0.7 }} />}
      {selected.map((i) => {
        const n = nodes[i];
        if (!n) return null;
        return (
          <g key={`h${i}`} data-testid="path-handles">
            {n.hin && <line x1={n.x} y1={n.y} x2={n.hin.x} y2={n.hin.y} style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hout && <line x1={n.x} y1={n.y} x2={n.hout.x} y2={n.hout.y} style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hin && <circle data-testid="path-handle" cx={n.hin.x} cy={n.hin.y} r={3 * px} style={{ fill: "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
            {n.hout && <circle data-testid="path-handle" cx={n.hout.x} cy={n.hout.y} r={3 * px} style={{ fill: "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
          </g>
        );
      })}
      {ringAt && <circle data-testid="path-close-ring" cx={ringAt.x} cy={ringAt.y} r={7 * px} fill="none" style={{ stroke: "var(--ll-pen-mark)", strokeWidth: px }} />}
      {nodes.map((n, i) => (
        <AnchorMark key={i} x={n.x} y={n.y} px={px} selected={selected.includes(i)} delayIndex={i} />
      ))}
    </svg>
  );
};

/** The point at `t` on segment `seg`, for the "a point goes here" ghost: found by splitting the segment and reading the new point. */
function insertPoint(path: EditPath, seg: number, t: number): { x: number; y: number } | null {
  const r = insertNode(path, seg, t);
  const n = r.index >= 0 ? r.path.nodes[r.index] : null;
  return n ? { x: n.x, y: n.y } : null;
}
