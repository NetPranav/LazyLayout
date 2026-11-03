"use client";

import React, { useRef, useCallback } from "react";

export type EditorMode = "design" | "motion" | "code";

export interface ModeTabsProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  disabled?: boolean;
  className?: string;
  dataState?: "hover" | "focus";
}

interface ModeItem {
  id: EditorMode;
  label: string;
}

const MODES: readonly ModeItem[] = [
  { id: "design", label: "Design" },
  { id: "motion", label: "Motion" },
  { id: "code", label: "Code" },
];

export const ModeTabs: React.FC<ModeTabsProps> = ({
  mode,
  onChange,
  disabled = false,
  className = "",
  dataState,
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const curIdx = MODES.findIndex((m) => m.id === mode);
      let nextIdx = -1;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIdx = (curIdx + 1) % MODES.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIdx = (curIdx - 1 + MODES.length) % MODES.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = MODES.length - 1;
      }

      if (nextIdx >= 0) {
        const next = MODES[nextIdx];
        if (next) {
          onChange(next.id);
          tabRefs.current[nextIdx]?.focus();
        }
      }
    },
    [mode, onChange, disabled]
  );

  return (
    <div
      role="tablist"
      aria-label="Mode"
      data-state={dataState}
      onKeyDown={handleKeyDown}
      className={`ll-modes ll:flex ll:items-center ll:gap-0.5 ll:h-8 ll:p-0.5 ll:border ll:border-border ll:rounded-md ll:self-center ll:box-border ${
        disabled ? "ll:opacity-40 ll:pointer-events-none" : ""
      } ${className}`}
    >
      {MODES.map((item, index) => {
        const isSelected = mode === item.id;
        const isForcedHover = dataState === "hover" && !isSelected && index === 1;
        const isForcedFocus = dataState === "focus" && isSelected;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-mode={item.id}
            disabled={disabled}
            tabIndex={isSelected && !disabled ? 0 : -1}
            onClick={() => !disabled && onChange(item.id)}
            className={`ll-mode ll:w-mode-tab ll:h-mode-tab ll:rounded-sm ll:flex ll:items-center ll:justify-center ll:text-body ll:font-medium ll:whitespace-nowrap ll:select-none ll:cursor-pointer ll:outline-none ll:border-0 ll:transition-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
              isForcedFocus ? "ll:ring-1 ll:ring-primary " : ""
            }${
              isSelected
                ? "ll:bg-control-active ll:text-primary"
                : isForcedHover
                ? "ll:bg-surface-hover ll:text-primary"
                : "ll:bg-transparent ll:text-muted ll:hover:text-primary"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
