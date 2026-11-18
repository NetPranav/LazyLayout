"use client";

import { create } from "zustand";
import type { CanvasMode } from "./useCanvasViewStore";
import type { Overlay } from "../playground/playground";

/**
 * ROADMAP Phase 90: the Animation Playground's own state. A way of looking, not part of the design: not saved, not
 * undone, never exported. While it is open the canvas is in Preview and states are live; `held` is a state a layer is
 * kept in (as if hovered or pressed), so it can be watched, and `before` is the mode to go back to.
 */
interface State {
  open: boolean;
  before: CanvasMode | null;
  held: { layerId: string; name: string } | null;
  overlays: readonly Overlay[];
  setOpen: (open: boolean, before?: CanvasMode | null) => void;
  hold: (held: { layerId: string; name: string } | null) => void;
  setOverlay: (overlay: Overlay, on: boolean) => void;
}

export const usePlaygroundStore = create<State>((set) => ({
  open: false,
  before: null,
  held: null,
  overlays: [],
  setOpen: (open, before = null) => set(open ? { open, before } : { open, before: null, held: null, overlays: [] }),
  hold: (held) => set({ held }),
  setOverlay: (overlay, on) => set((s) => ({ overlays: on ? (s.overlays.includes(overlay) ? s.overlays : [...s.overlays, overlay]) : s.overlays.filter((o) => o !== overlay) })),
}));
