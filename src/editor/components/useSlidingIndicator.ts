"use client";

import { useRef, useEffect, type RefObject } from "react";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, type Sim } from "../motion/loop";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { useMounted } from "./useMounted";

export interface SlidingIndicatorProps {
  containerRef: RefObject<HTMLElement | null>;
  indicatorRef: RefObject<HTMLElement | null>;
  itemRefs: RefObject<(HTMLElement | null)[]>;
  selectedIndex: number;
}

export function useSlidingIndicator({
  containerRef,
  indicatorRef,
  itemRefs,
  selectedIndex,
}: SlidingIndicatorProps) {
  const springsRef = useRef<{ x: Spring; w: Spring; sim: Sim } | null>(null);
  const mounted = useMounted();
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    const p = getActivePreset();
    const x = new Spring(0, p.glideH);
    const w = new Spring(0, p.glideW);
    const sim: Sim = {
      sp: [x, w],
      apply: () => {
        if (indicatorRef.current) {
          indicatorRef.current.style.transform = `translate3d(${x.x.toFixed(2)}px, 0, 0)`;
          indicatorRef.current.style.width = `${Math.max(0, w.x).toFixed(2)}px`;
        }
      },
    };
    springsRef.current = { x, w, sim };

    return () => {
      if (springsRef.current) {
        simRemove(springsRef.current.sim);
      }
    };
  }, [indicatorRef]);

  useEffect(() => {
    if (!mounted) return;

    const btn = itemRefs.current?.[selectedIndex];
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    const sp = springsRef.current;

    if (!btn || !container || !indicator || !sp) return;

    const targetX = btn.offsetLeft;
    const targetW = btn.offsetWidth;
    const p = getActivePreset();

    indicator.style.display = "block";

    if (isFirstMountRef.current || prefersReducedMotion()) {
      isFirstMountRef.current = false;
      sp.x.jump(targetX);
      sp.w.jump(targetW);
      indicator.style.transform = `translate3d(${targetX}px, 0, 0)`;
      indicator.style.width = `${targetW}px`;
      return;
    }

    sp.x.tune(p.glideH);
    sp.w.tune(p.glideW);
    sp.x.to = targetX;
    sp.w.to = targetW;

    simAdd(sp.sim);
  }, [mounted, selectedIndex, containerRef, indicatorRef, itemRefs]);

  // The container can change width after the selection settled (a scrollbar appears, the panel
  // resizes, the row was hidden at mount): re-place the indicator under the selected item.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const btn = itemRefs.current?.[selectedIndex];
      const indicator = indicatorRef.current;
      const sp = springsRef.current;
      if (!btn || !indicator || !sp || indicator.style.display !== "block") return;
      sp.x.jump(btn.offsetLeft);
      sp.w.jump(btn.offsetWidth);
      indicator.style.transform = `translate3d(${btn.offsetLeft}px, 0, 0)`;
      indicator.style.width = `${btn.offsetWidth}px`;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [selectedIndex, containerRef, indicatorRef, itemRefs]);
}
