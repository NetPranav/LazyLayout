"use client";

import React from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Grid,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
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
      <button
        type="button"
        disabled={disabled}
        aria-label="Align left"
        title="Align left"
        onClick={() => onAlign?.("left")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignLeft} size={14} />
      </button>

      {/* Align Horizontal Center */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Align center"
        title="Align center"
        onClick={() => onAlign?.("hcenter")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignCenter} size={14} />
      </button>

      {/* Align Right */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Align right"
        title="Align right"
        onClick={() => onAlign?.("right")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignRight} size={14} />
      </button>

      {/* Align Top */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Align top"
        title="Align top"
        onClick={() => onAlign?.("top")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignVerticalJustifyStart} size={14} />
      </button>

      {/* Align Vertical Middle */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Align middle"
        title="Align middle"
        onClick={() => onAlign?.("vcenter")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignVerticalJustifyCenter} size={14} />
      </button>

      {/* Align Bottom */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Align bottom"
        title="Align bottom"
        onClick={() => onAlign?.("bottom")}
        className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
      >
        <Icon icon={AlignVerticalJustifyEnd} size={14} />
      </button>

      {/* Multi-selection extra actions */}
      {isMulti && (
        <>
          <button
            type="button"
            disabled={disabled}
            aria-label="Distribute horizontally"
            title="Distribute horizontally"
            onClick={() => onDistribute?.("h")}
            className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
          >
            <Icon icon={AlignHorizontalDistributeCenter} size={14} />
          </button>

          <button
            type="button"
            disabled={disabled}
            aria-label="Distribute vertically"
            title="Distribute vertically"
            onClick={() => onDistribute?.("v")}
            className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
          >
            <Icon icon={AlignVerticalDistributeCenter} size={14} />
          </button>

          <button
            type="button"
            disabled={disabled}
            aria-label="Tidy up"
            title="Tidy up (Ctrl+Alt+T)"
            onClick={() => onTidy?.()}
            className="ll:flex-1 ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-secondary-bg ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
          >
            <Icon icon={Grid} size={14} />
          </button>
        </>
      )}
    </div>
  );
};
