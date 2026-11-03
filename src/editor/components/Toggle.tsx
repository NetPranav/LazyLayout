"use client";

import React, { useRef, useEffect, useCallback, useId, useState } from "react";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, type Sim } from "../motion/loop";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = "md",
  className = "",
  "aria-label": ariaLabelProp,
  id: propId,
}) => {
  const generatedId = useId();
  const toggleId = propId ?? generatedId;
  const ariaLabel = ariaLabelProp ?? label;

  const trackRef = useRef<HTMLButtonElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<{ x: Spring; sim: Sim } | null>(null);
  const [pad] = useState(2);

  const isSm = size === "sm";

  // Calculate runtime travel from measured element widths
  const getTravelPositions = useCallback(() => {
    const track = trackRef.current;
    const knob = knobRef.current;
    if (track && knob) {
      const offX = pad;
      const onX = Math.max(0, track.clientWidth - knob.clientWidth - pad);
      return { offX, onX };
    }
    const offX = pad;
    const onX = isSm ? 12 : 16;
    return { offX, onX };
  }, [pad, isSm]);

  // Initialize pop spring for knob travel
  useEffect(() => {
    const { offX, onX } = getTravelPositions();
    const p = getActivePreset();
    const x = new Spring(checked ? onX : offX, p.pop);
    const sim: Sim = {
      sp: [x],
      apply: () => {
        if (knobRef.current) {
          knobRef.current.style.transform = `translate3d(${x.x.toFixed(2)}px, 0, 0)`;
        }
      },
    };
    springRef.current = { x, sim };

    return () => {
      if (springRef.current) {
        simRemove(springRef.current.sim);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate knob when checked state changes
  useEffect(() => {
    const sp = springRef.current;
    if (!sp) return;
    const { offX, onX } = getTravelPositions();
    const target = checked ? onX : offX;
    const p = getActivePreset();

    if (prefersReducedMotion()) {
      sp.x.jump(target);
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${target}px, 0, 0)`;
      }
      return;
    }

    sp.x.tune(p.pop);
    sp.x.to = target;
    simAdd(sp.sim);
}, [checked, getTravelPositions]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    onChange(!checked);
  }, [disabled, onChange, checked]);

  return (
    <label
      htmlFor={toggleId}
      className={`ll:inline-flex ll:items-center ll:gap-2 ll:cursor-pointer ll:select-none ll:font-sans ${
        disabled ? "ll:opacity-50 ll:cursor-not-allowed" : ""
      } ${className}`}
    >
      <button
        ref={trackRef}
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleToggle}
        className={`ll:relative ll:inline-flex ll:items-center ll:box-border ll:rounded-sm ll:border ll:transition-colors ll:duration-120 ll:shrink-0 ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
          isSm
            ? "ll:w-toggle-track-sm ll:h-toggle-track-sm"
            : "ll:w-toggle-track ll:h-toggle-track"
        } ${
          checked
            ? "ll:bg-control-primary ll:border-control-primary"
            : "ll:bg-surface-bar ll:border-border"
        }`}
      >
        {/* Rectangular knob with modest radius */}
        <div
          ref={knobRef}
          aria-hidden="true"
          className={`ll:absolute ll:rounded-xs ll:transition-colors ll:duration-120 ${
            isSm
              ? "ll:w-toggle-knob-sm ll:h-toggle-knob-sm"
              : "ll:w-toggle-knob ll:h-toggle-knob"
          } ${
            checked
              ? "ll:bg-control-primary-fg"
              : "ll:bg-surface-raised ll:border ll:border-border"
          }`}
        />
      </button>

      {(label || description) && (
        <span className="ll:flex ll:flex-col ll:leading-tight ll:font-sans">
          {label && (
            <span className="ll:text-body ll:font-medium ll:text-primary ll:font-sans">
              {label}
            </span>
          )}
          {description && (
            <span className="ll:text-small ll:text-secondary ll:font-sans">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
};
