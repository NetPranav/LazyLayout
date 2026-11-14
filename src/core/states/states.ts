/**
 * Design track D15 (Main 78): named states of a layer. A state stores only what differs from the base layer; the
 * kernel applies it (`activeStates`), blending numbers by `stateBlend` so a hover can ease in and out.
 *
 * Built-in names are the ones the live preview and the export recognise: `hover` (pointer over the layer), `pressed`
 * (pointer down on it) and `focus` (last pressed). Any other name is a custom state, shown by picking it.
 */
import type { MotionDocument, Layer } from "../document/schema";
import type { PropValue } from "../document/registry";

export const BUILT_IN_STATES = ["hover", "pressed", "focus"] as const;
export type BuiltInState = (typeof BUILT_IN_STATES)[number];

export interface LayerStateRow {
  id: string;
  name: string;
  props: Record<string, PropValue>;
}

/** The states of one layer, built-ins first. */
export function statesOf(doc: Pick<MotionDocument, "states">, layerId: string): LayerStateRow[] {
  const rows = Object.values(doc.states ?? {}).filter((s) => s.layerId === layerId).map((s) => ({ id: s.id, name: s.name, props: s.props as Record<string, PropValue> }));
  const rank = (n: string) => {
    const i = (BUILT_IN_STATES as readonly string[]).indexOf(n);
    return i < 0 ? 99 : i;
  };
  return rows.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/** Layers that have at least one state (the stage draws these through the kernel). */
export function stateLayerIds(doc: Pick<MotionDocument, "states" | "layers">): Set<string> {
  const out = new Set<string>();
  for (const s of Object.values(doc.states ?? {})) if (doc.layers[s.layerId]) out.add(s.layerId);
  return out;
}

/** Every property path any state of the layer sets. */
export function statePaths(doc: Pick<MotionDocument, "states">, layerId: string): Set<string> {
  const out = new Set<string>();
  for (const s of Object.values(doc.states ?? {})) if (s.layerId === layerId) for (const k of Object.keys(s.props)) out.add(k);
  return out;
}

/** The state to show for a pointer: pressed beats focus beats hover. Returns the state's name or undefined. */
export function pickLiveState(names: ReadonlySet<string>, flags: { hover: boolean; pressed: boolean; focus: boolean }): string | undefined {
  if (flags.pressed && names.has("pressed")) return "pressed";
  if (flags.focus && names.has("focus")) return "focus";
  if (flags.hover && names.has("hover")) return "hover";
  return undefined;
}

/** What a state's props become when `patch` is written on top of the base layer: equal-to-base values are dropped, `undefined` deletes. */
export function mergeStateProps(base: Layer["properties"], current: Record<string, PropValue>, patch: Record<string, PropValue | undefined>): Record<string, PropValue> {
  const next: Record<string, PropValue> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || JSON.stringify(v) === JSON.stringify(base[k])) delete next[k];
    else next[k] = v;
  }
  return next;
}

/** One step of the ease towards a target (0 or 1): critically damped, so a quick in-and-out never snaps. `rate` is 1/seconds. */
export function stepBlend(value: number, target: number, dt: number, rate = 14): number {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  const v = value + (target - value) * k;
  return Math.abs(target - v) < 0.002 ? target : v;
}
