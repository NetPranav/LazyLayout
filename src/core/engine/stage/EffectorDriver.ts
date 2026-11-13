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
import { copyStyles, hasPointerEffector } from "../../render/copies";
import { resolveProps } from "../../render/resolve";

export interface EffectorDriverHost {
  getDocument(): MotionDocument;
  node(layerId: string): Element | undefined;
  source: InputSource;
}

interface Styled {
  style: { transform: string; opacity: string };
  getAttribute(name: string): string | null;
}

export class EffectorDriver {
  private lastDoc: MotionDocument | null = null;
  private layerIds: string[] = [];
  private lastPointer = "";
  /** What was last written per wrapper, to write only changes. */
  private readonly written = new WeakMap<object, string>();
  private touched = new Set<Styled>();

  constructor(private readonly host: EffectorDriverHost) {}

  private layers(): string[] {
    const doc = this.host.getDocument();
    if (this.lastDoc !== doc) {
      this.lastDoc = doc;
      this.lastPointer = "";
      this.layerIds = Object.values(doc.layers)
        .filter((l) => hasPointerEffector(resolveProps(l).get))
        .map((l) => l.id);
    }
    return this.layerIds;
  }

  /** True when no layer has a pointer effector. */
  get idle(): boolean {
    return this.layers().length === 0;
  }

  /** Re-style the copies for where the pointer is now. Call once per frame. */
  update(): void {
    const ids = this.layers();
    if (ids.length === 0) return;
    const p = this.host.source.pointer();
    const key = p ? `${Math.round(p.x * 10)},${Math.round(p.y * 10)}` : "";
    if (key === this.lastPointer) return; // nothing moved
    this.lastPointer = key;
    this.write(ids, p ? { x: p.x, y: p.y } : null);
  }

  private write(ids: readonly string[], pointer: { x: number; y: number } | null): void {
    const doc = this.host.getDocument();
    for (const id of ids) {
      const layer = doc.layers[id];
      const node = this.host.node(id);
      const parent = node?.parentElement;
      if (!layer || !parent) continue;
      const parentLayer = layer.parentId ? doc.layers[layer.parentId] : undefined;
      const pf = parentLayer ? getLayerGeometry(parentLayer).frame : null;
      const styles = copyStyles(resolveProps(layer).get, getLayerGeometry(layer).frame, { width: pf?.width ?? 0, height: pf?.height ?? 0 }, pointer);
      for (const el of Array.from(parent.querySelectorAll(`:scope > [data-repeat-of="${CSS.escape(id)}"]`)) as unknown as Styled[]) {
        const c = styles[Number(el.getAttribute("data-repeat-copy")) - 1];
        if (!c) continue;
        const next = `${c.transform}|${c.opacity}`;
        if (this.written.get(el) === next) continue;
        this.written.set(el, next);
        el.style.transform = c.transform;
        el.style.opacity = String(c.opacity);
        this.touched.add(el);
      }
    }
  }

  /** Put every copy back as the renderer drew it (no pointer). */
  dispose(): void {
    if (this.layerIds.length > 0) this.write(this.layerIds, null);
    this.touched.clear();
    this.lastDoc = null;
    this.lastPointer = "";
  }
}
