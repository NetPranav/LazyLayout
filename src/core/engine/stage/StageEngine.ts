import { documentStore, getDocument } from "../../store/documentState";
import { frameScheduler, type FrameScheduler } from "../../time/scheduler";
import { getTransport, subscribeTransport } from "../../time/transport";
import type { StageRenderer } from "../../render/StageRenderer";
import { StageAdapters } from "./StageAdapters";
import { ParityMonitor, parityEnabled } from "./parity";
import type { AdapterHost, EngineAdapter } from "./types";
import { ScrollDriver, type ScrollHost } from "../../scroll/ScrollDriver";
import { BindingDriver, type BindingDriverHost } from "./BindingDriver";
import { boundLayerIds } from "./styleWrites";
import { EffectorDriver } from "./EffectorDriver";

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

  // What was drawn may have changed under the adapter: the document, or a layer's element.
  const unsubscribeDocument = documentStore.subscribe((state, prev) => {
    if (state.document === prev.document) return;
    adapter.invalidate();
    bindingDriver?.invalidate();
    syncBoundLayers();
    dirty = true;
  });
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
  const setBound = (bound: ReturnType<BindingDriver["update"]>) => {
    if (adapter instanceof StageAdapters) adapter.setBound(bound ?? undefined);
    else adapter.setInputs({ bound: bound ?? undefined });
  };
  const syncBoundLayers = () => {
    if (adapter instanceof StageAdapters) adapter.setBoundLayers(options.bindings ? boundLayerIds(getDocument()) : new Set());
  };
  syncBoundLayers();
  let scrollWasLive = false;

  const unregister = scheduler.register("apply", (frame) => {
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
        dirty = true;
      } else if (bindingsWereLive) {
        setBound(null); // back to what the document says
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
    if (!dirty && time === lastTime) return;
    dirty = false;
    lastTime = time;
    adapter.seek(time);
  });

  // Phase 60: while playing, compare what the engines show with `evaluate()` every 30 frames.
  const stageAdapters = adapter instanceof StageAdapters ? adapter : null;
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
    effectorDriver?.dispose();
    scrollDriver?.reset();
    unmonitor?.();
    unregister();
    unsubscribeTransport();
    unsubscribeNodes();
    unsubscribeDocument();
    adapter.dispose();
  };
}
