/**
 * Editing a layer's modifier stack (ROADMAP Phase 109): add, change, switch on or off, move and remove, each one undo
 * step. The stack lives in `shape.modifiers`; the layer's own geometry is never touched.
 */

import { createId } from "../ids";
import { getDocument } from "../store/documentState";
import { MODIFIER_DEFS, MAX_MODIFIERS, newModifier, parseModifiers, serializeModifiers, type Modifier, type ModifierType } from "../paths/modifiers";
import { setLayerProps } from "./editOps";
import { MODIFIABLE } from "./layerOutline";

const stackOf = (id: string): Modifier[] | null => {
  const l = getDocument().layers[id];
  return l && MODIFIABLE.has(l.archetype) && l.locked !== true ? parseModifiers(l.properties["shape.modifiers"]) : null;
};
const write = (id: string, stack: readonly Modifier[], label: string): boolean => setLayerProps([id], { "shape.modifiers": serializeModifiers(stack) || null }, label) > 0;

/** Adds a modifier with its defaults (and any `params` given) at the end of the stack. Returns its id. */
export function addModifier(layerId: string, type: ModifierType, params: Record<string, number | string> = {}): string | null {
  const stack = stackOf(layerId);
  if (!stack || stack.length >= MAX_MODIFIERS || !MODIFIER_DEFS[type]) return null;
  const m = newModifier(type, createId("mod"));
  const next = parseModifiers(JSON.stringify([...stack, { ...m, params: { ...m.params, ...params } }]));
  return write(layerId, next, `Add ${MODIFIER_DEFS[type].label}`) ? m.id : null;
}

/** Changes a modifier's parameters and/or switches it on or off. */
export function setModifier(layerId: string, modId: string, patch: { on?: boolean; params?: Record<string, number | string> }): boolean {
  const stack = stackOf(layerId);
  const i = stack?.findIndex((m) => m.id === modId) ?? -1;
  if (!stack || i < 0) return false;
  const m = stack[i];
  const next = stack.slice();
  next[i] = { ...m, on: patch.on ?? m.on, params: { ...m.params, ...(patch.params ?? {}) } };
  const label = patch.params ? `Change ${MODIFIER_DEFS[m.type].label}` : patch.on === false ? "Switch modifier off" : "Switch modifier on";
  return write(layerId, parseModifiers(JSON.stringify(next)), label);
}

/** Moves a modifier to position `to` (0 is the first applied). */
export function moveModifier(layerId: string, modId: string, to: number): boolean {
  const stack = stackOf(layerId);
  const i = stack?.findIndex((m) => m.id === modId) ?? -1;
  if (!stack || i < 0) return false;
  const j = Math.max(0, Math.min(stack.length - 1, Math.round(to)));
  if (i === j) return false;
  const next = stack.slice();
  const [m] = next.splice(i, 1);
  next.splice(j, 0, m);
  return write(layerId, next, "Reorder modifiers");
}

/** Removes a modifier. */
export function removeModifier(layerId: string, modId: string): boolean {
  const stack = stackOf(layerId);
  if (!stack || !stack.some((m) => m.id === modId)) return false;
  return write(layerId, stack.filter((m) => m.id !== modId), "Remove modifier");
}
