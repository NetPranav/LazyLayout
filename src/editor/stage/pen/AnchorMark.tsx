"use client";

import React, { useEffect, useRef } from "react";
import { springAnim } from "@/editor/motion/ease";
import { getActivePreset } from "@/editor/motion/feel";

const POP_STAGGER_CAP = 12; // points that stagger their pop-in; the rest arrive together

/** A point's square. It pops in with the shared spring (and is only there while a path is being edited). */
export const AnchorMark = React.memo(function AnchorMark({ x, y, px, selected, delayIndex }: { x: number; y: number; px: number; selected: boolean; delayIndex: number }) {
  const ref = useRef<SVGRectElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = getActivePreset();
    springAnim(el as unknown as HTMLElement, [{ opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1 }], m.pop[0], m.pop[1], {
      delay: Math.min(delayIndex, POP_STAGGER_CAP) * m.popStagger,
      fill: "backwards",
    });
  }, [delayIndex]);
  const size = 7 * px;
  return (
    <rect
      ref={ref}
      data-testid="path-anchor"
      data-selected={selected ? "true" : "false"}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      rx={px}
      style={{ transformBox: "fill-box", transformOrigin: "center", fill: selected ? "var(--ll-pen-mark)" : "var(--ll-surface-raised)", stroke: "var(--ll-pen-mark)", strokeWidth: 1.25 * px }}
    />
  );
});
