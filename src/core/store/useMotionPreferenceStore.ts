"use client";

import { create } from "zustand";

/**
 * ROADMAP Phase 93: whether the canvas is shown as people who ask for reduced motion get it. A way of looking, not
 * part of the design: not saved, not undone, never exported. The system's own setting (`prefers-reduced-motion`)
 * counts too, so someone who has it on sees their designs that way without doing anything.
 */
interface State {
  reduced: boolean;
  setReduced: (on: boolean) => void;
}

export const useMotionPreferenceStore = create<State>((set) => ({
  reduced: false,
  setReduced: (reduced) => set({ reduced }),
}));

/** Reduced motion right now: the canvas's switch, or the system's setting. */
export function reducedMotionNow(): boolean {
  if (useMotionPreferenceStore.getState().reduced) return true;
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}
