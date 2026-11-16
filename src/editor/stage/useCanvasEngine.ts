"use client";

import { useStateEditStore } from "@/core/states/stateEdit";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { StageRenderer } from "@/core/render/StageRenderer";
import { installStageEngine } from "@/core/engine/stage/StageEngine";
import { installHalftonePointer } from "./halftonePointer";
import { evaluate } from "@/core/kernel/evaluate";
import { getDocument } from "@/core/store/documentState";
import { getTransport, transport, transportStore } from "@/core/time/transport";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useFramePreviewStore } from "@/core/store/useFramePreviewStore";
import { parityStore } from "@/core/engine/stage/parity";
import type { InputSource } from "@/core/bindings/inputBus";
import type { ScrollHost } from "@/core/scroll/ScrollDriver";
import { addBinding } from "@/core/bindings/bindingCommands";
import { parseBinding, resolveLayerRefs } from "@/core/document/signals";

/**
 * ROADMAP Phase 57 on the new canvas: the engine's stage adapters (`installStageEngine`, the kernel adapter) animate
 * the layers the canvas drew, writing straight to their elements in the scheduler's "apply" phase, exactly as the
 * curves say. Nothing re-renders to animate.
 *
 * The canvas draws through `RenderLayer`, which keeps no element registry of its own, so this fills the engine's
 * `LayerNodeRegistry` from the drawn page: every `[data-archetype][data-element-id]` element, except the copies a
 * linked view (mirror frame) draws of another frame's layers. It re-reads after each render and whenever the page's
 * elements change.
 *
 * The engine runs where the canvas should show motion: in Motion and Preview, and while playing. In Design (paused)
 * it is not installed, so the canvas shows the design itself; uninstalling puts back exactly what React drew.
 */
/** Drivers and effectors are live where the canvas shows motion: Motion, Preview, and while playing. Design shows the design itself. */
const driversLive = (): boolean => useCanvasViewStore.getState().mode !== "design" || getTransport().playing || Object.keys(useFramePreviewStore.getState().previewing).length > 0;

export function useCanvasEngine(pageRef: RefObject<HTMLElement | null>): void {
  const [renderer] = useState(() => new StageRenderer());
  const designing = useCanvasViewStore((s) => s.mode === "design");
  const playing = useStore(transportStore, (s) => s.playing);
  // a frame previewed in place (its Preview toggle) is a running page too: it scrolls, so drivers and effectors run
  const framePreviewing = useFramePreviewStore((p) => Object.keys(p.previewing).length > 0);
  // Design track D15: a state being edited, or states shown live, are drawn by the engine even in Design
  const statesShown = useStateEditStore((s) => s.layerId !== null || s.live);
  const enabled = !designing || playing || framePreviewing || statesShown;

  // the Halftone effect follows the pointer wherever the canvas shows motion
  useEffect(() => {
    const page = pageRef.current;
    if (!enabled || !page) return undefined;
    return installHalftonePointer(page, driversLive);
  }, [enabled, pageRef]);

  // keep the registry in step with what is drawn
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    syncRegistry(page, renderer);
  });
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    const observer = new MutationObserver(() => syncRegistry(page, renderer));
    observer.observe(page, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pageRef, renderer]);

  useEffect(() => {
    if (!enabled) return undefined;
    const page = pageRef.current;
    const source = page ? pagePointerSource(page) : null;
    const uninstall = installStageEngine(renderer, source ? { scroll: { host: pageScrollHost(page!, getDocument), active: () => Object.keys(useFramePreviewStore.getState().previewing).length > 0 }, bindings: { host: { getDocument, compositionId: () => getTransport().compositionId, source: source.input, reducedMotion: () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false }, active: () => driversLive() }, states: { getDocument, source: source.input, reducedMotion: () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, editing: () => { const e = useStateEditStore.getState(); return e.layerId && e.name ? { layerId: e.layerId, name: e.name } : null; }, live: () => useStateEditStore.getState().live || Object.keys(useFramePreviewStore.getState().previewing).length > 0 }, variants: { getDocument, source: source.input, reducedMotion: () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, live: () => useStateEditStore.getState().live || Object.keys(useFramePreviewStore.getState().previewing).length > 0 } } : {});
    // Test seam: the kernel's answer for a layer and the transport, so a browser test can compare the canvas with it.
    const w = window as unknown as { __LL_TEST__?: boolean; __LL_ENGINE__?: unknown };
    if (w.__LL_TEST__) {
      w.__LL_ENGINE__ = {
        kernel: (layerId: string, time: number) => evaluate(getDocument(), getTransport().compositionId, layerId, time),
        seek: (time: number) => transport.seek(time),
        play: () => transport.play(),
        pause: () => transport.pause(),
        time: () => getTransport().time,
        loop: (on: boolean) => transport.setLoop(on ? "loop" : "off"),
        parity: () => parityStore.getState(),
        document: () => getDocument(),
        // D4: add a driver from its text form; layer names are looked up in the document
        addBinding: (text: string, ownerLayerId: string) => {
          const layers = Object.values(getDocument().layers);
          return addBinding(resolveLayerRefs(parseBinding(text), (name) => layers.find((l) => l.name === name || l.id === name)?.id), ownerLayerId);
        },
      };
    }
    return () => {
      uninstall();
      source?.dispose();
      if (w.__LL_TEST__) delete w.__LL_ENGINE__;
    };
  }, [enabled, renderer, pageRef]);
}

function syncRegistry(page: HTMLElement, renderer: StageRenderer): void {
  const seen = new Set<string>();
  for (const el of page.querySelectorAll<HTMLElement>("[data-archetype][data-element-id]")) {
    // a linked view's copy of another frame's layer is not that layer's element
    if (el.closest("[data-mirror-id]")) continue;
    const id = el.getAttribute("data-element-id");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    renderer.registry.register(id, el);
  }
  for (const id of renderer.registry.ids()) if (!seen.has(id)) renderer.registry.unregister(id);
}

/**
 * The input bus's eyes on the canvas (D4): where the pointer is over the stage, in the drawn page's own px (so zoom and
 * pan do not change what a driver reads), and the scroll of the frame. Pointer events on the stage viewport, not the
 * window; scroll is the previewed frame's own scroll (`frame-preview-scroller`), and reads as none when nothing scrolls.
 */
function pagePointerSource(page: HTMLElement): { input: InputSource; dispose: () => void } {
  const view = page.closest<HTMLElement>('[data-testid="stage-viewport"]') ?? page;
  let pointer: { x: number; y: number; down: boolean; coarse: boolean; pressure: number; type: "mouse" | "pen" | "touch" } | null = null;
  const toPage = (e: PointerEvent) => {
    const r = page.getBoundingClientRect();
    const sx = page.offsetWidth > 0 ? r.width / page.offsetWidth : 1;
    const sy = page.offsetHeight > 0 ? r.height / page.offsetHeight : 1;
    return { x: (e.clientX - r.left) / (sx || 1), y: (e.clientY - r.top) / (sy || 1) };
  };
  const onMove = (e: PointerEvent) => {
    const t: "mouse" | "pen" | "touch" = e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse";
    pointer = { ...toPage(e), down: e.buttons !== 0, coarse: t === "touch", pressure: e.pressure, type: t };
  };
  /** The first previewed frame that has anything to scroll. */
  const scroller = (): HTMLElement | null => {
    for (const el of Array.from(view.querySelectorAll<HTMLElement>('[data-testid="frame-preview-scroller"]'))) if (el.scrollHeight - el.clientHeight > 0) return el;
    return null;
  };
  view.addEventListener("pointermove", onMove);
  // a press and release inside one frame would never be seen as "down": count the presses too (Phase 80)
  let presses = 0;
  const onDown = (e: PointerEvent) => {
    presses++;
    onMove(e);
  };
  view.addEventListener("pointerdown", onDown);
  view.addEventListener("pointerup", onMove);
  return {
    input: {
      pointer: () => pointer,
      presses: () => presses,
      pageSize: () => ({ width: page.offsetWidth, height: page.offsetHeight }),
      // the scroll of the previewed frame (a frame shown as a device's screen scrolls under the canvas's click layer): the first
      // one that has anything to scroll; none means no scroll, which reads as 0
      scroll: () => {
        const el = scroller();
        return el ? { y: el.scrollTop, max: el.scrollHeight - el.clientHeight, viewport: el.clientHeight } : { y: 0, max: 0 };
      },
      // where a layer is on the page, in the same px as the pointer (the page's own, whatever the zoom)
      layerRect: (id) => {
        const el = page.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`);
        if (!el) return null;
        const pr = page.getBoundingClientRect();
        const k = page.offsetWidth > 0 ? pr.width / page.offsetWidth : 1;
        const r = el.getBoundingClientRect();
        return { x: (r.left - pr.left) / (k || 1), y: (r.top - pr.top) / (k || 1), width: r.width / (k || 1), height: r.height / (k || 1) };
      },
      // where a layer sits in the scrolled content, in the page's own px: its drawn position inside the (scrolled) frame, plus the scroll
      layerBox: (id) => {
        const sc = scroller();
        const frameId = sc?.getAttribute("data-frame-id");
        const frame = frameId ? page.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(frameId)}"]`) : null;
        const el = page.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`);
        if (!sc || !frame || !el) return null;
        const k = page.offsetWidth > 0 ? page.getBoundingClientRect().width / page.offsetWidth : 1;
        const fr = frame.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { top: (r.top - fr.top) / (k || 1) + sc.scrollTop, height: r.height / (k || 1) };
      },
    },
    dispose: () => {
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerdown", onDown);
      view.removeEventListener("pointerup", onMove);
    },
  };
}

/**
 * The scroll the scroll-driven clips read (Phase 81 on the new canvas, Design track D11): the previewed frame's own scroll, and where
 * each layer sits in its content. A frame shown as a device's screen scrolls (its `scrollTop`), so a clip's range is measured against
 * that, not against the browser window.
 */
function pageScrollHost(page: HTMLElement, getDoc: () => import("@/core/document/schema").MotionDocument): ScrollHost {
  const originals = new Map<string, string>();
  // the scroll overlays live in the stage viewport, above the drawn page (not inside it)
  const view = page.closest<HTMLElement>('[data-testid="stage-viewport"]') ?? page;
  /** The first previewed frame that has anything to scroll, as the drawn element that scrolls. */
  const frame = (): HTMLElement | null => {
    for (const s of Array.from(view.querySelectorAll<HTMLElement>('[data-testid="frame-preview-scroller"]'))) {
      const id = s.getAttribute("data-frame-id");
      const node = id ? page.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`) : null;
      if (node && node.scrollHeight - node.clientHeight > 0) return node;
    }
    return null;
  };
  const el = (id: string) => page.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`);
  return {
    getDocument: getDoc,
    metrics() {
      const f = frame();
      return f ? { scrollY: f.scrollTop, viewportHeight: f.clientHeight } : null;
    },
    box(id) {
      const f = frame();
      const node = el(id);
      if (!f || !node || !node.isConnected || !f.contains(node)) return null;
      // layout position inside the frame's content, ignoring transforms (so a clip animating the layer cannot move its own range)
      let top = 0;
      let n: Element | null = node;
      while (n && n !== f) {
        const own = layoutTop(n);
        if (own === null) return null;
        top += own;
        n = (n as HTMLElement).offsetParent ?? n.parentElement;
      }
      if (n !== f) return null;
      const css = parseFloat(getComputedStyle(node).height);
      const height = typeof node.offsetHeight === "number" ? node.offsetHeight : Number.isFinite(css) ? css : 0;
      return { top, height };
    },
    setPin(id, px) {
      const node = el(id);
      if (!node) return;
      if (px === null) {
        const original = originals.get(id);
        if (original) node.style.setProperty("translate", original);
        else node.style.removeProperty("translate");
        originals.delete(id);
        return;
      }
      if (!originals.has(id)) originals.set(id, node.style.getPropertyValue("translate"));
      node.style.setProperty("translate", `0 ${px}px`);
    },
  };
}

/** An element's top inside its offset parent from layout, not from where it is drawn: `offsetTop`, or the CSS `top` of an absolutely placed svg (which has no offsetTop). Null when it cannot be told. */
function layoutTop(el: Element): number | null {
  const h = el as HTMLElement;
  if (typeof h.offsetTop === "number") return h.offsetTop;
  const cs = getComputedStyle(el);
  if (cs.position !== "absolute") return null;
  const t = parseFloat(cs.top);
  return Number.isFinite(t) ? t : 0;
}
