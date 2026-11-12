import { z } from "zod";
import { defineTypedCommand } from "../commands";
import { setLayerProps, transaction } from "../editing/editOps";
import type { PropValue } from "../document/registry";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { FX_DEFAULTS, FX_PARAMS, FX_SLOTS, FX_SLOT_PARAMS, FX_TYPES, fxPath, readStack, type FxType } from "./fxStack";
import { readerOf } from "./compositing";

/**
 * Effect stack commands (ROADMAP Phase 75, Law 20): add an effect, change its parameters, switch it off, reorder and
 * remove, and the motion blur switch and shutter. Each acts on the selected layers unless given ids and is one undo
 * step. The stack is the layer's `fx.N.*` properties (`fxStack.ts`); slot order is list order.
 */
const ids = () => useSelectionStore.getState().selectedIds;
const targets = z.array(z.string()).optional();

type SlotSnapshot = Record<string, PropValue>;

/** Every property of a slot as it is on the layer (only the ones that are set). */
function snapshot(props: Readonly<Record<string, PropValue>>, slot: number): SlotSnapshot {
  const out: SlotSnapshot = {};
  for (const name of FX_SLOT_PARAMS) {
    const v = props[fxPath(slot, name)];
    if (v !== undefined) out[name] = v;
  }
  return out;
}

/** Rewrites the layer's slots to hold exactly `list`, in order (and clears the ones after). */
function writeSlots(layerId: string, list: readonly SlotSnapshot[], label: string): void {
  const patch: Record<string, PropValue | null> = {};
  for (let slot = 1; slot <= FX_SLOTS; slot++) {
    const entry = list[slot - 1];
    for (const name of FX_SLOT_PARAMS) patch[fxPath(slot, name)] = entry && entry[name] !== undefined ? entry[name] : null;
  }
  setLayerProps([layerId], patch, label);
}

/** The slots that hold an effect, in order, as snapshots (with the slot each came from). */
function occupied(props: Readonly<Record<string, PropValue>>): Array<{ slot: number; entry: SlotSnapshot }> {
  const list: Array<{ slot: number; entry: SlotSnapshot }> = [];
  for (let slot = 1; slot <= FX_SLOTS; slot++) {
    const s = snapshot(props, slot);
    if (typeof s.type === "string" && (FX_TYPES as readonly string[]).includes(s.type)) list.push({ slot, entry: s });
  }
  return list;
}

export function registerFxCommands(): () => void {
  const offs: Array<() => void> = [];
  const add = (off: () => void) => offs.push(off);

  add(defineTypedCommand({
    id: "layer.addEffect", title: "Add an Effect to the Stack", category: "Effects",
    args: z.object({ ids: targets, type: z.enum(FX_TYPES), params: z.record(z.string(), z.union([z.number(), z.string()])).optional(), at: z.number().int().min(1).max(FX_SLOTS).optional() }),
    run: ({ ids: t, type, params, at }) => {
      const added: Array<{ layerId: string; slot: number }> = [];
      const refused: string[] = [];
      transaction("Add effect", () => {
        for (const id of t ?? ids()) {
          const layer = getDocument().layers[id];
          if (!layer || layer.locked === true) continue;
          const list = occupied(layer.properties).map((o) => o.entry);
          if (list.length >= FX_SLOTS) {
            refused.push(id);
            continue;
          }
          const entry: SlotSnapshot = { type, enabled: true, ...FX_DEFAULTS[type], ...Object.fromEntries(Object.entries(params ?? {}).filter(([k]) => FX_PARAMS[type].includes(k))) };
          const position = Math.min(list.length, (at ?? list.length + 1) - 1);
          list.splice(position, 0, entry);
          writeSlots(id, list, "Add effect");
          added.push({ layerId: id, slot: position + 1 });
        }
      });
      return { added, refused };
    },
  }));

  add(defineTypedCommand({
    id: "layer.setEffect", title: "Change an Effect's Settings", category: "Effects",
    args: z.object({ ids: targets, slot: z.number().int().min(1).max(FX_SLOTS), enabled: z.boolean().optional(), params: z.record(z.string(), z.union([z.number(), z.string()])).optional() }),
    run: ({ ids: t, slot, enabled, params }) => {
      let changed = 0;
      transaction("Change effect", () => {
        for (const id of t ?? ids()) {
          const layer = getDocument().layers[id];
          if (!layer) continue;
          const stack = readStack(readerOf(layer.properties as Record<string, PropValue>));
          const effect = stack.find((e) => e.slot === slot);
          if (!effect) continue;
          const patch: Record<string, PropValue> = {};
          if (enabled !== undefined) patch[fxPath(slot, "enabled")] = enabled;
          for (const [name, value] of Object.entries(params ?? {})) if (FX_PARAMS[effect.type].includes(name)) patch[fxPath(slot, name)] = value;
          if (Object.keys(patch).length > 0) changed += setLayerProps([id], patch, "Change effect");
        }
      });
      return { changed };
    },
  }));

  add(defineTypedCommand({
    id: "layer.removeEffect", title: "Remove an Effect from the Stack", category: "Effects",
    args: z.object({ ids: targets, slot: z.number().int().min(1).max(FX_SLOTS) }),
    run: ({ ids: t, slot }) => {
      let removed = 0;
      transaction("Remove effect", () => {
        for (const id of t ?? ids()) {
          const layer = getDocument().layers[id];
          if (!layer || layer.locked === true) continue;
          const list = occupied(layer.properties);
          if (!list.some((o) => o.slot === slot)) continue;
          writeSlots(id, list.filter((o) => o.slot !== slot).map((o) => o.entry), "Remove effect");
          removed++;
        }
      });
      return { removed };
    },
  }));

  add(defineTypedCommand({
    id: "layer.moveEffect", title: "Move an Effect Up or Down the Stack", category: "Effects",
    args: z.object({ ids: targets, slot: z.number().int().min(1).max(FX_SLOTS), to: z.number().int().min(1).max(FX_SLOTS) }),
    run: ({ ids: t, slot, to }) => {
      let moved = 0;
      transaction("Reorder effects", () => {
        for (const id of t ?? ids()) {
          const layer = getDocument().layers[id];
          if (!layer || layer.locked === true) continue;
          const list = occupied(layer.properties);
          const target = list.find((o) => o.slot === slot);
          if (!target) continue;
          const without = list.filter((o) => o !== target);
          without.splice(Math.min(without.length, to - 1), 0, target);
          if (without.every((o, i) => o === list[i])) continue;
          writeSlots(id, without.map((o) => o.entry), "Reorder effects");
          moved++;
        }
      });
      return { moved };
    },
  }));

  add(defineTypedCommand({
    id: "layer.setMotionBlur", title: "Motion Blur On or Off, and Its Shutter Angle", category: "Effects",
    args: z.object({ ids: targets, on: z.boolean().optional(), shutterAngle: z.number().min(1).max(720).optional() }),
    run: ({ ids: t, on, shutterAngle }) => {
      let changed = 0;
      transaction("Motion blur", () => {
        const chosen = (t ?? ids()).filter((id) => getDocument().layers[id]);
        if (on !== undefined) for (const id of chosen) if ((getDocument().layers[id].motionBlur === true) !== on) {
          documentCommands.setLayerFlags(id, { motionBlur: on || undefined });
          changed++;
        }
        if (shutterAngle !== undefined) changed += setLayerProps(chosen, { "motion.shutterAngle": shutterAngle }, "Set shutter angle");
      });
      return { changed };
    },
  }));

  return () => offs.forEach((off) => off());
}

export type { FxType };
