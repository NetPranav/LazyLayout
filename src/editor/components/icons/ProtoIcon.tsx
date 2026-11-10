/**
 * Prototype icons (protoGlyphs.ts, from DOCS/UI/design). viewBox 0 0 24 24, no fill, 1.5 stroke, round caps and joins,
 * exactly as the prototype's `svg` rule. The stroke scales with the box like in the prototype, so no optical scale.
 */
import React from "react";
import { PROTO_GLYPHS, type ProtoGlyph, type ProtoName, type ProtoNode } from "./protoGlyphs";

export type { ProtoName };

export interface ProtoIconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  name: ProtoName;
  size?: number | string;
}

function renderNode(node: ProtoNode, key: number): React.ReactNode {
  const [tag, attrs, children] = node;
  return React.createElement(tag, { key, ...attrs }, children?.map(renderNode));
}

export const ProtoIcon: React.FC<ProtoIconProps> = ({ name, size = 16, className = "", ...props }) => {
  const glyph: ProtoGlyph = PROTO_GLYPHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={glyph.vb ?? "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`ll:shrink-0 ${className}`}
      {...props}
    >
      {glyph.n.map(renderNode)}
    </svg>
  );
};
