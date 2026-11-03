"use client";

import React from "react";
import { Eye, EyeOff, Frame, MoreHorizontal, type LucideIcon } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import type { StatusChip } from "./types";

export interface RightPanelHeaderProps {
  selectionName?: string;
  selectionIcon?: LucideIcon;
  isLayerHidden?: boolean;
  onToggleHideLayer?: () => void;
  onMoreOptions?: () => void;
  statusChips?: StatusChip[];
  onSelectStatusChip?: (chip: StatusChip) => void;
  className?: string;
}

export const RightPanelHeader: React.FC<RightPanelHeaderProps> = ({
  selectionName = "Headline",
  selectionIcon = Frame,
  isLayerHidden = false,
  onToggleHideLayer,
  onMoreOptions,
  statusChips = [],
  onSelectStatusChip,
  className = "",
}) => {
  return (
    <div className={`ll-rhead ll:shrink-0 ll:flex ll:flex-col ${className}`}>
      {/* Top row: icon, name, hide-layer toggle, more options */}
      <div className="ll-rtop ll:h-header ll:px-4 ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:border-b ll:border-border ll:shrink-0">
        <Icon
          icon={selectionIcon}
          size={16}
          className="ll-rico ll:text-muted ll:shrink-0"
        />
        <span className="ll-rname ll:text-lead ll:font-semibold ll:text-primary ll:truncate ll:min-w-0">
          {selectionName}
        </span>

        <div className="ll:flex-1" />

        <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
          <IconButton
            size="sm"
            aria-label={isLayerHidden ? "Show layer" : "Hide layer"}
            title={isLayerHidden ? "Show layer" : "Hide layer"}
            pressed={isLayerHidden}
            aria-pressed={isLayerHidden}
            icon={<Icon icon={isLayerHidden ? EyeOff : Eye} size={14} />}
            onClick={onToggleHideLayer}
          />
          <IconButton
            size="sm"
            aria-label="More"
            title="More"
            icon={<Icon icon={MoreHorizontal} size={14} />}
            onClick={onMoreOptions}
          />
        </div>
      </div>

      {/* Status chips row: shown when chips exist */}
      {statusChips.length > 0 && (
        <div className="ll-rstat ll:h-8 ll:px-4 ll:flex ll:items-center ll:gap-3 ll:shrink-0 ll:border-b ll:border-border">
          {statusChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="ll-rs ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:transition-none ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-1 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:rounded-xs"
              onClick={() => {
                chip.onClick?.();
                onSelectStatusChip?.(chip);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
