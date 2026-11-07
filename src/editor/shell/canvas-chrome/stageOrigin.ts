import { create } from "zustand";

/** Where the page's top-left corner is, relative to the rulers (they sit along the canvas's edges), and how long they are. */
export interface StageOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const useStageOriginStore = create<{ origin: StageOrigin; setOrigin: (o: StageOrigin) => void }>((set, get) => ({
  origin: { x: 0, y: 0, width: 0, height: 0 },
  setOrigin: (o) => {
    const c = get().origin;
    if (c.x !== o.x || c.y !== o.y || c.width !== o.width || c.height !== o.height) set({ origin: o });
  },
}));
