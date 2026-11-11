"use client";

import React from "react";
import { ScreencastKeys } from "@/editor/components/ScreencastKeys";
import { useScreencastStore } from "@/editor/diagnostics/screencastStore";
import { Button } from "@/editor/components/Button";

/** View > Show keystrokes: turn it on, then press keys or click anywhere; the keys show at the bottom left of the box. */
export function ScreencastKeysDemo() {
  const enabled = useScreencastStore((s) => s.enabled);
  return (
    <div className="ll:flex ll:flex-col ll:gap-3">
      <div className="ll:flex ll:items-center ll:gap-2">
        <Button onClick={() => useScreencastStore.getState().toggle()}>{enabled ? "Hide keystrokes" : "Show keystrokes"}</Button>
        <Button variant="ghost" onClick={() => useScreencastStore.getState().push(["A note from a demo run"], { note: true })}>
          Add a note
        </Button>
      </div>
      <div className="ll:relative ll:h-56 ll:w-full ll:max-w-xl ll:rounded-md ll:border ll:border-border ll:bg-surface-canvas">
        <ScreencastKeys />
      </div>
    </div>
  );
}
