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
import { IconButton } from "@/editor/components/IconButton";
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
      aria-label="Alignment and distribution"
      className={`ll:flex ll:items-center ll:gap-0.5 ll:p-0.5 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border ${className}`}
    >
      {/* Align Left */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align left"
        tooltip="Align left"
        onClick={() => onAlign?.("left")}
        icon={<Icon icon={AlignLeft} size={14} />}
      />

      {/* Align Horizontal Center */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align center"
        tooltip="Align center"
        onClick={() => onAlign?.("hcenter")}
        icon={<Icon icon={AlignCenter} size={14} />}
      />

      {/* Align Right */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align right"
        tooltip="Align right"
        onClick={() => onAlign?.("right")}
        icon={<Icon icon={AlignRight} size={14} />}
      />

      {/* Divider */}
      <div
        aria-hidden="true"
        className="ll:w-px ll:h-3.5 ll:bg-border ll:mx-0.5 ll:shrink-0"
      />

      {/* Align Top */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align top"
        tooltip="Align top"
        onClick={() => onAlign?.("top")}
        icon={<Icon icon={AlignVerticalJustifyStart} size={14} />}
      />

      {/* Align Vertical Middle */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align middle"
        tooltip="Align middle"
        onClick={() => onAlign?.("vcenter")}
        icon={<Icon icon={AlignVerticalJustifyCenter} size={14} />}
      />

      {/* Align Bottom */}
      <IconButton
        size="sm"
        disabled={disabled}
        aria-label="Align bottom"
        tooltip="Align bottom"
        onClick={() => onAlign?.("bottom")}
        icon={<Icon icon={AlignVerticalJustifyEnd} size={14} />}
      />

      {/* Multi-selection extra actions */}
      {isMulti && (
        <>
          <div
            aria-hidden="true"
            className="ll:w-px ll:h-3.5 ll:bg-border ll:mx-0.5 ll:shrink-0"
          />

          {/* Distribute Horizontally */}
          <IconButton
            size="sm"
            disabled={disabled}
            aria-label="Distribute horizontally"
            tooltip="Distribute horizontally"
            onClick={() => onDistribute?.("h")}
            icon={<Icon icon={AlignHorizontalDistributeCenter} size={14} />}
          />

          {/* Distribute Vertically */}
          <IconButton
            size="sm"
            disabled={disabled}
            aria-label="Distribute vertically"
            tooltip="Distribute vertically"
            onClick={() => onDistribute?.("v")}
            icon={<Icon icon={AlignVerticalDistributeCenter} size={14} />}
          />

          {/* Tidy Up */}
          <IconButton
            size="sm"
            disabled={disabled}
            aria-label="Tidy up"
            tooltip="Tidy up (Ctrl+Alt+T)"
            onClick={() => onTidy?.()}
            icon={<Icon icon={Grid} size={14} />}
          />
        </>
      )}
    </div>
  );
};
