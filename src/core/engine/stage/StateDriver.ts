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
import { pickLiveState, stateLayerIds, statesOf, stepBlend } from "../../states/states";

export interface StateDriverHost {
  getDocument(): MotionDocument;
  source: InputSource;
  /** The state being edited: shown at once and in full. */
  editing(): { layerId: string; name: string } | null;
  /** Whether hover and press are live (Preview, or the States switch). */
  live(): boolean;
  reducedMotion(): boolean;
}

export interface StateFrame {
  activeStates: Record<string, string>;
  stateBlend: Record<string, number>;
}

interface Entry {
  name: string;
  amount: number;
  target: number;
}

export class StateDriver {
  private readonly entries = new Map<string, Entry>();
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
    const frame: StateFrame = { activeStates: {}, stateBlend: {} };

    for (const id of layers) {
      if (editing?.layerId === id) {
        this.entries.delete(id);
        frame.activeStates[id] = editing.name;
        frame.stateBlend[id] = 1;
        continue;
      }
      const names = new Set(statesOf(doc, id).map((s) => s.name));
      const want = live ? pickLiveState(names, { hover: hoverNow.has(id), pressed: pressedNow.has(id), focus: this.focused.has(id) }) : undefined;
      let e = this.entries.get(id);
      if (want) {
        if (!e) e = { name: want, amount: 0, target: 1 };
        else if (e.name !== want) {
          if (e.amount < 0.02) e = { name: want, amount: 0, target: 1 };
          else e.target = 0; // the old one eases out first
        } else e.target = 1;
        this.entries.set(id, e);
      } else if (e) e.target = 0;
      e = this.entries.get(id);
      if (!e) continue;
      e.amount = reduced ? e.target : stepBlend(e.amount, e.target, dt);
      if (e.amount <= 0 && e.target === 0) {
        this.entries.delete(id);
        continue;
      }
      if (!names.has(e.name)) {
        this.entries.delete(id);
        continue;
      }
      frame.activeStates[id] = e.name;
      frame.stateBlend[id] = e.amount;
    }
    // layers that lost all their states while eased in
    for (const id of [...this.entries.keys()]) if (!layers.has(id)) this.entries.delete(id);
    const key = JSON.stringify(frame);
    this.changed = key !== this.lastKey;
    this.lastKey = key;
    return frame;
  }

  dispose(): void {
    this.entries.clear();
    this.focused.clear();
    this.lastKey = "";
  }
}
