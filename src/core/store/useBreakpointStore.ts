"use client";

import { create } from "zustand";

/**
 * The breakpoint being viewed (ROADMAP Phase 43): its id, or null for the base. What the canvas draws is the document
 * as seen at that breakpoint. A choice that isn't one of the document's breakpoints counts as the base.
 *
 * Edits go to the *edit target*: the view, unless a layer was picked inside a linked view (a mirror frame), in which
 * case they go to that mirror's breakpoint. The edit target is derived from the selection (see useSelectionStore), it
 * is never set by a gesture, so picking a layer in a mirror can't leave the rest of the canvas in another breakpoint.
 */
interface State {
  activeId: string | null;
  /** Set while a layer picked in a mirror is selected: that mirror's breakpoint (null: the base). undefined: follow the view. */
  editId: string | null | undefined;
  setActive: (id: string | null) => void;
  setEditTarget: (id: string | null | undefined) => void;
}

export const useBreakpointStore = create<State>((set) => ({
  activeId: null,
  editId: undefined,
  setActive: (activeId) => set({ activeId }),
  setEditTarget: (editId) => set({ editId }),
}));

const editOf = (s: Pick<State, "activeId" | "editId">): string | null => (s.editId !== undefined ? s.editId : s.activeId);

/** The breakpoint edits go to right now (null: the base). */
export const editBreakpointId = (): string | null => editOf(useBreakpointStore.getState());

/** `editBreakpointId`, as a hook. */
export const useEditBreakpointId = (): string | null => useBreakpointStore(editOf);
