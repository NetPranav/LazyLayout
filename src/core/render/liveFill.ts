import type { Layer } from "../document/schema";

/**
 * A copy of a layer and everything under it, with every id prefixed (Phase 116), for drawing it inside a live fill:
 * the copy never shares an id with the source, so measuring and selecting on the canvas still find the source
 * itself. The copy's root is placed at 0, 0 of the fill.
 */
export function cloneSubtree(layers: Readonly<Record<string, Layer>>, rootId: string, prefix: string, limit = 2_000): { layers: Record<string, Layer>; rootId: string } {
  const out: Record<string, Layer> = {};
  const walk = (id: string, parentId: string | null) => {
    const l = layers[id];
    if (!l || Object.keys(out).length >= limit) return;
    const nid = prefix + id;
    out[nid] = {
      ...l,
      id: nid,
      parentId,
      children: l.children.filter((c) => layers[c]).map((c) => prefix + c),
      ...(parentId === null ? { properties: { ...l.properties, positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.rotation": 0 } } : {}),
    };
    for (const c of l.children) walk(c, nid);
  };
  walk(rootId, null);
  return { layers: out, rootId: prefix + rootId };
}

/** Whether `ancestor` is `id` or contains it. */
export function contains(layers: Readonly<Record<string, Layer>>, ancestor: string, id: string): boolean {
  let cur: string | null = id;
  for (let guard = 0; cur && guard < 10_000; guard++) {
    if (cur === ancestor) return true;
    cur = layers[cur]?.parentId ?? null;
  }
  return false;
}
