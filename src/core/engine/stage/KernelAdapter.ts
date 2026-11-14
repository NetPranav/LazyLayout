import type { MotionDocument } from "../../document/schema";
import { evaluate, type EvaluateInputs } from "../../kernel/evaluate";
import type { AdapterHost, EngineAdapter, EngineCapabilities, LayerFilter, StyledElement } from "./types";
import { animatedLayers, fxFilters, styleWrites } from "./styleWrites";
import { FxFilterWriter } from "./fxFilters";

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

  /** The element each copy of a layer draws (Design track D8), by copy number; found once per document and node set. */
  private readonly copyCache = new Map<string, { parent: Element; copies: Map<number, StyledElement> }>();

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
    this.inputs = inputs;
    this.invalidate();
  }

  /** Design track D4: this frame's bound values. Not an `invalidate`: the plan is unchanged and only changed values are written. */
  setBound(bound: EvaluateInputs["bound"]): void {
    this.inputs = bound === this.inputs.bound ? this.inputs : { ...this.inputs, bound };
  }

  invalidate(): void {
    this.plannedFor = null;
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
      this.plan = new Map(Array.from(animatedLayers(doc)).filter(([id, paths]) => this.accepts(id, paths)));
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
      if (paths.has("fx.stack")) this.fx.sync(element as unknown as Element, layerId, fxFilters(layerId, resolved));
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
    // A property this layer stopped animating (a track was removed) gets its drawn value back.
    for (const [property, original] of originals) {
      if (property in writes) continue;
      if (original) element.style.setProperty(property, original);
      else element.style.removeProperty(property);
      originals.delete(property);
      written.delete(property);
    }
    for (const [property, value] of Object.entries(writes)) {
      if (written.get(property) === value) continue;
      if (!originals.has(property)) originals.set(property, element.style.getPropertyValue(property));
      element.style.setProperty(property, value);
      written.set(property, value);
      this.stats.writes++;
    }
  }

  /** Puts back what React drew on a layer's element and forgets it. */
  private restore(layerId: string): void {
    const element = this.elements.get(layerId);
    this.fx.remove(element as unknown as Element | undefined, layerId);
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
  }

  /** After a document change: layers that no longer animate anything give their elements back. */
  private restoreStale(): void {
    for (const key of Array.from(this.elements.keys())) if (!this.plan.has(key.split("#")[0])) this.restore(key);
  }
}
