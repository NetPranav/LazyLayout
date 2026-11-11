"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { ArchetypeRenderProps } from "./types";
type ResolvedProps = ArchetypeRenderProps["resolved"];
import { frameScheduler } from "../time/scheduler";
import { SurfaceController, rasterizeText, type SurfaceGeometry, type Ticker } from "../surface/controller";
import { surfaceSettings, linearRgb } from "../surface/settings";

/**
 * Surfaces (ROADMAP S2–S6): an inflated surface drawn in a layer's box. The canvas sits under the layer's own content
 * and over its background (the host isolates its stacking). Text inside the host is printed onto the surface (and kept
 * as real, invisible text). Presses dent it only when `interactive` (Preview, export); in Design the layer keeps the
 * pointer (COLLABORATION §10).
 */

const editorTicker: Ticker = (task) => frameScheduler.register("render", (f) => task(f.dt));

const HIDE_TEXT_STYLE = "[data-surface-host] [data-archetype=\"text\"]{opacity:0 !important}";

function ensureStyle(doc: Document): void {
  if (doc.getElementById("ll-surface-style")) return;
  const style = doc.createElement("style");
  style.id = "ll-surface-style";
  style.textContent = HIDE_TEXT_STYLE;
  doc.head.appendChild(style);
}

/** A layer's surface colour: the first visible solid fill, else the frame's background, else near black. */
export function surfaceBaseColor(resolved: ResolvedProps): string {
  const fills = resolved.get("paint.fills");
  if (typeof fills === "string" && fills.startsWith("[")) {
    try {
      const list = JSON.parse(fills) as Array<{ type?: string; color?: string; visible?: boolean; stops?: Array<{ color: string }> }>;
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        if (f.visible === false) continue;
        if (f.type === "solid" && f.color) return f.color;
        if (f.stops && f.stops[0]) return f.stops[0].color;
      }
    } catch {
      // not a fill list
    }
  }
  const bg = resolved.str("appearance.background.color", "");
  if (bg && bg !== "transparent") return bg;
  const svgFill = resolved.str("svg.fill", "");
  return svgFill || "#111111";
}

export interface SurfaceViewProps {
  resolved: ResolvedProps;
  geometry: SurfaceGeometry;
  interactive: boolean;
  /** Draw the host's text onto the surface. */
  content: boolean;
  ticker?: Ticker;
}

export const SurfaceView: React.FC<SurfaceViewProps> = ({ resolved, geometry, interactive, content, ticker = editorTicker }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<SurfaceController | null>(null);
  const settings = surfaceSettings((p) => resolved.get(p));
  const settingsKey = JSON.stringify(settings);
  const base = surfaceBaseColor(resolved);
  const geoKey = `${geometry.width}|${geometry.height}|${geometry.radius}|${geometry.kind}`;
  const stableSettings = useMemo(() => JSON.parse(settingsKey) as typeof settings, [settingsKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new SurfaceController(canvas, ticker);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [ticker]);

  // settings, size, colour
  useEffect(() => {
    const canvas = canvasRef.current;
    const controller = controllerRef.current;
    if (!canvas || !controller) return;
    const host = canvas.parentElement;
    const rect = host?.getBoundingClientRect();
    const zoom = host && host.offsetWidth > 0 && rect ? rect.width / host.offsetWidth : 1;
    const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const [w, h, r, kind] = geoKey.split("|");
    controller.update({ width: Number(w), height: Number(h), radius: Number(r), kind: kind as SurfaceGeometry["kind"] }, stableSettings, linearRgb(base), Math.min(3, dpr * zoom));
  }, [geoKey, stableSettings, base, ticker]);

  // the text, printed on the surface
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || !content) {
      controllerRef.current?.setContent(null);
      return;
    }
    ensureStyle(canvas.ownerDocument);
    let pending = false;
    const redraw = () => {
      pending = false;
      const rect = host.getBoundingClientRect();
      const zoom = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
      const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      controllerRef.current?.setContent(rasterizeText(host, Math.min(3, dpr * zoom)));
    };
    const soon = () => {
      if (pending) return;
      pending = true;
      const stop = ticker(() => {
        stop();
        redraw();
      });
    };
    soon();
    const observer = new MutationObserver(soon);
    observer.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
    void canvas.ownerDocument.fonts?.ready.then(soon);
    return () => observer.disconnect();
  }, [content, geoKey, ticker]);

  // presses (Preview and export only)
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || !interactive) return;
    const local = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const zoom = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
      return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    };
    let down = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = true;
      const p = local(e);
      controllerRef.current?.press(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const p = local(e);
      controllerRef.current?.move(p.x, p.y);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      controllerRef.current?.release();
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    const win = host.ownerDocument.defaultView ?? window;
    win.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    return () => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      data-surface-canvas=""
      aria-hidden="true"
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none", display: "block" }}
    />
  );
};
