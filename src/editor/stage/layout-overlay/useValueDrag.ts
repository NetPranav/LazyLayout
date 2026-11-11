"use client";

import { useCallback, useState } from "react";
import { documentCommands } from "@/core/store/useDocumentStore";
import type { PropValue } from "@/core/document/registry";
import { snapSpacing } from "./spacingScale";

export interface ValueDrag {
  /** The layer the value is written to. */
  id: string;
  label: string;
  axis: "x" | "y";
  /** 1 when dragging towards +x / +y makes the value bigger, -1 when it makes it smaller. */
  sign: 1 | -1;
  base: number;
  /** Snap to the spacing scale (padding, gap); tracks round to whole pixels. */
  scale: boolean;
  min?: number;
  write: (value: number, mods: { shift: boolean; alt: boolean }) => Record<string, PropValue | undefined>;
}

/** One drag of a number on the canvas: written live inside one transaction (one undo step), Esc puts it back. */
export function useValueDrag(zoom: number) {
  const [live, setLive] = useState<{ key: string; value: number } | null>(null);
  const start = useCallback(
    (e: React.PointerEvent, key: string, spec: ValueDrag) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const scale = zoom > 0 ? zoom : 1;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const tx = documentCommands.begin(spec.label);
      const move = (ev: PointerEvent) => {
        const delta = ((spec.axis === "x" ? ev.clientX - x0 : ev.clientY - y0) / scale) * spec.sign;
        const raw = spec.base + delta;
        const value = Math.max(spec.min ?? 0, spec.scale ? snapSpacing(raw, ev.ctrlKey || ev.metaKey) : Math.round(raw));
        documentCommands.updateProps(spec.id, spec.write(value, { shift: ev.shiftKey, alt: ev.altKey }));
        setLive({ key, value });
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("keydown", esc, true);
        setLive(null);
      };
      const up = () => {
        stop();
        tx.commit();
      };
      const esc = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.stopPropagation();
        stop();
        tx.cancel();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("keydown", esc, true);
    },
    [zoom],
  );
  return { live, start };
}
