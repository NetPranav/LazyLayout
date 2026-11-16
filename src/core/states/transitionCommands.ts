/** Transition commands (ROADMAP Phase 79, Law 20): how a layer moves between its states, and the properties that move on a transition of their own. One undo step each. */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import type { PropValue } from "../document/registry";
import { setLayerProps, transaction } from "../editing/editOps";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { statePaths } from "./states";
import { PRESENCE_KINDS } from "../engine/motion/layoutMotion";
import { MOTION_AT_PATHS, REDUCED_POLICIES, layerAtBreakpoint, motionAtOf, reducedPolicyOf } from "../breakpoints/breakpointMotion";
import { useMotionPreferenceStore } from "../store/useMotionPreferenceStore";
import { editBreakpointId } from "../store/useBreakpointStore";
import { documentCommands } from "../store/useDocumentStore";
import { TRANSITION_CURVES, TRANSITION_OVERRIDES, TRANSITION_TYPES, overridePath } from "./transitions";

const selected = () => useSelectionStore.getState().selectedIds;

export function registerTransitionCommands(): () => void {
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.setTransition", title: "Set How a Layer Moves Between States", category: "States",
    args: z.object({ ids: z.array(z.string()).optional(), type: z.enum(TRANSITION_TYPES).optional(), duration: z.number().min(0.01).max(10).optional(), bounce: z.number().min(0).max(1).optional(), curve: z.enum(TRANSITION_CURVES).optional() }),
    run: ({ ids, type, duration, bounce, curve }) => {
      const doc = getDocument();
      const chosen = (ids ?? selected()).filter((id) => doc.layers[id] && doc.layers[id].locked !== true);
      const patch: Record<string, PropValue> = {};
      if (type !== undefined) patch["transition.type"] = type;
      if (duration !== undefined) patch["transition.duration"] = duration;
      if (bounce !== undefined) patch["transition.bounce"] = bounce;
      if (curve !== undefined) patch["transition.curve"] = curve;
      if (chosen.length === 0 || Object.keys(patch).length === 0) return { ok: true, changed: 0 };
      return { ok: true, changed: setLayerProps(chosen, patch, "Set transition") };
    },
  }));

  offs.push(defineTypedCommand({
    id: "layer.setTransitionOverride", title: "Give One Property Its Own Transition", category: "States",
    args: z.object({
      id: z.string().optional(),
      /** 1 to 3; left out, the property's own slot or the first free one is used. */
      slot: z.number().int().min(1).max(TRANSITION_OVERRIDES).optional(),
      /** The property path; null clears the slot. */
      property: z.string().nullable(),
      type: z.enum(TRANSITION_TYPES).optional(),
      duration: z.number().min(0.01).max(10).optional(),
      bounce: z.number().min(0).max(1).optional(),
    }),
    run: ({ id, slot, property, type, duration, bounce }) => {
      const doc = getDocument();
      const layerId = id ?? selected()[0];
      const layer = layerId ? doc.layers[layerId] : undefined;
      if (!layerId || !layer) return { ok: false, code: "NO_LAYER", message: "No layer to set a transition on." };
      const at = (n: number) => layer.properties[overridePath(n, "property")];
      const slots = Array.from({ length: TRANSITION_OVERRIDES }, (_, i) => i + 1);
      if (property === null) {
        if (!slot) return { ok: false, code: "NO_SLOT", message: "Say which one to remove." };
        const patch: Record<string, PropValue | null> = {};
        for (const name of ["property", "type", "duration", "bounce"] as const) patch[overridePath(slot, name)] = null;
        setLayerProps([layerId], patch, "Remove property transition");
        return { ok: true, slot };
      }
      if (!statePaths(doc, layerId).has(property)) return { ok: false, code: "NOT_IN_A_STATE", message: "None of this layer's states changes that property, so there is nothing for it to move between." };
      const target = slot ?? slots.find((n) => at(n) === property) ?? slots.find((n) => typeof at(n) !== "string" || at(n) === "");
      if (!target) return { ok: false, code: "FULL", message: `A layer holds at most ${TRANSITION_OVERRIDES} property transitions.` };
      if (slots.some((n) => n !== target && at(n) === property)) return { ok: false, code: "DUPLICATE", message: "That property already has a transition of its own." };
      const patch: Record<string, PropValue> = { [overridePath(target, "property")]: property };
      if (type !== undefined) patch[overridePath(target, "type")] = type;
      if (duration !== undefined) patch[overridePath(target, "duration")] = duration;
      if (bounce !== undefined) patch[overridePath(target, "bounce")] = bounce;
      setLayerProps([layerId], patch, "Set property transition");
      return { ok: true, slot: target };
    },
  }));

  // Phase 87: layout changes animate; a way to appear and to disappear
  offs.push(defineTypedCommand({
    id: "layer.setLayoutMotion", title: "Animate a Layer's Layout Changes, Entrance and Exit", category: "States",
    args: z.object({ ids: z.array(z.string()).optional(), on: z.boolean().optional(), enter: z.enum(PRESENCE_KINDS).optional(), exit: z.enum(PRESENCE_KINDS).optional() }),
    run: ({ ids, on, enter, exit }) => {
      const doc = getDocument();
      const chosen = (ids ?? selected()).filter((id) => doc.layers[id] && doc.layers[id].locked !== true);
      const patch: Record<string, PropValue | null> = {};
      if (on !== undefined) patch["layoutMotion.on"] = on ? true : null;
      if (enter !== undefined) patch["presence.enter"] = enter === "none" ? null : enter;
      if (exit !== undefined) patch["presence.exit"] = exit === "none" ? null : exit;
      if (chosen.length === 0 || Object.keys(patch).length === 0) return { ok: true, changed: 0 };
      return { ok: true, changed: setLayerProps(chosen, patch, "Set layout motion") };
    },
  }));

  // Phase 88: how a layer's motion plays, at the breakpoint being viewed (the base when none is)
  offs.push(defineTypedCommand({
    id: "layer.setMotionAt", title: "Set How a Layer's Motion Plays at This Breakpoint", category: "Motion",
    args: z.object({
      ids: z.array(z.string()).optional(),
      plays: z.boolean().optional(),
      timeScale: z.number().min(0.1).max(10).optional(),
      distance: z.number().min(0).max(4).optional(),
      loops: z.boolean().optional(),
      /** Phase 93: what is left of the animation under reduced motion. */
      reduced: z.enum(REDUCED_POLICIES).optional(),
      /** Takes the four settings off at this breakpoint: it plays as the larger one does. */
      reset: z.boolean().optional(),
    }),
    run: ({ ids, plays, timeScale, distance, loops, reduced, reset }) => {
      const doc = getDocument();
      const chosen = (ids ?? selected()).filter((id) => doc.layers[id] && doc.layers[id].locked !== true);
      if (chosen.length === 0) return { ok: true, changed: 0 };
      const viewed = editBreakpointId();
      let changed = 0;
      transaction("Set motion at breakpoint", () => {
        if (reset) {
          if (viewed) documentCommands.resetOverrides(chosen, viewed, [...MOTION_AT_PATHS]);
          else changed += setLayerProps(chosen, Object.fromEntries(MOTION_AT_PATHS.map((path) => [path, null])), "Set motion at breakpoint");
          if (viewed) changed = chosen.length;
        }
        for (const id of chosen) {
          // only what differs from what the layer already does here is written, so nothing is stored that says "as before"
          const now = motionAtOf(layerAtBreakpoint(getDocument(), getDocument().layers[id], viewed).properties);
          const patch: Record<string, PropValue | null> = {};
          if (plays !== undefined && plays !== now.plays) patch["motion.plays"] = plays;
          if (timeScale !== undefined && timeScale !== now.timeScale) patch["motion.timeScale"] = timeScale;
          if (distance !== undefined && distance !== now.distance) patch["motion.distance"] = distance;
          if (loops !== undefined && loops !== now.loops) patch["motion.loops"] = loops;
          if (reduced !== undefined && reduced !== reducedPolicyOf(layerAtBreakpoint(getDocument(), getDocument().layers[id], viewed).properties)) patch["motion.reduced"] = reduced === "auto" ? null : reduced;
          if (Object.keys(patch).length > 0) changed += setLayerProps([id], patch, "Set motion at breakpoint") > 0 && !reset ? 1 : 0;
        }
      });
      return { ok: true, changed };
    },
  }));

  // Phase 93: draw the canvas as reduced motion gets it
  offs.push(defineTypedCommand({
    id: "view.reducedMotion", title: "Preview: Show as Reduced Motion", category: "View",
    args: z.object({ on: z.boolean().optional() }).default({}),
    run: ({ on }) => {
      const next = on ?? !useMotionPreferenceStore.getState().reduced;
      useMotionPreferenceStore.getState().setReduced(next);
      return { ok: true, on: next };
    },
  }));

  return () => offs.forEach((off) => off());
}
