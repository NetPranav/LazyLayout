"use client";

import React from "react";
import type { StageElement } from "./types";
import {
  STAGE_CONSTANTS,
  RESIZE_HANDLE_NAMES,
  RESIZE_HANDLE_CURSORS,
  type ResizeHandleName,
} from "./constants";
import type { SnapLine, SpacingMark } from "@/core/geometry/snap";
import { useSelectionStore } from "@/core/store/useSelectionStore";

interface TransformOverlayProps {
  selectedIds: string[];
  hoveredId: string | null;
  elements: Record<string, StageElement>;
  snapLines?: SnapLine[];
  spacingMarks?: SpacingMark[];
  onStartMove?: (elementId: string, e: React.PointerEvent) => void;
  onStartResize?: (handle: ResizeHandleName, e: React.PointerEvent) => void;
  /** How much the artboard is scaled on screen; the handles are drawn against it so they stay a grabbable size. */
  zoom?: number;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  selectedIds,
  hoveredId,
  elements,
  snapLines = [],
  spacingMarks = [],
  onStartMove: _onStartMove,
  onStartResize,
  zoom = 1,
}) => {
  // The page is drawn scaled, so every outline, handle and label is divided by the zoom: they stay 1px / 8px / 11px on screen at any zoom, like the design prototype.
  const inv = zoom > 0 ? 1 / zoom : 1;
  const px = (n: number) => `calc(${n}px * ${inv})`;
  const selectedMirrorId = useSelectionStore((s) => s.selectedMirrorId);
  const dimmed = "color-mix(in srgb, var(--ll-text-primary) 55%, transparent)";

  const boxOf = (id: string): StageElement | undefined => {
    const targetId = id === "subtitle" ? "headline" : id;
    const compoundKey = selectedMirrorId ? `${selectedMirrorId}::${targetId}` : null;
    return (compoundKey && elements[compoundKey]) ? elements[compoundKey] : elements[targetId];
  };
  const picked = selectedIds.map((id) => ({ id, el: boxOf(id) })).filter((x): x is { id: string; el: StageElement } => !!x.el);
  const multi = picked.length > 1;
  let group: { x: number; y: number; width: number; height: number } | null = null;
  if (multi) {
    const x0 = Math.min(...picked.map((p) => p.el.x));
    const y0 = Math.min(...picked.map((p) => p.el.y));
    const x1 = Math.max(...picked.map((p) => p.el.x + p.el.width));
    const y1 = Math.max(...picked.map((p) => p.el.y + p.el.height));
    group = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  /** The 8 resize handles: 8px squares centred on the corners and edge midpoints of the box. */
  const handles = RESIZE_HANDLE_NAMES.map((name) => {
    const pos: React.CSSProperties = {};
    if (name.includes("n")) pos.top = px(-4);
    if (name.includes("s")) pos.bottom = px(-4);
    if (name.includes("w")) pos.left = px(-4);
    if (name.includes("e")) pos.right = px(-4);
    if (name === "n" || name === "s") pos.left = `calc(50% - ${px(4)})`;
    if (name === "w" || name === "e") pos.top = `calc(50% - ${px(4)})`;
    return (
      <div
        key={name}
        data-handle={name}
        data-testid="selection-handle"
        className="ll-handle handle ll:absolute ll:pointer-events-auto ll:z-10"
        style={{
          ...pos,
          boxSizing: "border-box",
          width: px(8),
          height: px(8),
          backgroundColor: "var(--ll-surface-panel)",
          border: `${px(1)} solid var(--ll-text-primary)`,
          cursor: RESIZE_HANDLE_CURSORS[name],
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartResize?.(name, e);
        }}
      >
        {/* a larger invisible target around the square, so the handle is easy to hit and the cursor changes at once */}
        <span aria-hidden="true" className="ll:absolute" style={{ inset: px(-4), cursor: RESIZE_HANDLE_CURSORS[name] }} />
      </div>
    );
  });

  /** The size chip: centred under the box, 8px below it, 11px mono on the control colour. */
  const dim = (w: number, h: number) => (
    <div
      className="ll-dim dim ll:absolute ll:z-10 ll:whitespace-nowrap ll:font-mono ll:select-none ll:pointer-events-none"
      style={{
        left: "50%",
        top: `calc(100% + ${px(8)})`,
        transform: `translateX(-50%) scale(${inv})`,
        transformOrigin: "50% 0",
        font: "500 11px/16px var(--ll-font-mono)",
        backgroundColor: "var(--ll-control-primary-bg)",
        color: "var(--ll-control-primary-fg)",
        padding: "0 6px",
        borderRadius: "var(--ll-radius-sm)",
      }}
    >
      {Math.round(w)} × {Math.round(h)}
    </div>
  );

  return (
    <div
      data-testid="selection-overlay"
      className="ll-transform-overlay ll:absolute ll:inset-0 ll:pointer-events-none ll:overflow-visible"
      aria-hidden="true"
    >
      {/* 1. Hover outline for a non-selected hovered element: 1px at 55% */}
      {(() => {
        const targetHover = hoveredId === "subtitle" ? "headline" : hoveredId;
        if (!targetHover || selectedIds.includes(targetHover)) return null;
        const el = boxOf(targetHover);
        if (!el) return null;
        return (
          <div
            data-testid="hover-outline"
            className="ll-hover-outline ll:absolute ll:pointer-events-none"
            style={{
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              boxSizing: "border-box",
              border: `${px(1)} solid ${dimmed}`,
              ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
            }}
          />
        );
      })()}

      {/* 2. Selection boxes. One layer: the box on its bounds with 8 handles and the size chip. Several: each layer gets a 55% outline, and one box around all of them carries the handles and the chip. */}
      {picked.map(({ id, el }) => (
        <div
          key={id}
          data-selection-id={id}
          data-testid="selection-box"
          className="ll-selbox selbox ll:absolute ll:pointer-events-none"
          style={{
            left: el.x,
            top: el.y,
            width: el.width,
            height: el.height,
            boxSizing: "border-box",
            border: `${px(1)} solid ${multi ? dimmed : "var(--ll-text-primary)"}`,
            ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
          }}
        >
          {!multi && handles}
          {!multi && dim(el.width, el.height)}
        </div>
      ))}
      {group && (
        <div
          data-testid="selection-group"
          className="ll-selbox selbox ll:absolute ll:pointer-events-none"
          style={{
            left: group.x,
            top: group.y,
            width: group.width,
            height: group.height,
            boxSizing: "border-box",
            border: `${px(1)} solid ${dimmed}`,
          }}
        >
          {handles}
          {dim(group.width, group.height)}
        </div>
      )}

      {/* 3. Snapping Guide Lines */}
      {snapLines.map((line, idx) => {
        const isX = line.axis === "x";
        return (
          <div
            key={`snap-line-${idx}`}
            data-testid="snap-guide"
            data-axis={line.axis}
            className="ll-snap-guide ll:absolute ll:pointer-events-none"
            style={{
              left: isX ? line.pos : line.from,
              top: isX ? line.from : line.pos,
              width: isX ? STAGE_CONSTANTS.selectionBorderWidth : line.to - line.from,
              height: isX ? line.to - line.from : STAGE_CONSTANTS.selectionBorderWidth,
              backgroundColor: "var(--ll-accent, var(--ll-text-primary))",
            }}
          />
        );
      })}

      {/* 4. Distance HUD Marks (Alt-drag spacing labels) */}
      {spacingMarks.map((mark, idx) => {
        const isX = mark.axis === "x";
        const mid = (mark.from + mark.to) / 2;
        return (
          <div
            key={`spacing-mark-${idx}`}
            data-testid="spacing-mark"
            className="ll-spacing-mark ll:absolute ll:pointer-events-none ll:flex ll:items-center ll:justify-center"
            style={{
              left: isX ? mark.from : mark.at,
              top: isX ? mark.at : mark.from,
              width: isX ? mark.to - mark.from : 1,
              height: isX ? 1 : mark.to - mark.from,
              backgroundColor: "var(--ll-text-secondary)",
            }}
          >
            <span
              className="ll:absolute ll:font-mono ll:px-1 ll:rounded-xs ll:bg-surface-panel ll:text-primary ll:border ll:border-border ll:pointer-events-none"
              style={{
                left: isX ? mid - mark.from : 4,
                top: isX ? -16 : mid - mark.from - 8,
                fontSize: "var(--ll-text-nano-size)",
                lineHeight: "var(--ll-text-nano-line-height)",
              }}
            >
              {Math.round(mark.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
