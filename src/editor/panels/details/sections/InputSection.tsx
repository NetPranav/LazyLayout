"use client";

import React from "react";
import { Select } from "@/editor/components/Select";
import { TextField } from "@/editor/components/TextField";
import { Checkbox } from "@/editor/components/Checkbox";
import type { InspectorSectionProps } from "../types";

export const INPUT_TYPE_OPTIONS = [
  { value: "Text", label: "Text" },
  { value: "Email", label: "Email" },
  { value: "Password", label: "Password" },
  { value: "Number", label: "Number" },
] as const;

export const InputSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const inputType = (getValue?.("input.type") as string) || "Email";
  const placeholder = (getValue?.("input.placeholder") as string) || "you@example.com";
  const value = (getValue?.("input.value") as string) || "";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <Select
        size="sm"
        aria-label="Input type"
        value={inputType}
        options={INPUT_TYPE_OPTIONS}
        onChange={(v) => onUpdateProp?.("input.type", v)}
      />
      <TextField
        size="sm"
        prefixLabel="Placeholder"
        aria-label="Placeholder"
        value={placeholder}
        onChange={(e) => onUpdateProp?.("input.placeholder", e.target.value)}
      />
      <TextField
        size="sm"
        prefixLabel="Value"
        aria-label="Value"
        value={value}
        onChange={(e) => onUpdateProp?.("input.value", e.target.value)}
      />
    </div>
  );
};

export const InputMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const required = (getValue?.("input.required") as boolean) || false;
  const readOnly = (getValue?.("input.readOnly") as boolean) || false;
  const pattern = (getValue?.("input.pattern") as string) || "";
  const errorMessage = (getValue?.("input.errorMessage") as string) || "Enter a valid email";

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      <div className="ll:flex ll:flex-col ll:gap-1.5">
        <Checkbox
          label="Required"
          checked={required}
          onChange={(v) => onUpdateProp?.("input.required", v)}
        />
        <Checkbox
          label="Read only"
          checked={readOnly}
          onChange={(v) => onUpdateProp?.("input.readOnly", v)}
        />
      </div>
      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <TextField
          size="sm"
          prefixLabel="Pattern"
          aria-label="Pattern"
          value={pattern}
          onChange={(e) => onUpdateProp?.("input.pattern", e.target.value)}
        />
        <TextField
          size="sm"
          prefixLabel="Error"
          aria-label="Error message"
          value={errorMessage}
          onChange={(e) => onUpdateProp?.("input.errorMessage", e.target.value)}
        />
      </div>
    </div>
  );
};
