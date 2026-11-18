/** Motion library commands (ROADMAP Phase 91, Law 20): insert an effect on layers, tune its props, detach it into plain clips, or remove it. One undo step each. */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { hydrateClip } from "../document/factories";
import type { EffectInstance } from "../document/schema";
import { transaction } from "../editing/editOps";
import { createId } from "../ids";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { animationOf, getEffect, overridesOf, whyNotOn, type LibraryValues } from "./library";

const selected = () => useSelectionStore.getState().selectedIds;
const VALUES = z.object({ duration: z.number(), delay: z.number(), strength: z.number(), stagger: z.number() }).partial();

/** The clip an instance plays has an id made from the instance's, so it can be found again without storing anything more. */
export const clipIdOf = (instanceId: string): string => `clip_${instanceId}`;

/** The instances of the library on a layer. */
export function instancesOn(layerId: string): EffectInstance[] {
  return Object.values(getDocument().effects).filter((fx) => fx.layerId === layerId && getEffect(fx.effectId) !== undefined && getDocument().clips[clipIdOf(fx.id)] !== undefined);
}

/** The values an instance has: its overrides over the effect's defaults. */
export function valuesOf(instance: EffectInstance): Record<string, number> {
  const effect = getEffect(instance.effectId);
  const out: Record<string, number> = {};
  for (const p of effect?.props ?? []) {
    const v = instance.propOverrides[p.key];
    out[p.key] = typeof v === "number" ? v : p.default;
  }
  return out;
}

export function registerLibraryCommands(): () => void {
  const category = "Library";
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "library.insert", title: "Insert a Library Effect", category,
    args: z.object({ effectId: z.string(), ids: z.array(z.string()).optional(), values: VALUES.optional() }),
    run: ({ effectId, ids, values }) => {
      const effect = getEffect(effectId);
      if (!effect) return { ok: false, code: "NO_EFFECT", message: "That effect is not in the library." };
      const doc = getDocument();
      const chosen = (ids ?? selected()).filter((id) => doc.layers[id]);
      if (chosen.length === 0) return { ok: false, code: "NO_LAYER", message: "Select a layer to put the effect on." };
      const refused = chosen.map((id) => whyNotOn(effect, doc.layers[id].archetype)).find((r) => r !== null);
      if (refused) return { ok: false, code: "NOT_FOR_THIS_LAYER", message: refused };
      const overrides = overridesOf(effect, (values ?? {}) as LibraryValues);
      const made: string[] = [];
      transaction(`Insert ${effect.name}`, () => {
        for (const layerId of chosen) {
          const id = createId("fxi");
          const template = { ...hydrateClip(animationOf(effect, overrides)), id: clipIdOf(id) };
          documentCommands.addClip(layerId, template, `Insert ${effect.name}`);
          documentCommands.mutate(`Insert ${effect.name}`, (draft) => {
            draft.effects[id] = { id, layerId, effectId: effect.id, version: effect.version, propOverrides: overrides, bindingOverrides: {}, seed: 0 };
          });
          made.push(id);
        }
      });
      return { ok: true, instances: made };
    },
  }));

  offs.push(defineTypedCommand({
    id: "library.setProps", title: "Change a Library Effect", category,
    args: z.object({ instance: z.string(), values: VALUES }),
    run: ({ instance, values }) => {
      const doc = getDocument();
      const fx = doc.effects[instance];
      const effect = fx ? getEffect(fx.effectId) : undefined;
      if (!fx || !effect) return { ok: false, code: "NO_INSTANCE", message: "That effect is not on the page any more." };
      const next = overridesOf(effect, { ...valuesOf(fx), ...(values as LibraryValues) });
      const old = doc.clips[clipIdOf(instance)];
      transaction(`Change ${effect.name}`, () => {
        if (old) documentCommands.removeClip(old.id, `Change ${effect.name}`);
        documentCommands.addClip(fx.layerId, { ...hydrateClip(animationOf(effect, next)), id: clipIdOf(instance), enabled: old?.enabled ?? true }, `Change ${effect.name}`);
        documentCommands.mutate(`Change ${effect.name}`, (draft) => {
          draft.effects[instance].propOverrides = next;
        });
      });
      return { ok: true };
    },
  }));

  offs.push(defineTypedCommand({
    id: "library.detach", title: "Detach a Library Effect", category,
    args: z.object({ instance: z.string() }),
    run: ({ instance }) => {
      if (!getDocument().effects[instance]) return { ok: false, code: "NO_INSTANCE", message: "That effect is not on the page any more." };
      documentCommands.mutate("Detach effect", (draft) => void delete draft.effects[instance]);
      return { ok: true };
    },
  }));

  offs.push(defineTypedCommand({
    id: "library.remove", title: "Remove a Library Effect", category,
    args: z.object({ instance: z.string() }),
    run: ({ instance }) => {
      if (!getDocument().effects[instance]) return { ok: false, code: "NO_INSTANCE", message: "That effect is not on the page any more." };
      documentCommands.mutate("Remove effect", (draft) => {
        delete draft.effects[instance];
        delete draft.clips[clipIdOf(instance)];
      });
      return { ok: true };
    },
  }));
  return () => offs.forEach((off) => off());
}
