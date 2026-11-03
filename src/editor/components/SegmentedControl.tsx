"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, type Sim } from "../motion/loop";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { useMounted } from "./useMounted";

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
  const springsRef = useRef<{ x: Spring; w: Spring; sim: Sim } | null>(null);
  const mounted = useMounted();

  // Initialize glide springs
  useEffect(() => {
    const p = getActivePreset();
    const x = new Spring(0, p.glideH);
    const w = new Spring(0, p.glideW);
    const sim: Sim = {
      sp: [x, w],
      apply: () => {
        if (markerRef.current) {
          markerRef.current.style.transform = `translate3d(${x.x.toFixed(2)}px, 0, 0)`;
          markerRef.current.style.width = `${Math.max(0, w.x).toFixed(2)}px`;
        }
      },
    };
    springsRef.current = { x, w, sim };

    return () => {
      if (springsRef.current) {
        simRemove(springsRef.current.sim);
      }
    };
  }, []);

  // Update marker position when value or options change
  const updateMarker = useCallback((instant = false) => {
    const idx = options.findIndex((o) => o.value === value);
    const btn = itemRefs.current[idx];
    const container = containerRef.current;
    const marker = markerRef.current;
    const sp = springsRef.current;

    if (!btn || !container || !marker || !sp) return;

    const targetX = btn.offsetLeft;
    const targetW = btn.offsetWidth;
    const p = getActivePreset();

    marker.style.display = "block";

    if (instant || prefersReducedMotion()) {
      sp.x.jump(targetX);
      sp.w.jump(targetW);
      marker.style.transform = `translate3d(${targetX}px, 0, 0)`;
      marker.style.width = `${targetW}px`;
      return;
    }

    sp.x.tune(p.glideH);
    sp.w.tune(p.glideW);
    sp.x.to = targetX;
    sp.w.to = targetW;

    simAdd(sp.sim);
  }, [options, value]);

  useEffect(() => {
    if (mounted) {
      updateMarker(false);
    }
  }, [value, mounted, updateMarker]);

  // Initial layout measurement
  useEffect(() => {
    if (mounted) {
      updateMarker(true);
    }
  }, [mounted, updateMarker]);

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

  const containerSizeStyles = size === "sm" ? "ll:h-7" : "ll:h-9";
  const itemHeightStyles =
    size === "sm"
      ? "ll:h-6 ll:px-2 ll:gap-1.5 ll:text-small"
      : "ll:h-7.5 ll:px-3 ll:gap-2 ll:text-body";

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? "true" : undefined}
      className={`ll:relative ll:inline-flex ll:items-center ll:box-border ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:p-0.5 ll:gap-0.5 ll:select-none ll:shrink-0 ${containerSizeStyles} ${
        disabled ? "ll:opacity-40 ll:pointer-events-none" : ""
      } ${className}`}
    >
      {/* Sliding spring active marker */}
      <div
        ref={markerRef}
        aria-hidden="true"
        className="ll:absolute ll:top-0.5 ll:bottom-0.5 ll:left-0 ll:bg-surface-raised ll:rounded-sm ll:shadow-soft ll:pointer-events-none ll:hidden"
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
            className={`ll:relative ll:z-10 ll:inline-flex ll:items-center ll:justify-center ll:box-border ll:rounded-sm ll:font-sans ll:font-medium ll:transition-colors ll:duration-100 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${itemHeightStyles} ${
              isSelected
                ? "ll:text-primary ll:font-semibold"
                : "ll:text-secondary ll:hover:text-primary"
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
