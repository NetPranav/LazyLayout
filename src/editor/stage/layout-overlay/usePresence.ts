"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Spring } from "@/editor/motion/spring";
import { SP } from "@/editor/motion/presets";
import { simAdd, simRemove, type Sim } from "@/editor/motion/loop";
import { isMotionOff } from "@/editor/motion/reducedMotion";

const FROM_SCALE = 0.985;

/** Fades and scales the node in (and out) with the editor's press spring; with motion off it just switches. */
export function usePresence(ref: RefObject<HTMLElement | null>, shown: boolean): void {
  const spring = useRef<Spring | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    spring.current ??= new Spring(0, SP.press);
    const s = spring.current;
    const paint = () => {
      const p = Math.min(1, Math.max(0, s.x));
      node.style.opacity = String(p);
      node.style.transform = `scale(${FROM_SCALE + (1 - FROM_SCALE) * p})`;
      node.style.visibility = p <= 0.001 && !shown ? "hidden" : "visible";
    };
    s.to = shown ? 1 : 0;
    if (isMotionOff()) {
      s.snap();
      paint();
      return;
    }
    const sim: Sim = { sp: [s], apply: paint };
    simAdd(sim);
    return () => simRemove(sim);
  }, [ref, shown]);
}
