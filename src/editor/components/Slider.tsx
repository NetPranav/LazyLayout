"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Spring } from "@/editor/motion/spring";
import { simAdd, type Sim } from "@/editor/motion/loop";
import { prefersReducedMotion } from "@/editor/motion/feel";

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  formatValue?: (val: number) => string;
  format?: (val: number) => string;
  ariaLabel?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const SLD_SP: [number, number] = [0.26, 0.5];

export const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  unit = "",
  formatValue,
  format,
  ariaLabel = "Slider",
  label,
  className = "",
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectiveAriaLabel = label ?? ariaLabel;
  const effectiveFormat = format ?? formatValue;
  const [isDragging, setIsDragging] = useState(false);
  const [stretchX, setStretchX] = useState(0);

  const springRef = useRef<Spring | null>(null);
  const simRef = useRef<Sim | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);

  const dec = (String(step).split(".")[1] || "").length;

  const snapV = useCallback(
    (v: number): number => {
      const snapped = Math.round((v - min) / step) * step + min;
      return Math.max(min, Math.min(max, Number(snapped.toFixed(dec))));
    },
    [min, max, step, dec]
  );

  const kick = useCallback((targetStretch: number) => {
    if (prefersReducedMotion()) {
      setStretchX(0);
      return;
    }
    if (!springRef.current) {
      springRef.current = new Spring(0, SLD_SP);
      simRef.current = {
        sp: [springRef.current],
        apply: () => {
          if (springRef.current) {
            setStretchX(Number(springRef.current.x.toFixed(2)));
          }
        },
        rest: () => {
          if (springRef.current) {
            setStretchX(Number(springRef.current.x.toFixed(2)));
          }
        },
      };
    }
    springRef.current.to = targetStretch;
    if (simRef.current) simAdd(simRef.current);
  }, []);

  const fromPointerX = useCallback(
    (clientX: number): number => {
      const el = containerRef.current;
      if (!el) return value;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX - r.left - 3) / Math.max(1, r.width - 6)));
      return snapV(min + p * (max - min));
    },
    [min, max, snapV, value]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;

    el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
    setIsDragging(true);

    lastXRef.current = e.clientX;
    lastTimeRef.current = e.timeStamp;

    const nextVal = fromPointerX(e.clientX);
    onChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const now = e.timeStamp;
    const dt = Math.max(1, now - lastTimeRef.current);
    const vel = ((e.clientX - lastXRef.current) / dt) * 1000;

    lastXRef.current = e.clientX;
    lastTimeRef.current = now;

    const nextVal = fromPointerX(e.clientX);
    onChange(nextVal);

    kick(Math.max(-14, Math.min(14, vel * 0.012)));

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      kick(0);
    }, 70);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    kick(0);
    try {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let d = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      d = -step * (e.shiftKey ? 10 : 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      d = step * (e.shiftKey ? 10 : 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
      return;
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
      return;
    } else {
      return;
    }

    e.preventDefault();
    onChange(snapV(value + d));
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const clampedVal = Math.max(min, Math.min(max, value));
  const pct = max > min ? (clampedVal - min) / (max - min) : 0;
  const fillWidth = `calc(3px + (100% - 6px) * ${pct})`;
  const thumbLeft = `calc(3px + (100% - 6px) * ${pct} - 3px)`;

  const displayVal = effectiveFormat ? effectiveFormat(clampedVal) : `${clampedVal}${unit}`;

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedVal}
      aria-valuetext={displayVal}
      aria-label={effectiveAriaLabel}
      aria-disabled={disabled}
      className={`ll-sld ${isDragging ? "drag" : ""} ${disabled ? "ll:opacity-45 ll:cursor-not-allowed" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <i className="ll-sl-t" />
      <i className="ll-sl-f" style={{ width: fillWidth }} />
      <i
        className="ll-sl-h"
        style={{
          left: thumbLeft,
          transform: `translateX(${stretchX > 0 ? -stretchX : 0}px) scaleX(${1 + Math.abs(stretchX) / 6})`,
        }}
      />
      <b className="ll-sl-g" style={{ left: fillWidth }}>
        {displayVal}
      </b>
    </div>
  );
};

export default Slider;
