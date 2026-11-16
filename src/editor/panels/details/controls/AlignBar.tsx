"use client";

import React from "react";
import { PhosphorMotionIcon } from "@/editor/components/icons/PhosphorIcon";
import { Tooltip } from "@/editor/components/Tooltip";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";

export interface AlignBarProps {
  onAlign?: (mode: AlignMode) => void;
  onDistribute?: (axis: SpreadAxis) => void;
  onTidy?: () => void;
  isMulti?: boolean;
  disabled?: boolean;
  className?: string;
}

export const AlignBar: React.FC<AlignBarProps> = ({
  onAlign,
  onDistribute,
  onTidy,
  isMulti = false,
  disabled = false,
  className = "",
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Alignment"
      className={`ll-dgroup ll:flex ll:items-center ll:gap-0.5 ll:h-7 ll:p-px ll:rounded-md ll:border ll:border-border ll:w-full ${className}`}
    >
      {/* Align Left */}
      <Tooltip content="Align left — Align selected objects to the leftmost edge" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align left"
          onClick={() => onAlign?.("left")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignLeft" motion="left" size={16} />
        </button>
      </Tooltip>

      {/* Align Horizontal Center */}
      <Tooltip content="Align center — Align selected objects to their horizontal midpoint" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align center"
          onClick={() => onAlign?.("hcenter")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignCenterHorizontal" motion="lift" size={16} />
        </button>
      </Tooltip>

      {/* Align Right */}
      <Tooltip content="Align right — Align selected objects to the rightmost edge" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align right"
          onClick={() => onAlign?.("right")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignRight" motion="right" size={16} />
        </button>
      </Tooltip>

      {/* Align Top */}
      <Tooltip content="Align top — Align selected objects to the topmost edge" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align top"
          onClick={() => onAlign?.("top")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignTop" motion="up" size={16} />
        </button>
      </Tooltip>

      {/* Align Vertical Middle */}
      <Tooltip content="Align middle — Align selected objects to their vertical midpoint" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align middle"
          onClick={() => onAlign?.("vcenter")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignCenterVertical" motion="lift" size={16} />
        </button>
      </Tooltip>

      {/* Align Bottom */}
      <Tooltip content="Align bottom — Align selected objects to the bottommost edge" side="top">
        <button
          type="button"
          disabled={disabled}
          aria-label="Align bottom"
          onClick={() => onAlign?.("bottom")}
          className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
        >
          <PhosphorMotionIcon name="alignBottom" motion="down" size={16} />
        </button>
      </Tooltip>

      {/* Multi-selection extra actions */}
      {isMulti && (
        <>
          <Tooltip content="Distribute horizontally — Space selected layers with equal horizontal gaps" side="top">
            <button
              type="button"
              disabled={disabled}
              aria-label="Distribute horizontally"
              onClick={() => onDistribute?.("h")}
              className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
            >
              <PhosphorMotionIcon name="arrowsOutLineHorizontal" motion="spread-h" size={16} />
            </button>
          </Tooltip>

          <Tooltip content="Distribute vertically — Space selected layers with equal vertical gaps" side="top">
            <button
              type="button"
              disabled={disabled}
              aria-label="Distribute vertically"
              onClick={() => onDistribute?.("v")}
              className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
            >
              <PhosphorMotionIcon name="arrowsOutLineVertical" motion="spread-v" size={16} />
            </button>
          </Tooltip>

          <Tooltip content="Tidy up (Ctrl+Alt+T) — Arrange items into an even grid layout" side="top">
            <button
              type="button"
              disabled={disabled}
              aria-label="Tidy up"
              onClick={() => onTidy?.()}
              className="ll-pi-host ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
            >
              <PhosphorMotionIcon name="gridFour" motion="lift" size={16} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
};
