"use client";

import React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Dedicated Multi-layer glyph matching prototype P (<symbol id="multi"> line 1615):
 * Two overlapping rounded rectangles representing multi-layer selection.
 */
export const MultiLayerGlyph = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }
>(({ size = 16, strokeWidth = 1.5, className = "", ...props }, ref) => (
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
    <rect x="4" y="10" width="10" height="10" rx="2" />
    <path d="M10 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4" />
  </svg>
));
MultiLayerGlyph.displayName = "MultiLayerGlyph";

export type IconGlyphProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
};

/**
 * Built-in icon registry mapping named keys to dedicated SVG glyphs.
 */
export const ICON_REGISTRY: Record<
  string,
  React.ComponentType<IconGlyphProps>
> = {
  multi: MultiLayerGlyph,
  "multi-layer": MultiLayerGlyph,
};

export type IconComponent =
  | LucideIcon
  | React.ComponentType<IconGlyphProps>
  | React.ForwardRefExoticComponent<IconGlyphProps>;

export interface IconProps extends Omit<LucideProps, "ref" | "icon"> {
  icon?: IconComponent | string;
  glyph?: React.ReactNode;
}

/**
 * Shared Lucide & Custom SVG Icon wrapper enforcing single 1.5 stroke-width across Lazy Layout.
 * Supports Lucide icons, custom forwardRef SVG components, named registry glyphs, and ReactNode glyphs.
 */
export const Icon: React.FC<IconProps> = ({
  icon,
  glyph,
  size = 16,
  strokeWidth = 1.5,
  className = "",
  ...props
}) => {
  if (glyph) {
    return <span className={`ll:inline-flex ll:items-center ll:justify-center ll:shrink-0 ${className}`}>{glyph}</span>;
  }

  if (typeof icon === "string") {
    const Registered = ICON_REGISTRY[icon];
    if (Registered) {
      return (
        <Registered
          size={size}
          strokeWidth={strokeWidth}
          className={`ll:shrink-0 ${className}`}
          {...props}
        />
      );
    }
  }

  if (icon) {
    const Comp = icon as React.ComponentType<IconGlyphProps>;
    return (
      <Comp
        size={size}
        strokeWidth={strokeWidth}
        className={`ll:shrink-0 ${className}`}
        {...props}
      />
    );
  }

  return null;
};
