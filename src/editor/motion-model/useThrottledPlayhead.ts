"use client";

import { useEffect, useState } from "react";
import { useMotionModel } from "./store";

/**
 * The playhead frame for a component that only displays it. While playing it re-renders at most `maxHz` times a second
 * (with a trailing update); while paused, seeking or scrubbing it follows every change at once. Anything that needs every
 * frame (the needle) writes to the DOM directly instead, and event handlers read `useMotionModel.getState().playhead`.
 */
export function useThrottledPlayhead(maxHz = 10): number {
  const [frame, setFrame] = useState(() => useMotionModel.getState().playhead);

  useEffect(() => {
    const interval = 1000 / maxHz;
    let last = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const publish = () => {
      last = performance.now();
      trailing = undefined;
      setFrame(useMotionModel.getState().playhead);
    };
    publish();
    const unsubscribe = useMotionModel.subscribe((state, prev) => {
      if (state.playhead === prev.playhead && state.playing === prev.playing) return;
      if (!state.playing) {
        if (trailing !== undefined) {
          clearTimeout(trailing);
          trailing = undefined;
        }
        publish();
        return;
      }
      const wait = interval - (performance.now() - last);
      if (wait <= 0) publish();
      else if (trailing === undefined) trailing = setTimeout(publish, wait);
    });
    return () => {
      unsubscribe();
      if (trailing !== undefined) clearTimeout(trailing);
    };
  }, [maxHz]);

  return frame;
}
