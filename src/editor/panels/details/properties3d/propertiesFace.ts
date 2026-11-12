"use client";

import { create } from "zustand";

/**
 * Persisted Simple vs Pro face toggle for the 3D Properties Editor (ROADMAP 3D-022).
 * Simple: Looks strip + 4–6 plain-word controls.
 * Pro: Exhaustive field renderer driven by the Zod schema's public `def`.
 */
export type PropertiesFace = "simple" | "pro";

export type Tab3dId =
  | "object"
  | "modifiers"
  | "physics"
  | "material"
  | "object-data"
  | "constraints"
  | "world"
  | "render";

const FACE_KEY = "lazylayout:properties-face";
const TAB_KEY = "lazylayout:properties-tab";

function initialFace(): PropertiesFace {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(FACE_KEY) === "pro"
      ? "pro"
      : "simple";
  } catch {
    return "simple";
  }
}

function initialTab(): Tab3dId {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(TAB_KEY) : null;
    if (
      saved === "object" ||
      saved === "modifiers" ||
      saved === "physics" ||
      saved === "material" ||
      saved === "object-data" ||
      saved === "constraints" ||
      saved === "world" ||
      saved === "render"
    ) {
      return saved as Tab3dId;
    }
    return "object";
  } catch {
    return "object";
  }
}

export const usePropertiesFace = create<{
  face: PropertiesFace;
  setFace: (face: PropertiesFace) => void;
}>((set) => ({
  face: initialFace(),
  setFace: (face) => {
    try {
      window.localStorage.setItem(FACE_KEY, face);
    } catch {
      // Storage might be blocked
    }
    set({ face });
  },
}));

export const usePropertiesTab = create<{
  activeTab: Tab3dId;
  setActiveTab: (tab: Tab3dId) => void;
}>((set) => ({
  activeTab: initialTab(),
  setActiveTab: (activeTab) => {
    try {
      window.localStorage.setItem(TAB_KEY, activeTab);
    } catch {
      // Storage might be blocked
    }
    set({ activeTab });
  },
}));
