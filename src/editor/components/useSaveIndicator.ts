"use client";

import { useEffect, useState } from "react";
import { useSaveStatus, type SaveState } from "@/core/storage/ProjectSession";

export type SaveIndicatorState = "saved" | "dirty" | "saving" | "error";

/**
 * How long the saving trace stays on after the last save finishes. An autosave
 * is pending for 400 ms and writes for a few ms, so without this the trace
 * would flash for a few ms and never be seen.
 */
export const SAVE_HOLD_MS = 700;

const isBusy = (state: SaveState) => state === "pending" || state === "saving";

/**
 * The save indicator for the top-bar logo. `saveStatus` and `saving` overrides
 * win, as before. Otherwise the store's "pending" and "saving" states turn
 * `isSaving` on, and it stays on for SAVE_HOLD_MS after the store leaves them.
 * "error" never shows the trace.
 */
export function useSaveIndicator({
  saveStatus,
  saving = false,
}: {
  saveStatus?: SaveIndicatorState;
  saving?: boolean;
}): { state: SaveIndicatorState; isSaving: boolean } {
  const storeState = useSaveStatus((s) => s.state);
  const storeBusy = isBusy(storeState);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useSaveStatus.subscribe((next, prev) => {
      if (isBusy(next.state)) {
        window.clearTimeout(timer);
        setHeld(true);
      } else if (isBusy(prev.state)) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setHeld(false), SAVE_HOLD_MS);
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const state: SaveIndicatorState =
    saveStatus !== undefined
      ? saveStatus
      : saving || storeState === "saving"
      ? "saving"
      : storeState === "error"
      ? "error"
      : storeState === "pending"
      ? "dirty"
      : "saved";

  const isSaving =
    saveStatus !== undefined ? saveStatus === "saving" : saving || storeBusy || held;

  return { state, isSaving };
}
