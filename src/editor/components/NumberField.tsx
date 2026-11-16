"use client";

import React, { useState, useRef, useCallback, useId } from "react";
import { Tooltip } from "./Tooltip";

function getFieldTooltip(
  label: React.ReactNode,
  ariaLabel?: string,
  title?: string,
  tooltip?: string
): string {
  if (tooltip) return tooltip;
  if (title) return `${title} (drag to scrub)`;

  const key = (ariaLabel || (typeof label === "string" ? label : "")).toLowerCase().trim();
  if (key === "x" || key === "frame.x") return "X position — Horizontal canvas coordinate (drag to scrub)";
  if (key === "y" || key === "frame.y") return "Y position — Vertical canvas coordinate (drag to scrub)";
  if (key === "w" || key === "width" || key === "frame.width") return "Width — Object width in pixels (drag to scrub)";
  if (key === "h" || key === "height" || key === "frame.height") return "Height — Object height in pixels (drag to scrub)";
  if (key.includes("rotation") || key === "r" || key === "°") return "Rotation — Angle in degrees (drag to scrub)";
  if (key.includes("opacity") || key === "%") return "Opacity — Layer visibility percentage (drag to scrub)";
  if (key.includes("corner") || key.includes("radius")) return "Corner radius — Roundness of corners in pixels (drag to scrub)";
  if (key === "gap") return "Gap — Space between auto-layout children (drag to scrub)";
  if (key.includes("padding horizontal")) return "Horizontal padding — Left and right inner space in pixels (drag to scrub)";
  if (key.includes("padding vertical")) return "Vertical padding — Top and bottom inner space in pixels (drag to scrub)";
  if (key === "s" || key === "size" || key.includes("font size")) return "Font size — Text size in pixels (drag to scrub)";
  if (key.includes("line height")) return "Line height — Vertical spacing between lines (drag to scrub)";
  if (key.includes("tracking") || key.includes("letter spacing")) return "Letter spacing — Space between characters (drag to scrub)";
  if (key.includes("column span") || key === "col span") return "Column span — Grid columns to occupy (drag to scrub)";
  if (key.includes("row span")) return "Row span — Grid rows to occupy (drag to scrub)";
  if (key === "grow") return "Flex grow — Share of free space in auto-layout (drag to scrub)";
  if (key === "shrink") return "Flex shrink — Rate of shrinking in auto-layout (drag to scrub)";
  if (key === "z" || key === "z-index") return "Z-index — Stacking order priority (drag to scrub)";

  if (ariaLabel) return `${ariaLabel} (drag to scrub)`;
  if (typeof label === "string" && label) return `${label} (drag to scrub)`;
  return "Drag horizontally to scrub value (Shift: x10, Alt: x0.1)";
}

export interface NumberFieldProps {
  label?: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  unit?: string;
  placeholder?: string;
  precision?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** What the field is, in a sentence: shown before the scrub hint when the pointer rests on its label. */
  title?: string;
  /** Custom tooltip text shown on 1s hover. */
  tooltip?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  unit,
  placeholder,
  precision,
  disabled = false,
  size: _size = "md",
  className = "",
  id: propId,
  "aria-label": ariaLabel,
  title,
  tooltip,
}) => {
  const generatedId = useId();
  const inputId = propId ?? generatedId;
  const effectiveSuffix = suffix ?? unit;

  // While typing, draft stores the string text
  const [draft, setDraft] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startXRef = useRef(0);
  const startValRef = useRef(0);
  const scrubActiveRef = useRef(false);
  const hasMovedRef = useRef(false);

  const isMixed = value === null;

  // Determine decimal places from step if precision is omitted
  const decPlaces =
    precision ??
    (step.toString().includes(".") ? step.toString().split(".")[1].length : 0);

  const formatNumber = useCallback(
    (n: number) => {
      return decPlaces > 0 ? n.toFixed(decPlaces) : Math.round(n).toString();
    },
    [decPlaces]
  );

  const clamp = useCallback(
    (n: number) => {
      let result = n;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return parseFloat(result.toFixed(decPlaces));
    },
    [min, max, decPlaces]
  );

  const displayedText =
    draft !== null ? draft : isMixed ? "" : formatNumber(value ?? 0);

  // Commit text input
  const handleCommit = useCallback(() => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);

    if (trimmed === "" && isMixed) return;

    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed) && Number.isFinite(parsed)) {
      const clamped = clamp(parsed);
      if (clamped !== value) {
        onChange(clamped);
      }
    }
  }, [draft, isMixed, clamp, value, onChange]);

  // Scrub handler on label pointerdown
  const handleLabelPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    // A focused field shows what is being typed; leave it first so the scrub's value is the one on screen (and is not overwritten on blur).
    if (document.activeElement === inputRef.current) inputRef.current?.blur();

    const targetEl = e.currentTarget;
    startXRef.current = e.clientX;
    const initialVal = value ?? 0;
    startValRef.current = initialVal;
    scrubActiveRef.current = true;
    setIsScrubbing(true);

    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!scrubActiveRef.current) return;
      const deltaX = ev.clientX - startXRef.current;

      let multiplier = 1;
      if (ev.shiftKey) multiplier = 10;
      if (ev.altKey) multiplier = 0.1;

      const deltaVal = deltaX * step * multiplier;
      const newVal = clamp(startValRef.current + deltaVal);
      onChange(newVal);
    };

    const onPointerUp = (ev: PointerEvent) => {
      scrubActiveRef.current = false;
      setIsScrubbing(false);
      try {
        targetEl.releasePointerCapture(ev.pointerId);
      } catch {
        // fallback
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };

    const onPointerCancel = () => {
      if (scrubActiveRef.current) {
        scrubActiveRef.current = false;
        setIsScrubbing(false);
        onChange(startValRef.current); // restore
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  };

  // Drag scrub directly on input when dragged horizontally
  const handleInputPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (disabled || e.button !== 0) return;
    if (document.activeElement === inputRef.current && draft !== null) {
      return;
    }

    const startX = e.clientX;
    const initialVal = value ?? 0;
    startXRef.current = startX;
    startValRef.current = initialVal;
    hasMovedRef.current = false;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      if (!hasMovedRef.current) {
        if (Math.abs(deltaX) >= 4) {
          hasMovedRef.current = true;
          scrubActiveRef.current = true;
          setIsScrubbing(true);
          inputRef.current?.blur();
        } else {
          return;
        }
      }

      if (!scrubActiveRef.current) return;
      let multiplier = 1;
      if (ev.shiftKey) multiplier = 10;
      if (ev.altKey) multiplier = 0.1;

      const deltaVal = deltaX * step * multiplier;
      const newVal = clamp(startValRef.current + deltaVal);
      onChange(newVal);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (scrubActiveRef.current) {
        scrubActiveRef.current = false;
        setIsScrubbing(false);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Keyboard arrow step handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter commits and Escape cancels here; marked handled so the canvas shortcuts (Enter: select children) don't
    // also act on the keypress once the field has let go of focus
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(null);
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      let multiplier = 1;
      if (e.shiftKey) multiplier = 10;
      if (e.altKey) multiplier = 0.1;

      const delta = (e.key === "ArrowUp" ? 1 : -1) * step * multiplier;
      const current =
        draft !== null
          ? parseFloat(draft) || value || 0
          : value || 0;
      const next = clamp(current + delta);
      setDraft(null);
      onChange(next);
    }
  };

  const heightStyles = "ll:h-7 ll:px-2 ll:gap-2";

  return (
    <div
      data-testid="inspector-field"
      data-prop={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      className={`ll:relative ll:inline-flex ll:w-full ll:items-center ll:box-border ll:rounded-sm ll:border ll:transition-colors ll:duration-100 ll:bg-surface-bar ${heightStyles} ${
        isScrubbing
          ? "ll:border-primary"
          : "ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary"
      } ${disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""} ${className}`}
    >
      {/* Scrub label */}
      {label != null && label !== "" && (
        <Tooltip content={getFieldTooltip(label, ariaLabel, title, tooltip)} side="top">
          <span
            role="presentation"
            data-scrub
            onPointerDown={handleLabelPointerDown}
            className={`ll-pf ${
              typeof label !== "string"
                ? "ll-pi ll:inline-flex ll:items-center ll:justify-center"
                : "ll:text-micro ll:font-mono ll:font-medium ll:tracking-normal"
            } ll:select-none ll:shrink-0 ${
              isScrubbing ? "ll:text-primary" : "ll:text-muted ll:hover:text-primary"
            } ${disabled ? "ll:cursor-not-allowed" : "ll:cursor-ew-resize"}`}
          >
            {label}
          </span>
        </Tooltip>
      )}

      <div className="ll:flex ll:flex-1 ll:items-center ll:justify-between ll:min-w-0 ll:h-full">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
          placeholder={isMixed ? "Mixed" : placeholder}
          value={displayedText}
          onPointerDown={handleInputPointerDown}
          onFocus={() => setDraft(displayedText)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className={`ll:flex-1 ll:min-w-0 ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:font-normal ll:tracking-normal ll:text-primary ll:placeholder:text-muted ${
            disabled ? "ll:cursor-not-allowed" : ""
          }`}
        />

        {effectiveSuffix && (
          <span
            role="presentation"
            data-scrub
            onPointerDown={handleLabelPointerDown}
            className={`ll:text-nano ll:font-mono ll:font-medium ll:tracking-wider ll:select-none ll:shrink-0 ll:ml-1.5 ${
              isScrubbing ? "ll:text-primary" : "ll:text-muted ll:hover:text-primary"
            } ${disabled ? "ll:cursor-not-allowed" : "ll:cursor-ew-resize"}`}
          >
            {effectiveSuffix}
          </span>
        )}
      </div>
    </div>
  );
};
