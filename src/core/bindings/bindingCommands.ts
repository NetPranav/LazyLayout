/**
 * Edits to the document's bindings table (Design track D4). Each is one undo step, runs through `documentCommands.mutate`,
 * and is checked against `BindingSchema` first, so a bad binding is refused with a message instead of stored.
 *
 * Not yet registered as typed commands in the command registry (the palette, keybindings and the agent bridge cannot reach
 * them); that is a named gap in the D4 status check.
 */
import { BindingDraftSchema, BindingSchema, type Binding, type BindingDraft } from "../document/signals";
import { createId } from "../ids";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";

/** Adds a binding to a layer and returns its id. Throws a `ZodError` when the draft is not a valid binding. */
export function addBinding(draft: BindingDraft, ownerLayerId: string, options: { name?: string; enabled?: boolean } = {}, label = "Add driver"): string {
  const checked = BindingDraftSchema.parse(draft);
  const doc = getDocument();
  if (!doc.layers[ownerLayerId]) throw new Error(`There is no layer ${ownerLayerId}.`);
  const id = createId("bnd");
  const binding: Binding = BindingSchema.parse({ ...checked, id, ownerLayerId, enabled: options.enabled ?? true, ...(options.name ? { name: options.name } : {}) });
  documentCommands.mutate(label, (draft2) => {
    draft2.bindings = { ...(draft2.bindings ?? {}), [id]: binding };
  });
  return id;
}

/** Changes a binding. The result is checked before it is stored. Returns false when there is no such binding. */
export function updateBinding(id: string, patch: Partial<Omit<Binding, "id" | "ownerLayerId">>, label = "Edit driver"): boolean {
  const current = getDocument().bindings?.[id];
  if (!current) return false;
  const next = BindingSchema.parse({ ...current, ...patch, id, ownerLayerId: current.ownerLayerId });
  documentCommands.mutate(label, (draft) => {
    draft.bindings = { ...(draft.bindings ?? {}), [id]: next };
  });
  return true;
}

export const setBindingEnabled = (id: string, enabled: boolean): boolean => updateBinding(id, { enabled }, enabled ? "Turn driver on" : "Turn driver off");

export function removeBinding(id: string, label = "Remove driver"): boolean {
  if (!getDocument().bindings?.[id]) return false;
  documentCommands.mutate(label, (draft) => {
    const rest = { ...(draft.bindings ?? {}) };
    delete rest[id];
    draft.bindings = rest;
  });
  return true;
}

/** The bindings a layer owns, in document order. */
export const bindingsOf = (layerId: string): Binding[] => Object.values(getDocument().bindings ?? {}).filter((b) => b.ownerLayerId === layerId);

/**
 * Replaces the drivers a layer owns under one name with new ones, in one undo step (a Follow is two drivers; changing its
 * settings must not leave the old pair behind or cost two undos). An empty list just removes them.
 */
export function setDriversNamed(ownerLayerId: string, name: string, drafts: readonly BindingDraft[], label = "Set driver"): string[] {
  const doc = getDocument();
  if (!doc.layers[ownerLayerId]) throw new Error(`There is no layer ${ownerLayerId}.`);
  const made = drafts.map((d) => BindingSchema.parse({ ...BindingDraftSchema.parse(d), id: createId("bnd"), ownerLayerId, enabled: true, name }));
  documentCommands.mutate(label, (draft) => {
    const kept = Object.fromEntries(Object.entries(draft.bindings ?? {}).filter(([, b]) => !(b.ownerLayerId === ownerLayerId && b.name === name)));
    for (const b of made) kept[b.id] = b;
    draft.bindings = kept;
  });
  return made.map((b) => b.id);
}
