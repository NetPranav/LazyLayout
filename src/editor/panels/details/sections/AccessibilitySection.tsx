"use client";

import React from "react";
import { Select } from "@/editor/components/Select";
import { TextField } from "@/editor/components/TextField";
import { Toggle } from "@/editor/components/Toggle";
import { ACCESSIBILITY_ROLE_OPTIONS } from "../constants";
import type { InspectorSectionProps } from "../types";

export const AccessibilitySection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const role = (getValue?.("a11y.role") as string) || "auto";
  const ariaLabel = (getValue?.("a11y.label") as string) || "";
  const ariaHidden = (getValue?.("a11y.hidden") as boolean) ?? false;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ll:w-full ${className}`}>
      {/* Role Select */}
      <Select
        size="sm"
        label="Role"
        aria-label="ARIA role"
        value={role}
        options={ACCESSIBILITY_ROLE_OPTIONS}
        onChange={(val) => onUpdateProp?.("a11y.role", val)}
      />

      {/* Accessible Label / Alt text */}
      <TextField
        size="sm"
        label="ARIA Label"
        placeholder="Describe element for screen readers..."
        value={ariaLabel}
        onChange={(e) => onUpdateProp?.("a11y.label", e.target.value)}
      />

      {/* Aria Hidden Toggle */}
      <div className="ll:flex ll:items-center ll:justify-between ll:py-1">
        <span className="ll:text-small ll:font-mono ll:text-primary">
          Hide from screen readers
        </span>
        <Toggle
          size="sm"
          checked={ariaHidden}
          onChange={(checked) => onUpdateProp?.("a11y.hidden", checked)}
        />
      </div>
    </div>
  );
};
