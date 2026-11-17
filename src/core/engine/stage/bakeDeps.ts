import type { MotionDocument } from "../../document/schema";
import { getLayerParentRef } from "../../geometry/parentTransforms";
import { hasLinks } from "../../links/linkModel";
import { hasExpressions } from "../../expressions/exprModel";
import { followsPath } from "../../paths/pathFollow";
import { mattesOf } from "../../kernel/evaluate";

/**
 * What a layer's baked animation (WaapiAdapter) depends on, as a list of object identities. The document store shares
 * structure (immer), so when an edit leaves these objects alone their identities stay the same and the layer's bake can
 * be reused: an edit to one layer re-bakes that layer, not every animated layer on the page.
 *
 * Conservative on purpose:
 * - the layer itself and its parent chain (Phase 73 parenting composes their transforms), plus each one's DOM parent
 *   (sequences and staggers depend on a layer's index among its siblings);
 * - the clips, behaviours and states of those layers;
 * - every other top-level part of the document (compositions, tokens, bindings, environment ...), as a whole;
 * - a layer that reads other layers in ways that aren't traced here (links, expressions, following a path, a matte)
 *   depends on all layers and all clips, so it re-bakes on any change, as every layer did before.
 */
export type BakeDeps = readonly unknown[];

const PER_LAYER_KEYS = new Set(["layers", "clips", "behaviours", "states"]);

/** Index of the per-layer parts, built once per document and reused for every layer's key. */
export interface BakeIndex {
  readonly doc: MotionDocument;
  readonly clipsByLayer: ReadonlyMap<string, readonly unknown[]>;
  readonly behavioursByLayer: ReadonlyMap<string, readonly unknown[]>;
  readonly statesByLayer: ReadonlyMap<string, readonly unknown[]>;
  readonly matted: ReadonlySet<string>;
  readonly docLevel: readonly unknown[];
}

function groupBy<T extends { layerId: string }>(items: Iterable<T>): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const list = out.get(item.layerId);
    if (list) list.push(item);
    else out.set(item.layerId, [item]);
  }
  return out;
}

export function buildBakeIndex(doc: MotionDocument): BakeIndex {
  const matted = new Set<string>();
  for (const [source, targets] of mattesOf(doc)) {
    matted.add(source);
    for (const id of targets) matted.add(id);
  }
  const docLevel: unknown[] = [];
  for (const key of Object.keys(doc).sort()) {
    if (!PER_LAYER_KEYS.has(key)) docLevel.push(key, (doc as unknown as Record<string, unknown>)[key]);
  }
  return {
    doc,
    clipsByLayer: groupBy(Object.values(doc.clips)),
    behavioursByLayer: groupBy(Object.values(doc.behaviours)),
    statesByLayer: groupBy(Object.values(doc.states ?? {}) as { layerId: string }[]),
    matted,
    docLevel,
  };
}

const MAX_CHAIN = 64;

export function bakeDepsOf(index: BakeIndex, layerId: string): BakeDeps {
  const { doc } = index;
  const deps: unknown[] = [...index.docLevel];
  let id: string | null | undefined = layerId;
  const seen = new Set<string>();
  while (id && !seen.has(id) && seen.size < MAX_CHAIN) {
    seen.add(id);
    const layer = doc.layers[id];
    if (!layer) break;
    const props = layer.properties;
    if (hasLinks(props) || hasExpressions(props) || followsPath(props) || index.matted.has(id)) {
      // reads other layers in ways not traced here: depends on everything per-layer
      return [...index.docLevel, doc.layers, doc.clips, doc.behaviours, doc.states];
    }
    // the DOM parent too: sequences and staggers place a layer by its index among its siblings (parent.children)
    const domParent = layer.parentId ? doc.layers[layer.parentId] : undefined;
    deps.push(layer, domParent, ...(index.clipsByLayer.get(id) ?? []), "|b", ...(index.behavioursByLayer.get(id) ?? []), "|s", ...(index.statesByLayer.get(id) ?? []), "|");
    id = getLayerParentRef(layer);
  }
  return deps;
}

export function sameDeps(a: BakeDeps | undefined, b: BakeDeps): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
