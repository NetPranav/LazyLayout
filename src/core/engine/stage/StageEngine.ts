import { documentStore, getDocument } from "../../store/documentState";
import { frameScheduler, type FrameInfo, type FrameScheduler } from "../../time/scheduler";
import { getTransport, subscribeTransport } from "../../time/transport";
import type { StageRenderer } from "../../render/StageRenderer";
import { StageAdapters } from "./StageAdapters";
import { waapiBakeStats } from "./WaapiAdapter";
import { KernelAdapter } from "./KernelAdapter";
import { ParityMonitor, parityEnabled } from "./parity";
import type { AdapterHost, EngineAdapter } from "./types";
import { ScrollDriver, type ScrollHost } from "../../scroll/ScrollDriver";
import { BindingDriver, type BindingDriverHost } from "./BindingDriver";
import { boundLayerIds, copiedLayerIds } from "./styleWrites";
import { StateDriver, type StateDriverHost } from "./StateDriver";
import { VariantDriver, type VariantDriverHost } from "./VariantDriver";
import { LayoutDriver, type LayoutDriverHost } from "./LayoutDriver";
import { stateLayerIds } from "../../states/states";
import { EffectorDriver } from "./EffectorDriver";
import { CssVarWriter } from "./CssVarWriter";

/**
 * ROADMAP Phase 57: puts the animation on the stage. Reads the transport (Phase 54), and each frame, in the
 * scheduler's `apply` phase (Phase 55), asks the adapter to show the transport's time. It writes through the
 * stage's `LayerNodeRegistry`, never through React or the document store (Law 9).
 *
 * Today the kernel adapter shows everything. Phase 58 adds a Web Animations adapter for animations that can run off
 * the main thread, and Phase 59 chooses between them for scrubbing and playing.
 */
export interface StageEngineOptions {
  scheduler?: FrameScheduler;
  adapter?: EngineAdapter;
  /** Run the parity monitor (Phase 60). Default: dev builds, tests and `?parity=1`. */
  parity?: boolean;
  /** Scroll-driven clips (Phase 81): the frame's scroll, and whether it is live (Preview only; in Design the page isn't scrolled and reveals stay as drawn). */
  scroll?: { host: ScrollHost; active: () => boolean };
  /** Design track D4: drivers (bindings). The host measures the page's inputs; `active` says whether they are live (Preview and Motion; in Design the page shows the design). */
  bindings?: { host: BindingDriverHost; active: () => boolean };
  /** Design track D15: states. Hover and press come from the same input source; `editing` and `live` say what to show. */
  states?: StateDriverHost;
  /** Phase 80: animated variants (a variant switch moves on the instance's transition; an instance's own click, hover or press). */
  variants?: VariantDriverHost;
  /** Phase 93: whether to draw the page as reduced motion gets it (the canvas's switch or the system's setting). */
  reducedMotion?: () => boolean;
  /** Phase 88: the breakpoint being viewed (null: the base); motion plays as that breakpoint says. */
  breakpoint?: () => string | null;
  /** Phase 87: layout motion and presence (the element of each layer comes from the renderer's registry). */
  layout?: Omit<LayoutDriverHost, "node" | "getDocument">;
}

/** The installed engines' "measure at rest" steps (see `measureAtRest`). */
const restSteps = new Set<<T>(read: () => T) => T>();

/**
 * Runs `read` with the animation taken off every layer the stage engines are drawing, then puts it back (nothing is
 * painted in between). The canvas measures its layers with this, so a layer's box is where it rests whatever the
 * playhead shows. With no engine installed it just runs `read`. Layers playing as Web Animations are not rested.
 */
export function measureAtRest<T>(read: () => T): T {
  let run = read;
  for (const step of restSteps) {
    const inner = run;
    run = () => step(inner);
  }
  return run();
}

/** Told after every frame the stage engines wrote to the page (see `afterEngineWrites`). */
const writeListeners = new Set<() => void>();

/**
 * Calls `listener` right after each frame of the engines' `apply` step, in the same task as their writes (styles, CSS
 * variables, filters). The canvas watches the page for changes that move a layer's resting box; the engine's writes
 * only change the animated pose, so the canvas uses this to drop what it saw of them instead of measuring the page
 * again on every frame of playback.
 */
export function afterEngineWrites(listener: () => void): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

export function installStageEngine(renderer: StageRenderer, options: StageEngineOptions = {}): () => void {
  const scheduler = options.scheduler ?? frameScheduler;
  const adapter = options.adapter ?? new StageAdapters();
  const host: AdapterHost = {
    node: (id) => renderer.registry.get(id),
    getDocument,
    compositionId: () => getTransport().compositionId,
    fps: () => getTransport().fps,
    duration: () => getTransport().duration,
  };
  adapter.mount(host);

  let lastTime = Number.NaN;
  let lastPlaying = false;
  let lastRate = 1;
  let dirty = true;

  // Sample animations ahead of time, in idle slices, so Play/seek after an edit find their keyframes ready
  // (performance, 2026-11-18). Only the stage's own WAAPI adapter supports it; others are left alone.
  const waapi = adapter instanceof StageAdapters ? adapter.waapi : null;
  let idleHandle: number | null = null;
  const idle = typeof window !== "undefined" && typeof window.requestIdleCallback === "function" ? window : null;
  const schedulePrebake = () => {
    if (!waapi || !idle || idleHandle !== null) return;
    idleHandle = idle.requestIdleCallback(
      (deadline) => {
        idleHandle = null;
        if (getTransport().playing) return; // playing: play() already sampled what it needed
        // On a busy page the callback can arrive by timeout with no idle time left; then take a short slice anyway, so
        // the work still gets done a little at a time instead of being put off forever.
        const sliceEnd = performance.now() + 8;
        const timeLeft = deadline.didTimeout ? () => sliceEnd - performance.now() : () => deadline.timeRemaining();
        if (!waapi.prebake(timeLeft)) schedulePrebake();
      },
      { timeout: 2000 },
    );
  };

  // What was drawn may have changed under the adapter: the document, or a layer's element.
  const unsubscribeDocument = documentStore.subscribe((state, prev) => {
    if (state.document === prev.document) return;
    adapter.invalidate();
    bindingDriver?.invalidate();
    syncBoundLayers();
    dirty = true;
    schedulePrebake();
  });
  schedulePrebake();
  // Test seam (only with window.__LL_TEST__): the WAAPI adapter's work counters, for the performance budget e2e spec.
  if (waapi && typeof window !== "undefined" && (window as unknown as { __LL_TEST__?: boolean }).__LL_TEST__) {
    (window as unknown as { __LL_WAAPI__?: typeof waapiBakeStats }).__LL_WAAPI__ = waapiBakeStats;
  }
  const unsubscribeNodes = renderer.registry.subscribe(() => {
    adapter.invalidate();
    dirty = true;
  });
  const unsubscribeTransport = subscribeTransport((state, prev) => {
    if (state.compositionId !== prev.compositionId) {
      adapter.invalidate();
      dirty = true;
    }
  });

  const scrollDriver = options.scroll ? new ScrollDriver(options.scroll.host) : null;
  const bindingDriver = options.bindings ? new BindingDriver(options.bindings.host) : null;
  let bindingsWereLive = false;
  // D10: pointer effectors restyle their copies live (same input source as the drivers)
  const effectorDriver = options.bindings ? new EffectorDriver({ getDocument, node: (id) => renderer.registry.get(id), source: options.bindings.host.source }) : null;
  let effectorsWereLive = false;
  const cssVars = new CssVarWriter((id) => renderer.registry.get(id) as unknown as { style: { setProperty(n: string, v: string): void; removeProperty(n: string): string; getPropertyValue(n: string): string } } | undefined);
  const setBound = (bound: ReturnType<BindingDriver["update"]>) => {
    if (adapter instanceof StageAdapters) adapter.setBound(bound ?? undefined);
    else adapter.setInputs({ bound: bound ?? undefined });
  };
  const syncBoundLayers = () => {
    if (adapter instanceof StageAdapters) adapter.setBoundLayers(new Set([...(options.bindings ? boundLayerIds(getDocument()) : []), ...copiedLayerIds(getDocument()), ...(options.states ? stateLayerIds(getDocument()) : [])]));
  };
  syncBoundLayers();
  let scrollWasLive = false;
  const stateDriver = options.states ? new StateDriver(options.states) : null;
  let statesWereLive = false;
  let lastBreakpoint: string | null | undefined;
  let lastReduced: boolean | undefined;
  const variantDriver = options.variants ? new VariantDriver(options.variants) : null;
  let variantsWereLive = false;
  const layoutDriver = options.layout ? new LayoutDriver({ ...options.layout, getDocument, node: (id) => renderer.registry.get(id) as unknown as ReturnType<LayoutDriverHost["node"]> }) : null;

  const applyFrame = (frame: FrameInfo) => {
    if (scrollDriver && options.scroll) {
      const live = options.scroll.active();
      if (live || scrollWasLive) {
        const update = live ? scrollDriver.update(frame) : scrollDriver.reset();
        scrollWasLive = live;
        if (update.changed) {
          if (adapter instanceof StageAdapters) adapter.setScrollLayers(update.layers);
          adapter.setInputs({ scrollClipTime: update.clipTime });
          dirty = true;
        }
      }
    }
    const { time, playing, rate } = getTransport();
    if (options.reducedMotion && adapter instanceof StageAdapters) {
      const reduced = options.reducedMotion();
      if (reduced !== lastReduced) {
        lastReduced = reduced;
        adapter.setReducedMotion(reduced);
        dirty = true;
      }
    }
    if (options.breakpoint && adapter instanceof StageAdapters) {
      const viewed = options.breakpoint();
      if (viewed !== lastBreakpoint) {
        lastBreakpoint = viewed;
        adapter.setBreakpoint(viewed);
        dirty = true;
      }
    }
    if (stateDriver && adapter instanceof StageAdapters && !stateDriver.idle) {
      const states = stateDriver.update(frame.dt);
      if (stateDriver.changed || !statesWereLive) {
        adapter.setStates(states);
        dirty = true;
      }
      statesWereLive = true;
    } else if (statesWereLive && adapter instanceof StageAdapters) {
      adapter.setStates(null); // back to what the document says
      stateDriver?.dispose();
      statesWereLive = false;
      dirty = true;
    }
    if (variantDriver && adapter instanceof StageAdapters && !variantDriver.idle) {
      const mix = variantDriver.update(frame.dt);
      if (variantDriver.changed || !variantsWereLive) {
        adapter.setPropMix(mix);
        dirty = true;
      }
      variantsWereLive = true;
    } else if (variantsWereLive && adapter instanceof StageAdapters) {
      adapter.setPropMix(null); // back to what the document says
      variantsWereLive = false;
      dirty = true;
    }
    if (effectorDriver && options.bindings) {
      const live = options.bindings.active() && !effectorDriver.idle;
      if (live) effectorDriver.update();
      else if (effectorsWereLive) effectorDriver.dispose(); // back to the copies as drawn
      effectorsWereLive = live;
    }
    if (bindingDriver && options.bindings) {
      // Drivers: nothing is measured or marked dirty while no binding is enabled. A frame with live bindings always redraws, because the pointer or the scroll may have moved.
      const live = options.bindings.active() && !bindingDriver.idle;
      if (live) {
        setBound(bindingDriver.update(time, frame.dt));
        cssVars.apply(bindingDriver.vars);
        dirty = true;
      } else if (bindingsWereLive) {
        setBound(null); // back to what the document says
        cssVars.dispose();
        dirty = true;
      }
      bindingsWereLive = live;
    }
    if (playing !== lastPlaying || (playing && rate !== lastRate)) {
      if (playing) adapter.play(time, rate);
      else adapter.pause(time);
      if (playing !== lastPlaying) dirty = true; // a hand-over between engines: show the time again
      lastPlaying = playing;
      lastRate = rate;
    }
    if (dirty || time !== lastTime) {
      dirty = false;
      lastTime = time;
      adapter.seek(time);
    }
    // after everything else has drawn: where the layout now puts each layer that animates its layout changes
    if (layoutDriver && !layoutDriver.idle) layoutDriver.update(frame.dt);
  };
  const unregister = scheduler.register("apply", (frame) => {
    try {
      applyFrame(frame);
    } finally {
      for (const listener of writeListeners) listener();
    }
  });

  // Phase 60: while playing, compare what the engines show with `evaluate()` every 30 frames.
  const stageAdapters = adapter instanceof StageAdapters ? adapter : null;
  const restStep = <T,>(read: () => T): T => (stageAdapters ? stageAdapters.kernel.atRest(read) : adapter instanceof KernelAdapter ? adapter.atRest(read) : read());
  restSteps.add(restStep);
  const unmonitor =
    stageAdapters && (options.parity ?? parityEnabled())
      ? new ParityMonitor({
          scheduler,
          getDocument,
          compositionId: () => getTransport().compositionId,
          fps: () => getTransport().fps,
          transportTime: () => getTransport().time,
          isPlaying: () => getTransport().playing,
          running: () => stageAdapters.running(),
          read: (element, property) => element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue(property) ?? "",
        }).install()
      : null;

  return () => {
    restSteps.delete(restStep);
    effectorDriver?.dispose();
    stateDriver?.dispose();
    variantDriver?.dispose();
    layoutDriver?.dispose();
    cssVars.dispose();
    scrollDriver?.reset();
    unmonitor?.();
    unregister();
    unsubscribeTransport();
    unsubscribeNodes();
    unsubscribeDocument();
    if (idleHandle !== null && idle) idle.cancelIdleCallback(idleHandle);
    adapter.dispose();
  };
}
