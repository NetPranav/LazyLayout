import { create } from "zustand";

/**
 * Which mesh fill is being edited on the canvas (Phase 115): the layer, the fill's index, and the point picked. While
 * it is set, the mesh's points show as handles on the canvas; otherwise the canvas belongs to selecting and moving.
 */
interface MeshEditState {
  layerId: string | null;
  fill: number;
  point: number | null;
  edit: (layerId: string, fill: number) => void;
  pick: (point: number | null) => void;
  stop: () => void;
}

export const useMeshEditStore = create<MeshEditState>((set) => ({
  layerId: null,
  fill: 0,
  point: null,
  edit: (layerId, fill) => set({ layerId, fill, point: null }),
  pick: (point) => set({ point }),
  stop: () => set({ layerId: null, point: null }),
}));
