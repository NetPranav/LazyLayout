"use client";

import type { CSSProperties } from "react";
import { frameScheduler } from "@/core/time/scheduler";
import { getTransport, subscribeTransport } from "@/core/time/transport";
import { getDocument } from "@/core/store/documentState";
import { evaluate } from "@/core/kernel/evaluate";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { layerBoxStyle } from "@/core/render/geometry";
import { resolveProps } from "@/core/render/resolve";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";

/**
 * Playback without re-rendering (ROADMAP Phase 56). While the transport plays, the animated values of each layer are
 * written straight onto its drawn node in the scheduler's "apply" phase, so neither the canvas nor the timeline
 * re-renders 60 times a second. When playback stops, every value written is put back exactly as React had it, and
 * React draws the paused frame from there.
 *
 * Two rules keep the drawing identical to React's:
 * - only the CSS a clip actually animates is touched (a layer's static background or radius is never written, so it
 *   can't be lost on pause);
 * - the CSS comes from `layerBoxStyle`, the function the renderer itself uses, so the transform (perspective, pins,
 *   order of operations) is the one React would draw and nothing jumps when playback stops.
 */

/** Which CSS properties a document property drives. */
const CSS_OF: Array<[test: (path: string) => boolean, css: Array<keyof CSSProperties>]> = [
  [(p) => p === "appearance.opacity", ["opacity"]],
  [(p) => p.startsWith("transform.") || p === "frame.rotation", ["transform", "transformOrigin"]],
  [(p) => p === "appearance.background.color", ["backgroundColor"]],
  [(p) => p === "appearance.radius", ["borderRadius"]],
];

const kebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The inline values React had on each element before playback wrote over them, to put back on pause. */
const saved = new Map<HTMLElement, Map<string, string>>();

/** Puts back every inline value playback wrote, exactly as it was. */
export function clearStagePlaybackOverrides(): void {
  for (const [el, props] of saved) {
    for (const [prop, value] of props) {
      if (value === "") el.style.removeProperty(prop);
      else el.style.setProperty(prop, value);
    }
  }
  saved.clear();
}

function write(el: HTMLElement, prop: string, value: string): void {
  let props = saved.get(el);
  if (!props) saved.set(el, (props = new Map()));
  if (!props.has(prop)) props.set(prop, el.style.getPropertyValue(prop));
  if (value === "") el.style.removeProperty(prop);
  else el.style.setProperty(prop, value);
}

const cssValue = (v: unknown): string => (v === undefined || v === null ? "" : typeof v === "number" ? String(v) : String(v));

/** Writes the animated values of every clip-driven layer at `explicitTime` (default: the transport's time). */
export function applyStagePlaybackDirectDom(explicitTime?: number): void {
  if (typeof document === "undefined") return;
  const t = getTransport();
  const timeSec = explicitTime !== undefined ? explicitTime : t.time;
  const fps = t.fps || 60;
  document.querySelector<HTMLElement>('[data-testid="stage-page"]')?.setAttribute("data-frame", String(Math.round(timeSec * fps)));

  const doc = getDocument();
  // the CSS each layer's clips animate
  const animated = new Map<string, Set<keyof CSSProperties>>();
  for (const clip of Object.values(doc.clips ?? {})) {
    if (!clip.enabled || !doc.layers[clip.layerId]) continue;
    for (const track of clip.tracks) {
      for (const [test, css] of CSS_OF) {
        if (!test(track.property)) continue;
        let set = animated.get(clip.layerId);
        if (!set) animated.set(clip.layerId, (set = new Set()));
        for (const c of css) set.add(c);
      }
    }
  }

  for (const [layerId, cssProps] of animated) {
    const el = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype][data-element-id="${layerId}"]`);
    if (!el) continue;
    let props: Record<string, unknown>;
    try {
      props = evaluate(doc, MAIN_COMPOSITION_ID, layerId, timeSec);
    } catch {
      continue;
    }
    const base = doc.layers[layerId];
    const layer: Layer = { ...base, properties: { ...base.properties, ...(props as Record<string, PropValue>) } };
    const style = layerBoxStyle(layer, resolveProps(layer), { frameAtOrigin: true, layers: doc.layers });
    for (const prop of cssProps) write(el, kebab(prop), cssValue(style[prop]));
  }
}

/**
 * Installs playback-by-DOM: an "apply" task while playing, and a full restore the moment playback stops (or on
 * uninstall). Returns the uninstall function.
 */
export function installStagePlaybackDirectDom(): () => void {
  const unregisterScheduler = frameScheduler.register("apply", () => {
    const t = getTransport();
    if (t.playing) applyStagePlaybackDirectDom(t.time);
  });
  const unsubscribeTransport = subscribeTransport((state, prev) => {
    if (prev.playing && !state.playing) clearStagePlaybackOverrides();
  });
  return () => {
    clearStagePlaybackOverrides();
    unsubscribeTransport();
    unregisterScheduler();
  };
}
