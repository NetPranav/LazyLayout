import type { ResolvedProps } from "../../kernel/evaluate";
import { drawDashes, drawSettings, isDrawPath } from "../../paths/strokeDraw";
import { subpathData } from "../../paths/morphMatch";

/**
 * ROADMAP Phase 85: a morphing path and a stroke being drawn, written by the animation engine. Neither is a CSS
 * property that every browser animates (`d` is not one in Safari, and the dashes are made from several settings), so
 * they are attributes on the layer's `<path>` elements: `d`, and `pathLength="1"` with `stroke-dasharray` and
 * `stroke-dashoffset` (`core/paths/strokeDraw.ts`).
 *
 * The render definition draws a path layer as one `<path>`, or, when the layer has drawing settings and several
 * sub-paths, as one fill `<path data-path-fill>` and a stroke `<path data-path-part="i">` per sub-path, so each can be
 * drawn on its own. This writer finds whichever is there. The first write to an attribute remembers what React had
 * drawn, and `remove` puts it back.
 */
const PATH = "svg.path";
type Attr = "d" | "pathLength" | "stroke-dasharray" | "stroke-dashoffset";

/** Whether a layer animating `paths` needs this writer. */
export const writesSvgPath = (paths: ReadonlySet<string>): boolean => {
  if (paths.has(PATH)) return true;
  for (const p of paths) if (isDrawPath(p)) return true;
  return false;
};

interface PathEl {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}
interface Found {
  root: unknown;
  fill: PathEl | null;
  /** The stroke elements: one for the whole path, or one per sub-path. */
  parts: PathEl[];
  split: boolean;
}

function find(root: Element): Found | null {
  if (typeof root.querySelectorAll !== "function") return null;
  const marked = Array.from(root.querySelectorAll("path[data-path-part]"));
  if (marked.length > 0) return { root, fill: root.querySelector("path[data-path-fill]"), parts: marked, split: true };
  const one = typeof root.matches === "function" && root.matches("path") ? root : root.querySelector("path");
  return one ? { root, fill: null, parts: [one], split: false } : null;
}

export class SvgPathWriter {
  private readonly found = new Map<string, Found>();
  private readonly originals = new Map<PathEl, Map<Attr, string | null>>();
  /** Attribute writes made, for tests. */
  writes = 0;

  private set(el: PathEl, name: Attr, value: string | null): void {
    let originals = this.originals.get(el);
    if (!originals) this.originals.set(el, (originals = new Map()));
    if (!originals.has(name)) originals.set(name, el.getAttribute(name));
    // null: back to what React drew
    const next = value ?? originals.get(name) ?? null;
    if (el.getAttribute(name) === next) return;
    if (next === null) el.removeAttribute(name);
    else el.setAttribute(name, next);
    this.writes++;
  }

  /** Shows `resolved` on the layer's path elements: the path when it is animated, and the dashes of its drawing settings. */
  sync(element: Element, layerId: string, paths: ReadonlySet<string>, resolved: ResolvedProps): void {
    let found = this.found.get(layerId);
    if (!found || found.root !== element || found.parts.some((p) => (p as unknown as { isConnected?: boolean }).isConnected === false)) {
      this.remove(layerId);
      const next = find(element);
      if (!next) return;
      this.found.set(layerId, (found = next));
    }
    const d = resolved[PATH];
    if (paths.has(PATH) && typeof d === "string") {
      if (!found.split) this.set(found.parts[0], "d", d);
      else {
        const subs = subpathData(d);
        // a morph can have more sub-paths than were drawn at rest: the last element takes the rest
        found.parts.forEach((part, i) => this.set(part, "d", (i === found!.parts.length - 1 ? subs.slice(i).join(" ") : subs[i]) ?? ""));
        if (found.fill) this.set(found.fill, "d", d);
      }
    }
    const dashes = drawDashes(drawSettings((p) => resolved[p]), found.parts.length);
    found.parts.forEach((part, i) => {
      const dash = dashes?.[Math.min(i, dashes.length - 1)];
      this.set(part, "pathLength", dash ? "1" : null);
      this.set(part, "stroke-dasharray", dash ? dash.array : null);
      this.set(part, "stroke-dashoffset", dash ? String(dash.offset) : null);
    });
  }

  /** Puts a layer's path elements back as React drew them. */
  remove(layerId: string): void {
    const found = this.found.get(layerId);
    if (!found) return;
    this.found.delete(layerId);
    for (const el of [...found.parts, ...(found.fill ? [found.fill] : [])]) {
      const originals = this.originals.get(el);
      if (!originals) continue;
      for (const [name, value] of originals) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      this.originals.delete(el);
    }
  }
}
