"use client";

import React, { useMemo, useCallback } from "react";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import {
  EASING_PRESETS,
  INSPECTOR_CONSTANTS,
  type CubicBezierCurve,
} from "../constants";

export interface EasingCurveBoxProps {
  curve?: CubicBezierCurve;
  onChange?: (curve: CubicBezierCurve) => void;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_CURVE: CubicBezierCurve = EASING_PRESETS[2]; // Ease out (0, 0, 0.58, 1)

export const EasingCurveBox: React.FC<EasingCurveBoxProps> = ({
  curve = DEFAULT_CURVE,
  onChange,
  disabled = false,
  className = "",
}) => {
  const { x1, y1, x2, y2 } = curve;

  // Compute SVG control points in 100x100 space
  const pad = INSPECTOR_CONSTANTS.CURVE_PAD_START; // 6
  const range = INSPECTOR_CONSTANTS.CURVE_RANGE;   // 88

  const startX = pad;
  const startY = pad + range; // 94
  const endX = pad + range;   // 94
  const endY = pad;           // 6

  const cp1X = Math.round(startX + range * Math.max(0, Math.min(1, x1)));
  const cp1Y = Math.round(startY - range * y1);
  const cp2X = Math.round(startX + range * Math.max(0, Math.min(1, x2)));
  const cp2Y = Math.round(startY - range * y2);

  const pathD = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

  const currentPreset = useMemo(() => {
    const found = EASING_PRESETS.find(
      (p) =>
        Math.abs(p.x1 - x1) < 0.02 &&
        Math.abs(p.y1 - y1) < 0.02 &&
        Math.abs(p.x2 - x2) < 0.02 &&
        Math.abs(p.y2 - y2) < 0.02
    );
    return found ? found.name : "Custom";
  }, [x1, y1, x2, y2]);

  const presetOptions = useMemo(() => {
    const opts = EASING_PRESETS.map((p) => ({
      value: p.name,
      label: p.name,
    }));
    if (currentPreset === "Custom") {
      return [...opts, { value: "Custom", label: "Custom" }];
    }
    return opts;
  }, [currentPreset]);

  const handlePresetChange = useCallback(
    (name: string) => {
      const match = EASING_PRESETS.find((p) => p.name === name);
      if (match) {
        onChange?.(match);
      }
    },
    [onChange]
  );

  const handleUpdate = useCallback(
    (param: "x1" | "y1" | "x2" | "y2", val: number) => {
      const updated: CubicBezierCurve = {
        name: "Custom",
        x1: param === "x1" ? val : x1,
        y1: param === "y1" ? val : y1,
        x2: param === "x2" ? val : x2,
        y2: param === "y2" ? val : y2,
      };
      onChange?.(updated);
    },
    [x1, y1, x2, y2, onChange]
  );

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Preset selector */}
      <Select
        size="sm"
        disabled={disabled}
        aria-label="Easing preset"
        value={currentPreset}
        options={presetOptions}
        onChange={handlePresetChange}
      />

      <div className="ll:flex ll:gap-3 ll:items-center">
        {/* SVG Easing Curve Display */}
        <div
          role="img"
          aria-label={`Bezier curve: (${x1}, ${y1}, ${x2}, ${y2})`}
          className="ecurve ll:w-24 ll:h-24 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-sm ll:p-1 ll:shrink-0 ll:relative ll:overflow-hidden"
        >
          <svg
            viewBox="0 0 100 100"
            className="ll:w-full ll:h-full ll:block"
            preserveAspectRatio="none"
          >
            {/* Diagonal reference baseline */}
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="var(--ll-border-color)"
              strokeDasharray="2,2"
              strokeWidth={1}
            />

            {/* Handle 1 line and dot */}
            <line
              x1={startX}
              y1={startY}
              x2={cp1X}
              y2={cp1Y}
              stroke="var(--ll-text-muted)"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <circle
              cx={cp1X}
              cy={cp1Y}
              r={2.5}
              fill="var(--ll-text-primary)"
            />

            {/* Handle 2 line and dot */}
            <line
              x1={endX}
              y1={endY}
              x2={cp2X}
              y2={cp2Y}
              stroke="var(--ll-text-muted)"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <circle
              cx={cp2X}
              cy={cp2Y}
              r={2.5}
              fill="var(--ll-text-primary)"
            />

            {/* Main cubic curve */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--ll-text-primary)"
              strokeWidth={1.5}
            />
          </svg>
        </div>

        {/* 2x2 Grid of x1, y1, x2, y2 NumberFields with scrub */}
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <NumberField
            size="sm"
            label="x1"
            value={x1}
            step={INSPECTOR_CONSTANTS.STEP_FINE}
            precision={2}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(val) => handleUpdate("x1", val)}
          />
          <NumberField
            size="sm"
            label="y1"
            value={y1}
            step={INSPECTOR_CONSTANTS.STEP_FINE}
            precision={2}
            disabled={disabled}
            onChange={(val) => handleUpdate("y1", val)}
          />
          <NumberField
            size="sm"
            label="x2"
            value={x2}
            step={INSPECTOR_CONSTANTS.STEP_FINE}
            precision={2}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(val) => handleUpdate("x2", val)}
          />
          <NumberField
            size="sm"
            label="y2"
            value={y2}
            step={INSPECTOR_CONSTANTS.STEP_FINE}
            precision={2}
            disabled={disabled}
            onChange={(val) => handleUpdate("y2", val)}
          />
        </div>
      </div>
    </div>
  );
};
