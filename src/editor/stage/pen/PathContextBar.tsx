"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/editor/components/Button";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { useMounted } from "@/editor/components/useMounted";
import { springAnim, cancelAll } from "@/editor/motion/ease";
import { getActivePreset } from "@/editor/motion/feel";
import { isMotionOff } from "@/editor/motion/reducedMotion";
import { useDraftPathStore } from "@/core/store/useDraftPathStore";
import { useVectorEditStore } from "@/core/store/useVectorEditStore";
import { closeEditedPath, deleteSelectedPoints, exitPathEdit, getDraftControls, joinEditedPath, joinNeighbour, setSelectedPointType, sharedPointType, type PointType } from "./penAdapter";
import "../stage.css";

const BAR_TOP_GAP_PX = 12;
const SLIDE_OFFSET_PX = 12;
const HIDE_DURATION_MS = 110;

const POINT_TYPES: ReadonlyArray<{ value: PointType; label: string; title: string }> = [
  { value: "straight", label: "Straight", title: "Straight: no handles" },
  { value: "mirrored", label: "Mirrored", title: "Mirrored: two equal, opposite handles" },
  { value: "free", label: "Free", title: "Free: the two handles move on their own" },
];

/**
 * The context bar at the top of the canvas while a path is drafted (pen) or edited point by point. Same surface as the
 * text format bar. Nothing is in the page until a path is being worked on; it slides in on the shared spring and out
 * on a short fade (and does neither with motion off). After its first use it stays in the page, hidden.
 */
export const PathContextBar: React.FC = () => {
  const mounted = useMounted();
  const barRef = useRef<HTMLDivElement | null>(null);
  const draftCount = useDraftPathStore((s) => (s.kind === "pen" ? s.nodes.length : 0));
  const editing = useVectorEditStore((s) => s.layerId !== null);
  const nodes = useVectorEditStore((s) => s.nodes);
  const closed = useVectorEditStore((s) => s.closed);
  const selected = useVectorEditStore((s) => s.selected);
  const active = draftCount > 0 || editing;
  const [rendered, setRendered] = useState(false);
  if (active && !rendered) setRendered(true);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !rendered) return;
    cancelAll(bar);
    if (active) {
      const place = () => {
        const host = document.querySelector<HTMLElement>('[data-stage="workspace"]');
        const r = host?.getBoundingClientRect();
        if (!r) return;
        bar.style.left = `${Math.round(r.left + r.width / 2 - bar.offsetWidth / 2)}px`;
        bar.style.top = `${Math.round(r.top + BAR_TOP_GAP_PX)}px`;
      };
      bar.style.display = "flex";
      place();
      const m = getActivePreset();
      springAnim(bar, [{ opacity: 0, translate: `0 -${SLIDE_OFFSET_PX}px` }, { opacity: 1, translate: "0 0" }], m.pop[0], m.pop[1]);
      window.addEventListener("resize", place);
      return () => window.removeEventListener("resize", place);
    }
    if (isMotionOff()) {
      bar.style.display = "none";
      return;
    }
    const anim = bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HIDE_DURATION_MS, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => {
      bar.style.display = "none";
    };
  }, [active, rendered]);

  if (!mounted || !rendered) return null;

  const draft = draftCount > 0 && !editing;
  const controls = getDraftControls();
  const canClose = draft ? draftCount >= 3 : editing && !closed && nodes.length >= 3;
  const canDelete = draft ? draftCount > 0 : selected.length > 0;
  const joinable = editing && joinNeighbour() !== null;
  const pointType = editing ? sharedPointType(nodes, selected) : null;

  return createPortal(
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Path"
      data-testid="path-context-bar"
      data-pen-ui=""
      className="ll-ftxb ll:select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button size="sm" variant="ghost" disabled={!canClose} title="Close path" onClick={() => (draft ? controls?.close() : closeEditedPath())}>
        Close path
      </Button>
      <Button size="sm" variant="ghost" disabled={!joinable} title="Join to the open path next to the selected end point" onClick={joinEditedPath}>
        Join
      </Button>
      <Button size="sm" variant="ghost" disabled={!canDelete} title="Delete point (Backspace)" onClick={() => (draft ? controls?.removeLast() : deleteSelectedPoints())}>
        Delete point
      </Button>
      {editing && (
        <>
          <span className="ll-ftxs" />
          <div className="ll:w-48" data-testid="path-point-type">
            <SegmentedControl
              size="sm"
              ariaLabel="Point type"
              options={POINT_TYPES}
              value={pointType ?? ("" as PointType)}
              disabled={selected.length === 0}
              onChange={setSelectedPointType}
            />
          </div>
        </>
      )}
      <span className="ll-ftxs" />
      <Button size="sm" variant="primary" title="Done (Enter)" onClick={() => (draft ? controls?.finish() : exitPathEdit())}>
        Done
      </Button>
    </div>,
    document.body,
  );
};
