/** Motion safety commands (ROADMAP Phase 93, Law 20): the fixes the safety list offers, each one undo step. */
import { z } from "zod";
import { defineTypedCommand } from "../commands";
import type { PropValue } from "../document/registry";
import { setLayerProps, transaction } from "../editing/editOps";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { TOUCH_MIN } from "../playground/playground";
import { MAX_FLASHES_PER_SECOND, estimateFlashesPerSecond } from "./accessibility";

const selected = () => useSelectionStore.getState().selectedIds;

export function registerMotionSafetyCommands(): () => void {
  const category = "Accessibility";
  const offs: Array<() => void> = [];

  offs.push(defineTypedCommand({
    id: "layer.setMotionSafety", title: "Mark a Layer's Motion Essential or Pausable", category,
    args: z.object({ ids: z.array(z.string()).optional(), essential: z.boolean().optional(), pausable: z.boolean().optional() }),
    run: ({ ids, essential, pausable }) => {
      const doc = getDocument();
      const chosen = (ids ?? selected()).filter((id) => doc.layers[id] && doc.layers[id].locked !== true);
      const patch: Record<string, PropValue | null> = {};
      if (essential !== undefined) patch["motion.essential"] = essential ? true : null;
      if (pausable !== undefined) patch["motion.pausable"] = pausable ? true : null;
      if (chosen.length === 0 || Object.keys(patch).length === 0) return { ok: true, changed: 0 };
      return { ok: true, changed: setLayerProps(chosen, patch, "Set motion safety") };
    },
  }));

  offs.push(defineTypedCommand({
    id: "motionSafety.growToTouchTarget", title: "Make a Tap Target 44 px", category,
    args: z.object({ ids: z.array(z.string()).optional() }),
    run: ({ ids }) => {
      const doc = getDocument();
      let changed = 0;
      transaction("Make tap target 44 px", () => {
        for (const id of ids ?? selected()) {
          const l = doc.layers[id];
          const w = l?.properties["frame.width"], h = l?.properties["frame.height"];
          if (!l || l.locked === true || typeof w !== "number" || typeof h !== "number") continue;
          changed += setLayerProps([id], { "frame.width": Math.max(w, TOUCH_MIN), "frame.height": Math.max(h, TOUCH_MIN) }, "Make tap target 44 px");
        }
      });
      return { ok: true, changed };
    },
  }));

  offs.push(defineTypedCommand({
    id: "motionSafety.slowFlashing", title: "Slow a Flashing Animation Down", category,
    args: z.object({ clipId: z.string() }),
    run: ({ clipId }) => {
      const clip = getDocument().clips[clipId];
      if (!clip) return { ok: false, code: "NO_CLIP", message: "That animation is gone." };
      const rate = estimateFlashesPerSecond(clip);
      if (rate <= MAX_FLASHES_PER_SECOND) return { ok: true, changed: 0 };
      // a little under the limit, so it is not right at the edge
      const k = (rate / (MAX_FLASHES_PER_SECOND * 0.9));
      documentCommands.mutate("Slow flashing down", (draft) => {
        const c = draft.clips[clipId];
        c.duration = Math.round(c.duration * k * 1e6) / 1e6;
        for (const t of c.tracks) for (const kf of t.keyframes) kf.time = Math.round(kf.time * k * 1e6) / 1e6;
        if (c.repeatDelay) c.repeatDelay = Math.round(c.repeatDelay * k * 1e6) / 1e6;
      });
      return { ok: true, changed: 1, by: k };
    },
  }));
  return () => offs.forEach((off) => off());
}
