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

type AlignActionItem = {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ComponentProps<typeof PhosphorMotionIcon>["name"];
  motion: React.ComponentProps<typeof PhosphorMotionIcon>["motion"];
  run: (handlers: {
    onAlign?: AlignBarProps["onAlign"];
    onDistribute?: AlignBarProps["onDistribute"];
    onTidy?: AlignBarProps["onTidy"];
  }) => void;
};

const BASE_ACTIONS: readonly AlignActionItem[] = [
  {
    id: "left",
    label: "Align left",
    tooltip: "Align left — Align selected objects to the leftmost edge",
    icon: "alignLeft",
    motion: "left",
    run: ({ onAlign }) => onAlign?.("left"),
  },
  {
    id: "hcenter",
    label: "Align center",
    tooltip: "Align center — Align selected objects to their horizontal midpoint",
    icon: "alignCenterHorizontal",
    motion: "lift",
    run: ({ onAlign }) => onAlign?.("hcenter"),
  },
  {
    id: "right",
    label: "Align right",
    tooltip: "Align right — Align selected objects to the rightmost edge",
    icon: "alignRight",
    motion: "right",
    run: ({ onAlign }) => onAlign?.("right"),
  },
  {
    id: "top",
    label: "Align top",
    tooltip: "Align top — Align selected objects to the topmost edge",
    icon: "alignTop",
    motion: "up",
    run: ({ onAlign }) => onAlign?.("top"),
  },
  {
    id: "vcenter",
    label: "Align middle",
    tooltip: "Align middle — Align selected objects to their vertical midpoint",
    icon: "alignCenterVertical",
    motion: "lift",
    run: ({ onAlign }) => onAlign?.("vcenter"),
  },
  {
    id: "bottom",
    label: "Align bottom",
    tooltip: "Align bottom — Align selected objects to the bottommost edge",
    icon: "alignBottom",
    motion: "down",
    run: ({ onAlign }) => onAlign?.("bottom"),
  },
];

const MULTI_ACTIONS: readonly AlignActionItem[] = [
  {
    id: "dist-h",
    label: "Distribute horizontally",
    tooltip: "Distribute horizontally — Space selected layers with equal horizontal gaps",
    icon: "arrowsOutLineHorizontal",
    motion: "spread-h",
    run: ({ onDistribute }) => onDistribute?.("h"),
  },
  {
    id: "dist-v",
    label: "Distribute vertically",
    tooltip: "Distribute vertically — Space selected layers with equal vertical gaps",
    icon: "arrowsOutLineVertical",
    motion: "spread-v",
    run: ({ onDistribute }) => onDistribute?.("v"),
  },
  {
    id: "tidy",
    label: "Tidy up",
    tooltip: "Tidy up (Ctrl+Alt+T) — Arrange items into an even grid layout",
    icon: "gridFour",
    motion: "lift",
    run: ({ onTidy }) => onTidy?.(),
  },
];

export const AlignBar: React.FC<AlignBarProps> = ({
  onAlign,
  onDistribute,
  onTidy,
  isMulti = false,
  disabled = false,
  className = "",
}) => {
  const actions = isMulti ? [...BASE_ACTIONS, ...MULTI_ACTIONS] : BASE_ACTIONS;

  return (
    <div
      role="toolbar"
      aria-label="Alignment"
      className={`ll-dgroup ll:grid ${isMulti ? "ll:grid-cols-9" : "ll:grid-cols-6"} ll:items-center ll:gap-0.5 ll:h-7 ll:p-px ll:rounded-md ll:border ll:border-border ll:w-full ${className}`}
    >
      {actions.map((action) => (
        <Tooltip key={action.id} content={action.tooltip} side="top" className="ll:w-full ll:h-full">
          <button
            type="button"
            disabled={disabled}
            aria-label={action.label}
            onClick={() => action.run({ onAlign, onDistribute, onTidy })}
            className="ll-pi-host ll:w-full ll:h-full ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:bg-control-active ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors ll:disabled:opacity-40 ll:disabled:cursor-not-allowed"
          >
            <PhosphorMotionIcon name={action.icon} motion={action.motion} size={16} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
};
