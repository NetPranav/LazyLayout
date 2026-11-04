"use client";

import React, { forwardRef, useRef, useImperativeHandle } from "react";
import { pressEl } from "../motion/surface";
import { Tooltip } from "./Tooltip";

export type IconButtonSize = "sm" | "md" | "lg" | "tall";
export type IconButtonVariant = "ghost" | "secondary" | "subtle";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label describing the button action. Required for screen readers. */
  "aria-label": string;
  /** Optional icon to render inside. */
  icon?: React.ReactNode;
  /** Optional tooltip text. Defaults to aria-label if true or string. */
  tooltip?: string | boolean;
  /** Button sizing: sm is 24x24px, md is 28x28px, lg is 40x40px (canvas tool bars), tall is 32x40px (the panels toggle). Default is md. */
  size?: IconButtonSize;
  /** Visual variant: ghost (transparent), secondary (bordered), subtle (raised). Default is ghost. */
  variant?: IconButtonVariant;
  /** Pressed / toggled active state. */
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    "aria-label": ariaLabel,
    icon,
    children,
    tooltip,
    size = "md",
    variant = "ghost",
    pressed = false,
    disabled = false,
    className = "",
    type = "button",
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    ...props
  },
  ref
) {
  const innerRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLButtonElement);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!disabled && innerRef.current) {
      pressEl(innerRef.current, true);
    }
    onPointerDown?.(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!disabled && innerRef.current) {
      pressEl(innerRef.current, false);
    }
    onPointerUp?.(e);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!disabled && innerRef.current) {
      pressEl(innerRef.current, false);
    }
    onPointerLeave?.(e);
  };

  // Apple-level layout: modest radius (sm: 4px), strict alignment, no pills
  const sizeStyles =
    size === "sm"
      ? "ll:w-6 ll:h-6 ll:min-w-6 ll:min-h-6 ll:text-title"
      : size === "lg"
        ? "ll:w-10 ll:h-10 ll:min-w-10 ll:min-h-10 ll:text-lead"
        : size === "tall"
          ? "ll:w-8 ll:h-10 ll:min-w-8 ll:min-h-10 ll:text-lead"
          : "ll:w-7 ll:h-7 ll:min-w-7 ll:min-h-7 ll:text-lead";

let variantStyles = "";
if (pressed) {
  variantStyles = "ll:bg-select-bg ll:text-select-fg ll:border-0";
} else if (variant === "secondary") {
  variantStyles =
    "ll:bg-surface-raised ll:text-secondary ll:border ll:border-border ll:hover:bg-surface-hover ll:hover:text-primary ll:active:bg-control-active";
} else if (variant === "subtle") {
  variantStyles =
    "ll:bg-surface-bar ll:text-secondary ll:border-0 ll:hover:bg-surface-hover ll:hover:text-primary ll:active:bg-control-active";
} else {
  // ghost
  variantStyles =
    "ll:bg-transparent ll:text-secondary ll:border-0 ll:hover:bg-surface-hover ll:hover:text-primary ll:active:bg-control-active";
}

const baseStyles =
"ll:inline-grid ll:place-items-center ll:box-border ll:select-none ll:shrink-0 ll:rounded-sm ll:transition-none ll:cursor-pointer ll:font-sans ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ll:disabled:opacity-40 ll:disabled:cursor-not-allowed ll:disabled:hover:bg-transparent ll:disabled:hover:text-secondary";

const buttonElement = (
  <button
    ref={innerRef}
    type={type}
    aria-label={ariaLabel}
    aria-pressed={pressed ? "true" : undefined}
    disabled={disabled}
    onPointerDown={handlePointerDown}
    onPointerUp={handlePointerUp}
    onPointerLeave={handlePointerLeave}
    className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
    {...props}
  >
    {icon ?? children}
  </button>
);

const tooltipText = typeof tooltip === "string" ? tooltip : tooltip === true ? ariaLabel : null;

if (tooltipText && !disabled) {
  return <Tooltip content={tooltipText}>{buttonElement}</Tooltip>;
}

return buttonElement;
});

