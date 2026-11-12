"use client";

/**
 * Live context keys the command bus's `when` clauses read (Sub-Phase 43.1/43.3).
 * A plain Zustand store, not React-only state, so `runCommand`/the keydown
 * dispatcher (neither of which run inside a component) can read the current
 * values synchronously via `getContextKeys()`.
 */

import { create } from "zustand";
import type { ContextKeys, FocusScope } from "./types";
import { useSelectionStore } from "../store/useSelectionStore";
import { isTextEditingTarget } from "./normalize";

const DEFAULT_CONTEXT: ContextKeys = {
  canvasFocus: false,
  timelineFocus: false,
  blueprintFocus: false,
  textEditing: false,
  "selection.count": 0,
  "transport.playing": false,
  editingScene3d: false,
};

interface ContextKeysStore extends ContextKeys {
  setContext: (patch: Partial<ContextKeys>) => void;
}

export const useContextKeysStore = create<ContextKeysStore>((set) => ({
  ...DEFAULT_CONTEXT,
  setContext: (patch) => set(patch),
}));

export function getContextKeys(): ContextKeys {
  const { setContext: _setContext, ...ctx } = useContextKeysStore.getState();
  // A focused field that is removed from the page (a panel re-renders under it) never fires focusout, which would leave
  // `textEditing` stuck on and Undo and every shortcut off. Whether a field really has focus is a fact we can ask for.
  if (ctx.textEditing && typeof document !== "undefined" && !isTextEditingTarget(document.activeElement)) {
    useContextKeysStore.setState({ textEditing: false });
    return { ...ctx, textEditing: false };
  }
  return ctx;
}

/**
 * Sub-Phase 43.3: exactly one focused region. Setting a scope clears the
 * other two; `null` clears all three (the pointer is over neither panel).
 */
export function setFocusScope(scope: FocusScope | null): void {
  useContextKeysStore.setState({
    canvasFocus: scope === "canvas",
    timelineFocus: scope === "timeline",
    blueprintFocus: scope === "blueprint",
  });
}

export function setTextEditing(editing: boolean): void {
  useContextKeysStore.setState({ textEditing: editing });
}

export function setEditingScene3d(editing: boolean): void {
  useContextKeysStore.setState({ editingScene3d: editing });
}

// `selection.count` follows the one selection store (it used to be declared and never written).
useSelectionStore.subscribe((state, prev) => {
  if (state.selectedIds.length !== prev.selectedIds.length) useContextKeysStore.setState({ "selection.count": state.selectedIds.length });
});
