"use client";

import React, { useRef, useCallback } from "react";
import { useSlidingIndicator } from "./useSlidingIndicator";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  disabled = false,
  className = "",
  ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);

  useSlidingIndicator({
    containerRef,
    indicatorRef: markerRef,
    itemRefs,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (disabled) return;

      const enabledIndices: number[] = [];
      options.forEach((opt, idx) => {
        if (!opt.disabled) enabledIndices.push(idx);
      });

      if (enabledIndices.length === 0) return;

      const currentPos = enabledIndices.indexOf(index);
      let targetIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextPos = (currentPos + 1) % enabledIndices.length;
        targetIndex = enabledIndices[nextPos];
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
        targetIndex = enabledIndices[prevPos];
      } else if (e.key === "Home") {
        e.preventDefault();
        targetIndex = enabledIndices[0];
      } else if (e.key === "End") {
        e.preventDefault();
        targetIndex = enabledIndices[enabledIndices.length - 1];
      }

      if (targetIndex !== null) {
        const targetOption = options[targetIndex];
        onChange(targetOption.value);
        itemRefs.current[targetIndex]?.focus();
      }
    },
    [disabled, options, onChange]
  );

  const containerSizeStyles = size === "sm" ? "ll:h-7 ll:p-px" : "ll:h-8 ll:p-0.5";
  const itemPaddingStyles =
    size === "sm" ? "ll:px-2 ll:gap-1.5 ll:text-micro" : "ll:px-3 ll:gap-2 ll:text-body";

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? "true" : undefined}
      className={`ll:relative ll:flex ll:w-full ll:items-center ll:box-border ll:border ll:border-border ll:rounded-md ll:gap-px ll:select-none ll:shrink-0 ${containerSizeStyles} ${
        disabled ? "ll:opacity-40 ll:pointer-events-none" : ""
      } ${className}`}
    >
      {/* Sliding spring active marker, covers the selected cell */}
      <div
        ref={markerRef}
        aria-hidden="true"
        className="ll:absolute ll:top-0.5 ll:bottom-0.5 ll:left-0 ll:bg-control-active ll:rounded-sm ll:pointer-events-none ll:hidden"
      />

      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isItemDisabled = disabled || option.disabled;

        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={isItemDisabled}
            title={option.title}
            aria-label={option.ariaLabel}
            onClick={() => !isItemDisabled && onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`ll:relative ll:z-10 ll:flex ll:flex-1 ll:min-w-0 ll:h-full ll:items-center ll:justify-center ll:box-border ll:rounded-sm ll:font-sans ll:font-medium ll:transition-colors ll:duration-100 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${itemPaddingStyles} ${
              isSelected
                ? "ll:text-primary ll:font-medium"
                : "ll:text-muted ll:hover:text-primary ll:hover:bg-surface-bar"
            } ${isItemDisabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""}`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
