"use client";

import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { TextField } from "@/editor/components/TextField";
import type { InspectorSectionProps } from "../types";

export const CounterSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const value = (getValue?.("counter.value") as number) ?? 1280;
  const prefix = (getValue?.("counter.prefix") as string) || "";
  const suffix = (getValue?.("counter.suffix") as string) || "+";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <div className="ll:w-full">
        <NumberField
          size="sm"
          label="Value"
          aria-label="Value"
          value={value}
          step={1}
          onChange={(v) => onUpdateProp?.("counter.value", v)}
        />
      </div>

      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <TextField
          size="sm"
          prefixLabel="Prefix"
          aria-label="Prefix"
          value={prefix}
          onChange={(e) => onUpdateProp?.("counter.prefix", e.target.value)}
        />
        <TextField
          size="sm"
          prefixLabel="Suffix"
          aria-label="Suffix"
          value={suffix}
          onChange={(e) => onUpdateProp?.("counter.suffix", e.target.value)}
        />
      </div>
    </div>
  );
};

export const CounterMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const decimals = (getValue?.("counter.decimals") as number) ?? 0;
  const separator = (getValue?.("counter.separator") as string) || ",";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <NumberField
        size="sm"
        label="Decimals"
        aria-label="Decimals"
        value={decimals}
        step={1}
        onChange={(v) => onUpdateProp?.("counter.decimals", v)}
      />
      <TextField
        size="sm"
        prefixLabel="Separator"
        aria-label="Separator"
        value={separator}
        onChange={(e) => onUpdateProp?.("counter.separator", e.target.value)}
      />
    </div>
  );
};
