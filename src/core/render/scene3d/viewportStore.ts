"use client";

/**
 * ============================================================================
 * 3D VIEWPORT STORE (ROADMAP Phases 3D-012, 3D-014, 3D-018)
 * ============================================================================
 * Shared Zustand store for the 3D viewport state:
 *   - settings: ViewportSettings (shading modes, overlays, cavity, x-ray)
 *   - camera: ViewCamera (orbit/pan/dolly, focal length, ortho toggle)
 *   - selection: Selection3d (active element + set of selected 3D object IDs)
 *   - cursor: Cursor3d (position and surface-aligned rotation)
 *   - snap: { enabled, target, step }
 *   - pivot: PivotKind ("median" | "individual" | "cursor" | "active")
 *   - orientation: OrientationKind ("global" | "local" | "normal" | "view" | "cursor")
 *   - keymapId: "blender" | "beginner"
 *   - editingSceneId: string | null (the scene currently open for 3D editing)
 * ============================================================================
 */

import { create } from "zustand";
import { type ViewportSettings, DEFAULT_VIEWPORT_SETTINGS } from "../../3d/viewport/settings";
import { type ViewCamera, DEFAULT_VIEW_CAMERA } from "../../3d/camera/viewCamera";
import { type Selection3d, EMPTY_SELECTION } from "../../3d/pick/select";
import { type Cursor3d, resetCursor } from "../../3d/snap/cursor";
import type { SnapTarget } from "../../3d/snap/snap";
import type { PivotKind } from "../../3d/snap/pivot";
import type { OrientationKind } from "../../3d/snap/orientation";
import { useContextKeysStore } from "../../commands/contextKeys";
import { bindKeymap, getKeymapById } from "../../3d/keymap";

export type KeymapId = "blender" | "beginner";

export interface ViewportSnapConfig {
  enabled: boolean;
  target: SnapTarget;
  step: number;
}

export interface ViewportState {
  settings: ViewportSettings;
  camera: ViewCamera;
  selection: Selection3d;
  cursor: Cursor3d;
  snap: ViewportSnapConfig;
  pivot: PivotKind;
  orientation: OrientationKind;
  keymapId: KeymapId;
  editingSceneId: string | null;

  setSettings: (settings: ViewportSettings | ((prev: ViewportSettings) => ViewportSettings)) => void;
  setCamera: (camera: ViewCamera | ((prev: ViewCamera) => ViewCamera)) => void;
  setSelection: (selection: Selection3d | ((prev: Selection3d) => Selection3d)) => void;
  setCursor: (cursor: Cursor3d | ((prev: Cursor3d) => Cursor3d)) => void;
  setSnap: (snap: Partial<ViewportSnapConfig> | ((prev: ViewportSnapConfig) => ViewportSnapConfig)) => void;
  setPivot: (pivot: PivotKind) => void;
  setOrientation: (orientation: OrientationKind) => void;
  setKeymapId: (keymapId: KeymapId) => void;
  setEditingSceneId: (editingSceneId: string | null) => void;
  reset: () => void;
}

export function createInitialViewportState(): Omit<
  ViewportState,
  | "setSettings"
  | "setCamera"
  | "setSelection"
  | "setCursor"
  | "setSnap"
  | "setPivot"
  | "setOrientation"
  | "setKeymapId"
  | "setEditingSceneId"
  | "reset"
> {
  return {
    settings: DEFAULT_VIEWPORT_SETTINGS,
    camera: DEFAULT_VIEW_CAMERA,
    selection: EMPTY_SELECTION,
    cursor: resetCursor(),
    snap: {
      enabled: false,
      target: "grid",
      step: 1,
    },
    pivot: "median",
    orientation: "global",
    keymapId: "blender",
    editingSceneId: null,
  };
}

export const useViewportStore = create<ViewportState>((set) => ({
  ...createInitialViewportState(),

  setSettings: (updater) =>
    set((state) => ({
      settings: typeof updater === "function" ? updater(state.settings) : updater,
    })),

  setCamera: (updater) =>
    set((state) => ({
      camera: typeof updater === "function" ? updater(state.camera) : updater,
    })),

  setSelection: (updater) =>
    set((state) => ({
      selection: typeof updater === "function" ? updater(state.selection) : updater,
    })),

  setCursor: (updater) =>
    set((state) => ({
      cursor: typeof updater === "function" ? updater(state.cursor) : updater,
    })),

  setSnap: (updater) =>
    set((state) => {
      const next =
        typeof updater === "function"
          ? updater(state.snap)
          : { ...state.snap, ...updater };
      return { snap: next };
    }),

  setPivot: (pivot) => set({ pivot }),

  setOrientation: (orientation) => set({ orientation }),

  setKeymapId: (keymapId) => set({ keymapId }),

  setEditingSceneId: (editingSceneId) => {
    set({ editingSceneId });
    useContextKeysStore.setState({ editingScene3d: editingSceneId !== null });
  },

  reset: () => {
    set(createInitialViewportState());
    useContextKeysStore.setState({ editingScene3d: false });
  },
}));

// Sync editing context key whenever editingSceneId changes from any setter
useViewportStore.subscribe((state, prev) => {
  if (state.editingSceneId !== prev.editingSceneId) {
    useContextKeysStore.setState({ editingScene3d: state.editingSceneId !== null });
  }
  if (state.keymapId !== prev.keymapId) {
    bindKeymap(getKeymapById(state.keymapId));
  }
});

// Test seam: with `window.__LL_TEST__` set before load, `window.__LL_VIEWPORT_STORE__` gives browser tests direct access
if (typeof window !== "undefined") {
  Object.defineProperty(window, "__LL_VIEWPORT_STORE__", {
    configurable: true,
    get() {
      const w = window as unknown as { __LL_TEST__?: boolean };
      return w.__LL_TEST__ ? useViewportStore : undefined;
    },
  });
}

