"use client";

import React from "react";

export interface IconSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

/**
 * Lucide-compatible icons for PageSelector to satisfy lane isolation
 * and eliminate direct lucide-react imports.
 */

export const ChevronDown = React.forwardRef<SVGSVGElement, IconSvgProps>(
  ({ size = 16, strokeWidth = 1.5, className = "", ...props }, ref) => (
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
);
ChevronDown.displayName = "ChevronDown";

export const Check = React.forwardRef<SVGSVGElement, IconSvgProps>(
  ({ size = 16, strokeWidth = 1.5, className = "", ...props }, ref) => (
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
);
Check.displayName = "Check";

export const Search = React.forwardRef<SVGSVGElement, IconSvgProps>(
  ({ size = 16, strokeWidth = 1.5, className = "", ...props }, ref) => (
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
);
Search.displayName = "Search";

export const Plus = React.forwardRef<SVGSVGElement, IconSvgProps>(
  ({ size = 16, strokeWidth = 1.5, className = "", ...props }, ref) => (
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
);
Plus.displayName = "Plus";
