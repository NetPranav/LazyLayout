/**
 * Where everything is, read from what the engine actually drew.
 *
 * The page is one real tree drawn by the engine (stacks, padding, hug, fill, clip and opacity all apply), so a layer's
 * place is not something its properties can answer. This reads it from the DOM, in the page's own pixels (zoom and pan
 * taken out). The selection boxes, the click targets and the editing operations (align, group, reparent) all use it.
 */

import type { Layer } from "@/core/document/schema";
import { documentOrder } from "@/core/selection/selectionOps";
import type { StageElement } from "./types";

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** The drawn node of each layer in the page element, by layer id. */
function drawnNodes(page: HTMLElement): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>();
  page.querySelectorAll<HTMLElement>("[data-element-id]").forEach((n) => {
    const id = n.getAttribute("data-element-id");
    if (id && !out.has(id)) out.set(id, n);
  });
  return out;
}

/** A locked layer, or one inside a locked layer, cannot be picked on the canvas (the Layers panel still can). */
function isLockedDeep(layers: Record<string, Layer>, id: string): boolean {
  let cur: Layer | undefined = layers[id];
  let guard = 0;
  while (cur && guard++ < 1000) {
    if (cur.locked === true) return true;
    cur = cur.parentId ? layers[cur.parentId] : undefined;
  }
  return false;
}

/** Every drawn layer's box in page pixels, back to front (the top-level page itself has none: it is the artboard). */
export function measurePage(page: HTMLElement, layers: Record<string, Layer>): Record<string, StageElement> {
  const pageRect = page.getBoundingClientRect();
  const scale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
  const nodes = drawnNodes(page);
  const boxes = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();

  for (const id of documentOrder(layers)) {
    const node = nodes.get(id);
    const layer = layers[id];
    if (!node || !layer) continue;
    const r = node.getBoundingClientRect();
    const rotation = num(layer.properties["frame.rotation"]) ?? 0;
    let width = r.width / scale;
    let height = r.height / scale;
    let x = (r.left - pageRect.left) / scale;
    let y = (r.top - pageRect.top) / scale;
    if (rotation !== 0) {
      // the screen box of a turned layer is bigger than the layer: keep its centre, and its own size
      const cx = x + width / 2;
      const cy = y + height / 2;
      width = num(layer.properties["frame.width"]) ?? width;
      height = num(layer.properties["frame.height"]) ?? height;
      x = cx - width / 2;
      y = cy - height / 2;
    } else if (layer.archetype === "text") {
      // text set not to wrap runs past its box: the selection includes the part that sticks out
      width = Math.max(width, node.scrollWidth);
      height = Math.max(height, node.scrollHeight);
    }
    boxes.set(id, { x, y, width, height, rotation });
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const result: Record<string, StageElement> = {};
  for (const id of documentOrder(layers)) {
    const layer = layers[id];
    const box = boxes.get(id);
    if (!layer || !box || layer.parentId === null) continue;
    const parent = boxes.get(layer.parentId);
    const parentIsPage = layers[layer.parentId]?.parentId === null;
    result[id] = {
      id,
      name: layer.name,
      type: layer.archetype === "text" || layer.archetype === "svgText" ? "text" : layer.archetype === "button" || layer.archetype === "fab" ? "button" : layer.archetype === "image" ? "image" : "container",
      x: round(box.x),
      y: round(box.y),
      ox: parent && !parentIsPage ? round(parent.x) : 0,
      oy: parent && !parentIsPage ? round(parent.y) : 0,
      width: round(box.width),
      height: round(box.height),
      rotation: box.rotation || undefined,
      hidden: false,
      locked: isLockedDeep(layers, id),
      title: typeof layer.properties["content.text"] === "string" ? (layer.properties["content.text"] as string) : layer.name,
      label: String(layer.properties["content.label"] ?? layer.properties["content.text"] ?? layer.name),
    };
  }
  return result;
}

/**
 * What the editing operations (align, distribute, group, reparent) ask a stage: where layers are, relative to their
 * top-level frame. The same reading as the selection boxes, so they agree.
 */
export function pageMeasurer(page: () => HTMLElement | null) {
  const measureNow = (ids: readonly string[]) => {
    const el = page();
    if (!el) return ids.map(() => null);
    const pageRect = el.getBoundingClientRect();
    const scale = el.offsetWidth > 0 ? pageRect.width / el.offsetWidth : 1;
    const nodes = drawnNodes(el);
    return ids.map((id) => {
      const n = nodes.get(id);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { id, x: (r.left - pageRect.left) / scale, y: (r.top - pageRect.top) / scale, width: r.width / scale, height: r.height / scale };
    });
  };
  return {
    measureNow,
    measure: async (ids: readonly string[]) => measureNow(ids),
    onLayout: () => () => undefined,
    invalidate: () => undefined,
  };
}
