"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { StageRenderer } from "@/core/render/StageRenderer";
import { installStageEngine } from "@/core/engine/stage/StageEngine";
import { evaluate } from "@/core/kernel/evaluate";
import { getDocument } from "@/core/store/documentState";
import { getTransport, transport, transportStore } from "@/core/time/transport";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { parityStore } from "@/core/engine/stage/parity";

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
  const enabled = !designing || playing;

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
    const uninstall = installStageEngine(renderer);
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
      };
    }
    return () => {
      uninstall();
      if (w.__LL_TEST__) delete w.__LL_ENGINE__;
    };
  }, [enabled, renderer]);
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
