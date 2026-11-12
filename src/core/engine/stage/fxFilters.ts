import type { FilterPrimitive } from "../../paint/effects";
import type { FxFilterSpec } from "../../render/fxStack";

/**
 * ROADMAP Phase 75: the SVG filters of the effect stack (displacement, noise) and of motion blur, kept in the frame
 * document by the animation engine. CSS `filter: url(#id)` points at them. The first time a layer needs one the
 * `<filter>` is built; afterwards a parameter that animates only changes attributes on the primitives already there
 * (no markup is rebuilt, no React runs). The `<svg>` that holds them is hidden and takes no pointer.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

type Doc = Pick<Document, "createElementNS" | "querySelector" | "body" | "documentElement">;

const signature = (primitives: readonly FilterPrimitive[]): string => primitives.map((p) => `${p.tag}(${p.children ? signature(p.children) : ""})`).join(",");

function setAttrs(el: Element, attrs: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(attrs)) {
    const text = String(value);
    if (el.getAttribute(name) !== text) el.setAttribute(name, text);
  }
}

function build(doc: Doc, p: FilterPrimitive): Element {
  const el = doc.createElementNS(SVG_NS, p.tag);
  setAttrs(el, p.attrs);
  for (const child of p.children ?? []) el.appendChild(build(doc, child));
  return el;
}

function update(el: Element, p: FilterPrimitive): void {
  setAttrs(el, p.attrs);
  (p.children ?? []).forEach((child, i) => {
    const node = el.children[i];
    if (node) update(node, child);
  });
}

export class FxFilterWriter {
  /** The filter ids each layer owns, so ones it stops needing are removed. */
  private readonly owned = new Map<string, Set<string>>();
  private defsOf = new WeakMap<object, Element>();

  private defs(doc: Doc): Element | null {
    const cached = this.defsOf.get(doc);
    if (cached && cached.isConnected) return cached;
    let svg = doc.querySelector("svg[data-fx-defs]");
    if (!svg) {
      svg = doc.createElementNS(SVG_NS, "svg");
      setAttrs(svg, { "aria-hidden": "true", "data-fx-defs": "", width: 0, height: 0, style: "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none" });
      svg.appendChild(doc.createElementNS(SVG_NS, "defs"));
      (doc.body ?? doc.documentElement).appendChild(svg);
    }
    const defs = svg.querySelector("defs");
    if (defs) this.defsOf.set(doc, defs);
    return defs;
  }

  /** Makes the layer's filters exactly `specs`: builds or updates each one, and removes any it had before that isn't there now. */
  sync(element: Element, layerId: string, specs: readonly FxFilterSpec[]): void {
    const doc = element.ownerDocument as Doc | null;
    if (!doc || typeof doc.createElementNS !== "function") return;
    const had = this.owned.get(layerId) ?? new Set<string>();
    const now = new Set(specs.map((s) => s.id));
    const defs = this.defs(doc);
    if (!defs) return;
    for (const id of had) if (!now.has(id)) defs.querySelector(`[id="${id}"]`)?.remove();
    for (const spec of specs) {
      let filter = defs.querySelector(`[id="${spec.id}"]`);
      const sig = signature(spec.primitives);
      if (filter && filter.getAttribute("data-sig") !== sig) {
        filter.remove();
        filter = null;
      }
      if (!filter) {
        filter = doc.createElementNS(SVG_NS, "filter");
        filter.setAttribute("id", spec.id);
        filter.setAttribute("color-interpolation-filters", "sRGB");
        filter.setAttribute("data-sig", sig);
        for (const p of spec.primitives) filter.appendChild(build(doc, p));
        defs.appendChild(filter);
      } else {
        spec.primitives.forEach((p, i) => {
          const node = filter!.children[i];
          if (node) update(node, p);
        });
      }
      const pad = Math.min(400, 10 + spec.region);
      setAttrs(filter, { x: `-${pad}%`, y: `-${pad}%`, width: `${100 + 2 * pad}%`, height: `${100 + 2 * pad}%` });
    }
    if (now.size === 0) this.owned.delete(layerId);
    else this.owned.set(layerId, now);
  }

  /** Takes away every filter a layer owns (it stopped having effects, or the engine is shutting down). */
  remove(element: Element | undefined, layerId: string): void {
    const ids = this.owned.get(layerId);
    this.owned.delete(layerId);
    const doc = element?.ownerDocument as Doc | null | undefined;
    if (!ids || !doc || typeof doc.querySelector !== "function") return;
    for (const id of ids) doc.querySelector(`[id="${id}"]`)?.remove();
  }
}
