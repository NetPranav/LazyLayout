import { create } from "zustand";

/** Which text shows its variable-font axes as sliders on the canvas (Phase 125). */
interface AxesEditState {
  layerId: string | null;
  show: (layerId: string | null) => void;
}

export const useAxesEditStore = create<AxesEditState>((set) => ({
  layerId: null,
  show: (layerId) => set({ layerId }),
}));
