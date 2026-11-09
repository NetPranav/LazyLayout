"use client";

import { create } from "zustand";

/**
 * Which frames are being previewed on the canvas: shown as the device's screen, with what is below the fold scrolling
 * inside. A way of looking, not part of the design: not saved, not undone, never exported.
 */
interface State {
  previewing: Readonly<Record<string, true>>;
  setPreview: (frameId: string, on: boolean) => void;
}

export const useFramePreviewStore = create<State>((set) => ({
  previewing: {},
  setPreview: (frameId, on) =>
    set((s) => {
      const next = { ...s.previewing };
      if (on) next[frameId] = true;
      else delete next[frameId];
      return { previewing: next };
    }),
}));
