"use client";

import { create } from "zustand";

/** Whether the "Pair with Claude" panel is open (ROADMAP Phase 50). */
interface State {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useAgentUiStore = create<State>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
