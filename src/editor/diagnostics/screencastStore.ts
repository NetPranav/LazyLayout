"use client";

import { create } from "zustand";

/**
 * Show keystrokes (View menu): the keys pressed, the mouse buttons used and the command that ran, drawn at the bottom
 * left of the canvas, like Blender's Screencast Keys. For recordings, demos and teaching. Remembered per browser;
 * `?keys=1` in the address turns it on for one visit (the demo runs use that).
 */
const STORAGE_KEY = "lazylayout:show-keystrokes";

function initial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URL(window.location.href).searchParams.get("keys") === "1") return true;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface ScreencastEntry {
  id: number;
  /** "Ctrl", "Shift", "R", "Left click", "Drag", "Scroll" … */
  keys: string[];
  /** How many times in a row the same keys were used. */
  count: number;
  /** The command the keys ran, when one did. */
  command?: string;
  /** A note the demo shows (not from input). */
  note?: boolean;
  at: number;
}

interface ScreencastState {
  enabled: boolean;
  entries: ScreencastEntry[];
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  push: (keys: string[], opts?: { note?: boolean }) => void;
  nameLast: (command: string) => void;
  prune: (now: number) => void;
}

/** How long an entry stays, and how many are shown at once. */
export const SCREENCAST_HOLD_MS = 2600;
const MAX_ENTRIES = 6;
let nextId = 1;

export const useScreencastStore = create<ScreencastState>((set, get) => ({
  enabled: initial(),
  entries: [],
  setEnabled: (on) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      // storage can be blocked; the switch still works for this visit
    }
    set({ enabled: on, entries: [] });
  },
  toggle: () => get().setEnabled(!get().enabled),
  push: (keys, opts) => {
    if (!get().enabled || keys.length === 0) return;
    const now = performance.now();
    set((s) => {
      const last = s.entries[s.entries.length - 1];
      if (last && !opts?.note && !last.note && last.keys.join("+") === keys.join("+") && now - last.at < SCREENCAST_HOLD_MS) {
        return { entries: [...s.entries.slice(0, -1), { ...last, count: last.count + 1, at: now }] };
      }
      const entry: ScreencastEntry = { id: nextId++, keys, count: 1, at: now, ...(opts?.note ? { note: true } : {}) };
      return { entries: [...s.entries, entry].slice(-MAX_ENTRIES) };
    });
  },
  nameLast: (command) =>
    set((s) => {
      const last = s.entries[s.entries.length - 1];
      if (!last || last.note || performance.now() - last.at > 250) return s;
      return { entries: [...s.entries.slice(0, -1), { ...last, command }] };
    }),
  prune: (now) =>
    set((s) => {
      const kept = s.entries.filter((e) => now - e.at < SCREENCAST_HOLD_MS * (e.note ? 2 : 1));
      return kept.length === s.entries.length ? s : { entries: kept };
    }),
}));
