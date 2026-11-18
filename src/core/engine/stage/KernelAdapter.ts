import type { MotionDocument } from "../../document/schema";
import { evaluate, type EvaluateInputs } from "../../kernel/evaluate";
import type { AdapterHost, EngineAdapter, EngineCapabilities, LayerFilter, StyledElement } from "./types";
import { animatedLayers, fxFilters, styleWrites } from "./styleWrites";
import { FxFilterWriter } from "./fxFilters";
import { SvgPathWriter, writesSvgPath } from "./svgPaths";
import { textFxOf, textFxText } from "../../text/textFx";

/** The most copies of one layer that follow its animation (each is one more `evaluate` when the copies are staggered). */
export const MAX_FOLLOWING_COPIES = 600;

/**
 * ROADMAP Phase 57: applies `evaluate()` straight to the layers' elements. It is the universal fallback (it can
 * show any layer, any property) and the scrub engine: `seek(t)` is the exact value at `t`, whatever came before.
 *
 * It writes only what a layer animates, and only what changed since its last write. The first write to a style
 * remembers what React had drawn, so `dispose()` (or a layer stopping being animated) puts that back.
 */
export class KernelAdapter implements EngineAdapter {
  readonly id = "kernel";
  readonly capabilities: EngineCapabilities = { scrub: true, deterministic: true, offMainThread: false };

  private host: AdapterHost | null = null;
  private inputs: EvaluateInputs = {};
  private lastTime = 0;
  /** The animated layers of `plannedFor`, recomputed when the document changes. */
  private plan = new Map<string, Set<string>>();
  private plannedFor: MotionDocument | null = null;
  /** What this adapter last wrote, per layer and CSS property. */
  private readonly written = new Map<string, Map<string, string>>();
  /** What the element held before the first write, per layer and CSS property. */
  private readonly originals = new Map<string, Map<string, string>>();
  private readonly elements = new Map<string, StyledElement>();
  /** The SVG filters of the effect stack and motion blur (Phase 75), kept in the frame document. */
  private readonly fx = new FxFilterWriter();
  /** A morphing path and a stroke being drawn (Phase 85): attributes on the layer's path elements. */
  readonly svgPaths = new SvgPathWriter();

  /** The element each copy of a layer draws (Design track D8), by copy number; found once per document and node set. */
  private readonly copyCache = new Map<string, { parent: Element; copies: Map<number, StyledElement> }>();

  /** What each element held (our own writes) when the document last changed, until the next write compares. */
  private readonly pending = new Map<string, Map<string, string>>();
  private mixLayers: ReadonlyMap<string, ReadonlySet<string>> = new Map();
  private mixKey = "";

  /** Counts of work done, for tests. */
  stats = { evaluations: 0, writes: 0 };

  /** @param accepts the layers this adapter draws; the default is every animated layer. */
  constructor(private readonly accepts: LayerFilter = () => true) {}

  currentTime(): number | null {
    return null;
  }

  mount(host: AdapterHost): void {
    this.host = host;
    this.invalidate();
  }

  play(time: number): void {
    this.lastTime = time;
  }

  pause(time: number): void {
    this.lastTime = time;
  }

  setInputs(inputs: EvaluateInputs): void {
    // the states the state driver set are not the caller's to wipe (the scroll driver sets inputs of its own)
    this.inputs = { ...inputs, activeStates: inputs.activeStates ?? this.inputs.activeStates, stateBlend: inputs.stateBlend ?? this.inputs.stateBlend, stateMix: inputs.stateMix ?? this.inputs.stateMix, propMix: inputs.propMix ?? this.inputs.propMix, breakpoint: inputs.breakpoint !== undefined ? inputs.breakpoint : this.inputs.breakpoint, reducedMotion: inputs.reducedMotion ?? this.inputs.reducedMotion, pointer: "pointer" in inputs ? inputs.pointer : this.inputs.pointer, layerOrigin: inputs.layerOrigin ?? this.inputs.layerOrigin };
    this.invalidate();
  }

  /** Phase 93: whether the page is drawn as reduced motion gets it. */
  setReducedMotion(on: boolean): void {
    if ((this.inputs.reducedMotion ?? false) === on) return;
    this.inputs = { ...this.inputs, reducedMotion: on };
    this.invalidate();
  }

  /** Phase 88: the breakpoint being viewed; a layer's motion plays as that breakpoint says. */
  setBreakpoint(id: string | null): void {
    if ((this.inputs.breakpoint ?? null) === id) return;
    this.inputs = { ...this.inputs, breakpoint: id };
    this.invalidate();
  }

  /** Where the pointer is on the page (page px), for mattes whose copies an effector moves by it. Not an `invalidate`, like `setBound`. */
  setPointer(pointer: EvaluateInputs["pointer"], layerOrigin?: EvaluateInputs["layerOrigin"]): void {
    this.inputs = { ...this.inputs, pointer, ...(layerOrigin ? { layerOrigin } : {}) };
  }

  /** Design track D4: this frame's bound values. Not an `invalidate`: the plan is unchanged and only changed values are written. */
  setBound(bound: EvaluateInputs["bound"]): void {
    this.inputs = bound === this.inputs.bound ? this.inputs : { ...this.inputs, bound };
  }

  /** Design track D15: this frame's states and how far into them each layer is. Like `setBound`, not an `invalidate`. */
  setStates(frame: { activeStates: Record<string, string>; stateBlend: Record<string, number>; stateMix?: EvaluateInputs["stateMix"] } | null): void {
    this.inputs = { ...this.inputs, activeStates: frame?.activeStates, stateBlend: frame?.stateBlend, stateMix: frame?.stateMix };
  }

  /**
   * Phase 80: layers on their way from one look to another, with the paths that are moving. They join the plan while
   * they move (a layer that animates nothing else is otherwise not the kernel's) and leave it, restored, when done.
   */
  setPropMix(frame: { propMix: NonNullable<EvaluateInputs["propMix"]>; layers: ReadonlyMap<string, ReadonlySet<string>> } | null): void {
    this.inputs = { ...this.inputs, propMix: frame?.propMix };
    const key = frame ? Array.from(frame.layers, ([id, paths]) => `${id}:${Array.from(paths).join(",")}`).join("|") : "";
    if (key === this.mixKey) return;
    this.mixKey = key;
    this.mixLayers = frame?.layers ?? new Map();
    this.plannedFor = null; // plan again, without throwing away what is written
  }

  invalidate(): void {
    // What each element holds now is our own last write. If it holds something else by the next write, React drew the
    // layer again with a new value (the document changed), and that is what to put back when the animation ends: a
    // variant switched to and fro while it animates used to end on the first variant's style (Phase 80).
    for (const [key, originals] of this.originals) {
      const element = this.elements.get(key);
      const written = this.written.get(key);
      if (!element || !written || this.pending.has(key)) continue;
      const held = new Map<string, string>();
      for (const property of originals.keys()) if (written.has(property)) held.set(property, element.style.getPropertyValue(property));
      if (held.size > 0) this.pending.set(key, held);
    }
    this.plannedFor = null;
    this.textWritten.clear();
    this.written.clear(); // React may have redrawn an element since; write everything again
    this.copyCache.clear();
  }

  /** The inner element of each copy of `layerId` (copy number -> element). Copies are drawn beside the layer, in wrappers marked `data-repeat-of`. */
  private copiesOf(layerId: string, element: StyledElement): Map<number, StyledElement> {
    const parent = (element as unknown as { parentElement?: Element | null }).parentElement;
    if (!parent) return new Map();
    const cached = this.copyCache.get(layerId);
    if (cached && cached.parent === parent) return cached.copies;
    const copies = new Map<number, StyledElement>();
    for (const wrapper of Array.from(parent.querySelectorAll(`:scope > [data-repeat-of="${layerId.replace(/"/g, '\\"')}"]`))) {
      const n = Number(wrapper.getAttribute("data-repeat-copy"));
      const inner = wrapper.firstElementChild as unknown as StyledElement | null;
      if (n > 0 && inner?.style) copies.set(n, inner);
    }
    this.copyCache.set(layerId, { parent, copies });
    return copies;
  }

  seek(time: number): void {
    const host = this.host;
    if (!host) return;
    this.lastTime = time;
    const doc = host.getDocument();
    if (this.plannedFor !== doc) {
      const animated = animatedLayers(doc);
      for (const [id, paths] of this.mixLayers) if (doc.layers[id]) animated.set(id, new Set([...(animated.get(id) ?? []), ...paths]));
      this.plan = new Map(Array.from(animated).filter(([id, paths]) => this.mixLayers.has(id) || this.accepts(id, paths)));
      this.plannedFor = doc;
      this.restoreStale();
    }
    const compositionId = host.compositionId();
    for (const [layerId, paths] of this.plan) {
      const element = host.node(layerId) as unknown as StyledElement | undefined;
      if (!element?.style) continue;
      if (this.elements.get(layerId) !== element) {
        this.restore(layerId); // the layer was drawn into a new element
        this.elements.set(layerId, element);
      }
      this.stats.evaluations++;
      const resolved = evaluate(doc, compositionId, layerId, time, this.inputs);
      this.apply(layerId, element, styleWrites(paths, resolved, layerId));
      if (paths.has("text.fxProgress")) this.writeText(doc, layerId, element, resolved);
      if (paths.has("fx.stack")) this.fx.sync(element as unknown as Element, layerId, fxFilters(layerId, resolved));
      if (writesSvgPath(paths)) this.svgPaths.sync(element as unknown as Element, layerId, paths, resolved);
      this.followWithCopies(doc, compositionId, layerId, paths, resolved, element, time);
    }
  }

  /**
   * Design track D8, D10: the copies of a repeated or cloned layer follow its animation, each `copy.delay` seconds behind the one
   * before (0: all together). Beyond `MAX_FOLLOWING_COPIES` they stay as drawn.
   */
  private followWithCopies(doc: MotionDocument, compositionId: string, layerId: string, paths: ReadonlySet<string>, resolved: ReturnType<typeof evaluate>, element: StyledElement, time: number): void {
    const copies = this.copiesOf(layerId, element);
    if (copies.size === 0 || copies.size > MAX_FOLLOWING_COPIES) return;
    const d = doc.layers[layerId]?.properties["copy.delay"];
    const delay = typeof d === "number" && Number.isFinite(d) ? d : 0;
    for (const [n, inner] of copies) {
      const key = `${layerId}#c${n}`;
      if (this.elements.get(key) !== inner) {
        this.restore(key);
        this.elements.set(key, inner);
      }
      let at = resolved;
      if (delay !== 0) {
        this.stats.evaluations++;
        at = evaluate(doc, compositionId, layerId, time - n * delay, this.inputs);
      }
      this.apply(key, inner, styleWrites(paths, at, layerId));
    }
  }

  /**
   * Runs `read` with every element as React drew it (the pose being shown taken off), then puts the pose back. For
   * measuring where a layer rests: a box read while the layer is half way through a move would include the move, and
   * whoever adds the animation to that box would add it twice.
   */
  atRest<T>(read: () => T): T {
    const undo: Array<() => void> = [];
    for (const [key, originals] of this.originals) {
      const element = this.elements.get(key);
      const written = this.written.get(key);
      if (!element || !written) continue;
      for (const [property, original] of originals) {
        const shown = written.get(property);
        if (shown === undefined) continue;
        if (original) element.style.setProperty(property, original);
        else element.style.removeProperty(property);
        undo.push(() => element.style.setProperty(property, shown));
      }
    }
    try {
      return read();
    } finally {
      for (const put of undo) put();
    }
  }

  dispose(): void {
    for (const layerId of Array.from(this.elements.keys())) this.restore(layerId);
    this.host = null;
    this.plan = new Map();
    this.plannedFor = null;
  }

  private apply(layerId: string, element: StyledElement, writes: Record<string, string>): void {
    let written = this.written.get(layerId);
    if (!written) this.written.set(layerId, (written = new Map()));
    let originals = this.originals.get(layerId);
    if (!originals) this.originals.set(layerId, (originals = new Map()));
    const held = this.pending.get(layerId);
    if (held) {
      this.pending.delete(layerId);
      for (const [property, ours] of held) {
        if (!originals.has(property)) continue;
        const now = element.style.getPropertyValue(property);
        if (now !== ours) originals.set(property, now); // React drew it again since
      }
    }
    // A property this layer stopped animating (a track was removed) gets its drawn value back.
    for (const [property, original] of originals) {
      if (property in writes) continue;
      if (original) element.style.setProperty(property, original);
      else element.style.removeProperty(property);
      originals.delete(property);
      written.delete(property);
    }
    // What React drew is read for every new property before anything is written: `mask-image` and `-webkit-mask-image`
    // are one property under two names, so reading the second after writing the first gave back our own value, and
    // restoring "put it back" (a matte's mask stayed on the layer after leaving Motion).
    for (const property of Object.keys(writes)) if (!originals.has(property)) originals.set(property, element.style.getPropertyValue(property));
    for (const [property, value] of Object.entries(writes)) {
      if (written.get(property) === value) continue;
      element.style.setProperty(property, value);
      written.set(property, value);
      this.stats.writes++;
    }
  }

  /** The text each layer's `data-fx` span held before the engine wrote to it, and what it wrote. */
  private readonly textOriginals = new Map<string, string>();
  private readonly textWritten = new Map<string, string>();

  /** Design track D12: the text a scramble, typewriter, rotating word or count-up shows now, written into the layer's `data-fx` span. */
  private writeText(doc: MotionDocument, layerId: string, element: StyledElement, resolved: ReturnType<typeof evaluate>): void {
    const span = (element as unknown as { querySelector?: (s: string) => { textContent: string | null } | null }).querySelector?.("[data-fx]");
    if (!span) return;
    const stored = resolved["content.text"] ?? doc.layers[layerId]?.properties["content.text"];
    const fx = textFxOf((p) => resolved[p], typeof resolved["text.fxProgress"] === "number" ? (resolved["text.fxProgress"] as number) : undefined);
    if (!fx || typeof stored !== "string") return;
    const shown = textFxText(stored, fx);
    if (this.textWritten.get(layerId) === shown) return;
    if (!this.textOriginals.has(layerId)) this.textOriginals.set(layerId, span.textContent ?? "");
    span.textContent = shown;
    this.textWritten.set(layerId, shown);
    this.stats.writes++;
  }

  /** Puts back what React drew on a layer's element and forgets it. */
  private restore(layerId: string): void {
    const element = this.elements.get(layerId);
    const original = this.textOriginals.get(layerId);
    if (element && original !== undefined) {
      const span = (element as unknown as { querySelector?: (s: string) => { textContent: string | null } | null }).querySelector?.("[data-fx]");
      if (span) span.textContent = original;
    }
    this.textOriginals.delete(layerId);
    this.textWritten.delete(layerId);
    this.fx.remove(element as unknown as Element | undefined, layerId);
    this.svgPaths.remove(layerId);
    const originals = this.originals.get(layerId);
    if (element && originals) {
      for (const [property, original] of originals) {
        if (original) element.style.setProperty(property, original);
        else element.style.removeProperty(property);
      }
    }
    this.elements.delete(layerId);
    this.originals.delete(layerId);
    this.written.delete(layerId);
    this.pending.delete(layerId);
  }

  /** After a document change: layers that no longer animate anything give their elements back. */
  private restoreStale(): void {
    for (const key of Array.from(this.elements.keys())) if (!this.plan.has(key.split("#")[0])) this.restore(key);
  }
}
