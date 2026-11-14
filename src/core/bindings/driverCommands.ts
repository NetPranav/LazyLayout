/**
 * Driver commands (Design track D4, Law 20): the typed commands that make drivers reachable from the command palette, the
 * keybindings and the agent bridge, not only from the Design panel. A driver is written in the binding grammar the code view
 * uses (`pointer.uv(page) |> component(x) |> remap(0, 1, -30, 30) -> hero.transform.rotate`), so an agent can write one.
 */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { BindingSyntaxError, parseBinding, resolveLayerRefs } from "../document/signals";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { addBinding, bindingsOf, removeBinding, setBindingEnabled } from "./bindingCommands";

const selected = () => useSelectionStore.getState().selectedIds[0];

export function registerDriverCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.addDriver", title: "Drive a Property from the Pointer, Scroll or Time", category: "Drivers",
    args: z.object({
      /** The layer the driver belongs to (default: the selected one). */
      id: z.string().optional(),
      /** The driver in the binding grammar: signal, operators, then the layer and property it drives. */
      text: z.string().min(1).max(2000),
      name: z.string().max(80).optional(),
    }),
    run: ({ id: given, text, name }) => {
      const doc = getDocument();
      const owner = given ?? selected();
      if (!owner || !doc.layers[owner]) return { ok: false, code: "NO_LAYER", message: "No layer to put the driver on." };
      const layers = Object.values(doc.layers);
      let draft;
      try {
        draft = resolveLayerRefs(parseBinding(text), (n) => layers.find((l) => l.id === n || l.name === n)?.id);
      } catch (e) {
        return { ok: false, code: "BAD_DRIVER", message: e instanceof BindingSyntaxError || e instanceof Error ? e.message : String(e) };
      }
      try {
        const bindingId = addBinding(draft, owner, name ? { name } : {});
        return { ok: true, id: bindingId };
      } catch (e) {
        return { ok: false, code: "BAD_DRIVER", message: e instanceof Error ? e.message.slice(0, 300) : String(e) };
      }
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.removeDriver", title: "Remove a Driver", category: "Drivers",
    args: z.object({ id: z.string().optional(), driverId: z.string().optional() }),
    run: ({ id, driverId }) => {
      const owner = id ?? selected();
      const targets = driverId ? [driverId] : owner ? bindingsOf(owner).map((b) => b.id) : [];
      let removed = 0;
      for (const t of targets) if (removeBinding(t)) removed++;
      return { removed };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.setDriverEnabled", title: "Turn a Driver On or Off", category: "Drivers",
    args: z.object({ driverId: z.string(), enabled: z.boolean() }),
    run: ({ driverId, enabled }) => (setBindingEnabled(driverId, enabled) ? { ok: true } : { ok: false, code: "NO_DRIVER", message: `No driver ${driverId}.` }),
  }));

  return () => offs.forEach((off) => off());
}
