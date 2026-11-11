"use client";

import React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { PhosphorGlyph } from "./icons/PhosphorIcon";
import { ProtoIcon } from "./icons/ProtoIcon";
import { LUCIDE_TO_PHOSPHOR } from "./icons/phosphorMap";
import { LUCIDE_TO_PROTO } from "./icons/protoMap";

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

const warned = new Set<string>();

function nameOf(icon: unknown): string {
  const c = icon as { displayName?: string; name?: string };
  return c.displayName || c.name || "";
}

/**
 * Shared icon wrapper. Every icon renders as a prototype glyph (LUCIDE_TO_PROTO), else as Phosphor Light
 * (LUCIDE_TO_PHOSPHOR) for icons the prototype has no twin for. The passed component (a lucide icon or a local
 * forwardRef glyph) is looked up by displayName, so call sites keep their imports.
 * An unmapped component falls back to its own glyph and logs a warning in development.
 * Also supports named registry glyphs and ReactNode glyphs.
 */
export const Icon: React.FC<IconProps> = ({
  icon,
  glyph,
  size = 16,
  strokeWidth = 1.5,
  absoluteStrokeWidth: _absoluteStrokeWidth,
  className = "",
  ...props
}) => {
  if (glyph) {
    return <span className={`ll:inline-flex ll:items-center ll:justify-center ll:shrink-0 ${className}`}>{glyph}</span>;
  }

  const resolved = typeof icon === "string" ? ICON_REGISTRY[icon] : icon;
  if (resolved) {
    const proto = LUCIDE_TO_PROTO[nameOf(resolved)];
    if (proto) {
      return (
        <ProtoIcon
          {...(props as React.SVGProps<SVGSVGElement>)}
          name={proto.id}
          size={size}
          className={className}
          style={proto.flipY ? { ...props.style, rotate: "180deg" } : props.style}
        />
      );
    }
    const mapped = LUCIDE_TO_PHOSPHOR[nameOf(resolved)];
    if (mapped) {
      return <PhosphorGlyph {...(props as React.SVGProps<SVGSVGElement>)} name={mapped.name} flipX={mapped.flipX} size={size} className={className} />;
    }
    if (process.env.NODE_ENV !== "production") {
      const key = nameOf(resolved) || "(anonymous)";
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[Icon] unmapped icon "${key}": add it to icons/protoMap.ts (or phosphorMap.ts as a fallback)`);
      }
    }
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
