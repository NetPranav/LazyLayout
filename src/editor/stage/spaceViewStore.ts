import { create } from "zustand";

/**
 * The orbit preview of a 3D space (Phase 127): while it is on, dragging on the space turns the view around it, for a
 * look only. Nothing is saved; switching it off (or editing) goes back to the space as it is set.
 */
interface SpaceViewState {
  orbiting: string | null;
  /** The preview turn, degrees, added to the space's own viewing angle. */
  x: number;
  y: number;
  start: (id: string) => void;
  turn: (x: number, y: number) => void;
  stop: () => void;
}

export const useSpaceViewStore = create<SpaceViewState>((set) => ({
  orbiting: null,
  x: 0,
  y: 0,
  start: (id) => set({ orbiting: id, x: 0, y: 0 }),
  turn: (x, y) => set({ x: Math.max(-80, Math.min(80, x)), y: Math.max(-80, Math.min(80, y)) }),
  stop: () => set({ orbiting: null, x: 0, y: 0 }),
}));
