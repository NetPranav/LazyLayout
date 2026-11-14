/** State commands (Design track D15, Law 20): add, remove, rename and pick a state to edit, from the panel, the palette and the agent bridge. */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { documentStore, getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { useStateEditStore } from "./stateEdit";
import { statesOf } from "./states";

const selected = () => useSelectionStore.getState().selectedIds[0];
const NAME = z.string().trim().min(1).max(40).regex(/^[A-Za-z][A-Za-z0-9 _-]*$/, "a state name starts with a letter");

export function registerStateCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.addState", title: "Add a State to a Layer", category: "States",
    args: z.object({ id: z.string().optional(), name: NAME, edit: z.boolean().optional() }),
    run: ({ id, name, edit }) => {
      const layerId = id ?? selected();
      const doc = getDocument();
      if (!layerId || !doc.layers[layerId]) return { ok: false, code: "NO_LAYER", message: "No layer to put the state on." };
      if (statesOf(doc, layerId).some((s) => s.name.toLowerCase() === name.toLowerCase())) return { ok: false, code: "STATE_EXISTS", message: `This layer already has a state called ${name}.` };
      const stateId = documentCommands.addState(layerId, name, {}, `Add state ${name}`);
      if (edit !== false) useStateEditStore.getState().edit(layerId, name);
      return { ok: true, id: stateId };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.removeState", title: "Remove a State from a Layer", category: "States",
    args: z.object({ id: z.string().optional(), name: z.string() }),
    run: ({ id, name }) => {
      const layerId = id ?? selected();
      const row = layerId ? statesOf(getDocument(), layerId).find((s) => s.name === name) : undefined;
      if (!layerId || !row) return { ok: false, code: "NO_STATE", message: `No state called ${name}.` };
      const edit = useStateEditStore.getState();
      if (edit.layerId === layerId && edit.name === name) edit.edit(null, null);
      documentCommands.removeState(row.id, `Remove state ${name}`);
      return { ok: true };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.editState", title: "Edit a State of a Layer (or Back to the Base)", category: "States",
    args: z.object({ id: z.string().optional(), name: z.string().nullable() }),
    run: ({ id, name }) => {
      const layerId = id ?? selected();
      if (!layerId) return { ok: false, code: "NO_LAYER", message: "No layer selected." };
      if (name !== null && !statesOf(getDocument(), layerId).some((s) => s.name === name)) return { ok: false, code: "NO_STATE", message: `No state called ${name}.` };
      useStateEditStore.getState().edit(name === null ? null : layerId, name);
      return { ok: true };
    },
  }));

  // A state is only edited while its layer is the selection and the state exists (undo can remove it).
  const stopEditingIfGone = () => {
    const e = useStateEditStore.getState();
    if (!e.layerId || !e.name) return;
    const still = useSelectionStore.getState().selectedIds[0] === e.layerId && statesOf(getDocument(), e.layerId).some((s) => s.name === e.name);
    if (!still) e.edit(null, null);
  };
  const offSel = useSelectionStore.subscribe(stopEditingIfGone);
  const offDoc = documentStore.subscribe(stopEditingIfGone);
  offs.push(offSel, offDoc);

  return () => offs.forEach((off) => off());
}
