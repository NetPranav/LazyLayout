"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { StageRenderer } from "@/core/render/StageRenderer";
import { installStageEngine } from "@/core/engine/stage/StageEngine";
import { evaluate } from "@/core/kernel/evaluate";
import { getDocument } from "@/core/store/documentState";
import { getTransport, transport, transportStore } from "@/core/time/transport";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useFramePreviewStore } from "@/core/store/useFramePreviewStore";
import { parityStore } from "@/core/engine/stage/parity";
import type { InputSource } from "@/core/bindings/inputBus";
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
export function useCanvasEngine(pageRef: RefObject<HTMLElement | null>): void {
  const [renderer] = useState(() => new StageRenderer());
  const designing = useCanvasViewStore((s) => s.mode === "design");
  const playing = useStore(transportStore, (s) => s.playing);
  // a frame previewed in place (its Preview toggle) is a running page too: it scrolls, so drivers and effectors run
  const framePreviewing = useFramePreviewStore((p) => Object.keys(p.previewing).length > 0);
  const enabled = !designing || playing || framePreviewing;

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
    const uninstall = installStageEngine(renderer, source ? { bindings: { host: { getDocument, compositionId: () => getTransport().compositionId, source: source.input, reducedMotion: () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false }, active: () => true } } : {});
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
  view.addEventListener("pointermove", onMove);
  view.addEventListener("pointerdown", onMove);
  view.addEventListener("pointerup", onMove);
  return {
    input: {
      pointer: () => pointer,
      pageSize: () => ({ width: page.offsetWidth, height: page.offsetHeight }),
      // the scroll of the previewed frame (a frame shown as a device's screen scrolls under the canvas's click layer): the first
      // one that has anything to scroll; none means no scroll, which reads as 0
      scroll: () => {
        for (const el of Array.from(view.querySelectorAll<HTMLElement>('[data-testid="frame-preview-scroller"]'))) {
          const max = el.scrollHeight - el.clientHeight;
          if (max > 0) return { y: el.scrollTop, max };
        }
        return { y: 0, max: 0 };
      },
    },
    dispose: () => {
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerdown", onMove);
      view.removeEventListener("pointerup", onMove);
    },
  };
}
