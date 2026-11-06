"use client";

import React, { useState } from "react";
import { CutoutDialog } from "../CutoutDialog";
import { Select } from "@/editor/components/Select";
import { TextField } from "@/editor/components/TextField";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";
import { importFiles } from "@/core/assets/assetImport";
import { assetSrc } from "@/core/assets/useAssetUrl";
import { replaceImage } from "@/core/paint/paintOps";
import { getDocument } from "@/core/store/documentState";

/** Image fit as the picture's `object-fit`: Fill covers the box, Fit shows all of it, Crop keeps its own size. */
const FIT_TO_CSS: Record<string, string> = { fill: "cover", fit: "contain", crop: "none" };
const CSS_TO_FIT: Record<string, string> = { cover: "fill", fill: "fill", contain: "fit", "scale-down": "fit", none: "crop" };

/** "50% 30%" as the focal point's two numbers (centre is 50 50). */
function focalOf(position: unknown): [number, number] {
  if (typeof position !== "string") return [50, 50];
  const [x, y] = position.split(/\s+/).map((t) => (t === "left" || t === "top" ? 0 : t === "right" || t === "bottom" ? 100 : t === "center" ? 50 : parseFloat(t)));
  return [Number.isFinite(x) ? x : 50, Number.isFinite(y) ? y : 50];
}

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
  selectedIds,
  selectedId,
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const altValue = getValue?.("media.alt");
  const altText = typeof altValue === "string" ? altValue : "";
  const imageFit = CSS_TO_FIT[String(getValue?.("media.objectFit") ?? "cover")] ?? "fill";
  const src = String(getValue?.("media.src") ?? "");
  const fileName = src.startsWith("asset:") ? (getDocument().assets?.[src.slice(6)]?.name ?? "Image") : (src.split("/").pop() || "Image");
  const picker = React.useRef<HTMLInputElement>(null);
  const [cutting, setCutting] = useState(false);
  const ids = selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const replace = async (file: File | undefined) => {
    if (!file) return;
    const [outcome] = await importFiles([file]);
    if (outcome?.entry) replaceImage(ids, assetSrc(outcome.entry.id), outcome.entry.width && outcome.entry.height ? { w: outcome.entry.width, h: outcome.entry.height } : undefined);
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* File row: swatch thumb, filename, Replace action */}
      <div className="ll-dline ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border">
        <span className="ll-dsw ll-dth ll:w-4 ll:h-4 ll:rounded-xs ll:bg-surface-raised ll:border ll:border-border ll:shrink-0" />
        <span className="ll-dfn ll:text-small ll:font-mono ll:text-primary ll:truncate">
          {fileName}
        </span>
        <div className="ll:flex-1" />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="ll-dtxt ll:text-micro ll:font-sans ll:text-muted ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:outline-none"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => setCutting(true)}
          className="ll-dtxt ll:text-micro ll:font-sans ll:text-muted ll:hover:text-primary ll:bg-transparent ll:border-0 ll:cursor-pointer ll:outline-none ll:whitespace-nowrap"
        >
          Cut out
        </button>
        {cutting && selectedId && <CutoutDialog layerId={selectedId} onClose={() => setCutting(false)} />}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          aria-label="Replacement image"
          onChange={(e) => {
            void replace(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Image fit select */}
      <div className="ll:w-full">
        <Select
          size="sm"
          aria-label="Image fit"
          value={imageFit}
          options={IMAGE_FIT_OPTIONS}
          onChange={(v) => onUpdateProp?.("media.objectFit", FIT_TO_CSS[v] ?? "cover")}
        />
      </div>

      {/* Alt text field with "Alt" prefix */}
      <TextField
        size="sm"
        prefixLabel="Alt"
        aria-label="Alt text"
        value={altText}
        onChange={(e) => onUpdateProp?.("media.alt", e.target.value)}
      />
    </div>
  );
};

export const ImageMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const [focalX, focalY] = focalOf(getValue?.("media.objectPosition"));
  const ratio = String(getValue?.("media.aspectRatio") || "auto");

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="X"
          aria-label="Focal X"
          suffix="%"
          value={focalX}
          onChange={(v) => onUpdateProp?.("media.objectPosition", `${v}% ${focalY}%`)}
        />
        <NumberField
          size="sm"
          label="Y"
          aria-label="Focal Y"
          suffix="%"
          value={focalY}
          onChange={(v) => onUpdateProp?.("media.objectPosition", `${focalX}% ${v}%`)}
        />
      </div>
      <Select
        size="sm"
        label="Ratio"
        aria-label="Aspect ratio"
        value={ratio}
        options={ASPECT_RATIO_OPTIONS}
        onChange={(v) => onUpdateProp?.("media.aspectRatio", v)}
      />
    </div>
  );
};
