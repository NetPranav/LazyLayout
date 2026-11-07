"use client";

import React from "react";
import { ColorSwatch } from "../controls/ColorSwatch";
import { Select } from "@/editor/components/Select";
import { Checkbox } from "@/editor/components/Checkbox";
import type { InspectorSectionProps } from "../types";

export const TOGGLE_SIZE_OPTIONS = [
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
] as const;

export const ToggleSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const isChecked = (getValue?.("toggle.checked") as boolean) ?? true;
  const toggleSize = (getValue?.("toggle.size") as string) || "Medium";
  const activeColor = (getValue?.("toggle.activeColor") as string) || "34C759";
  const inactiveColor = (getValue?.("toggle.inactiveColor") as string) || "8E8E93";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <Checkbox
        label="Checked"
        checked={isChecked}
        onChange={(v) => onUpdateProp?.("toggle.checked", v)}
      />
      <Select
        size="sm"
        aria-label="Toggle size"
        value={toggleSize}
        options={TOGGLE_SIZE_OPTIONS}
        onChange={(v) => onUpdateProp?.("toggle.size", v)}
      />

      {/* Active Color */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <ColorSwatch label="Active colour picker" hex={activeColor} onChange={(h) => onUpdateProp?.("toggle.activeColor", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Active hex"
              value={activeColor}
              onChange={(e) =>
                onUpdateProp?.(
                  "toggle.activeColor",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Active
        </span>
      </div>

      {/* Inactive Color */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <ColorSwatch label="Inactive colour picker" hex={inactiveColor} onChange={(h) => onUpdateProp?.("toggle.inactiveColor", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Inactive hex"
              value={inactiveColor}
              onChange={(e) =>
                onUpdateProp?.(
                  "toggle.inactiveColor",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Inactive
        </span>
      </div>
    </div>
  );
};
