"use client";
import React, { useEffect, useState } from "react";
import { frameScheduler } from "@/core/time/scheduler";
import { documentStore } from "@/core/store/documentState";
import { usePlaygroundStore } from "@/core/store/usePlaygroundStore";
import { dimensionLabel, interactiveIds, smallTouchTargets, type Box } from "@/core/playground/playground";

/**
 * Playground overlays (ROADMAP Phase 90): wireframes, box model, dimensions and touch targets, drawn over the page as
 * it is now (so they follow an animation). Boxes are measured from what is on the page and shown in `pointer-events:
 * none` layers, so nothing here takes a click. Measured once per frame, and only while an overlay is on.
 */
interface Measured extends Box { margin: number[]; padding: number[] }

const px = (v: string) => Number.parseFloat(v) || 0;

export const PlaygroundOverlay: React.FC<{ host: React.RefObject<HTMLElement | null> }> = ({ host }) => {
  const overlays = usePlaygroundStore((s) => s.overlays);
  const [boxes, setBoxes] = useState<Measured[]>([]);
  const [touchIds, setTouchIds] = useState<string[]>([]);
  const on = overlays.length > 0;

  useEffect(() => {
    if (!on) return;
    let last = "";
    const measure = () => {
      const root = host.current;
      if (!root) return;
      const origin = root.getBoundingClientRect();
      const out: Measured[] = [];
      document.querySelectorAll<HTMLElement>('[data-testid="stage-page"] [data-archetype][data-element-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const cs = getComputedStyle(el);
        out.push({
          id: el.dataset.elementId ?? "",
          name: documentStore.getState().document.layers[el.dataset.elementId ?? ""]?.name ?? "",
          x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height,
          margin: [px(cs.marginTop), px(cs.marginRight), px(cs.marginBottom), px(cs.marginLeft)],
          padding: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
        });
      });
      const key = JSON.stringify(out.map((b) => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)]));
      if (key === last) return;
      last = key;
      setBoxes(out);
      setTouchIds(smallTouchTargets(out, interactiveIds(documentStore.getState().document)).map((b) => b.id));
    };
    return frameScheduler.register("overlay", measure);
  }, [on, host]);

  if (!on) return null;
  const has = (o: (typeof overlays)[number]) => overlays.includes(o);
  return (
    <div aria-hidden="true" data-testid="playground-overlay" className="ll:absolute ll:inset-0 ll:pointer-events-none ll:z-30 ll:overflow-hidden">
      {boxes.map((b) => (
        <React.Fragment key={b.id}>
          {has("box") && (
            <>
              <div data-pg="margin" style={{ position: "absolute", left: b.x - b.margin[3], top: b.y - b.margin[0], width: b.w + b.margin[1] + b.margin[3], height: b.h + b.margin[0] + b.margin[2], background: "rgba(246,178,107,.28)" }} />
              <div data-pg="padding" style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: "rgba(147,196,125,.30)" }} />
              <div data-pg="content" style={{ position: "absolute", left: b.x + b.padding[3], top: b.y + b.padding[0], width: Math.max(0, b.w - b.padding[1] - b.padding[3]), height: Math.max(0, b.h - b.padding[0] - b.padding[2]), background: "rgba(111,168,220,.35)" }} />
            </>
          )}
          {has("wireframe") && <div data-pg="wireframe" style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, outline: "1px dashed rgba(255,0,170,.85)", outlineOffset: -1 }} />}
          {has("dimensions") && b.w > 24 && b.h > 14 && (
            <span data-pg="dimensions" style={{ position: "absolute", left: b.x + 2, top: b.y + 1, font: "9px/1 monospace", color: "#fff", background: "rgba(20,20,20,.75)", padding: "1px 3px", borderRadius: 2, whiteSpace: "nowrap" }}>
              {dimensionLabel(b)}
            </span>
          )}
          {has("touch") && touchIds.includes(b.id) && (
            <div data-pg="touch" title={`${b.name} is smaller than 44 px`} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: "rgba(230,50,50,.35)", outline: "1px solid rgb(230,50,50)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
