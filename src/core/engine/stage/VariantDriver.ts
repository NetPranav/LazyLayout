/**
 * ROADMAP Phase 80: the stage's side of animated variants. It notices an instance whose variant changed in the
 * document, and (while interactions are live) an instance's own click, hover or press, and moves every layer of the
 * instance from the look it shows to the look of the new variant on the instance's transition. What it hands the
 * kernel is `propMix`: per layer, the properties on their way and how far along they are, so what is drawn is
 * `evaluate()` of the document with that input.
 *
 * Interrupting a switch never snaps: going back to the variant it came from turns the same spring round with the speed
 * it has; going on to a third starts from what is on screen. Idle (and free) with no variant instance on the page.
 */
import type { MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import type { InputSource } from "../../bindings/inputBus";
import { insideRect } from "../../bindings/inputBus";
import { mixValue, type PropMix } from "../../kernel/evaluate";
import { kernelMover, transitionOf, type MoverFactory, type MoverLike } from "../../states/transitions";
import { lookDifference, lookOf, triggeredValues, variantInstanceRoots, variantKey, variantLook, variantTriggerOf, variantValuesOf, type Look } from "../../components/variantMotion";

export interface VariantDriverHost {
  getDocument(): MotionDocument;
  source: InputSource;
  /** Whether clicks, hover and press are live (Preview, or the States switch). */
  live(): boolean;
  reducedMotion(): boolean;
  /** Whether a variant changed in the document animates (off while a test or a tool wants the document as it is). Default: yes. */
  animateEdits?(): boolean;
  /** What moves the numbers: the kernel's spring by default, Motion's once it has loaded (Phase 87). */
  mover?(): MoverFactory;
}

export interface VariantFrame {
  propMix: Record<string, PropMix>;
  layers: Map<string, Set<string>>;
}

interface Run {
  /** The variant the move began at when it began from rest (going back to it reverses the spring), else null. */
  fromKey: string | null;
  toKey: string;
  /** 1: heading for `to`; 0: turned back to `from`. */
  target: 0 | 1;
  mix: Map<string, { from: Record<string, PropValue>; to: Record<string, PropValue> }>;
  mover: MoverLike;
}
interface Seen {
  key: string;
  look: Look;
}

export class VariantDriver {
  private doc: MotionDocument | null = null;
  private roots: string[] = [];
  private readonly seen = new Map<string, Seen>();
  private readonly runs = new Map<string, Run>();
  /** The variant an interaction is showing, per instance, when it is not the document's. */
  private readonly shown = new Map<string, Record<string, string>>();
  private wasDown = false;
  private presses = -1;
  private wasLive = false;
  private lastKey = "";
  changed = false;

  constructor(private readonly host: VariantDriverHost) {}

  /** Reads the document when it changed: which instances have variants, and whether one switched since last time. */
  private sync(): void {
    const doc = this.host.getDocument();
    if (doc === this.doc) return;
    this.doc = doc;
    this.roots = variantInstanceRoots(doc);
    const alive = new Set(this.roots);
    for (const id of [...this.seen.keys()]) if (!alive.has(id)) this.forget(id);
    const animate = this.host.animateEdits?.() ?? true;
    for (const id of this.roots) {
      const key = variantKey(variantValuesOf(doc, id));
      const before = this.seen.get(id);
      const look = lookOf(doc, id);
      this.seen.set(id, { key, look });
      if (!before) continue;
      if (before.key !== key) {
        this.shown.delete(id); // the document decides again
        if (animate) this.start(doc, id, key, look, before);
        else this.runs.delete(id);
      } else if (this.runs.has(id) && !this.shown.has(id) && this.runs.get(id)!.mover.resting) this.runs.delete(id);
    }
  }

  private forget(id: string): void {
    this.seen.delete(id);
    this.runs.delete(id);
    this.shown.delete(id);
  }

  /** What an instance shows now, per layer: the mix it is in, over the look given. */
  private displayed(id: string, base: Look): Look {
    const run = this.runs.get(id);
    if (!run) return base;
    const out: Look = new Map(base);
    for (const [layerId, m] of run.mix) {
      const props: Record<string, PropValue> = { ...(base.get(layerId) ?? {}) };
      for (const [path, to] of Object.entries(m.to)) {
        const v = mixValue(path, m.from[path], to, run.mover.value);
        if (v !== undefined && v !== null) props[path] = v;
      }
      out.set(layerId, props);
    }
    return out;
  }

  /** Sends an instance towards the look `to` (the variant `toKey`). `before` is what the document said a moment ago, when it is the document that changed. */
  private start(doc: MotionDocument, id: string, toKey: string, to: Look, before?: Seen): void {
    const run = this.runs.get(id);
    const spec = transitionOf(doc.layers[id]?.properties ?? {});
    if (run && run.fromKey === toKey) {
      run.target = 0; // back where it came from: the same spring, turned round
      run.mover.use(spec);
      run.mover.to(0);
      return;
    }
    if (run && run.toKey === toKey) {
      run.target = 1;
      run.mover.use(spec);
      run.mover.to(1);
      return;
    }
    const base = before?.look ?? lookOf(doc, id);
    const from = this.displayed(id, base);
    const atRest = !run || run.mover.resting;
    const fromKey = !atRest ? null : run ? (run.target === 1 ? run.toKey : run.fromKey) : (before?.key ?? variantKey(variantValuesOf(doc, id)));
    const mix = lookDifference(from, to, id);
    if (mix.size === 0) {
      this.runs.delete(id);
      return;
    }
    const mover = (this.host.mover?.() ?? kernelMover)(spec, 0);
    mover.to(1);
    this.runs.set(id, { fromKey, toKey, target: 1, mix, mover });
  }

  /** True when there is nothing to draw and nothing to watch. */
  get idle(): boolean {
    this.sync();
    if (this.runs.size > 0) return false;
    if (!this.host.live()) return !this.wasLive;
    const doc = this.doc!;
    return !this.roots.some((id) => variantTriggerOf(doc, id));
  }

  update(dt: number): VariantFrame | null {
    this.sync();
    const doc = this.doc!;
    const live = this.host.live();
    if (live) this.interact(doc);
    else if (this.wasLive) {
      // interactions over: every instance goes back to the variant the document gives it
      for (const id of [...this.shown.keys()]) {
        this.shown.delete(id);
        const seen = this.seen.get(id);
        if (seen) this.start(doc, id, seen.key, seen.look);
      }
      this.wasDown = false;
    }
    if (!live) this.presses = -1; // presses made while nothing was live are not clicks on an instance
    this.wasLive = live;

    const reduced = this.host.reducedMotion();
    const frame: VariantFrame = { propMix: {}, layers: new Map() };
    for (const [id, run] of [...this.runs]) {
      if (!doc.layers[id]) {
        this.runs.delete(id);
        continue;
      }
      if (reduced) run.mover.jump(run.target);
      else run.mover.step(dt);
      // at rest on what the document says: nothing is left to draw
      if (run.mover.resting && !this.shown.has(id) && (run.target === 1 ? run.toKey : run.fromKey) === this.seen.get(id)?.key) {
        this.runs.delete(id);
        continue;
      }
      const amount = Math.round(run.mover.value * 1e4) / 1e4;
      for (const [layerId, m] of run.mix) {
        if (!doc.layers[layerId]) continue;
        frame.propMix[layerId] = { from: m.from, to: m.to, amount };
        frame.layers.set(layerId, new Set(Object.keys(m.to)));
      }
    }
    const key = JSON.stringify(Object.entries(frame.propMix).map(([id, m]) => [id, m.amount, Object.keys(m.to).length]));
    this.changed = key !== this.lastKey;
    this.lastKey = key;
    return frame.layers.size > 0 ? frame : null;
  }

  /** The instances' own interactions: a click switches, hover and press show a variant while they last. */
  private interact(doc: MotionDocument): void {
    const p = this.host.source.pointer();
    const down = !!p?.down;
    const presses = this.host.source.presses?.();
    // a press is a new one counted by the host, or (a host that doesn't count) the button going down
    const pressedNow = presses !== undefined ? presses !== this.presses && this.presses >= 0 : down && !this.wasDown;
    if (presses !== undefined) this.presses = presses;
    this.wasDown = down;
    for (const id of this.roots) {
      const trigger = variantTriggerOf(doc, id);
      if (!trigger) {
        if (this.shown.has(id)) this.show(doc, id, null);
        continue;
      }
      const rect = p ? this.host.source.layerRect?.(id) : null;
      const inside = !!(p && rect && insideRect(rect, p.x, p.y));
      const rest = variantValuesOf(doc, id);
      const current = this.shown.get(id) ?? rest;
      let want = current;
      if (trigger.on === "click") {
        if (pressedNow && inside) want = triggeredValues(doc, id, trigger, current, rest);
      } else {
        const active = trigger.on === "hover" ? inside : inside && down;
        want = active ? triggeredValues(doc, id, trigger, rest, rest) : rest;
      }
      if (variantKey(want) !== variantKey(current)) this.show(doc, id, variantKey(want) === variantKey(rest) ? null : want);
    }
  }

  private show(doc: MotionDocument, id: string, values: Record<string, string> | null): void {
    const seen = this.seen.get(id);
    if (!seen) return;
    if (!values) {
      this.shown.delete(id);
      this.start(doc, id, seen.key, seen.look);
      return;
    }
    const look = variantLook(doc, id, values);
    if (!look) return;
    this.shown.set(id, values);
    this.start(doc, id, variantKey(values), look);
  }

  /** The variant each instance is showing through an interaction (not the document's), for the editor and tests. */
  showing(id: string): Record<string, string> | null {
    return this.shown.get(id) ?? null;
  }

  dispose(): void {
    this.runs.clear();
    this.shown.clear();
    this.seen.clear();
    this.doc = null;
    this.wasDown = this.wasLive = false;
    this.presses = -1;
    this.lastKey = "";
  }
}
