"use client";

import { create } from "zustand";

/** Which generated file the Code page shows. Shared by the files tree (left panel) and the code panel (bottom). */
interface CodeFilesState {
  activeFileId: string | null;
  openTabs: string[];
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
}

export const useCodeFilesStore = create<CodeFilesState>((set) => ({
  activeFileId: null,
  openTabs: [],
  openFile: (id) =>
    set((s) => ({
      activeFileId: id,
      openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
    })),
  closeFile: (id) =>
    set((s) => {
      const openTabs = s.openTabs.filter((t) => t !== id);
      const activeFileId = s.activeFileId === id ? (openTabs[openTabs.length - 1] ?? null) : s.activeFileId;
      return { openTabs, activeFileId };
    }),
}));
