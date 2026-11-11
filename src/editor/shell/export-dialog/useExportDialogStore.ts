"use client";

import { create } from "zustand";

export type ExportFormat = "zip" | "file" | "npm";

interface ExportDialogState {
  open: boolean;
  /** The button (or menu anchor) the sheet grows from; focus goes back to it on close. */
  trigger: HTMLElement | null;
  /** Repo paths the person unticked. Everything else is exported. */
  excluded: string[];
  selectedPath: string | null;
  format: ExportFormat;
  openDialog: (trigger?: HTMLElement | null) => void;
  close: () => void;
  select: (path: string) => void;
  setIncluded: (paths: string[], included: boolean) => void;
  setFormat: (format: ExportFormat) => void;
}

export const useExportDialogStore = create<ExportDialogState>((set) => ({
  open: false,
  trigger: null,
  excluded: [],
  selectedPath: null,
  format: "zip",
  openDialog: (trigger) =>
    set({
      open: true,
      trigger: trigger ?? (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null),
      excluded: [],
      selectedPath: null,
      format: "zip",
    }),
  close: () => set({ open: false }),
  select: (path) => set({ selectedPath: path }),
  setIncluded: (paths, included) =>
    set((s) => {
      const rest = s.excluded.filter((p) => !paths.includes(p));
      return { excluded: included ? rest : [...rest, ...paths] };
    }),
  setFormat: (format) => set({ format }),
}));

/** Opens the Export dialog. Pass the button it was opened from so the sheet grows from it and focus returns to it. */
export function openExportDialog(trigger?: HTMLElement | null): void {
  useExportDialogStore.getState().openDialog(trigger);
}
