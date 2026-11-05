"use client";

import React from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { IconButton } from "@/editor/components/IconButton";
import { Icon } from "@/editor/components/Icon";

export interface RepeatableRowProps {
  id: string;
  isOpen?: boolean;
  isHidden?: boolean;
  leadContent: React.ReactNode;
  summaryContent: React.ReactNode;
  leadTitle?: string;
  onOpenSettings?: () => void;
  onToggleHide?: () => void;
  onRemove?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
  className?: string;
}

export const RepeatableRow: React.FC<RepeatableRowProps> = ({
  id,
  isOpen = false,
  isHidden = false,
  leadContent,
  summaryContent,
  leadTitle = "Settings",
  onOpenSettings,
  onToggleHide,
  onRemove,
  className = "",
}) => {
  return (
    <div
      data-row-id={id}
      data-open={isOpen ? "true" : undefined}
      data-hidden={isHidden ? "true" : undefined}
      className={`dr rr ll:group ll:flex ll:items-center ll:gap-1.5 ll:h-8 ll:px-1.5 ll:rounded-sm ll:transition-colors ll:duration-100 ${
        isOpen
          ? "ll:bg-surface-raised ll:border ll:border-primary"
          : "ll:hover:bg-surface-bar ll:border ll:border-transparent"
      } ${isHidden ? "ll:opacity-40" : ""} ${className}`}
    >
      {/* Reorder Grip */}
      <span
        aria-hidden="true"
        title="Drag to reorder"
        className="ll:w-3.5 ll:h-6 ll:flex ll:items-center ll:justify-center ll:text-muted ll:opacity-0 ll:group-hover:opacity-100 ll:group-focus-within:opacity-100 ll:cursor-grab ll:shrink-0 ll:transition-opacity ll:duration-100"
      >
        <Icon icon={GripVertical} size={12} />
      </span>

      {/* Lead button (Thumbnail or icon) that toggles Settings Popover */}
      <button
        type="button"
        aria-label={leadTitle}
        title={leadTitle}
        aria-expanded={isOpen}
        onClick={onOpenSettings}
        className="lead ll:w-7 ll:h-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:shrink-0 ll:transition-colors ll:duration-100 ll:hover:bg-surface-hover ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:outline-none"
      >
        {leadContent}
      </button>

      {/* Summary Field Area */}
      <div className="sum ll:flex-1 ll:min-w-0 ll:flex ll:items-center ll:gap-1.5">
        {summaryContent}
      </div>

      {/* Toggle Eye Button */}
      {onToggleHide && (
        <IconButton
          size="sm"
          aria-label={isHidden ? "Show item" : "Hide item"}
          tooltip={isHidden ? "Show item" : "Hide item"}
          onClick={onToggleHide}
          icon={<Icon icon={isHidden ? EyeOff : Eye} size={14} />}
        />
      )}

      {/* Remove Button */}
      {onRemove && (
        <IconButton
          size="sm"
          aria-label="Remove item"
          tooltip="Remove item"
          onClick={onRemove}
          icon={<Icon icon={Minus} size={14} />}
        />
      )}
    </div>
  );
};
