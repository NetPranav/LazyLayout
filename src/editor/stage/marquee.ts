/**
 * What a drag across the canvas selects: every element the box touches, at any depth, so sweeping across a page with
 * frames in it picks the shapes and text inside them too. A frame is picked only when none of what it holds is touched
 * (its box was swept over but nothing in it), so a layer and its parent are never both selected and a move cannot
 * move something twice.
 */

import type { Layer } from "@/core/document/schema";

export interface MarqueeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

/** `scope`: a frame the drag started in; only what is inside it counts. */
export function marqueeHits(
  layers: Record<string, Layer>,
  boxes: readonly MarqueeBox[],
  rect: { x0: number; y0: number; x1: number; y1: number },
  scope: string | null,
): string[] {
  const inScope = (id: string) => {
    if (!scope) return true;
    for (let cur = layers[id]?.parentId ?? null; cur; cur = layers[cur]?.parentId ?? null) if (cur === scope) return true;
    return false;
  };
  const hiddenWithin = (id: string) => {
    for (let cur: string | null = id; cur; cur = layers[cur]?.parentId ?? null) {
      const layer = layers[cur];
      if (!layer || layer.visible === false) return true;
    }
    return false;
  };
  const touched = boxes
    .filter((b) => !b.locked && layers[b.id] && layers[b.id].parentId !== null && b.width > 0 && b.height > 0)
    .filter((b) => b.x < rect.x1 && b.x + b.width > rect.x0 && b.y < rect.y1 && b.y + b.height > rect.y0)
    .filter((b) => inScope(b.id) && !hiddenWithin(b.id))
    .map((b) => b.id);
  const holdsTouched = new Set<string>();
  for (const id of touched) for (let cur = layers[id].parentId; cur; cur = layers[cur]?.parentId ?? null) holdsTouched.add(cur);
  return touched.filter((id) => !holdsTouched.has(id));
}
