import React, { useRef, useCallback } from "react";

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
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  const containerSizeStyles =
    size === "sm" ? "ll:h-7" : "ll:h-10";
  const itemHeightStyles =
    size === "sm" ? "ll:h-6 ll:px-2 ll:text-small" : "ll:h-8 ll:px-2.5 ll:text-small";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? "true" : undefined}
      className={`ll:inline-flex ll:items-center ll:box-border ll:bg-neutral-50 ll:border ll:border-border ll:rounded-md ll:p-0.5 ll:gap-0.5 ll:select-none ll:shrink-0 ${containerSizeStyles} ${
        disabled ? "ll:opacity-40 ll:pointer-events-none" : ""
      } ${className}`}
    >
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
            aria-label={option.ariaLabel || (typeof option.label === "string" ? option.label : undefined)}
            onClick={() => {
              if (!isItemDisabled && !isSelected) {
                onChange(option.value);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`ll:inline-flex ll:items-center ll:justify-center ll:gap-1.5 ll:box-border ll:rounded-sm ll:font-sans ll:font-medium ll:transition-none ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-neutral-1000 ll:focus-visible:ring-offset-1 ${itemHeightStyles} ${
              isSelected
                ? "ll:bg-neutral-1000 ll:text-neutral-0 ll:cursor-default"
                : "ll:bg-transparent ll:text-neutral-800 ll:hover:bg-neutral-100 ll:hover:text-neutral-1000 ll:cursor-pointer"
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
