"use client";

import React from "react";
import { PenTool } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { TextField } from "@/editor/components/TextField";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import type { InspectorSectionProps } from "../types";

export const CAP_OPTIONS = [
  { value: "Butt", label: "Butt" },
  { value: "Round", label: "Round" },
  { value: "Square", label: "Square" },
] as const;

export const JOIN_OPTIONS = [
  { value: "Miter", label: "Miter" },
  { value: "Round", label: "Round" },
  { value: "Bevel", label: "Bevel" },
] as const;

export const IconSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const iconName = (getValue?.("icon.name") as string) || "star";
  const size = (getValue?.("icon.size") as number) ?? 24;
  const strokeWidth = (getValue?.("icon.strokeWidth") as number) ?? 1.5;
  const strokeColor = (getValue?.("icon.strokeColor") as string) || "FFFFFF";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <TextField
        size="sm"
        prefixLabel="Icon"
        aria-label="Icon name"
        value={iconName}
        onChange={(e) => onUpdateProp?.("icon.name", e.target.value)}
      />

      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          label="Size"
          aria-label="Icon size"
          value={size}
          step={1}
          onChange={(v) => onUpdateProp?.("icon.size", v)}
        />
        <NumberField
          size="sm"
          label={<Icon icon={PenTool} size={14} />}
          aria-label="Stroke width"
          value={strokeWidth}
          step={0.5}
          precision={1}
          onChange={(v) => onUpdateProp?.("icon.strokeWidth", v)}
        />
      </div>

      {/* Stroke Color */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <span
            className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
            style={{ backgroundColor: `#${strokeColor}` }}
          />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Stroke hex"
              value={strokeColor}
              onChange={(e) =>
                onUpdateProp?.(
                  "icon.strokeColor",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Stroke
        </span>
      </div>
    </div>
  );
};

export const IconMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const viewBox = (getValue?.("icon.viewBox") as string) || "0 0 24 24";
  const pathData =
    (getValue?.("icon.path") as string) ||
    "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z";
  const lineCap = (getValue?.("icon.lineCap") as string) || "Round";
  const lineJoin = (getValue?.("icon.lineJoin") as string) || "Round";
  const dashArray = (getValue?.("icon.dashArray") as string) || "";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <TextField
        size="sm"
        prefixLabel="View"
        aria-label="View box"
        value={viewBox}
        onChange={(e) => onUpdateProp?.("icon.viewBox", e.target.value)}
      />

      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted">Path</span>
        <textarea
          rows={3}
          aria-label="Path"
          value={pathData}
          onChange={(e) => onUpdateProp?.("icon.path", e.target.value)}
          className="ll:w-full ll:box-border ll:px-2 ll:py-1.5 ll:bg-surface-bar ll:border ll:border-border ll:hover:border-muted ll:focus:border-border-active ll:rounded-sm ll:font-mono ll:text-micro ll:text-primary ll:outline-none ll:resize-none"
        />
      </div>

      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <div className="ll:grid ll:grid-cols-2 ll:gap-2">
          <Select
            size="sm"
            label="Cap"
            aria-label="Line cap"
            value={lineCap}
            options={CAP_OPTIONS}
            onChange={(v) => onUpdateProp?.("icon.lineCap", v)}
          />
          <Select
            size="sm"
            label="Join"
            aria-label="Line join"
            value={lineJoin}
            options={JOIN_OPTIONS}
            onChange={(v) => onUpdateProp?.("icon.lineJoin", v)}
          />
        </div>
        <TextField
          size="sm"
          prefixLabel="Dash"
          aria-label="Dash array"
          value={dashArray}
          onChange={(e) => onUpdateProp?.("icon.dashArray", e.target.value)}
        />
      </div>
    </div>
  );
};
