"use client";

import { create } from "zustand";
import type { GridStyle, MotionFeel } from "./canvas-chrome/types";
import { applyTheme, type Theme } from "@/editor/components/ThemeToggle";
import { applyFeel } from "@/editor/motion/feel";
import type { MotionPresetKey } from "@/editor/motion/presets";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useSnapStore } from "@/core/store/useSnapStore";

export interface CanvasSettingsState {
  gridStyle: GridStyle;
  gridSize: number;
  pixelGrid: boolean;
  checkerboard: boolean;
  theme: string;
  motionFeel: MotionFeel;
  dropdownBulge: number;
  inspectMode: boolean;
  canvasPan: boolean;
  canvasZoom: boolean;
  worldAxes: boolean;
  elementDragging: boolean;
  reparenting: boolean;
  collisionMode: "pass" | "push";
  marqueeMode: "intersects" | "encloses";
  snapThreshold: number;
  smartGuides: boolean;
  panMethod: "space" | "middle" | "blank";
  zoomSpeed: "normal" | "fast";

  setGridStyle: (style: GridStyle) => void;
  setGridSize: (size: number) => void;
  togglePixelGrid: () => void;
  toggleCheckerboard: () => void;
  setTheme: (theme: string) => void;
  setMotionFeel: (feel: MotionFeel) => void;
  setDropdownBulge: (bulge: number) => void;
  toggleInspectMode: () => void;
  toggleCanvasPan: () => void;
  toggleCanvasZoom: () => void;
  toggleWorldAxes: () => void;
  toggleElementDragging: () => void;
  toggleReparenting: () => void;
  setCollisionMode: (mode: "pass" | "push") => void;
  setMarqueeMode: (mode: "intersects" | "encloses") => void;
  setSnapThreshold: (threshold: number) => void;
  toggleSmartGuides: () => void;
  setPanMethod: (method: "space" | "middle" | "blank") => void;
  setZoomSpeed: (speed: "normal" | "fast") => void;
}

const STORAGE_KEY = "lazylayout:canvas-settings";

function loadSettings(): Partial<CanvasSettingsState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(state: CanvasSettingsState): void {
  if (typeof window === "undefined") return;
  try {
    const toSave = {
      gridStyle: state.gridStyle,
      gridSize: state.gridSize,
      pixelGrid: state.pixelGrid,
      checkerboard: state.checkerboard,
      theme: state.theme,
      motionFeel: state.motionFeel,
      dropdownBulge: state.dropdownBulge,
      inspectMode: state.inspectMode,
      canvasPan: state.canvasPan,
      canvasZoom: state.canvasZoom,
      worldAxes: state.worldAxes,
      elementDragging: state.elementDragging,
      reparenting: state.reparenting,
      collisionMode: state.collisionMode,
      marqueeMode: state.marqueeMode,
      snapThreshold: state.snapThreshold,
      smartGuides: state.smartGuides,
      panMethod: state.panMethod,
      zoomSpeed: state.zoomSpeed,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

export const useCanvasSettingsStore = create<CanvasSettingsState>((set, get) => {
  const initial = loadSettings();

  return {
    gridStyle: initial.gridStyle || "dots",
    gridSize: initial.gridSize || 24,
    pixelGrid: initial.pixelGrid ?? false,
    checkerboard: initial.checkerboard ?? false,
    theme: initial.theme || "paper",
    motionFeel: initial.motionFeel || "bouncy",
    dropdownBulge: initial.dropdownBulge ?? 50,
    inspectMode: initial.inspectMode ?? false,
    canvasPan: initial.canvasPan ?? true,
    canvasZoom: initial.canvasZoom ?? true,
    worldAxes: initial.worldAxes ?? true,
    elementDragging: initial.elementDragging ?? true,
    reparenting: initial.reparenting ?? true,
    collisionMode: initial.collisionMode || "pass",
    marqueeMode: initial.marqueeMode || "intersects",
    snapThreshold: initial.snapThreshold ?? 6,
    smartGuides: initial.smartGuides ?? true,
    panMethod: initial.panMethod || "space",
    zoomSpeed: initial.zoomSpeed || "normal",

    setGridStyle: (gridStyle) => {
      set({ gridStyle });
      saveSettings(get());
    },
    setGridSize: (gridSize) => {
      set({ gridSize });
      saveSettings(get());
    },
    togglePixelGrid: () => {
      set((s) => ({ pixelGrid: !s.pixelGrid }));
      saveSettings(get());
    },
    toggleCheckerboard: () => {
      const next = !get().checkerboard;
      set({ checkerboard: next });
      saveSettings(get());
      useCanvasViewStore.getState().setBackdrop(next ? "checker" : "light");
    },
    setTheme: (theme) => {
      set({ theme });
      saveSettings(get());
      applyTheme(theme as Theme);
    },
    setMotionFeel: (motionFeel) => {
      set({ motionFeel });
      saveSettings(get());
      applyFeel(motionFeel as MotionPresetKey);
    },
    setDropdownBulge: (dropdownBulge) => {
      set({ dropdownBulge });
      saveSettings(get());
    },
    toggleInspectMode: () => {
      set((s) => ({ inspectMode: !s.inspectMode }));
      saveSettings(get());
    },
    toggleCanvasPan: () => {
      set((s) => ({ canvasPan: !s.canvasPan }));
      saveSettings(get());
    },
    toggleCanvasZoom: () => {
      set((s) => ({ canvasZoom: !s.canvasZoom }));
      saveSettings(get());
    },
    toggleWorldAxes: () => {
      set((s) => ({ worldAxes: !s.worldAxes }));
      saveSettings(get());
    },
    toggleElementDragging: () => {
      set((s) => ({ elementDragging: !s.elementDragging }));
      saveSettings(get());
    },
    toggleReparenting: () => {
      set((s) => ({ reparenting: !s.reparenting }));
      saveSettings(get());
    },
    setCollisionMode: (collisionMode) => {
      set({ collisionMode });
      saveSettings(get());
    },
    setMarqueeMode: (marqueeMode) => {
      set({ marqueeMode });
      saveSettings(get());
    },
    setSnapThreshold: (snapThreshold) => {
      set({ snapThreshold });
      saveSettings(get());
    },
    toggleSmartGuides: () => {
      set((s) => ({ smartGuides: !s.smartGuides }));
      saveSettings(get());
    },
    setPanMethod: (panMethod) => {
      set({ panMethod });
      saveSettings(get());
    },
    setZoomSpeed: (zoomSpeed) => {
      set({ zoomSpeed });
      saveSettings(get());
    },
  };
});

/** Enforce prototype snapping defaults if no user preference was saved */
export function initPrototypeSnapDefaults(): void {
  if (typeof window === "undefined") return;
  const SNAP_KEY = "lazylayout:snap";
  const existing = window.localStorage.getItem(SNAP_KEY);
  if (!existing) {
    useSnapStore.setState({
      guides: false, // Prototype default: snap guides OFF
      grid: true,   // Prototype default: snap to grid ON
      objects: true,
      rulers: false,
    });
    try {
      window.localStorage.setItem(
        SNAP_KEY,
        JSON.stringify({ guides: false, grid: true, objects: true, rulers: false })
      );
    } catch {
      // ignore
    }
  }
}
