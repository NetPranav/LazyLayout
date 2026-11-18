/**
 * ROADMAP Phase 80: animated variants. When an instance of a component changes variant (Off to On), each of its
 * layers moves from the look it had to the look it gets, on the instance's transition (Phase 79: a spring by default,
 * which keeps its speed when the switch is interrupted). The instance can also bind an interaction of its own:
 *
 * - `variantTrigger.on`: `none`, `click` (each click switches), `hover` or `press` (shown while the pointer is on it / down on it).
 * - `variantTrigger.property`: the variant property that changes (Size, State ...); empty means the component's first.
 * - `variantTrigger.value`: the value it goes to; empty means the next value in the property's list (a click cycles).
 *
 * An interaction shows another variant on the stage (Preview, or the States switch) without changing the document.
 * Pure: no DOM. The stage's side is `engine/stage/VariantDriver.ts`.
 */
import type { PropValue } from "../document/registry";
import type { Layer, MotionDocument } from "../document/schema";
import { getPropertyDefinition } from "../document/properties";
import { instanceRootOf, remapInstance, subtreeIds } from "./instances";
import { findVariant } from "./variantOps";

export const VARIANT_TRIGGERS = ["none", "click", "hover", "press"] as const;
export type VariantTriggerKind = (typeof VARIANT_TRIGGERS)[number];
export interface VariantTrigger {
  on: Exclude<VariantTriggerKind, "none">;
  property: string;
  /** The value to go to; empty cycles to the next one. */
  value: string;
}

type Props = Readonly<Record<string, unknown>>;
export type Look = Map<string, Readonly<Record<string, PropValue>>>;

/** The variant set an instance root belongs to (its component, when that has variants), or null. */
export function variantSetOf(doc: MotionDocument, rootId: string) {
  const meta = doc.layers[rootId]?.instance;
  const comp = meta?.root ? doc.designComponents?.[meta.component] : undefined;
  return comp?.variants && comp.variants.length > 1 && comp.variantProps && comp.variantProps.length > 0 ? comp : null;
}

/** Every instance root on the page that has variants to switch between. */
export function variantInstanceRoots(doc: MotionDocument): string[] {
  if (!doc.designComponents) return [];
  const out: string[] = [];
  for (const l of Object.values(doc.layers)) if (l.instance?.root && variantSetOf(doc, l.id)) out.push(l.id);
  return out;
}

/** The values an instance shows, with the first value for a property it doesn't name. */
export function variantValuesOf(doc: MotionDocument, rootId: string): Record<string, string> {
  const comp = variantSetOf(doc, rootId);
  const chosen = doc.layers[rootId]?.instance?.variant ?? {};
  const out: Record<string, string> = {};
  for (const p of comp?.variantProps ?? []) out[p.name] = chosen[p.name] ?? p.values[0];
  return out;
}
export const variantKey = (values: Record<string, string>): string => JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));

/** The instance's own interaction, or null (none set, or it names a property or value the component doesn't have). */
export function variantTriggerOf(doc: MotionDocument, rootId: string): VariantTrigger | null {
  const comp = variantSetOf(doc, rootId);
  const p: Props = doc.layers[rootId]?.properties ?? {};
  const on = p["variantTrigger.on"];
  if (!comp || (on !== "click" && on !== "hover" && on !== "press")) return null;
  const named = typeof p["variantTrigger.property"] === "string" ? (p["variantTrigger.property"] as string) : "";
  const prop = comp.variantProps!.find((x) => x.name === named) ?? (named === "" ? comp.variantProps![0] : undefined);
  if (!prop) return null;
  const value = typeof p["variantTrigger.value"] === "string" ? (p["variantTrigger.value"] as string) : "";
  if (value !== "" && !prop.values.includes(value)) return null;
  return { on, property: prop.name, value };
}

/** Where a trigger takes the instance from `shown`: its value, or the next in the list; from that value, back to `rest`. */
export function triggeredValues(doc: MotionDocument, rootId: string, trigger: VariantTrigger, shown: Record<string, string>, rest: Record<string, string>): Record<string, string> {
  const prop = variantSetOf(doc, rootId)?.variantProps?.find((x) => x.name === trigger.property);
  if (!prop) return shown;
  const now = shown[prop.name] ?? prop.values[0];
  if (trigger.value === "") return { ...shown, [prop.name]: prop.values[(prop.values.indexOf(now) + 1) % prop.values.length] };
  return { ...shown, [prop.name]: now === trigger.value ? (rest[prop.name] !== trigger.value ? rest[prop.name] : prop.values.find((v) => v !== trigger.value) ?? now) : trigger.value };
}

/** The properties of every layer of an instance as the document has them. */
export function lookOf(doc: MotionDocument, rootId: string): Look {
  const out: Look = new Map();
  for (const id of subtreeIds(doc.layers, rootId)) out.set(id, doc.layers[id].properties as Record<string, PropValue>);
  return out;
}

/**
 * What every layer of an instance would look like showing the variant with `values`, without changing the document:
 * the switch is made on a copy of the instance's layers (the mains are only read). Null when the component has no
 * such variant. Layers are matched by name, as a real switch matches them, so each keeps its overrides.
 */
export function variantLook(doc: MotionDocument, rootId: string, values: Record<string, string>): Look | null {
  const comp = variantSetOf(doc, rootId);
  const root = doc.layers[rootId];
  const hit = comp ? findVariant(comp, { ...variantValuesOf(doc, rootId), ...values }) : undefined;
  if (!comp || !hit || !root?.instance) return null;
  if (hit.mainId === root.instance.source) return lookOf(doc, rootId);
  const ids = subtreeIds(doc.layers, rootId);
  const layers: Record<string, Layer> = { ...doc.layers };
  for (const id of ids) layers[id] = structuredClone(doc.layers[id]);
  const scratch = { ...doc, layers } as MotionDocument;
  remapInstance(scratch, rootId, hit.mainId);
  const out: Look = new Map();
  for (const id of ids) if (scratch.layers[id]) out.set(id, scratch.layers[id].properties as Record<string, PropValue>);
  return out;
}

const same = (a: unknown, b: unknown): boolean => a === b || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));
/** Where the instance sits is its own (a variant switch never moves it), and the trigger and transition are settings. */
const SKIP = /^(frame\.(x|y)$|positioning$|variantTrigger\.|transition\.)/;

/**
 * The properties that differ between two looks, per layer, as `from` and `to`. A property only one side sets is
 * measured against its default; one with no default on the missing side is left to switch at once.
 */
export function lookDifference(from: Look, to: Look, rootId: string): Map<string, { from: Record<string, PropValue>; to: Record<string, PropValue> }> {
  const out = new Map<string, { from: Record<string, PropValue>; to: Record<string, PropValue> }>();
  for (const [id, b] of to) {
    const a = from.get(id);
    if (!a) continue;
    let entry: { from: Record<string, PropValue>; to: Record<string, PropValue> } | undefined;
    for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (id === rootId && SKIP.test(path)) continue;
      if (same(a[path], b[path])) continue;
      const fallback = getPropertyDefinition(path)?.default as PropValue | undefined;
      const x = a[path] ?? fallback;
      const y = b[path] ?? fallback;
      if (x === undefined || x === null || y === undefined || y === null || same(x, y)) continue;
      entry ??= { from: {}, to: {} };
      entry.from[path] = x;
      entry.to[path] = y;
    }
    if (entry) out.set(id, entry);
  }
  return out;
}

/** The instance root a layer belongs to when that instance has variants, or null. */
export function variantRootOf(doc: MotionDocument, layerId: string): string | null {
  const root = instanceRootOf(doc.layers, layerId);
  return root && variantSetOf(doc, root) ? root : null;
}
