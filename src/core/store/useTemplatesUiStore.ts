"use client";

import { create } from "zustand";

/** Whether the Insert Section gallery is open (ROADMAP Phase 51). */
interface State {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useTemplatesUiStore = create<State>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
