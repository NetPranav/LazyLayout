"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eye, EyeOff, Frame, type LucideIcon } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { MENU_DEFAULT_WIDTH } from "@/editor/components/topbar-constants";
import { getActivePreset, prefersReducedMotion } from "@/editor/motion/feel";
import { springEase } from "@/editor/motion/ease";
import type { StatusChip } from "./types";

export interface RightPanelHeaderProps {
  selectionName?: string;
  selectionIcon?: LucideIcon;
  isMulti?: boolean;
  isLayerHidden?: boolean;
  onToggleHideLayer?: () => void;
  /** More menu, Reset item. */
  onReset?: () => void;
  /** More menu, Delete item. */
  onDelete?: () => void;
  statusChips?: StatusChip[];
  onSelectStatusChip?: (chip: StatusChip) => void;
  className?: string;
}

export const RightPanelHeader: React.FC<RightPanelHeaderProps> = ({
  selectionName = "Headline",
  selectionIcon = Frame,
  isMulti = false,
  isLayerHidden = false,
  onToggleHideLayer,
  onReset,
  onDelete,
  statusChips = [],
  onSelectStatusChip,
  className = "",
}) => {
  const headRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [moreAt, setMoreAt] = useState<{ x: number; y: number } | null>(null);
  const wasMultiRef = useRef(isMulti);

  // Multi-layer glyph pop-in on spring (matches prototype rstackSync)
  useEffect(() => {
    if (isMulti && !wasMultiRef.current && headRef.current) {
      const ico = headRef.current.querySelector(".ll-rico");
      if (ico && !prefersReducedMotion()) {
        const preset = getActivePreset();
        const se = springEase(preset.pop[0], preset.pop[1]);
        ico.animate(
          [
            { transform: "scale(0.6)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          {
            duration: se.duration,
            easing: se.easing,
            fill: "backwards",
          }
        );
      }
    }
    wasMultiRef.current = isMulti;
  }, [isMulti]);

  // The prototype opens this menu right-aligned under the button
  const openMore = () => {
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    setMoreAt({ x: r.right - MENU_DEFAULT_WIDTH, y: r.bottom + 4 });
  };

  return (
    <div ref={headRef} className={`ll-rhead ll:shrink-0 ll:flex ll:flex-col ${className}`}>
      {/* Top row: icon, name, hide-layer toggle, more options */}
      <div className="ll-rtop ll:h-header ll:px-4 ll:flex ll:items-center ll:gap-2 ll:min-w-0 ll:border-b ll:border-border ll:shrink-0">
        <span
          data-m={isMulti ? "1" : undefined}
          className="ll:inline-flex ll:items-center ll:justify-center ll:shrink-0"
        >
          <Icon
            icon={selectionIcon}
            size={16}
            className="ll-rico ll:text-muted ll:shrink-0"
          />
        </span>
        <span className="ll-rname ll:text-heading ll:font-semibold ll:text-primary ll:truncate ll:min-w-0">
          {selectionName}
        </span>

        <div className="ll:flex-1" />

        <IconButton
          size="sm"
          variant="ghost"
          aria-label={isLayerHidden ? "Show layer" : "Hide layer"}
          tooltip={isLayerHidden ? "Show layer" : "Hide layer"}
          pressed={isLayerHidden}
          onClick={onToggleHideLayer}
          icon={<Icon icon={isLayerHidden ? EyeOff : Eye} size={14} />}
          className="ll-ib ll-rhide"
        />
        <IconButton
          ref={moreRef}
          size="sm"
          variant="ghost"
          aria-label="More"
          tooltip="More"
          aria-haspopup="menu"
          aria-expanded={moreAt !== null}
          pressed={moreAt !== null}
          onClick={() => (moreAt ? setMoreAt(null) : openMore())}
          icon={
            <span className="ll:inline-block ll:leading-none ll:-translate-y-0.5" aria-hidden="true">
              ...
            </span>
          }
          className="ll-ib ll-rmore ll-more ll:-mr-1"
        />
        <Menu
          open={moreAt !== null}
          onClose={() => setMoreAt(null)}
          position={moreAt}
          width={MENU_DEFAULT_WIDTH}
          aria-label="More"
          className="ll:w-menu"
        >
          <MenuItem onClick={onReset}>Reset</MenuItem>
          <MenuItem onClick={onDelete}>Delete</MenuItem>
        </Menu>
      </div>

      {/* Status chips row: shown ONLY when chips exist (prototype parity) */}
      {statusChips && statusChips.length > 0 && (
        <div className="ll-rstat ll:h-8 ll:px-4 ll:flex ll:items-center ll:gap-3 ll:shrink-0 ll:border-b ll:border-border">
          {statusChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                chip.onClick?.();
                onSelectStatusChip?.(chip);
              }}
              className="ll-rs ll:text-micro ll:font-medium ll:text-secondary ll:hover:text-primary ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
