"use client";

import React, { forwardRef, useRef, useImperativeHandle } from "react";
import { pressEl } from "../motion/surface";

export type ButtonVariant = "default" | "strong" | "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    iconOnly = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
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

  const isDisabled = disabled || loading;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDisabled && innerRef.current) {
      pressEl(innerRef.current, true);
    }
    onPointerDown?.(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDisabled && innerRef.current) {
      pressEl(innerRef.current, false);
    }
    onPointerUp?.(e);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDisabled && innerRef.current) {
      pressEl(innerRef.current, false);
    }
    onPointerLeave?.(e);
  };

  const baseStyles =
  "ll:inline-flex ll:items-center ll:justify-center ll:box-border ll:font-sans ll:font-medium ll:select-none ll:shrink-0 ll:cursor-pointer ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset";

  // Sizes: sm is 24px/28px (modest radius sm 4px), md is 32px (modest radius md 6px). No pill shapes.
  let sizeStyles = "";
  if (size === "sm") {
    sizeStyles = iconOnly
      ? "ll:h-7 ll:w-7 ll:min-w-7 ll:p-0 ll:rounded-sm"
      : "ll:h-7 ll:px-2.5 ll:gap-1.5 ll:text-body ll:rounded-sm";
  } else {
    sizeStyles = iconOnly
      ? "ll:h-8 ll:w-8 ll:min-w-8 ll:p-0 ll:rounded-md"
      : "ll:h-8 ll:px-3 ll:gap-2 ll:text-body ll:rounded-md";
  }

  // Variants & states
  let variantStyles = "";
  if (variant === "primary") {
    variantStyles =
      "ll:bg-control-primary ll:text-control-primary-fg ll:border-0 ll:hover:opacity-90 ll:active:opacity-80";
  } else if (variant === "strong") {
    variantStyles =
      "ll:bg-surface-panel ll:text-primary ll:border ll:border-primary ll:hover:bg-surface-hover ll:active:bg-control-active";
  } else if (variant === "ghost") {
    variantStyles =
      "ll:bg-transparent ll:text-primary ll:border-0 ll:hover:bg-surface-hover ll:active:bg-control-active";
  } else {
    // default (P:36 transparent with border) and secondary alias
    variantStyles =
      "ll:bg-transparent ll:text-primary ll:border ll:border-border ll:hover:bg-surface-hover ll:active:bg-control-active";
  }

  const disabledStyles =
    "ll:disabled:bg-surface-canvas ll:disabled:text-muted ll:disabled:border-border ll:disabled:cursor-not-allowed ll:disabled:hover:bg-surface-canvas";

  const spinnerSize = size === "sm" ? 14 : 16;

  return (
    <button
      ref={innerRef}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`${iconOnly ? "ll-ib " : ""}${baseStyles} ${sizeStyles} ${variantStyles} ${disabledStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="ll-spinner-spin"
          width={spinnerSize}
          height={spinnerSize}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="28"
            strokeDashoffset="10"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {iconOnly
        ? !loading && children
        : children && <span className={loading ? "ll:opacity-60" : undefined}>{children}</span>}
      {!loading && rightIcon}
    </button>
  );
});
