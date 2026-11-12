import { z } from "zod";
import { defineTypedCommand } from "../commands";
import type { PropValue } from "../document/registry";
import { parseEasing } from "../document/motion";
import { setLayerProps, transaction } from "../editing/editOps";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { LINK_MAPS, LINK_SLOTS, LINK_SLOT_PARAMS, describeChain, isLinkable, linkCycleIf, linkCycleMessage, linkPath, readLinks, suggestMap, type Link } from "./linkModel";

/**
 * Link commands (ROADMAP Phase 76, Law 20): the pick-whip. `layer.setLink` links a property of one layer to a property of
 * another (or the same) layer, and is what dragging from one property to another calls; `layer.removeLink` takes one away.
 * A link that would close a cycle is refused with `[LINK_CYCLE]` and the chain, before anything is written.
 */
const selected = () => useSelectionStore.getState().selectedIds[0];

export function registerLinkCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.setLink", title: "Link a Property to Another (Pick-whip)", category: "Links",
    args: z.object({
      /** The layer that is driven (default: the selected one). */
      id: z.string().optional(),
      /** Its property that follows. */
      targetProperty: z.string(),
      sourceLayerId: z.string(),
      sourceProperty: z.string(),
      /** Which slot to use; by default the one already driving this property, else the first free one. */
      slot: z.number().int().min(1).max(LINK_SLOTS).optional(),
      map: z.enum(LINK_MAPS).optional(),
      inMin: z.number().optional(), inMax: z.number().optional(), outMin: z.number().optional(), outMax: z.number().optional(),
      clamp: z.boolean().optional(),
      curve: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
    run: (a) => {
      const doc = getDocument();
      const id = a.id ?? selected();
      const target = id ? doc.layers[id] : undefined;
      const source = doc.layers[a.sourceLayerId];
      if (!id || !target) return { ok: false, code: "NO_LAYER", message: "No layer to link." };
      if (!source) return { ok: false, code: "NO_SOURCE", message: `No layer "${a.sourceLayerId}".` };
      if (!isLinkable(a.targetProperty, target.archetype)) return { ok: false, code: "NOT_LINKABLE", message: `${a.targetProperty} can't be driven by a link (it must be a number, length or angle this layer has).` };
      if (!isLinkable(a.sourceProperty, source.archetype)) return { ok: false, code: "NOT_LINKABLE", message: `${a.sourceProperty} can't be read by a link (it must be a number, length or angle that layer has).` };
      if (a.curve !== undefined && parseEasing(a.curve) === null) return { ok: false, code: "BAD_CURVE", message: `"${a.curve}" isn't an easing.` };

      const existing = readLinks(target.properties);
      const slot = a.slot ?? existing.find((l) => l.target === a.targetProperty)?.slot ?? Array.from({ length: LINK_SLOTS }, (_, i) => i + 1).find((s) => !existing.some((l) => l.slot === s));
      if (slot === undefined) return { ok: false, code: "LINK_SLOTS_FULL", message: `A layer can have ${LINK_SLOTS} links.` };

      // the cycle check sees the document without the link this one replaces
      const without = { layers: { ...doc.layers, [id]: { ...target, properties: { ...target.properties, [linkPath(slot, "enabled")]: false } } } };
      const chain = linkCycleIf(without, id, { target: a.targetProperty, source: a.sourceLayerId, sourceProperty: a.sourceProperty });
      if (chain) return { ok: false, code: "LINK_CYCLE", chain: chain.map((n) => ({ layerId: n.layerId, property: n.property })), message: linkCycleMessage(doc, chain) };

      const suggested = a.map === undefined && a.inMin === undefined && a.inMax === undefined ? suggestMap(a.sourceProperty, a.targetProperty) : {};
      const map: Partial<Link> = { map: a.map, inMin: a.inMin, inMax: a.inMax, outMin: a.outMin, outMax: a.outMax, clamp: a.clamp, curve: a.curve, ...Object.fromEntries(Object.entries(suggested)) };
      const props: Record<string, PropValue | null> = {
        [linkPath(slot, "target")]: a.targetProperty,
        [linkPath(slot, "source")]: a.sourceLayerId,
        [linkPath(slot, "sourceProperty")]: a.sourceProperty,
        [linkPath(slot, "enabled")]: a.enabled ?? true,
      };
      for (const name of ["map", "inMin", "inMax", "outMin", "outMax", "clamp", "curve"] as const) if (map[name] !== undefined) props[linkPath(slot, name)] = map[name] as PropValue;
      setLayerProps([id], props, "Link property");
      return { ok: true, slot, description: describeChain(getDocument(), [{ layerId: id, property: a.targetProperty }, { layerId: a.sourceLayerId, property: a.sourceProperty }]) };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.removeLink", title: "Remove a Property Link", category: "Links",
    args: z.object({ id: z.string().optional(), slot: z.number().int().min(1).max(LINK_SLOTS).optional(), targetProperty: z.string().optional() }),
    run: ({ id, slot, targetProperty }) => {
      const layerId = id ?? selected();
      const layer = layerId ? getDocument().layers[layerId] : undefined;
      if (!layerId || !layer) return { removed: 0 };
      const found = readLinks(layer.properties).filter((l) => (slot === undefined || l.slot === slot) && (targetProperty === undefined || l.target === targetProperty));
      if (found.length === 0) return { removed: 0 };
      transaction("Remove link", () => {
        const patch: Record<string, PropValue | null> = {};
        for (const l of found) for (const name of LINK_SLOT_PARAMS) patch[linkPath(l.slot, name)] = null;
        setLayerProps([layerId], patch, "Remove link");
      });
      return { removed: found.length };
    },
  }));

  return () => offs.forEach((off) => off());
}
