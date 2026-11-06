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
  const keep = zoom > 0 && zoom < 1 ? 1 / zoom : 1; // the page is drawn smaller than life, so grow the handles back
  return (
    <div
      data-testid="selection-overlay"
      className="ll-transform-overlay ll:absolute ll:inset-0 ll:pointer-events-none ll:overflow-visible"
      aria-hidden="true"
    >
      {/* 1. Hover Outlines for non-selected hovered element */}
      {(() => {
        const targetHover = hoveredId === "subtitle" ? "headline" : hoveredId;
        if (!targetHover || selectedIds.includes(targetHover) || !elements[targetHover]) return null;
        const el = elements[targetHover];
        return (
          <div
            data-testid="hover-outline"
            className="ll-hover-outline ll:absolute ll:border ll:border-muted ll:rounded-sm ll:pointer-events-none"
            style={{
              left: el.x - STAGE_CONSTANTS.selectionBorderWidth,
              top: el.y - STAGE_CONSTANTS.selectionBorderWidth,
              width: el.width + STAGE_CONSTANTS.selectionBorderWidth * 2,
              height: el.height + STAGE_CONSTANTS.selectionBorderWidth * 2,
            }}
          />
        );
      })()}

      {/* 2. Selection Boxes & 8 Resize Handles */}
      {selectedIds.map((id) => {
        const targetId = id === "subtitle" ? "headline" : id;
        const el = elements[targetId];
        if (!el) return null;

        return (
          <div
            key={id}
            data-selection-id={id}
            data-testid="selection-box"
            className="ll-selbox selbox ll:absolute ll:pointer-events-none"
            style={{
              left: el.x + STAGE_CONSTANTS.selectionBoxOffset,
              top: el.y + STAGE_CONSTANTS.selectionBoxOffset,
              width: el.width - STAGE_CONSTANTS.selectionBoxOffset * 2,
              height: el.height - STAGE_CONSTANTS.selectionBoxOffset * 2,
              border: `${STAGE_CONSTANTS.selectionBorderWidth}px solid var(--ll-text-primary)`,
            }}
          >
            {/* 8 Resize Handles around the bounding frame */}
            {RESIZE_HANDLE_NAMES.map((name) => {
              // Calculate handle relative position
              let leftStyle: string | number = 0;
              let topStyle: string | number = 0;
              let transformStyle = "none";

              switch (name) {
                case "nw":
                  leftStyle = STAGE_CONSTANTS.handleOffset;
                  topStyle = STAGE_CONSTANTS.handleOffset;
                  break;
                case "n":
                  leftStyle = "50%";
                  topStyle = STAGE_CONSTANTS.handleOffset;
                  transformStyle = `translateX(${STAGE_CONSTANTS.handleCenterOffset}px)`;
                  break;
                case "ne":
                  leftStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  topStyle = STAGE_CONSTANTS.handleOffset;
                  break;
                case "e":
                  leftStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  topStyle = "50%";
                  transformStyle = `translateY(${STAGE_CONSTANTS.handleCenterOffset}px)`;
                  break;
                case "se":
                  leftStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  topStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  break;
                case "s":
                  leftStyle = "50%";
                  topStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  transformStyle = `translateX(${STAGE_CONSTANTS.handleCenterOffset}px)`;
                  break;
                case "sw":
                  leftStyle = STAGE_CONSTANTS.handleOffset;
                  topStyle = `calc(100% - ${
                    STAGE_CONSTANTS.handleSize + STAGE_CONSTANTS.handleOffset
                  }px)`;
                  break;
                case "w":
                  leftStyle = STAGE_CONSTANTS.handleOffset;
                  topStyle = "50%";
                  transformStyle = `translateY(${STAGE_CONSTANTS.handleCenterOffset}px)`;
                  break;
              }

              return (
                <div
                  key={name}
                  data-handle={name}
                  data-testid="selection-handle"
                  className="ll-handle handle ll:absolute ll:pointer-events-auto ll:z-10"
                  style={{
                    left: leftStyle,
                    top: topStyle,
                    width: STAGE_CONSTANTS.handleSize,
                    height: STAGE_CONSTANTS.handleSize,
                    backgroundColor: "var(--ll-surface-canvas)",
                    border: `${STAGE_CONSTANTS.selectionBorderWidth}px solid var(--ll-text-primary)`,
                    cursor: RESIZE_HANDLE_CURSORS[name],
                    transform: `${transformStyle === "none" ? "" : transformStyle} scale(${keep})`.trim(),
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onStartResize?.(name, e);
                  }}
                >
                  {/* a larger invisible target around the dot, so the handle is easy to hit and the cursor changes at once */}
                  <span aria-hidden="true" className="ll:absolute" style={{ inset: -5.5, cursor: RESIZE_HANDLE_CURSORS[name] }} />
                </div>
              );
            })}

            {/* Dimension Badge (.dim): e.g. "340 × 82" */}
            <div
              className="ll-dim dim ll:absolute ll:z-10 ll:flex ll:items-center ll:justify-center ll:whitespace-nowrap ll:font-mono ll:select-none ll:pointer-events-none"
              style={{
                left: 0,
                top: "calc(100% + var(--ll-spacing-0-5))",
                fontSize: "var(--ll-text-micro-size)",
                lineHeight: "var(--ll-text-micro-line-height)",
                fontWeight: "var(--ll-text-micro-weight)",
                backgroundColor: "var(--ll-control-primary-bg)",
                color: "var(--ll-control-primary-fg)",
                paddingLeft: STAGE_CONSTANTS.dimBadgePaddingX,
                paddingRight: STAGE_CONSTANTS.dimBadgePaddingX,
                paddingTop: STAGE_CONSTANTS.dimBadgePaddingY,
                paddingBottom: STAGE_CONSTANTS.dimBadgePaddingY,
                borderRadius: "var(--ll-radius-sm)",
              }}
            >
              {Math.round(el.width)} × {Math.round(el.height)}
            </div>
          </div>
        );
      })}

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
