"use client";

import React from "react";
import { MoveHorizontal, MoveVertical } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import type { InspectorSectionProps } from "../types";

export const CAP_OPTIONS = [
  { value: "Butt", label: "Butt" },
  { value: "Round", label: "Round" },
  { value: "Square", label: "Square" },
] as const;

export const DividerSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const orientation = (getValue?.("divider.orientation") as string) || "horizontal";
  const style = (getValue?.("divider.style") as string) || "solid";
  const thickness = (getValue?.("divider.thickness") as number) ?? 1;
  const length = (getValue?.("divider.length") as number) ?? 528;
  const color = (getValue?.("divider.color") as string) || "444444";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Horizontal / Vertical */}
      <SegmentedControl
        size="sm"
        ariaLabel="Divider orientation"
        value={orientation}
        onChange={(v) => onUpdateProp?.("divider.orientation", v)}
        options={[
          {
            value: "horizontal",
            label: "Horizontal",
            icon: <Icon icon={MoveHorizontal} size={14} />,
            ariaLabel: "Horizontal",
          },
          {
            value: "vertical",
            label: "Vertical",
            icon: <Icon icon={MoveVertical} size={14} />,
            ariaLabel: "Vertical",
          },
        ]}
      />

      {/* Style: Solid, Dashed, Dotted */}
      <SegmentedControl
        size="sm"
        ariaLabel="Divider style"
        value={style}
        onChange={(v) => onUpdateProp?.("divider.style", v)}
        options={[
          { value: "solid", label: "Solid", ariaLabel: "Solid" },
          { value: "dashed", label: "Dashed", ariaLabel: "Dashed" },
          { value: "dotted", label: "Dotted", ariaLabel: "Dotted" },
        ]}
      />

      {/* Thickness & Length */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          label="Thick"
          aria-label="Thickness"
          value={thickness}
          step={1}
          onChange={(v) => onUpdateProp?.("divider.thickness", v)}
        />
        <NumberField
          size="sm"
          label="Length"
          aria-label="Length"
          value={length}
          step={1}
          onChange={(v) => onUpdateProp?.("divider.length", v)}
        />
      </div>

      {/* Divider color */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <span
            className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0"
            style={{ backgroundColor: `#${color}` }}
          />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Divider color hex"
              value={color}
              onChange={(e) =>
                onUpdateProp?.(
                  "divider.color",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Divider color
        </span>
      </div>
    </div>
  );
};

export const DividerMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const cap = (getValue?.("divider.cap") as string) || "Butt";
  const dashOffset = (getValue?.("divider.dashOffset") as number) ?? 0;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <Select
        size="sm"
        label="Cap"
        aria-label="Cap"
        value={cap}
        options={CAP_OPTIONS}
        onChange={(v) => onUpdateProp?.("divider.cap", v)}
      />
      <NumberField
        size="sm"
        label="Dash"
        aria-label="Dash offset"
        value={dashOffset}
        step={1}
        onChange={(v) => onUpdateProp?.("divider.dashOffset", v)}
      />
    </div>
  );
};
