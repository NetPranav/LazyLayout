"use client";

import { create } from "zustand";

/** Whether the icons-and-photos library is open, and on which tab (Phase 126). */
export type MediaTab = "icons" | "photos";
interface State {
  isOpen: boolean;
  tab: MediaTab;
  open: (tab?: MediaTab) => void;
  close: () => void;
}

export const useMediaLibraryStore = create<State>((set) => ({
  isOpen: false,
  tab: "icons",
  open: (tab) => set((s) => ({ isOpen: true, tab: tab ?? s.tab })),
  close: () => set({ isOpen: false }),
}));
