"use client";

import { create } from "zustand";

/**
 * The right panel's 2D / 3D switch (top right of the inspector). 2D: the Figma-style settings. 3D: the same layer's
 * Blender-style settings (surface, cloth, material, light, press physics). Remembered per browser.
 */
export type InspectorDimension = "2d" | "3d";
const KEY = "lazylayout:inspector-dimension";

function initial(): InspectorDimension {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

export const useInspectorDimension = create<{ dimension: InspectorDimension; setDimension: (d: InspectorDimension) => void }>((set) => ({
  dimension: initial(),
  setDimension: (dimension) => {
    try {
      window.localStorage.setItem(KEY, dimension);
    } catch {
      // storage can be blocked: the switch still works for this visit
    }
    set({ dimension });
  },
}));
