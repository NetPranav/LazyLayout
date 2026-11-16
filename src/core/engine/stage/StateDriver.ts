/**
 * Design track D15: the stage's side of states. Each frame it reads the pointer (through the same `InputSource` the
 * drivers use), works out which state each layer with states is in (pressed, then focus, then hover), eases a blend
 * amount towards it, and hands the kernel `activeStates` and `stateBlend`. What is drawn is `evaluate()` of the document
 * with those inputs, so Preview and the export agree.
 *
 * A state being edited is shown at full strength and never blends. Idle (returns null) when no layer has a state, or
 * when the states are not live and none is being edited, so a document without states costs nothing.
 */
import type { MotionDocument } from "../../document/schema";
import type { InputSource } from "../../bindings/inputBus";
import { insideRect } from "../../bindings/inputBus";
import { pickLiveState, stateLayerIds, statesOf } from "../../states/states";
import { kernelMover, transitionOf, transitionOverrides, type MoverFactory, type MoverLike, type StateShare, type TransitionSpec } from "../../states/transitions";

export interface StateDriverHost {
  getDocument(): MotionDocument;
  source: InputSource;
  /** The state being edited: shown at once and in full. */
  editing(): { layerId: string; name: string } | null;
  /** Whether hover and press are live (Preview, or the States switch). */
  live(): boolean;
  reducedMotion(): boolean;
  /** What moves the numbers: the kernel's spring by default, Motion's once it has loaded (Phase 87). Read when a move begins. */
  mover?(): MoverFactory;
}

export interface StateFrame {
  /** The state each layer is going to (or the last one still fading out), and its share: what was drawn before Phase 79, kept for readers of one state. */
  activeStates: Record<string, string>;
  stateBlend: Record<string, number>;
  /** Phase 79: every state a layer is partly in, each with its share. The kernel draws from this. */
  stateMix: Record<string, StateShare[]>;
}

/** One state's movers on one layer: the share of every property, and of each property with a transition of its own. */
interface Entry {
  all: MoverLike;
  own: Map<string, MoverLike>;
}

export class StateDriver {
  /** Movers by layer, then by state name. */
  private readonly entries = new Map<string, Map<string, Entry>>();
  private focused = new Set<string>();
  private wasDown = false;
  private lastKey = "";
  /** Whether the last `update` gave a different answer from the one before (the stage redraws only then). */
  changed = false;

  constructor(private readonly host: StateDriverHost) {}

  /** True when nothing needs drawing: no states, or not live and nothing eased in. */
  get idle(): boolean {
    const doc = this.host.getDocument();
    if (this.host.editing()) return false;
    if (this.entries.size > 0) return false;
    return stateLayerIds(doc).size === 0 || !this.host.live();
  }

  update(dt: number): StateFrame | null {
    const doc = this.host.getDocument();
    const editing = this.host.editing();
    const live = this.host.live();
    const layers = stateLayerIds(doc);
    if (layers.size === 0 && this.entries.size === 0 && !editing) return null;

    const p = live ? this.host.source.pointer() : null;
    const down = !!p?.down;
    const pressedNow = new Set<string>();
    const hoverNow = new Set<string>();
    if (p && live) {
      for (const id of layers) {
        const r = this.host.source.layerRect?.(id);
        if (r && insideRect(r, p.x, p.y)) {
          hoverNow.add(id);
          if (down) pressedNow.add(id);
        }
      }
      if (down && !this.wasDown) this.focused = new Set(pressedNow); // a press moves focus to what was pressed, and away from the rest
    }
    this.wasDown = down;

    const reduced = this.host.reducedMotion();
    const frame: StateFrame = { activeStates: {}, stateBlend: {}, stateMix: {} };

    for (const id of layers) {
      const rows = statesOf(doc, id);
      if (editing?.layerId === id) {
        this.entries.delete(id);
        frame.activeStates[id] = editing.name;
        frame.stateBlend[id] = 1;
        frame.stateMix[id] = [{ name: editing.name, amount: 1 }];
        continue;
      }
      const names = new Set(rows.map((s) => s.name));
      const want = live ? pickLiveState(names, { hover: hoverNow.has(id), pressed: pressedNow.has(id), focus: this.focused.has(id) }) : undefined;
      let byState = this.entries.get(id);
      if (!want && !byState) continue;
      const own = doc.layers[id]?.properties ?? {};
      const make = this.host.mover?.() ?? kernelMover;
      const spec = transitionOf(own);
      const overrides = transitionOverrides(own);
      if (!byState) this.entries.set(id, (byState = new Map()));
      if (want && !byState.has(want)) byState.set(want, { all: make(spec), own: new Map() });

      const shares: StateShare[] = [];
      // every state heads for 1 when it is the one wanted and for 0 otherwise, all at once: hover fades as pressed arrives
      for (const row of rows) {
        const entry = byState.get(row.name);
        if (!entry) continue;
        const target = row.name === want ? 1 : 0;
        const amount = this.move(entry.all, spec, target, dt, reduced);
        let amounts: Record<string, number> | undefined;
        let moving = !entry.all.resting;
        for (const [path, override] of overrides) {
          if (!(path in row.props)) continue;
          let mover = entry.own.get(path);
          if (!mover) entry.own.set(path, (mover = make(override, amount)));
          (amounts ??= {})[path] = this.move(mover, override, target, dt, reduced);
          if (!mover.resting) moving = true;
        }
        for (const path of [...entry.own.keys()]) if (!overrides.has(path)) entry.own.delete(path);
        if (!moving && target === 0) {
          byState.delete(row.name); // faded out: nothing of it is left
          continue;
        }
        shares.push(amounts ? { name: row.name, amount, amounts } : { name: row.name, amount });
      }
      for (const name of [...byState.keys()]) if (!names.has(name)) byState.delete(name); // a state that was deleted
      if (byState.size === 0) this.entries.delete(id);
      if (shares.length === 0) continue;
      // the state it is going to is laid over the ones fading out
      shares.sort((a, b) => Number(a.name === want) - Number(b.name === want));
      frame.stateMix[id] = shares;
      const lead = shares[shares.length - 1];
      frame.activeStates[id] = lead.name;
      frame.stateBlend[id] = lead.amount;
    }
    // layers that lost all their states while eased in
    for (const id of [...this.entries.keys()]) if (!layers.has(id)) this.entries.delete(id);
    const key = JSON.stringify(frame.stateMix);
    this.changed = key !== this.lastKey;
    this.lastKey = key;
    return frame;
  }

  private move(mover: MoverLike, spec: TransitionSpec, target: number, dt: number, reduced: boolean): number {
    mover.use(spec);
    if (reduced) mover.jump(target);
    else {
      mover.to(target);
      mover.step(dt);
    }
    return Math.round(mover.value * 1e4) / 1e4;
  }

  dispose(): void {
    this.entries.clear();
    this.focused.clear();
    this.lastKey = "";
  }
}
