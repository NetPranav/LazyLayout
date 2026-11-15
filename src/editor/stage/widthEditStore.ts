import { create } from "zustand";

/**
 * Whose stroke width is being edited on the canvas (Phase 119). While it is set, the stroke's width points show as
 * handles along its path; otherwise the canvas belongs to selecting and moving.
 */
interface WidthEditState {
  layerId: string | null;
  edit: (layerId: string) => void;
  stop: () => void;
}

export const useWidthEditStore = create<WidthEditState>((set) => ({
  layerId: null,
  edit: (layerId) => set({ layerId }),
  stop: () => set({ layerId: null }),
}));
