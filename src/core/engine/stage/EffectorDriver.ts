/**
 * Design track D10: the live half of effectors. A pointer effector varies each copy by its distance to the pointer, so the
 * copies are re-styled every frame the pointer moves (Motion and Preview). It uses the same `copyStyles` as the renderer, with
 * the pointer, so what it writes is exactly what the renderer would draw for that pointer; only changed copies are written, and
 * `dispose` puts every copy back as the renderer drew it.
 *
 * Costs nothing when unused: with no layer that has a pointer effector, `update` returns before touching the page.
 */
import type { MotionDocument } from "../../document/schema";
import { getLayerGeometry } from "../../document/properties";
import type { InputSource } from "../../bindings/inputBus";
import { baseCopies, effectedStyle, hasLiveEffector, liveInfluence, type BaseCopy, type CopyStyle, type LiveInputs } from "../../render/copies";
import { readEffector } from "../../render/effector";
import { resolveProps } from "../../render/resolve";

export interface EffectorDriverHost {
  getDocument(): MotionDocument;
  node(layerId: string): Element | undefined;
  source: InputSource;
}

interface Styled {
  style: { transform: string; opacity: string; filter: string };
  getAttribute(name: string): string | null;
}

/** What the driver keeps for one layer between frames: its copies as made, its settings, and the wrappers it writes to. */
interface LayerState {
  settings: NonNullable<ReturnType<typeof readEffector>>;
  base: BaseCopy[];
  /** The wrapper element of each copy, by 0-based position in `base` (looked up once, and again if one is no longer on the page). */
  els: (Styled | undefined)[];
  /** The copies whose style differs from as made right now, so only they are visited when the pointer moves. */
  touched: Set<number>;
  parent: Element | null;
}

export class EffectorDriver {
  private lastDoc: MotionDocument | null = null;
  private layerIds: string[] = [];
  private lastPointer = "";
  private states = new Map<string, LayerState>();

  constructor(private readonly host: EffectorDriverHost) {}

  private layers(): string[] {
    const doc = this.host.getDocument();
    if (this.lastDoc !== doc) {
      this.lastDoc = doc;
      this.lastPointer = "";
      this.states.clear(); // the document changed: the copies and settings are read again
      this.layerIds = Object.values(doc.layers)
        .filter((l) => hasLiveEffector(resolveProps(l).get))
        .map((l) => l.id);
    }
    return this.layerIds;
  }

  /** True when no layer has a pointer effector. */
  get idle(): boolean {
    return this.layers().length === 0;
  }

  /** Re-style the copies for where the pointer and the scroll are now. Call once per frame. */
  update(): void {
    const ids = this.layers();
    if (ids.length === 0) return;
    const p = this.host.source.pointer();
    const sc = this.host.source.scroll();
    const progress = sc.max > 0 ? Math.min(1, Math.max(0, sc.y / sc.max)) : null;
    const key = `${p ? `${Math.round(p.x * 10)},${Math.round(p.y * 10)}` : ""}|${progress === null ? "" : Math.round(progress * 1000)}`;
    if (key === this.lastPointer) return; // neither the pointer nor the scroll moved
    this.lastPointer = key;
    this.write(ids, { pointer: p ? { x: p.x, y: p.y } : null, progress });
  }

  private state(id: string): LayerState | null {
    let st = this.states.get(id);
    if (st) return st;
    const doc = this.host.getDocument();
    const layer = doc.layers[id];
    const node = this.host.node(id);
    if (!layer || !node?.parentElement) return null;
    const get = resolveProps(layer).get;
    const settings = readEffector(get);
    const parentLayer = layer.parentId ? doc.layers[layer.parentId] : undefined;
    const pf = parentLayer ? getLayerGeometry(parentLayer).frame : null;
    const base = baseCopies(get, getLayerGeometry(layer).frame, { width: pf?.width ?? 0, height: pf?.height ?? 0 });
    if (!settings || base.length === 0) return null;
    st = { settings, base, els: new Array(base.length), touched: new Set(), parent: node.parentElement };
    this.states.set(id, st);
    return st;
  }

  /** The wrapper of copy `k` (0-based), found once; looked up again if the page replaced it. */
  private wrapper(id: string, st: LayerState, k: number): Styled | undefined {
    let el = st.els[k];
    if (el && (el as unknown as { isConnected?: boolean }).isConnected !== false) return el;
    if (!st.parent) return undefined;
    const found = Array.from(st.parent.querySelectorAll(`:scope > [data-repeat-of="${CSS.escape(id)}"]`)) as unknown as Styled[];
    for (const e of found) {
      const i = Number(e.getAttribute("data-repeat-copy")) - 1;
      if (i >= 0 && i < st.els.length) st.els[i] = e;
    }
    el = st.els[k];
    return el;
  }

  private write(ids: readonly string[], live: LiveInputs): void {
    for (const id of ids) {
      const st = this.state(id);
      if (!st) continue;
      const count = st.base.length + 1;
      const put = (k: number, c: CopyStyle) => {
        const el = this.wrapper(id, st, k);
        if (!el) return;
        el.style.transform = c.transform;
        el.style.opacity = String(c.opacity);
        el.style.filter = c.filter ?? "";
      };
      for (let k = 0; k < st.base.length; k++) {
        const b = st.base[k];
        const f = liveInfluence(st.settings, b.centre, b.index, count, live);
        if (f === 0) {
          if (st.touched.delete(k)) put(k, b); // it was changed, and the field has left it: back as made
          continue;
        }
        put(k, effectedStyle(b, st.settings, f));
        st.touched.add(k);
      }
    }
  }

  /** Put every copy back as the renderer drew it (no pointer). */
  dispose(): void {
    for (const [id, st] of this.states) {
      for (const k of st.touched) {
        const el = this.wrapper(id, st, k);
        const b = st.base[k];
        if (el && b) {
          el.style.transform = b.transform;
          el.style.opacity = String(b.opacity);
          el.style.filter = "";
        }
      }
      st.touched.clear();
    }
    this.states.clear();
    this.lastDoc = null;
    this.lastPointer = "";
  }
}
