"use client";

import React from "react";
import type { LucideProps } from "lucide-react";

/**
 * Custom motion icons sourced directly from P (editor-design-mode-blocks-dark.html).
 * Formatted as LucideIcon-compatible forwardRef components to pass through <Icon />.
 */

/** P #tb-auto: Auto-key toggle */
export const AutoKeyIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
      <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  )
);
AutoKeyIcon.displayName = "AutoKeyIcon";

/** P #tb-onion: Onion skin toggle */
export const OnionSkinIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M8 8h12v12H8Z" />
      <path d="M4 16V4h12" />
    </svg>
  )
);
OnionSkinIcon.displayName = "OnionSkinIcon";

/** P #split: Split clip (C) */
export const SplitIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </svg>
  )
);
SplitIcon.displayName = "SplitIcon";

/** P #tb-ease: Easing curve popover toggle */
export const EaseCurveIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 20C10 20 14 4 21 4" />
    </svg>
  )
);
EaseCurveIcon.displayName = "EaseCurveIcon";

/** P #kfadd: Add keyframe (K) */
export const AddKeyframeIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 3l9 9-9 9-9-9Z" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  )
);
AddKeyframeIcon.displayName = "AddKeyframeIcon";

/** Close / dismiss icon */
export const CloseIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.5, className = "", ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
);
CloseIcon.displayName = "CloseIcon";
