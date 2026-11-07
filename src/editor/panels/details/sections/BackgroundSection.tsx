"use client";

import React from "react";
import { ColorSwatch } from "../controls/ColorSwatch";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export const BG_TYPE_OPTIONS = [
  { value: "Solid", label: "Solid" },
  { value: "Gradient", label: "Gradient" },
  { value: "Pattern", label: "Pattern" },
  { value: "Noise", label: "Noise" },
] as const;

export const PATTERN_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Dots", label: "Dots" },
  { value: "Grid", label: "Grid" },
  { value: "Lines", label: "Lines" },
] as const;

export const BLEND_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Multiply", label: "Multiply" },
  { value: "Screen", label: "Screen" },
  { value: "Overlay", label: "Overlay" },
  { value: "Darken", label: "Darken" },
  { value: "Lighten", label: "Lighten" },
] as const;

export const BackgroundSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const bgType = (getValue?.("background.type") as string) || "Solid";
  const bgColor = (getValue?.("background.color") as string) || "1E1E1E";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <Select
        size="sm"
        aria-label="Background type"
        value={bgType}
        options={BG_TYPE_OPTIONS}
        onChange={(v) => onUpdateProp?.("background.type", v)}
      />

      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <ColorSwatch label="Background colour picker" hex={bgColor} onChange={(h) => onUpdateProp?.("background.color", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Background color hex"
              value={bgColor}
              onChange={(e) =>
                onUpdateProp?.(
                  "background.color",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Background color
        </span>
      </div>
    </div>
  );
};

export const BackgroundMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const angle = (getValue?.("background.angle") as number) ?? 180;
  const noise = (getValue?.("background.noise") as number) ?? 10;
  const pattern = (getValue?.("background.pattern") as string) || "None";
  const parallax = (getValue?.("background.parallax") as number) ?? 0;
  const blend = (getValue?.("background.blend") as string) || "Normal";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="Angle"
          aria-label="Gradient angle"
          suffix="°"
          value={angle}
          onChange={(v) => onUpdateProp?.("background.angle", v)}
        />
        <NumberField
          size="sm"
          label="Noise"
          aria-label="Noise opacity"
          suffix="%"
          value={noise}
          onChange={(v) => onUpdateProp?.("background.noise", v)}
        />
      </div>

      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <Select
          size="sm"
          label="Pattern"
          aria-label="Pattern"
          value={pattern}
          options={PATTERN_OPTIONS}
          onChange={(v) => onUpdateProp?.("background.pattern", v)}
        />
        <NumberField
          size="sm"
          label="Parallax"
          aria-label="Parallax speed"
          value={parallax}
          onChange={(v) => onUpdateProp?.("background.parallax", v)}
        />
        <Select
          size="sm"
          label="Blend"
          aria-label="Background blend"
          value={blend}
          options={BLEND_OPTIONS}
          onChange={(v) => onUpdateProp?.("background.blend", v)}
        />
      </div>
    </div>
  );
};
