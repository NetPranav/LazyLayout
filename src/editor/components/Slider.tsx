"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createSliderMotion, type SliderMotion } from "./SliderMotion";

/** Checker pattern for opacity-style tracks (colour sits on top as `trackBackground`). */
const CHECKER =
  "conic-gradient(var(--ll-border-color) 25%, var(--ll-surface-panel) 0 50%, var(--ll-border-color) 0 75%, var(--ll-surface-panel) 0)";

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  /** Continuous: fires on every change while dragging, clicking or pressing keys. */
  onChange: (val: number) => void;
  /** Fires once when the gesture ends (release, or each key press): make this the undo step. */
  onCommit?: (val: number) => void;
  /** Values the thumb sticks to when it passes close to them (hold Alt to bypass). */
  snapPoints?: number[];
  unit?: string;
  formatValue?: (val: number) => string;
  format?: (val: number) => string;
  ariaLabel?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Arrow key increment when different from `step` (for example a fine `step` with coarse keys). */
  keyStep?: number;
  /** "line" is the 2px calm track; "gradient" and "checker" show a 12px bar for colour and opacity. */
  track?: "line" | "gradient" | "checker";
  /** CSS background of the bar for the gradient and checker tracks. */
  trackBackground?: string;
  /** Show a number field next to the slider, kept in sync both ways. */
  showInput?: boolean;
  /** Width class for the number field (default is tokens only: ll:w-12). */
  inputClassName?: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  onCommit,
  snapPoints,
  unit = "",
  formatValue,
  format,
  ariaLabel = "Slider",
  label,
  className = "",
  disabled = false,
  keyStep,
  track = "line",
  trackBackground,
  showInput = false,
  inputClassName = "",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLElement>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const motionRef = useRef<SliderMotion | null>(null);

  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const changedRef = useRef(false);
  const lastValRef = useRef(value);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveAriaLabel = label ?? ariaLabel;
  const effectiveFormat = format ?? formatValue;
  const dec = (String(step).split(".")[1] || "").length;
  const span = max - min;
  const clampedVal = clamp(value, min, max);
  const frac = span > 0 ? (clampedVal - min) / span : 0;
  const displayVal = effectiveFormat ? effectiveFormat(clampedVal) : `${clampedVal}${unit}`;
  const isBar = track !== "line";

  const snapV = useCallback(
    (v: number): number => {
      const snapped = Math.round((v - min) / step) * step + min;
      return clamp(Number(snapped.toFixed(dec)), min, max);
    },
    [min, max, step, dec],
  );

  const withSnapPoints = useCallback(
    (v: number, bypass: boolean): number => {
      if (!snapPoints?.length || bypass) return v;
      const reach = Math.max(span * 0.02, step);
      for (const p of snapPoints) if (Math.abs(v - p) <= reach) return clamp(p, min, max);
      return v;
    },
    [snapPoints, span, step, min, max],
  );

  // The motion object paints straight into the DOM, so a drag never waits for a React render.
  useLayoutEffect(() => {
    const m = createSliderMotion({
      fill: () => fillRef.current,
      thumb: () => thumbRef.current,
      bubble: () => bubbleRef.current,
    });
    motionRef.current = m;
    m.place(frac);
    return () => {
      m.dispose();
      motionRef.current = null;
    };
    // frac is applied by the effect below; this one only creates the motion object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (typing a number, undo, another control) glide to the new place.
  useEffect(() => {
    if (draggingRef.current) return;
    motionRef.current?.glideTo(frac);
  }, [frac]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const emit = useCallback(
    (next: number) => {
      lastValRef.current = next;
      changedRef.current = true;
      onChange(next);
    },
    [onChange],
  );

  const valueAtX = useCallback(
    (clientX: number, bypassSnap: boolean): number => {
      const el = rootRef.current;
      if (!el) return value;
      const r = el.getBoundingClientRect();
      const p = clamp((clientX - r.left - 3) / Math.max(1, r.width - 6), 0, 1);
      return withSnapPoints(snapV(min + p * span), bypassSnap);
    },
    [min, span, snapV, withSnapPoints, value],
  );

  const fracOf = (v: number) => (span > 0 ? (v - min) / span : 0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const el = rootRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // capture is best effort
    }
    draggingRef.current = true;
    setDragging(true);
    changedRef.current = false;
    lastXRef.current = e.clientX;
    lastTimeRef.current = e.timeStamp;
    motionRef.current?.press(true);

    const next = valueAtX(e.clientX, e.altKey);
    // a click animates to the spot; once the pointer moves the thumb follows 1:1
    motionRef.current?.glideTo(fracOf(next));
    if (next !== lastValRef.current || next !== clampedVal) emit(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = motionRef.current;
    if (!draggingRef.current || !m) {
      return;
    }
    const dt = Math.max(1, e.timeStamp - lastTimeRef.current);
    const vel = ((e.clientX - lastXRef.current) / dt) * 1000;
    lastXRef.current = e.clientX;
    lastTimeRef.current = e.timeStamp;

    const next = valueAtX(e.clientX, e.altKey);
    m.follow(fracOf(next));
    if (next !== lastValRef.current) emit(next);

    m.stretch(clamp(vel * 0.012, -14, 14));
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => m.stretch(0), 70);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const m = motionRef.current;
    m?.stretch(0);
    m?.press(false);
    try {
      if (rootRef.current?.hasPointerCapture(e.pointerId)) rootRef.current.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (changedRef.current) {
      changedRef.current = false;
      onCommit?.(lastValRef.current);
    }
    // settle on whatever the parent finally holds (it may clamp or round differently)
    m?.glideTo(fracOf(lastValRef.current));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const inc = keyStep ?? step;
    const big = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = snapV(value - inc * big);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = snapV(value + inc * big);
        break;
      case "PageDown":
        next = snapV(value - Math.max(inc * 10, span / 10));
        break;
      case "PageUp":
        next = snapV(value + Math.max(inc * 10, span / 10));
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next === value) return;
    emit(next);
    changedRef.current = false;
    onCommit?.(next);
    motionRef.current?.nudge();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.pointerType === "touch") return;
    motionRef.current?.hover(true);
  };
  const handlePointerLeave = () => motionRef.current?.hover(false);

  // number field --------------------------------------------------------------
  const [draft, setDraft] = useState<string | null>(null);
  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft);
    setDraft(null);
    if (Number.isNaN(parsed)) return;
    const next = snapV(parsed);
    if (next === value) return;
    emit(next);
    changedRef.current = false;
    onCommit?.(next);
  };

  const barStyle: React.CSSProperties | undefined = isBar
    ? {
        background:
          track === "checker"
            ? `${trackBackground ?? "transparent"}, ${CHECKER}`
            : trackBackground,
        backgroundSize: track === "checker" ? "100% 100%, 8px 8px" : undefined,
      }
    : undefined;

  const slider = (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedVal}
      aria-valuetext={displayVal}
      aria-label={effectiveAriaLabel}
      aria-disabled={disabled}
      className={`ll-sld ${isBar ? "ll-sld-bar" : ""} ${dragging ? "drag" : ""} ${disabled ? "ll:opacity-45 ll:cursor-not-allowed" : ""} ${showInput ? "ll:flex-1 ll:min-w-0" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <i ref={trackRef} className="ll-sl-t" style={barStyle} />
      <i ref={fillRef} className="ll-sl-f" />
      <i ref={thumbRef} className="ll-sl-h" />
      <b ref={bubbleRef} className="ll-sl-g">
        {displayVal}
      </b>
    </div>
  );

  if (!showInput) return slider;

  return (
    <div className="ll:flex ll:items-center ll:gap-2 ll:w-full ll:min-w-0">
      {slider}
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${effectiveAriaLabel} value`}
        disabled={disabled}
        value={draft ?? String(clampedVal)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={`ll:h-6 ll:w-12 ll:shrink-0 ll:px-1.5 ll:rounded-sm ll:border ll:border-border ll:bg-transparent ll:text-primary ll:font-mono ll:text-micro ll:text-right ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${inputClassName}`}
      />
    </div>
  );
};

export default Slider;
