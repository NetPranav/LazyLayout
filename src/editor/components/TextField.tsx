"use client";

import React, { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { Icon } from "./Icon";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  prefixLabel?: string;
  error?: string;
  size?: "sm" | "md";
  mono?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    prefixLabel,
    error,
    size = "md",
    mono = false,
    disabled = false,
    className = "",
    id: propId,
    type = "text",
    placeholder,
    value,
    defaultValue,
    onChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = propId ?? generatedId;

  const isSm = size === "sm";
  const heightStyles = isSm ? "ll:h-7 ll:px-2 ll:gap-1.5" : "ll:h-8 ll:px-2.5 ll:gap-2";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-1 ll:w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none"
        >
          {label}
        </label>
      )}

      <div
        className={`ll:relative ll:inline-flex ll:items-center ll:box-border ll:rounded-sm ll:border ll:transition-colors ll:duration-100 ll:bg-surface-bar ${heightStyles} ${
          error
            ? "ll:border-primary"
            : "ll:border-border ll:hover:border-muted ll:focus-within:border-primary"
        } ${disabled ? "ll:opacity-40 ll:cursor-not-allowed" : ""}`}
      >
        {prefixLabel && (
          <span
            aria-hidden="true"
            className="ll:text-micro ll:font-mono ll:font-medium ll:text-muted ll:shrink-0 ll:select-none"
          >
            {prefixLabel}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          className={`ll:w-full ll:h-full ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary ll:placeholder:text-muted ${
            mono ? "ll:font-mono" : "ll:font-sans"
          } ${disabled ? "ll:cursor-not-allowed" : ""}`}
          {...props}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="ll:flex ll:items-center ll:gap-1.5 ll:text-micro ll:text-secondary ll:select-none"
        >
          <Icon icon={AlertCircle} size={12} className="ll:shrink-0 ll:text-secondary" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

