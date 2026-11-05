"use client";
import React, { useState, useEffect } from "react";
import { Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { ACCESSIBILITY_ROLE_OPTIONS } from "../constants";
import type { InspectorSectionProps } from "../types";

export interface AccessibilitySectionProps extends InspectorSectionProps {
  onAddA11yRef?: { current?: () => void };
}

const fieldClass =
  "ll-dfield ll:flex ll:items-center ll:gap-1.5 ll:h-7 ll:px-1.5 ll:bg-surface-bar ll:rounded-sm";
const inputClass =
  "ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-sans ll:text-small ll:text-primary ll:outline-none";

export const HTML_TAG_OPTIONS = [
  { value: "div", label: "div" },
  { value: "section", label: "section" },
  { value: "header", label: "header" },
  { value: "nav", label: "nav" },
  { value: "main", label: "main" },
  { value: "footer", label: "footer" },
  { value: "button", label: "button" },
  { value: "a", label: "a" },
] as const;

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({
  getValue,
  onUpdateProp,
  onAddA11yRef,
  className = "",
}) => {
  const [hasA11y, setHasA11y] = useState(false);

  const handleAdd = () => {
    setHasA11y(true);
  };

  useEffect(() => {
    if (onAddA11yRef) {
      onAddA11yRef.current = handleAdd;
    }
  });

  const htmlTag = (getValue?.("a11y.tag") as string) || "div";
  const ariaLabel = (getValue?.("a11y.label") as string) || "";
  const role = (getValue?.("a11y.role") as string) || "";
  const isDisabled = (getValue?.("a11y.disabled") as boolean) ?? false;

  if (!hasA11y) {
    return null;
  }

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <div className="ll-dr ll:flex ll:items-center ll:gap-1 ll:h-8 ll:px-1">
        <div className="ll:flex-1 ll:min-w-0">
          <Select
            size="sm"
            aria-label="HTML tag"
            value={htmlTag}
            options={HTML_TAG_OPTIONS}
            onChange={(val) => onUpdateProp?.("a11y.tag", val)}
          />
        </div>
        <button
          type="button"
          aria-label="Remove accessibility"
          title="Remove accessibility"
          onClick={() => setHasA11y(false)}
          className="ll-ib ll:w-6 ll:h-6 ll:grid ll:place-items-center ll:rounded-sm ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:bg-transparent ll:border-0 ll:p-0 ll:outline-none"
        >
          <Icon icon={Minus} size={14} />
        </button>
      </div>

      <div className={fieldClass} title="Label">
        <span className="ll:font-mono ll:text-micro ll:text-muted">Label</span>
        <input
          type="text"
          aria-label="Accessible name"
          placeholder="Accessible name"
          value={ariaLabel}
          onChange={(e) => onUpdateProp?.("a11y.label", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className={fieldClass} title="Role">
        <span className="ll:font-mono ll:text-micro ll:text-muted">Role</span>
        <input
          type="text"
          aria-label="e.g. region"
          placeholder="e.g. region"
          value={role}
          onChange={(e) => onUpdateProp?.("a11y.role", e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="ll:flex ll:items-center ll:gap-2 ll:h-7 ll:text-small ll:text-primary ll:cursor-pointer">
        <input
          type="checkbox"
          checked={isDisabled}
          onChange={(e) => onUpdateProp?.("a11y.disabled", e.target.checked)}
          className="ll:m-0 ll:w-3.5 ll:h-3.5"
        />
        Disabled
      </label>
    </div>
  );
};
