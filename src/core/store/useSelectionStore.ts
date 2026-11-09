"use client";

/**
 * ============================================================================
 * SELECTION MANAGEMENT STORE
 * ============================================================================
 * Zustand store managing selected entities across the IDE (elements on canvas,
 * assets in content browser, database tables, state variables, or Blueprint nodes).
 * Architecture Ref: ROADMAP.md §Sub-Phase 2.4 & PANELS.md §Panel 03
 * ============================================================================
 */

import { create } from "zustand";
import { documentStore } from "./documentState";
import { useBreakpointStore } from "./useBreakpointStore";
import { mirrorBreakpointId } from "../frames/devices";

export type SelectionType =
  | "element"
  | "asset"
  | "database_table"
  | "state_var"
  | "node"
  | null;

/** Where a layer was picked: on the canvas itself, or inside a linked view (mirror frame) of its frame. */
export interface SelectionView {
  /** The mirror frame the layer was picked in; null or omitted: picked in its own frame. */
  mirrorId?: string | null;
}

export interface SelectionState {
  selectedId: string | null;
  selectedIds: string[];
  selectionType: SelectionType;
  /** The mirror frame the selection was picked in (null: none). Always set together with the ids, never on its own. */
  selectedMirrorId: string | null;

  // Actions. Each one says where the layers were picked, so the view can't go stale (a selection made anywhere
  // without a view is a selection in the layers' own frames).
  select: (id: string, type: SelectionType, view?: SelectionView) => void;
  toggleSelection: (id: string, type: SelectionType, view?: SelectionView) => void;
  selectMultiple: (ids: string[], type: SelectionType, view?: SelectionView) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedId: null,
  selectedIds: [],
  selectionType: null,
  selectedMirrorId: null,

  select: (id, type, view) => {
    set({
      selectedId: id,
      selectedIds: [id],
      selectionType: type,
      selectedMirrorId: view?.mirrorId ?? null,
    });
  },

  toggleSelection: (id, type, view) => {
    const current = get().selectedIds;
    const exists = current.includes(id);
    const updated = exists ? current.filter((x) => x !== id) : [...current, id];

    set({
      selectedId: updated.length > 0 ? updated[updated.length - 1] : null,
      selectedIds: updated,
      selectionType: updated.length > 0 ? type : null,
      selectedMirrorId: updated.length > 0 ? (view?.mirrorId ?? null) : null,
    });
  },

  selectMultiple: (ids, type, view) => {
    set({
      selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
      selectedIds: ids,
      selectionType: ids.length > 0 ? type : null,
      selectedMirrorId: ids.length > 0 ? (view?.mirrorId ?? null) : null,
    });
  },

  clearSelection: () => {
    set({
      selectedId: null,
      selectedIds: [],
      selectionType: null,
      selectedMirrorId: null,
    });
  },

  isSelected: (id: string) => {
    return get().selectedIds.includes(id);
  },
}));

// The edit target follows the selection: a layer picked in a mirror is edited at that mirror's breakpoint, anything
// else at the breakpoint being viewed. Derived here, in one place, so no gesture has to set (and later reset) it.
function syncEditTarget(): void {
  const { selectedIds, selectedMirrorId } = useSelectionStore.getState();
  const doc = documentStore.getState().document;
  const target = selectedIds.length > 0 ? mirrorBreakpointId(doc, selectedMirrorId) : undefined;
  if (useBreakpointStore.getState().editId !== target) useBreakpointStore.getState().setEditTarget(target);
}
useSelectionStore.subscribe((state, prev) => {
  if (state.selectedMirrorId !== prev.selectedMirrorId || state.selectedIds !== prev.selectedIds) syncEditTarget();
});

// A layer that stops existing (an undo of its creation, a delete from anywhere, a frame removed) leaves the selection
// with it. Only ids that *were* layers are dropped: the selection also holds folders and assets, which aren't layers.
documentStore.subscribe((state, prev) => {
  if (state.document === prev.document) return;
  const { selectedMirrorId } = useSelectionStore.getState();
  if (selectedMirrorId && !state.document.layers[selectedMirrorId]) useSelectionStore.setState({ selectedMirrorId: null });
  syncEditTarget();
  const { selectedIds, selectionType } = useSelectionStore.getState();
  if (selectedIds.length === 0) return;
  const kept = selectedIds.filter((id) => !(prev.document.layers[id] && !state.document.layers[id]));
  if (kept.length === selectedIds.length) return;
  useSelectionStore.setState({
    selectedIds: kept,
    selectedId: kept.length > 0 ? kept[kept.length - 1] : null,
    selectionType: kept.length > 0 ? selectionType : null,
  });
});

/** Test seam: with `window.__LL_TEST__` set before load, `window.__LL_SELECTION__()` is the ids of the selected layers. */
if (typeof window !== "undefined" && (window as unknown as { __LL_TEST__?: boolean }).__LL_TEST__) {
  (window as unknown as Record<string, unknown>).__LL_SELECTION__ = () => useSelectionStore.getState().selectedIds;
}
