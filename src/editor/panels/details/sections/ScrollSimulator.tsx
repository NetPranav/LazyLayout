"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/editor/components/Button";
import { useDocument } from "@/core/store/useDocumentStore";
import { useFramePreviewStore } from "@/core/store/useFramePreviewStore";
import { OptionRow } from "../options/OptionRow";

/**
 * Scroll simulator (Design track D11, Main 82): scrub the page's scroll from the panel. It moves the previewed frame's own
 * scroll position, the same one the wheel moves, so a pinned section plays identically from here and from real scrolling.
 * Preview the page (this button) and drag.
 */
export const ScrollSimulator: React.FC<{ layerId: string }> = ({ layerId }) => {
  const layers = useDocument((d) => d.layers);
  const previewing = useFramePreviewStore((s) => s.previewing);
  const setPreview = useFramePreviewStore((s) => s.setPreview);
  const [pos, setPos] = useState(0);

  // the page the layer sits on: its ancestor directly under the canvas root
  let frameId: string | null = null;
  for (let cur: (typeof layers)[string] | undefined = layers[layerId]; cur; cur = cur.parentId ? layers[cur.parentId] : undefined) {
    const parent = cur.parentId ? layers[cur.parentId] : undefined;
    if (parent && parent.parentId === null) frameId = cur.id;
  }
  const on = !!(frameId && previewing[frameId]);
  const scroller = (): HTMLElement | null => (frameId ? document.querySelector<HTMLElement>(`[data-testid="frame-preview-scroller"][data-frame-id="${CSS.escape(frameId)}"]`) : null);

  // follow real scrolling, so the slider and the wheel agree
  useEffect(() => {
    if (!on) return undefined;
    const el = scroller();
    if (!el) return undefined;
    const sync = () => setPos(el.scrollHeight - el.clientHeight > 0 ? Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 1000) : 0);
    el.addEventListener("scroll", sync, { passive: true });
    sync();
    return () => el.removeEventListener("scroll", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, frameId]);

  if (!frameId) return null;
  return (
    <div className="ll:flex ll:flex-col ll:gap-1.5" data-testid="scroll-simulator">
      <OptionRow label="Simulate">
        <Button size="sm" aria-label={on ? "Stop previewing the page" : "Preview the page to scrub its scroll"} aria-pressed={on} onClick={() => setPreview(frameId!, !on)}>
          {on ? "Previewing" : "Preview page"}
        </Button>
      </OptionRow>
      <OptionRow label="Scroll">
        <input
          type="range"
          min={0}
          max={1000}
          value={pos}
          disabled={!on}
          aria-label="Scroll position"
          title="Drag to scroll the previewed page, from the top to the bottom."
          className="ll:w-full"
          onChange={(e) => {
            const v = Number(e.target.value);
            setPos(v);
            const el = scroller();
            if (el) el.scrollTop = (v / 1000) * (el.scrollHeight - el.clientHeight);
          }}
        />
      </OptionRow>
    </div>
  );
};
