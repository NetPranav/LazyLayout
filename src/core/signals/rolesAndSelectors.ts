/**
 * @file rolesAndSelectors.ts
 * @module core/signals/rolesAndSelectors
 * @description Phase 155: Semantic layer roles (inferred + editable), natural-language
 * target selectors ("every button", "the nearest card", "my neighbours", "the layer under
 * the cursor"), and pairwise relation signals (`distance`, `angle`, `overlap`, `order`).
 */

export type SemanticRole =
  | "button"
  | "link"
  | "heading"
  | "image"
  | "card"
  | "input"
  | "badge"
  | "section"
  | "text"
  | "shape"
  | "container";

export interface SemanticLayerNode {
  readonly id: string;
  readonly name?: string;
  readonly archetype?: string;
  readonly role?: SemanticRole;
  readonly parentId?: string | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly orderIndex?: number;
  readonly hasChildren?: boolean;
  readonly interactive?: boolean;
  readonly fontSizePx?: number;
}

export interface LayerRelationSignals {
  readonly centerDistancePx: number;
  readonly edgeDistancePx: number;
  readonly angleDeg: number;
  readonly overlapAreaPx: number;
  readonly overlapRatioA: number;
  readonly orderDelta: number;
}

export interface SelectorContext {
  readonly selfId?: string;
  readonly pointer?: { readonly x: number; readonly y: number } | null;
  readonly neighbourRadiusPx?: number;
}

/**
 * Infers a layer's semantic role from its explicit override first, then name,
 * typography, archetype, and structure.
 */
export function inferLayerRole(layer: SemanticLayerNode): SemanticRole {
  if (layer.role) return layer.role;

  const lower = (layer.name ?? "").toLowerCase();
  if (/\b(btn|button|cta|submit)\b/.test(lower)) return "button";
  if (/\b(link|nav|href|anchor)\b/.test(lower)) return "link";
  if (/\b(input|field|search|email|textarea)\b/.test(lower)) return "input";
  if (/\b(h[1-6]|heading|title|headline)\b/.test(lower)) return "heading";
  if (/\b(badge|tag|chip|pill)\b/.test(lower)) return "badge";
  if (/\b(card|tile|panel)\b/.test(lower)) return "card";
  if (/\b(hero|section|header|footer|banner)\b/.test(lower)) return "section";
  if (/\b(img|image|photo|avatar|logo|icon)\b/.test(lower) || layer.archetype === "media") return "image";

  if (layer.archetype === "text") {
    return (layer.fontSizePx ?? 16) >= 24 ? "heading" : "text";
  }
  if (layer.hasChildren) return "container";
  if (layer.interactive) return "button";
  return "shape";
}

function normalizeRoleToken(raw: string): SemanticRole {
  const token = raw.trim().toLowerCase().replace(/s$/, "");
  const map: Readonly<Record<string, SemanticRole>> = {
    button: "button",
    link: "link",
    heading: "heading",
    image: "image",
    card: "card",
    input: "input",
    badge: "badge",
    section: "section",
    text: "text",
    shape: "shape",
    container: "container",
  };
  return map[token] ?? "shape";
}

/** Returns every layer whose inferred/explicit role matches `role`. */
export function selectEveryRole(
  layers: readonly SemanticLayerNode[],
  role: SemanticRole,
): readonly SemanticLayerNode[] {
  return layers.filter((layer) => inferLayerRole(layer) === role);
}

/** Returns the nearest layer of a given `role` to `origin` (excluding `origin` itself). */
export function selectNearestOfRole(
  origin: SemanticLayerNode,
  layers: readonly SemanticLayerNode[],
  role: SemanticRole,
): SemanticLayerNode | null {
  const ox = origin.x + origin.width * 0.5;
  const oy = origin.y + origin.height * 0.5;
  let best: SemanticLayerNode | null = null;
  let bestDist = Infinity;

  for (const candidate of layers) {
    if (candidate.id === origin.id) continue;
    if (inferLayerRole(candidate) !== role) continue;
    const cx = candidate.x + candidate.width * 0.5;
    const cy = candidate.y + candidate.height * 0.5;
    const d = Math.hypot(cx - ox, cy - oy);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

/**
 * Selects neighbours of `origin` (siblings when sharing a non-null `parentId`, or
 * spatial neighbours within `radiusPx`), excluding `origin` itself.
 */
export function selectNeighbours(
  origin: SemanticLayerNode,
  layers: readonly SemanticLayerNode[],
  radiusPx = 200,
): readonly SemanticLayerNode[] {
  const ox = origin.x + origin.width * 0.5;
  const oy = origin.y + origin.height * 0.5;
  return layers.filter((candidate) => {
    if (candidate.id === origin.id) return false;
    if (origin.parentId != null) {
      return candidate.parentId === origin.parentId;
    }
    const cx = candidate.x + candidate.width * 0.5;
    const cy = candidate.y + candidate.height * 0.5;
    return Math.hypot(cx - ox, cy - oy) <= radiusPx;
  });
}

/**
 * Returns the topmost layer under `pointer` by ascending `orderIndex` (or array order).
 */
export function selectLayerUnderCursor(
  pointer: { readonly x: number; readonly y: number },
  layers: readonly SemanticLayerNode[],
): SemanticLayerNode | null {
  let topHit: SemanticLayerNode | null = null;
  let topOrder = -Infinity;

  layers.forEach((layer, idx) => {
    const inside =
      pointer.x >= layer.x &&
      pointer.x <= layer.x + layer.width &&
      pointer.y >= layer.y &&
      pointer.y <= layer.y + layer.height;
    if (!inside) return;
    const order = layer.orderIndex ?? idx;
    if (order >= topOrder) {
      topOrder = order;
      topHit = layer;
    }
  });
  return topHit;
}

/**
 * Evaluates natural-language / shorthand selector phrases:
 * - `"every button"`, `"every card"`, ...
 * - `"the nearest card"`, `"nearest button"`, ...
 * - `"my neighbours"` / `"my neighbors"`
 * - `"the layer under the cursor"` / `"under cursor"`
 */
export function resolveSemanticSelector(
  phrase: string,
  layers: readonly SemanticLayerNode[],
  context: SelectorContext = {},
): readonly SemanticLayerNode[] {
  const clean = phrase.trim().toLowerCase();

  if (clean.includes("under the cursor") || clean === "under cursor") {
    if (!context.pointer) return [];
    const hit = selectLayerUnderCursor(context.pointer, layers);
    return hit ? [hit] : [];
  }

  if (clean === "my neighbours" || clean === "my neighbors" || clean === "neighbours" || clean === "neighbors") {
    const self = layers.find((l) => l.id === context.selfId);
    if (!self) return [];
    return selectNeighbours(self, layers, context.neighbourRadiusPx ?? 200);
  }

  const everyMatch = /^every\s+([a-z]+)$/.exec(clean);
  if (everyMatch) {
    return selectEveryRole(layers, normalizeRoleToken(everyMatch[1]!));
  }

  const nearestMatch = /^(?:the\s+)?nearest\s+([a-z]+)$/.exec(clean);
  if (nearestMatch) {
    const self = layers.find((l) => l.id === context.selfId) ?? layers[0];
    if (!self) return [];
    const match = selectNearestOfRole(self, layers, normalizeRoleToken(nearestMatch[1]!));
    return match ? [match] : [];
  }

  return layers.filter((l) => l.id === phrase.trim());
}

/**
 * Computes pairwise relation signals (`distance`, `angle`, `overlap`, `order`)
 * between two layers in stage/page coordinates.
 */
export function computeLayerRelation(
  layerA: SemanticLayerNode,
  layerB: SemanticLayerNode,
): LayerRelationSignals {
  const ax = layerA.x + layerA.width * 0.5;
  const ay = layerA.y + layerA.height * 0.5;
  const bx = layerB.x + layerB.width * 0.5;
  const by = layerB.y + layerB.height * 0.5;

  const dx = bx - ax;
  const dy = by - ay;
  const centerDistancePx = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const ix = Math.max(0, Math.min(layerA.x + layerA.width, layerB.x + layerB.width) - Math.max(layerA.x, layerB.x));
  const iy = Math.max(0, Math.min(layerA.y + layerA.height, layerB.y + layerB.height) - Math.max(layerA.y, layerB.y));
  const overlapAreaPx = ix * iy;
  const areaA = Math.max(1e-6, layerA.width * layerA.height);
  const overlapRatioA = Math.min(1, overlapAreaPx / areaA);

  const gapX = Math.max(0, Math.max(layerA.x - (layerB.x + layerB.width), layerB.x - (layerA.x + layerA.width)));
  const gapY = Math.max(0, Math.max(layerA.y - (layerB.y + layerB.height), layerB.y - (layerA.y + layerA.height)));
  const edgeDistancePx = Math.hypot(gapX, gapY);

  return {
    centerDistancePx,
    edgeDistancePx,
    angleDeg,
    overlapAreaPx,
    overlapRatioA,
    orderDelta: (layerB.orderIndex ?? 0) - (layerA.orderIndex ?? 0),
  };
}
