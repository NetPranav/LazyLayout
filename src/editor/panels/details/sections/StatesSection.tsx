"use client";

import React, { useState } from "react";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { Select } from "@/editor/components/Select";
import { NumberField } from "@/editor/components/NumberField";
import type { InspectorSectionProps } from "../types";

export const BUTTON_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;

export const BUTTON_TYPE_OPTIONS = [
  { value: "button", label: "Button" },
  { value: "submit", label: "Submit" },
  { value: "reset", label: "Reset" },
] as const;

export const StatesSection: React.FC<InspectorSectionProps> = ({
  className = "",
}) => {
  const [activeState, setActiveState] = useState<string>("default");

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* State Switch: Default, Hover, Pressed, Disabled */}
      <SegmentedControl
        size="sm"
        ariaLabel="Interactive state"
        value={activeState}
        onChange={setActiveState}
        options={[
          { value: "default", label: "Default", ariaLabel: "Default state" },
          { value: "hover", label: "Hover", ariaLabel: "Hover state" },
          { value: "pressed", label: "Pressed", ariaLabel: "Pressed state" },
          { value: "disabled", label: "Disabled", ariaLabel: "Disabled state" },
        ]}
      />

      {/* State Background Swatch & Hex Line */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:border ll:border-border">
        <span className="ll:w-4 ll:h-4 ll:rounded-xs ll:bg-white ll:border ll:border-border ll:shrink-0" />
        <span className="ll:text-small ll:font-mono ll:text-primary">
          FFFFFF
        </span>
        <div className="ll:flex-1" />
        <span className="ll:text-small ll:font-sans ll:text-muted">
          100%
        </span>
      </div>
    </div>
  );
};

export const StatesMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const btnSize = (getValue?.("button.size") as string) || "medium";
  const btnType = (getValue?.("button.type") as string) || "button";
  const ringWidth = (getValue?.("button.ringWidth") as number) ?? 2;
  const disabledOp = (getValue?.("button.disabledOpacity") as number) ?? 50;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Size"
          aria-label="Button size"
          value={btnSize}
          options={BUTTON_SIZE_OPTIONS}
          onChange={(v) => onUpdateProp?.("button.size", v)}
        />
        <Select
          size="sm"
          label="Type"
          aria-label="Button type"
          value={btnType}
          options={BUTTON_TYPE_OPTIONS}
          onChange={(v) => onUpdateProp?.("button.type", v)}
        />
      </div>
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          label="Ring"
          aria-label="Ring width"
          value={ringWidth}
          onChange={(v) => onUpdateProp?.("button.ringWidth", v)}
        />
        <NumberField
          size="sm"
          label="Dis"
          aria-label="Disabled opacity"
          suffix="%"
          value={disabledOp}
          onChange={(v) => onUpdateProp?.("button.disabledOpacity", v)}
        />
      </div>
    </div>
  );
};
