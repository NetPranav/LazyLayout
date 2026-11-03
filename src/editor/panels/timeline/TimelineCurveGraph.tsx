"use client";

import React, { useState, useId } from "react";
import { Button } from "@/editor/components/Button";
import { PRESET_EASINGS } from "./constants";

export interface TimelineCurveGraphProps {
  onClose: () => void;
  onApplyEase?: (easeName: string) => void;
}

export const TimelineCurveGraph: React.FC<TimelineCurveGraphProps> = ({
  onClose,
  onApplyEase,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>("power2.out");
  const labelId = useId();

  const handleSelectPreset = (id: string) => {
    setSelectedPreset(id);
    onApplyEase?.(id);
  };

  return (
    <div
      role="region"
      aria-labelledby={labelId}
      className="ll-curve-graph ll:flex-1 ll:min-h-0 ll:flex ll:flex-col ll:bg-surface-panel ll:p-4 ll:overflow-y-auto"
    >
      <div className="ll:flex ll:items-center ll:justify-between ll:mb-3">
        <span
          id={labelId}
          className="ll:text-small ll:font-semibold ll:text-primary"
        >
          Keyframe Easing Curve (Graph Editor)
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back to Tracks
        </Button>
      </div>

      <div className="ll:grid ll:grid-cols-[1fr_220px] ll:gap-4 ll:flex-1 ll:min-h-0">
        {/* SVG Bezier Preview Canvas */}
        <div className="ll:bg-surface-bar ll:border ll:border-border ll:rounded-md ll:relative ll:flex ll:items-center ll:justify-center ll:overflow-hidden ll:p-4">
          <svg
            viewBox="0 0 200 120"
            className="ll:w-full ll:h-full ll:max-h-48 ll:text-primary"
          >
            {/* Grid lines */}
            <line
              x1="20"
              y1="100"
              x2="180"
              y2="100"
              stroke="var(--ll-border-color)"
              strokeDasharray="2,2"
            />
            <line
              x1="20"
              y1="20"
              x2="180"
              y2="20"
              stroke="var(--ll-border-color)"
              strokeDasharray="2,2"
            />

            {/* Bezier Path */}
            <path
              d={
                selectedPreset === "power2.out"
                  ? "M 20 100 C 60 20, 120 20, 180 20"
                  : selectedPreset === "power4.inOut"
                  ? "M 20 100 C 120 100, 80 20, 180 20"
                  : selectedPreset === "elastic.out"
                  ? "M 20 100 C 50 0, 90 35, 180 20"
                  : selectedPreset === "bounce.out"
                  ? "M 20 100 C 60 -10, 130 20, 180 20"
                  : "M 20 100 C 70 120, 110 20, 180 20"
              }
              fill="none"
              stroke="var(--ll-control-primary-bg)"
              strokeWidth="2"
            />

            {/* Start and End Anchor points */}
            <circle
              cx="20"
              cy="100"
              r="4"
              fill="var(--ll-control-primary-bg)"
            />
            <circle
              cx="180"
              cy="20"
              r="4"
              fill="var(--ll-control-primary-bg)"
            />
          </svg>
        </div>

        {/* Easing Presets Selector */}
        <div className="ll:flex ll:flex-col ll:gap-1.5">
          <span className="ll:text-micro ll:text-muted ll:font-medium">
            Presets
          </span>
          <div className="ll:flex ll:flex-col ll:gap-1 ll:overflow-y-auto">
            {PRESET_EASINGS.map((p) => {
              const active = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`ll:h-7 ll:px-2.5 ll:rounded-sm ll:text-small ll:text-left ll:flex ll:items-center ll:justify-between ll:transition-none ll:cursor-pointer ll:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ${
                    active
                      ? "ll:bg-select-bg ll:text-select-fg ll:font-medium"
                      : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
                  }`}
                >
                  <span className="ll:truncate">{p.name}</span>
                  <span className="ll:text-micro ll:text-muted">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
