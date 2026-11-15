"use client";

import { create } from "zustand";

/**
 * Design track D15: the state being edited, if any. While a state is picked, the inspector and the canvas write to that
 * state (only the difference from the base is kept) and the canvas draws the layer in it. It is never set as a side
 * effect of another gesture: only the States section sets it, and deselecting the layer clears it.
 */
interface State {
  layerId: string | null;
  name: string | null;
  /** Show the states on real hover and press in the canvas (Preview always does). */
  live: boolean;
  edit: (layerId: string | null, name: string | null) => void;
  setLive: (live: boolean) => void;
}

export const useStateEditStore = create<State>((set) => ({
  layerId: null,
  name: null,
  live: false,
  edit: (layerId, name) => set({ layerId, name }),
  setLive: (live) => set({ live }),
}));

/** The state edits go to for this layer right now, or null (the base). */
export const editingStateOf = (layerId: string): string | null => {
  const s = useStateEditStore.getState();
  return s.layerId === layerId ? s.name : null;
};
