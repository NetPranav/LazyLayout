import { create } from "zustand";
import { DEFAULT_BRUSH_TOOL, type BrushToolSettings } from "@/core/paths/createPath";

/** The brush tool's settings (Phase 120): size, colour, brush, what drives the width, smoothing. Kept for the session. */
interface BrushToolState extends BrushToolSettings {
  set: (patch: Partial<BrushToolSettings>) => void;
}

export const useBrushToolStore = create<BrushToolState>((set) => ({
  ...DEFAULT_BRUSH_TOOL,
  set: (patch) => set(patch),
}));
