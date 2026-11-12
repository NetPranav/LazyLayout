import { getPropertyDefinition, isPropertyLegalFor } from "../document/properties";
import type { PropValue } from "../document/registry";
import type { MotionDocument } from "../document/schema";
import { parseEasing } from "../document/motion";
import { sampleEasing } from "../kernel/easing";
import { readExpressions } from "../expressions/exprModel";
import { expressionRefs, parseCached } from "../expressions/parse";

/**
 * ============================================================================
 * PROPERTY LINKS (ROADMAP Phase 76)
 * ============================================================================
 * A link makes one property follow another: this layer's rotation follows that layer's x. It lives on the layer that is
 * driven, in the numbered slots `link.N.*` (up to eight), so it is saved, undone and keyframed like any property, and
 * needs no schema change. The kernel reads the source's number at the same moment and carries it across the link's map,
 * and the result replaces the target's value (a link wins over animation, as an expression does in After Effects).
 *
 * This file is the pure half: reading the slots, carrying a number across a map, the graph of who depends on whom,
 * and finding a cycle. A cycle is refused with `[LINK_CYCLE]` and the chain that closes it.
 * ============================================================================
 */

export const LINK_SLOTS = 8;
export const LINK_MAPS = ["direct", "range", "curve"] as const;
export type LinkMap = (typeof LINK_MAPS)[number];

export const LINK_SLOT_PARAMS = ["target", "source", "sourceProperty", "map", "enabled", "clamp", "curve", "inMin", "inMax", "outMin", "outMax"] as const;
export const linkPath = (slot: number, name: string): string => `link.${slot}.${name}`;

export interface Link {
  slot: number;
  /** The property of this layer that is driven. */
  target: string;
  /** The layer it reads from (may be this layer). */
  source: string;
  sourceProperty: string;
  map: LinkMap;
  enabled: boolean;
  /** `range` and `curve`: hold the result inside the output range. */
  clamp: boolean;
  /** `curve`: the easing the 0 to 1 position is passed through. */
  curve: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
}

const str = (v: PropValue | undefined, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: PropValue | undefined, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** The links a layer has, in slot order. A slot with no target or source is empty. Disabled links are listed (with `enabled: false`). */
export function readLinks(props: Readonly<Record<string, PropValue>>): Link[] {
  const out: Link[] = [];
  for (let slot = 1; slot <= LINK_SLOTS; slot++) {
    const get = (name: string) => props[linkPath(slot, name)];
    const target = str(get("target"));
    const source = str(get("source"));
    const sourceProperty = str(get("sourceProperty"));
    if (!target || !source || !sourceProperty) continue;
    const map = str(get("map"), "direct");
    out.push({
      slot, target, source, sourceProperty,
      map: (LINK_MAPS as readonly string[]).includes(map) ? (map as LinkMap) : "direct",
      enabled: get("enabled") !== false,
      clamp: get("clamp") !== false,
      curve: str(get("curve"), "linear"),
      inMin: num(get("inMin"), 0), inMax: num(get("inMax"), 1), outMin: num(get("outMin"), 0), outMax: num(get("outMax"), 1),
    });
  }
  return out;
}

/** Whether a layer has any link in effect. */
export function hasLinks(props: Readonly<Record<string, PropValue>>): boolean {
  return readLinks(props).some((l) => l.enabled);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Carries a number across a link's map. `direct` passes it through. `range` takes it from the input range to the output
 * range (a reversed range reverses it). `curve` does the same but passes the 0 to 1 position through the easing first. An input
 * range with no width gives the output's start.
 */
export function mapValue(link: Pick<Link, "map" | "clamp" | "curve" | "inMin" | "inMax" | "outMin" | "outMax">, value: number): number {
  if (link.map === "direct") return value;
  const width = link.inMax - link.inMin;
  let t = width === 0 ? 0 : (value - link.inMin) / width;
  if (link.clamp) t = clamp01(t);
  if (link.map === "curve") {
    const easing = parseEasing(link.curve) ?? { kind: "linear" as const };
    // an eased position outside 0..1 (clamping off) is eased by its distance outside, mirrored, so the curve continues smoothly
    t = t < 0 ? -sampleEasing(easing, -t) : t > 1 ? 1 + sampleEasing(easing, t - 1) : sampleEasing(easing, t);
  }
  return link.outMin + t * (link.outMax - link.outMin);
}

/** Whether a property can be linked: a number, a length or an angle that the layer's archetype has. */
export function isLinkable(path: string, archetype: Parameters<typeof isPropertyLegalFor>[1]): boolean {
  const def = getPropertyDefinition(path);
  return !!def && (def.valueType === "number" || def.valueType === "length" || def.valueType === "angle") && isPropertyLegalFor(path, archetype);
}

/** A starting map for linking `source` to `target`: where both have a range, the whole of one onto the whole of the other; otherwise direct. */
export function suggestMap(sourcePath: string, targetPath: string): Partial<Link> {
  const s = getPropertyDefinition(sourcePath)?.range;
  const t = getPropertyDefinition(targetPath)?.range;
  if (s && t && s.min !== undefined && s.max !== undefined && t.min !== undefined && t.max !== undefined && s.min !== s.max) {
    return { map: "range", inMin: s.min, inMax: s.max, outMin: t.min, outMax: t.max, clamp: true };
  }
  return { map: "direct" };
}

// ---------------------------------------------------------------------------
// The graph: who depends on whom
// ---------------------------------------------------------------------------

/** A node of the dependency graph: one property of one layer. */
export interface LinkNode {
  layerId: string;
  property: string;
}
const key = (n: LinkNode) => `${n.layerId}|${n.property}`;

/** A layer by id, or by its name when exactly one layer has it (how an expression's `ref("Hero", …)` finds it). */
export function resolveLayerRef(layers: MotionDocument["layers"], ref: string): string | undefined {
  if (layers[ref]) return ref;
  const named = Object.values(layers).filter((l) => l.name === ref);
  return named.length === 1 ? named[0].id : undefined;
}

/** The properties an expression's `ref` and `refAtTime` read, as nodes (a reference to a layer that isn't there is skipped). */
export function expressionDependencies(layers: MotionDocument["layers"], text: string): LinkNode[] {
  const parsed = parseCached(text);
  if (!parsed.ok) return [];
  const out: LinkNode[] = [];
  for (const ref of expressionRefs(parsed.ast)) {
    const layerId = resolveLayerRef(layers, ref.layer);
    if (layerId) out.push({ layerId, property: ref.property });
  }
  return out;
}

/** The properties this property depends on: what its link reads, and what its expression refers to. */
function dependencies(doc: Pick<MotionDocument, "layers">, node: LinkNode): LinkNode[] {
  const out: LinkNode[] = [];
  const layer = doc.layers[node.layerId];
  if (!layer) return out;
  for (const l of readLinks(layer.properties)) if (l.enabled && l.target === node.property) out.push({ layerId: l.source, property: l.sourceProperty });
  for (const e of readExpressions(layer.properties)) if (e.enabled && e.target === node.property) out.push(...expressionDependencies(doc.layers, e.text));
  return out;
}

/** The chain from `first` back to `start` through the dependencies, if there is one (`start` leads the chain, and ends it). */
function chainBack(doc: Pick<MotionDocument, "layers">, start: LinkNode, first: LinkNode): LinkNode[] | null {
  if (key(first) === key(start)) return [start, first];
  const seen = new Set<string>();
  const walk = (node: LinkNode, path: LinkNode[]): LinkNode[] | null => {
    if (key(node) === key(start)) return [start, ...path];
    if (seen.has(key(node))) return null;
    seen.add(key(node));
    for (const next of dependencies(doc, node)) {
      const found = walk(next, [...path, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(first, [first]);
}

/**
 * The chain of properties that closes a cycle if `link` (on `layerId`) were added, or null if it wouldn't: starting from
 * the new link's source and following dependencies, does it come back to the property the link drives? The chain starts and
 * ends at that property: `[A.rotate, B.x, A.rotate]` reads "A.rotate follows B.x, which follows A.rotate".
 */
export function linkCycleIf(doc: Pick<MotionDocument, "layers">, layerId: string, link: Pick<Link, "target" | "source" | "sourceProperty">): LinkNode[] | null {
  return chainBack(doc, { layerId, property: link.target }, { layerId: link.source, property: link.sourceProperty });
}

/** The same for an expression: would an expression with this text on `layerId`'s `target` close a cycle through the layers it refers to? */
export function expressionCycleIf(doc: Pick<MotionDocument, "layers">, layerId: string, target: string, text: string): LinkNode[] | null {
  const start: LinkNode = { layerId, property: target };
  for (const first of expressionDependencies(doc.layers, text)) {
    const chain = chainBack(doc, start, first);
    if (chain) return chain;
  }
  return null;
}

/** Any cycle among the links and expressions already in the document (a hand-edited file can have one), as a chain, or null. */
export function findLinkCycle(doc: Pick<MotionDocument, "layers">): LinkNode[] | null {
  for (const layer of Object.values(doc.layers)) {
    for (const l of readLinks(layer.properties)) {
      if (!l.enabled) continue;
      // the link is already stored: ask as if it were being added to the others
      const others: Pick<MotionDocument, "layers"> = { layers: { ...doc.layers, [layer.id]: { ...layer, properties: { ...layer.properties, [linkPath(l.slot, "enabled")]: false } } } };
      const chain = linkCycleIf(others, layer.id, l);
      if (chain) return chain;
    }
    for (const e of readExpressions(layer.properties)) {
      if (!e.enabled) continue;
      const others: Pick<MotionDocument, "layers"> = { layers: { ...doc.layers, [layer.id]: { ...layer, properties: { ...layer.properties, [`expr.${e.slot}.enabled`]: false } } } };
      const chain = expressionCycleIf(others, layer.id, e.target, e.text);
      if (chain) return chain;
    }
  }
  return null;
}

/** `Hero.transform.rotate ← Null.transform.x ← Hero.transform.rotate`, with layer names. */
export function describeChain(doc: Pick<MotionDocument, "layers">, chain: readonly LinkNode[]): string {
  return chain.map((n) => `${doc.layers[n.layerId]?.name ?? n.layerId}.${n.property}`).join(" ← ");
}

/** The message a refused cycle carries. */
export const linkCycleMessage = (doc: Pick<MotionDocument, "layers">, chain: readonly LinkNode[]): string => `[LINK_CYCLE] ${describeChain(doc, chain)}`;
