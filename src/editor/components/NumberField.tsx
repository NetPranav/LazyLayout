"use client";

import React, { useState, useRef, useCallback, useId } from "react";

export interface NumberFieldProps {
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  precision?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  precision,
  disabled = false,
  size = "md",
  className = "",
  id: propId,
  "aria-label": ariaLabel,
}) => {
  const generatedId = useId();
  const inputId = propId ?? generatedId;

  // While typing, draft stores the string text
  const [draft, setDraft] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startXRef = useRef(0);
  const startValRef = useRef(0);
  const scrubActiveRef = useRef(false);

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

  // Keyboard arrow step handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
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

  const isSm = size === "sm";
  const heightStyles = isSm ? "ll:h-7 ll:px-2 ll:gap-1.5" : "ll:h-7.5 ll:px-2.5 ll:gap-2";

  return (
    <div
      className={`ll:relative ll:inline-flex ll:w-full ll:items-center ll:box-border ll:rounded-sm ll:border ll:transition-colors ll:duration-100 ll:bg-surface-bar ${heightStyles} ${
        isScrubbing
          ? "ll:border-primary"
          : "ll:border-border ll:hover:border-muted ll:focus-within:border-primary"
      } ${disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""} ${className}`}
    >
      {/* Scrub label */}
      <span
        role="presentation"
        data-scrub
        title="Drag horizontally to scrub value (Shift: x10, Alt: x0.1)"
        onPointerDown={handleLabelPointerDown}
        className={`ll-pf ${
          typeof label !== "string"
            ? "ll-pi ll:inline-flex ll:items-center ll:justify-center"
            : "ll:text-micro ll:font-mono ll:font-medium ll:uppercase ll:tracking-wider"
        } ll:select-none ll:shrink-0 ${
          isScrubbing ? "ll:text-primary" : "ll:text-muted ll:hover:text-primary"
        } ${disabled ? "ll:cursor-not-allowed" : "ll:cursor-ew-resize"}`}
      >
        {label}
      </span>

      <div className="ll:inline-flex ll:items-center ll:min-w-0 ll:max-w-full ll:h-full">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
          placeholder={isMixed ? "Mixed" : undefined}
          value={displayedText}
          onFocus={() => setDraft(displayedText)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className={`ll:field-sizing-content ll:min-w-0 ll:max-w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-mono ll:text-micro ll:tracking-normal ll:text-primary ll:placeholder:text-muted ${
            disabled ? "ll:cursor-not-allowed" : ""
          }`}
        />

        {suffix && (
          <span
            aria-hidden="true"
            className="ll:text-micro ll:font-mono ll:font-medium ll:text-muted ll:shrink-0 ll:select-none"
          >
            {suffix}
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className={`ll:flex-1 ll:self-stretch ll:min-w-0 ${disabled ? "" : "ll:cursor-text"}`}
      />
    </div>
  );
};
