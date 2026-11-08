"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

export interface IconSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

/**
 * Clean Lucide-compatible icon components for Lane B1 pickers.
 * Conforms to Lazy Layout icon spec: 1.5 default stroke width, 24x24 viewBox.
 * Sourced directly from Lucide SVG geometries to eliminate direct lucide-react imports.
 */

const PipetteSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12" />
      <path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z" />
      <path d="m2 22 .414-.414" />
    </svg>
  )
);
PipetteSvg.displayName = "Pipette";

const PlusSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
PlusSvg.displayName = "Plus";

const LinkIconSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
);
LinkIconSvg.displayName = "LinkIcon";

const CheckSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
);
CheckSvg.displayName = "Check";

const SearchSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  )
);
SearchSvg.displayName = "Search";

const XSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
);
XSvg.displayName = "X";

const SlidersSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="M10 8h4" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M17 16h4" />
      <path d="M19 12V3" />
      <path d="M19 21v-5" />
      <path d="M3 14h4" />
      <path d="M5 10V3" />
      <path d="M5 21v-7" />
    </svg>
  )
);
SlidersSvg.displayName = "Sliders";

const TypeSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <path d="M12 4v16" />
      <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
      <path d="M9 20h6" />
    </svg>
  )
);
TypeSvg.displayName = "Type";

const FrameSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <line x1="22" x2="2" y1="6" y2="6" />
      <line x1="22" x2="2" y1="18" y2="18" />
      <line x1="6" x2="6" y1="2" y2="22" />
      <line x1="18" x2="18" y1="2" y2="22" />
    </svg>
  )
);
FrameSvg.displayName = "Frame";

const MoreHorizontalSvg = React.forwardRef<SVGSVGElement, IconSvgProps>(
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
);
MoreHorizontalSvg.displayName = "MoreHorizontal";

/** Typed as LucideIcon so they pass through the shared Icon wrapper (1.5 stroke, size). */
export const Pipette = PipetteSvg as unknown as LucideIcon;
export const Plus = PlusSvg as unknown as LucideIcon;
export const LinkIcon = LinkIconSvg as unknown as LucideIcon;
export const Check = CheckSvg as unknown as LucideIcon;
export const Search = SearchSvg as unknown as LucideIcon;
export const X = XSvg as unknown as LucideIcon;
export const Sliders = SlidersSvg as unknown as LucideIcon;
export const Type = TypeSvg as unknown as LucideIcon;
export const Frame = FrameSvg as unknown as LucideIcon;
export const MoreHorizontal = MoreHorizontalSvg as unknown as LucideIcon;
