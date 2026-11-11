"use client";

/**
 * Phosphor Icons, Light weight (fallback set; the prototype set in protoGlyphs.ts wins where it has a twin) (https://github.com/phosphor-icons/core, MIT, (c) 2023 Phosphor Icons).
 * Glyph data lives in phosphorGlyphs.ts. viewBox 0 0 256 256, filled with currentColor.
 *
 * Optical scale: Phosphor glyphs sit inside more padding and use a thinner stroke than the lucide glyphs they
 * replaced, so at the same px they read smaller. Each glyph carries `s`, computed once as
 * (content extent of the lucide glyph it replaced) / (content extent of the Phosphor glyph), never below 1,
 * floored at 1.06 and capped at 1.2 (and so the glyph never exceeds the box). The viewBox is cropped
 * around the glyph centre by 1/s, so every size prop (12, 14, 16, 20) keeps the same optical size as before.
 */
import React from "react";
import { GLYPHS, type PhosphorName } from "./phosphorGlyphs";
import { ProtoIcon } from "./ProtoIcon";
import { PHOSPHOR_TO_PROTO } from "./protoMap";

export type { PhosphorName };

export interface PhosphorIconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  name: PhosphorName;
  size?: number | string;
  /** Mirror horizontally (e.g. right-hand sidebar). */
  flipX?: boolean;
}

/** Raw Phosphor glyph, used by Icon as the fallback for icons the prototype set has no twin for. */
export const PhosphorGlyph: React.FC<PhosphorIconProps> = ({ name, size = 16, flipX = false, className = "", style, ...props }) => {
  const glyph: { d: string; s: number; x?: { d: string; t: string } } = GLYPHS[name];
  const box = 256 / glyph.s;
  const origin = (256 - box) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${origin} ${origin} ${box} ${box}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      className={`ll:shrink-0 ${className}`}
      style={flipX ? { ...style, transform: "scaleX(-1)" } : style}
      {...props}
    >
      <path d={glyph.d} />
      {glyph.x ? <path d={glyph.x.d} transform={glyph.x.t} /> : null}
    </svg>
  );
};

/** Phosphor name in, prototype twin out when one exists (PHOSPHOR_TO_PROTO); otherwise the Phosphor glyph. */
export const PhosphorIcon: React.FC<PhosphorIconProps> = (props) => {
  const proto = PHOSPHOR_TO_PROTO[props.name];
  if (proto) {
    const { name: _name, flipX: _flipX, ...rest } = props;
    return <ProtoIcon name={proto} {...rest} />;
  }
  return <PhosphorGlyph {...props} />;
};

export type PhosphorMotion = "rotate" | "left" | "right" | "up" | "down" | "spread-h" | "spread-v" | "lift";

/** Phosphor glyph with a subtle hover motion. The motion fires when an ancestor with class `ll-pi-host` is hovered. */
export const PhosphorMotionIcon: React.FC<PhosphorIconProps & { motion?: PhosphorMotion }> = ({
  motion = "lift",
  ...props
}) => (
  <span className={`ll-pi ll-pi--${motion}`}>
    <PhosphorIcon {...props} />
  </span>
);
