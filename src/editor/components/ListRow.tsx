"use client";

import React, { useState, useRef } from "react";
import { GripVertical, Eye, EyeOff, Minus } from "lucide-react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

export interface ListRowProps {
  id?: string;
  name: string;
  value?: string;
  swatch?: string;
  icon?: React.ReactNode;
  visible?: boolean;
  onToggleVisible?: () => void;
  onRemove?: () => void;
  settingsContent?: React.ReactNode;
  settingsTitle?: string;
  className?: string;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  id,
  name,
  value,
  swatch,
  icon,
  visible = true,
  onToggleVisible,
  onRemove,
  settingsContent,
  settingsTitle,
  className = "",
  onDragStart,
  onDragOver,
  onDrop,
  draggable = false,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={rowRef}
        data-flip
        data-id={id}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`ll:group ll:flex ll:items-center ll:gap-2 ll:h-8 ll:px-2 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-border ll:transition-colors ll:duration-75 ll:box-border ${
          !visible ? "ll:opacity-50" : ""
        } ${className}`}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="ll:cursor-grab active:ll:cursor-grabbing ll:text-muted ll:hover:text-primary ll:shrink-0"
        >
          <Icon icon={GripVertical} size={14} />
        </div>

        {/* Swatch or Icon */}
        {swatch && (
          <div
            role="presentation"
            style={{ backgroundColor: swatch }}
            className="ll:w-4 ll:h-4 ll:rounded-sm ll:border ll:border-swatch-line ll:shrink-0 ll:shadow-soft"
          />
        )}
        {icon && (
          <div className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:text-secondary ll:shrink-0">
            {icon}
          </div>
        )}

        {/* Row main content (clickable to open popover) */}
        <button
          type="button"
          onClick={() => settingsContent && setPopoverOpen((prev) => !prev)}
          className="ll:flex ll:items-center ll:gap-2 ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:m-0 ll:p-0 ll:text-left ll:cursor-pointer ll:outline-none ll:select-none ll:font-sans"
        >
          <span className="ll:text-small ll:font-normal ll:text-primary ll:truncate">
            {name}
          </span>
          {value && (
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:truncate">
              {value}
            </span>
          )}
        </button>

        {/* Actions: Visibility toggle & Remove */}
        <div className="ll:flex ll:items-center ll:gap-0.5 ll:shrink-0">
          {onToggleVisible && (
            <IconButton
              size="sm"
              aria-label={visible ? `Hide ${name}` : `Show ${name}`}
              icon={
                visible ? (
                  <Icon icon={Eye} size={14} />
                ) : (
                  <Icon icon={EyeOff} size={14} />
                )
              }
              onClick={onToggleVisible}
            />
          )}

          {onRemove && (
            <IconButton
              size="sm"
              aria-label={`Remove ${name}`}
              icon={<Icon icon={Minus} size={14} />}
              onClick={onRemove}
            />
          )}
        </div>
      </div>

      {/* Anchored Settings Popover */}
      {settingsContent && (
        <Popover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          anchorRef={rowRef}
          side="left"
          title={settingsTitle ?? `${name} settings`}
        >
          {settingsContent}
        </Popover>
      )}
    </>
  );
};
