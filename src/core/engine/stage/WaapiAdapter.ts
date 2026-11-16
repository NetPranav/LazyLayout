import type { MotionDocument } from "../../document/schema";
import { evaluate, type EvaluateInputs } from "../../kernel/evaluate";
import type { AdapterHost, EngineAdapter, EngineCapabilities, LayerFilter } from "./types";
import { animatedLayers, styleWrites } from "./styleWrites";
import { bakeDepsOf, buildBakeIndex, sameDeps, type BakeDeps, type BakeIndex } from "./bakeDeps";

/**
 * ROADMAP Phase 58: runs a layer's animation as a Web Animation, so transforms and opacity keep going on the
 * compositor thread while the main thread is busy.
 *
 * The curve is the kernel's, not the browser's: the layer's animation is baked by sampling `evaluate()` once per
 * frame (at most 600 intervals) into linear keyframes. The browser only interpolates between neighbouring frames, so
 * every easing, spring-free curve and clip priority the kernel knows comes out the same (Law 8, one oracle).
 * `seek(t)` maps to `currentTime`; `play` runs at the transport's rate.
 */
export interface WaapiAnimation {
  currentTime: number | string | null | { valueOf(): number };
  playbackRate: number;
  play(): void;
  pause(): void;
  cancel(): void;
  id: string;
}

export interface WaapiElement {
  animate(keyframes: Array<Record<string, string | number>>, options: { duration: number; fill: "both"; easing: "linear"; id?: string }): WaapiAnimation;
}

/** More than this many frames from the transport and a running animation is moved back (a seek, a loop, a rate change). */
const DRIFT_FRAMES = 2;
const MAX_INTERVALS = 600;

const camel = (cssProperty: string) => cssProperty.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

interface Baked {
  element: WaapiElement;
  animation: WaapiAnimation;
  paths: ReadonlySet<string>;
  keyframes: Keyframes;
}

type Keyframes = Array<Record<string, string | number>>;

/** A layer's sampled keyframes and what they were sampled from (see bakeDeps.ts). */
/**
 * Sampled keyframes per layer id, shared by every WAAPI adapter. Each entry records the object identities, sampling
 * signature and inputs it was made from, and is only reused when all of them match, so sharing can't serve a stale bake.
 */
const sharedBakeCache = new Map<string, BakeEntry>();
/** Layers sampled since load, across adapters (the performance budget e2e spec reads it through a test seam). */
export const waapiBakeStats = { samples: 0 };
/** Tests: forget every cached bake. */
export function clearWaapiBakeCache(): void {
  sharedBakeCache.clear();
}

interface BakeEntry {
  deps: BakeDeps;
  /** composition, duration, fps, sample count and the inputs (by value) the bake used */
  signature: string;
  inputsKey: string;
  paths: ReadonlySet<string>;
  keyframes: Keyframes;
}

/** A layer this adapter is running, for the parity monitor (Phase 60). */
export interface RunningLayer {
  layerId: string;
  element: Element;
  paths: ReadonlySet<string>;
  /** The animation's own clock, in seconds. */
  time: number;
}

export class WaapiAdapter implements EngineAdapter {
  readonly id = "waapi";
  readonly capabilities: EngineCapabilities = { scrub: true, deterministic: false, offMainThread: true };

  private host: AdapterHost | null = null;
  private inputs: EvaluateInputs = {};
  private inputsKey = inputsKey({});
  private dirty = true;
  private playing = false;
  private rate = 1;
  private time = 0;
  private plannedFor: MotionDocument | null = null;
  private readonly baked = new Map<string, Baked>();
  /**
   * Sampled keyframes per layer, kept across document changes AND across adapters: the stage engine (and so this
   * adapter) is installed each time Motion opens, and a per-adapter cache was empty again on every visit. Performance (2026-11-18): every edit made the next
   * play, pause or seek re-sample EVERY animated layer at every frame of the timeline (a ~1 s freeze on a
   * 4x-throttled CPU with 46 animated layers). Now only layers whose inputs changed are re-sampled, and `prebake`
   * does it ahead of time in idle slices.
   */
  private readonly bakeCache = sharedBakeCache;

  /** Counts of work done, for tests. `bakes`: animations created; `samples`: layers whose keyframes were sampled. */
  stats = { bakes: 0, seeks: 0, samples: 0 };

  /** @param accepts the layers this adapter runs; the default is every animated layer. */
  constructor(private readonly accepts: LayerFilter = () => true) {}

  mount(host: AdapterHost): void {
    this.host = host;
    this.invalidate();
  }

  invalidate(): void {
    this.dirty = true;
  }

  /** Phase 88: the breakpoint being viewed; the animations are baked again for it. */
  setBreakpoint(id: string | null): void {
    if ((this.inputs.breakpoint ?? null) === id) return;
    this.inputs = { ...this.inputs, breakpoint: id };
    this.inputsKey = inputsKey(this.inputs);
    this.invalidate();
  }

  setInputs(inputs: EvaluateInputs): void {
    // Compared by value: the scroll driver and others pass a new object even when nothing in it changed (opening Motion
    // did), and a new identity used to throw away every cached bake. The breakpoint (Phase 88) is kept when not given.
    const next = { ...inputs, breakpoint: inputs.breakpoint !== undefined ? inputs.breakpoint : this.inputs.breakpoint };
    const key = inputsKey(next);
    if (key === this.inputsKey) return;
    this.inputs = next;
    this.inputsKey = key;
    this.invalidate();
  }

  currentTime(): number | null {
    for (const { animation } of this.baked.values()) {
      const t = Number(animation.currentTime);
      if (Number.isFinite(t)) return t / 1000;
    }
    return null;
  }

  /** The layers running as Web Animations right now, each with its own clock. */
  running(): RunningLayer[] {
    const out: RunningLayer[] = [];
    for (const [layerId, { element, animation, paths }] of this.baked) {
      const time = Number(animation.currentTime);
      if (Number.isFinite(time)) out.push({ layerId, element: element as unknown as Element, paths, time: time / 1000 });
    }
    return out;
  }

  play(time: number, rate: number): void {
    this.playing = true;
    this.rate = rate;
    this.time = time;
    this.rebuildIfNeeded();
    for (const { animation } of this.baked.values()) {
      animation.playbackRate = rate;
      animation.currentTime = time * 1000;
      animation.play();
    }
  }

  pause(time: number): void {
    this.playing = false;
    this.time = time;
    this.rebuildIfNeeded();
    for (const { animation } of this.baked.values()) {
      animation.pause();
      animation.currentTime = time * 1000;
    }
  }

  seek(time: number): void {
    if (!this.host) return;
    this.time = time;
    this.rebuildIfNeeded();
    if (this.playing) {
      // Running on its own clock: only step in when it has wandered from the transport.
      const own = this.currentTime();
      const tolerance = DRIFT_FRAMES / this.host.fps();
      if (own === null || Math.abs(own - time) <= tolerance) return;
      for (const { animation } of this.baked.values()) animation.currentTime = time * 1000;
      this.stats.seeks++;
      return;
    }
    for (const { animation } of this.baked.values()) animation.currentTime = time * 1000;
    this.stats.seeks++;
  }

  dispose(): void {
    this.cancelAll();
    this.host = null;
    this.plannedFor = null;
  }

  private cancelAll(): void {
    for (const { animation } of this.baked.values()) animation.cancel();
    this.baked.clear();
  }

  /** Composition, duration, fps and sample count: a change to any of them re-samples every layer. */
  private signature(): { signature: string; intervals: number; duration: number; compositionId: string } | null {
    const host = this.host;
    if (!host) return null;
    const duration = host.duration();
    const fps = host.fps();
    if (!(duration > 0) || !(fps > 0)) return null;
    const intervals = Math.max(1, Math.min(MAX_INTERVALS, Math.ceil(duration * fps)));
    const compositionId = host.compositionId();
    return { signature: `${compositionId}|${duration}|${fps}|${intervals}`, intervals, duration, compositionId };
  }

  /** The layer's keyframes: from the cache when nothing it depends on changed, sampled from the kernel otherwise. */
  private keyframesFor(
    doc: MotionDocument,
    index: BakeIndex,
    layerId: string,
    paths: ReadonlySet<string>,
    sig: { signature: string; intervals: number; duration: number; compositionId: string },
  ): Keyframes {
    const deps = bakeDepsOf(index, layerId);
    const cached = this.bakeCache.get(layerId);
    if (
      cached &&
      cached.signature === sig.signature &&
      cached.inputsKey === this.inputsKey &&
      sameDeps(cached.deps, deps) &&
      samePaths(cached.paths, paths)
    ) {
      return cached.keyframes;
    }
    const keyframes: Keyframes = [];
    for (let i = 0; i <= sig.intervals; i++) {
      const writes = styleWrites(paths, evaluate(doc, sig.compositionId, layerId, (i / sig.intervals) * sig.duration, this.inputs), layerId);
      const frame: Record<string, string | number> = { offset: i / sig.intervals };
      for (const [property, value] of Object.entries(writes)) frame[camel(property)] = value;
      keyframes.push(frame);
    }
    this.bakeCache.set(layerId, { deps, signature: sig.signature, inputsKey: this.inputsKey, paths, keyframes });
    this.stats.samples++;
    waapiBakeStats.samples++;
    return keyframes;
  }

  /**
   * Samples the keyframes of layers whose inputs changed, ahead of time, while `timeLeft()` (ms) stays above a small
   * margin. Creates no animations. Returns true when every animated layer is sampled for the current document.
   * Called from idle time (requestIdleCallback) so play, pause and seek find the work done.
   */
  prebake(timeLeft: () => number): boolean {
    const host = this.host;
    const sig = this.signature();
    if (!host || !sig) return true;
    const doc = host.getDocument();
    const index = buildBakeIndex(doc);
    for (const [layerId, paths] of animatedLayers(doc)) {
      if (!this.accepts(layerId, paths)) continue;
      if (timeLeft() < 2) return false;
      this.keyframesFor(doc, index, layerId, paths, sig);
    }
    return true;
  }

  private rebuildIfNeeded(): void {
    const host = this.host;
    if (!host) return;
    const doc = host.getDocument();
    if (!this.dirty && this.plannedFor === doc) return;
    this.dirty = false;
    this.plannedFor = doc;
    const sig = this.signature();
    if (!sig) {
      this.cancelAll();
      return;
    }
    const index = buildBakeIndex(doc);
    const next = new Map<string, Baked>();
    for (const [layerId, paths] of animatedLayers(doc)) {
      if (!this.accepts(layerId, paths)) continue;
      const element = host.node(layerId) as unknown as WaapiElement | undefined;
      if (!element || typeof element.animate !== "function") continue;
      const keyframes = this.keyframesFor(doc, index, layerId, paths, sig);
      const existing = this.baked.get(layerId);
      if (existing && existing.element === element && existing.keyframes === keyframes) {
        // same element, same keyframes: keep the running animation (no cancel, no new animate call)
        next.set(layerId, existing);
        this.baked.delete(layerId);
        continue;
      }
      const animation = element.animate(keyframes, { duration: sig.duration * 1000, fill: "both", easing: "linear", id: `ll:${layerId}` });
      animation.pause();
      animation.currentTime = this.time * 1000;
      if (this.playing) {
        animation.playbackRate = this.rate;
        animation.play();
      }
      next.set(layerId, { element, animation, paths, keyframes });
      this.stats.bakes++;
    }
    // what is left was replaced or is no longer animated
    for (const { animation } of this.baked.values()) animation.cancel();
    this.baked.clear();
    for (const [layerId, baked] of next) this.baked.set(layerId, baked);
    for (const layerId of [...this.bakeCache.keys()]) if (!next.has(layerId) && !doc.layers[layerId]) this.bakeCache.delete(layerId);
  }
}

function samePaths(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}

/** A stable text form of the evaluate inputs, to tell a real change from the same values in a new object. */
function inputsKey(inputs: EvaluateInputs): string {
  try {
    return JSON.stringify(inputs, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value,
    );
  } catch {
    return `unserialisable:${++unserialisableInputs}`; // not serialisable: treat as a change
  }
}
let unserialisableInputs = 0;
