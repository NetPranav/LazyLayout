"use client";

import React, { useId, useCallback } from "react";
import { Check, Minus } from "lucide-react";
import { Icon } from "./Icon";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  indeterminate = false,
  label,
  description,
  disabled = false,
  className = "",
  id: propId,
  "aria-label": ariaLabel,
}) => {
  const generatedId = useId();
  const checkboxId = propId ?? generatedId;

  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [disabled, onChange, checked]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [disabled, handleClick]
  );

  const isCheckedOrIndeterminate = checked || indeterminate;

  return (
    <label
      htmlFor={checkboxId}
      className={`ll:inline-flex ll:items-start ll:gap-2.5 ll:select-none ll:cursor-pointer ${
        disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""
      } ${className}`}
    >
      <button
        id={checkboxId}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`ll:relative ll:inline-grid ll:place-items-center ll:box-border ll:w-4 ll:h-4 ll:min-w-4 ll:min-h-4 ll:mt-0.5 ll:rounded-sm ll:border ll:transition-colors ll:duration-120 ll:shrink-0 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
          isCheckedOrIndeterminate
            ? "ll:bg-control-primary ll:border-control-primary ll:text-control-primary-fg"
            : "ll:bg-surface-bar ll:border-border ll:text-transparent ll:hover:border-secondary"
        }`}
      >
        {indeterminate ? (
          <Icon
            icon={Minus}
            size={12}
            className="ll:animate-in ll:fade-in ll:zoom-in-75 ll:duration-150"
          />
        ) : (
          <Icon
            icon={Check}
            size={12}
            className={`ll:transition-transform ll:duration-150 ${
              checked
                ? "ll:scale-100 ll:opacity-100"
                : "ll:scale-50 ll:opacity-0"
            }`}
          />
        )}
      </button>

      {(label || description) && (
        <span className="ll:flex ll:flex-col ll:leading-tight">
          {label && (
            <span className="ll:text-body ll:font-medium ll:text-primary">{label}</span>
          )}
          {description && (
            <span className="ll:text-small ll:text-secondary">{description}</span>
          )}
        </span>
      )}
    </label>
  );
};

