"use client";

import React from "react";
import { Select } from "@/editor/components/Select";
import { TextField } from "@/editor/components/TextField";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export const IMAGE_FIT_OPTIONS = [
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
  { value: "crop", label: "Crop" },
] as const;

export const ASPECT_RATIO_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
] as const;

export const ImageSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const altText = (getValue?.("content.alt") as string) || "Hero image";
  const imageFit = (getValue?.("appearance.imageFit") as string) || "fill";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* File row: swatch thumb, filename, Replace action */}
      <div className="ll-dline ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border">
        <span className="ll-dsw ll-dth ll:w-4 ll:h-4 ll:rounded-xs ll:bg-surface-raised ll:border ll:border-border ll:shrink-0" />
        <span className="ll-dfn ll:text-small ll:font-mono ll:text-primary ll:truncate">
          hero.jpg
        </span>
        <div className="ll:flex-1" />
        <button
          type="button"
          className="ll-dtxt ll:text-micro ll:font-sans ll:text-muted ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:outline-none"
        >
          Replace
        </button>
      </div>

      {/* Image fit select */}
      <div className="ll:w-full">
        <Select
          size="sm"
          aria-label="Image fit"
          value={imageFit}
          options={IMAGE_FIT_OPTIONS}
          onChange={(v) => onUpdateProp?.("appearance.imageFit", v)}
        />
      </div>

      {/* Alt text field with "Alt" prefix */}
      <TextField
        size="sm"
        prefixLabel="Alt"
        aria-label="Alt text"
        value={altText}
        onChange={(e) => onUpdateProp?.("content.alt", e.target.value)}
      />
    </div>
  );
};

export const ImageMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const focalX = (getValue?.("image.focalX") as number) ?? 50;
  const focalY = (getValue?.("image.focalY") as number) ?? 50;
  const ratio = (getValue?.("image.aspectRatio") as string) || "auto";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="X"
          aria-label="Focal X"
          suffix="%"
          value={focalX}
          onChange={(v) => onUpdateProp?.("image.focalX", v)}
        />
        <NumberField
          size="sm"
          label="Y"
          aria-label="Focal Y"
          suffix="%"
          value={focalY}
          onChange={(v) => onUpdateProp?.("image.focalY", v)}
        />
      </div>
      <Select
        size="sm"
        label="Ratio"
        aria-label="Aspect ratio"
        value={ratio}
        options={ASPECT_RATIO_OPTIONS}
        onChange={(v) => onUpdateProp?.("image.aspectRatio", v)}
      />
    </div>
  );
};
