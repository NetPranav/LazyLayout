"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * ROADMAP Phase 64 in the new timeline: a row is built only while it is in view of the timeline's scroller (or within
 * `margin` px of it). Out of view it is an empty block of the height it last had, so the scroll length, and the
 * position of every other row, stay the same. Small lists (`lazy` false) are always built, as before.
 */
export interface LazyRowProps {
  root: React.RefObject<HTMLElement | null>;
  id: string;
  lazy: boolean;
  /** Height in px of a row that has never been built (a closed layer row). */
  estimate?: number;
  margin?: number;
  children: React.ReactNode;
}

export const LazyRow: React.FC<LazyRowProps> = ({ root, id, lazy, estimate = 32, margin = 400, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<{ shown: boolean; height: number }>({ shown: !lazy, height: estimate });

  useEffect(() => {
    const el = ref.current;
    if (!lazy || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const height = el.offsetHeight || estimate;
        setState((s) => (s.shown === entry.isIntersecting ? s : { shown: entry.isIntersecting, height: s.shown ? height : s.height }));
      },
      { root: root.current, rootMargin: `${margin}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, root, margin, estimate]);

  if (!lazy) return <>{children}</>;
  const shown = state.shown;
  return (
    <div ref={ref} data-lazy-row={id} data-built={shown ? "true" : "false"} style={shown ? undefined : { height: state.height }}>
      {shown ? children : null}
    </div>
  );
};
