import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
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
    variant = "secondary",
    size = "md",
    iconOnly = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  const baseStyles =
    "ll:inline-flex ll:items-center ll:justify-center ll:box-border ll:font-sans ll:font-medium ll:select-none ll:shrink-0 ll:rounded-md ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary ll:focus-visible:ring-offset-2";

  // Sizes: sm is 28px, md is 32px
  let sizeStyles = "";
  if (size === "sm") {
    sizeStyles = iconOnly
      ? "ll:h-7 ll:w-7 ll:min-w-7 ll:p-0"
      : "ll:h-7 ll:px-2.5 ll:gap-1.5 ll:text-small";
  } else {
    sizeStyles = iconOnly
      ? "ll:h-8 ll:w-8 ll:min-w-8 ll:p-0"
      : "ll:h-8 ll:px-3 ll:gap-2 ll:text-small";
  }

  // Variants & states (instant hover on surface-panel, no color transitions)
  let variantStyles = "";
  if (variant === "primary") {
    variantStyles =
      "ll:bg-control-primary ll:text-control-primary-fg ll:border-0 ll:hover:opacity-90 ll:active:opacity-80 ll:disabled:opacity-40 ll:disabled:cursor-not-allowed";
  } else if (variant === "secondary") {
    variantStyles =
      "ll:bg-surface-raised ll:text-primary ll:border ll:border-border ll:hover:bg-surface-panel ll:active:bg-surface-canvas ll:disabled:opacity-40 ll:disabled:cursor-not-allowed ll:disabled:hover:bg-surface-raised";
  } else {
    // ghost
    variantStyles =
      "ll:bg-transparent ll:text-primary ll:border-0 ll:hover:bg-surface-panel ll:active:bg-surface-canvas ll:disabled:opacity-40 ll:disabled:cursor-not-allowed ll:disabled:hover:bg-transparent";
  }

  const spinnerSize = size === "sm" ? 14 : 16;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
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
