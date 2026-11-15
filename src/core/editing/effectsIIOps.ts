/**
 * Layer effects II edits (ROADMAP Phase 121) that set several properties at once, each one undo step.
 */

import { getDocument } from "../store/documentState";
import { isPropertyLegalFor } from "../document/properties";
import { frostedGlassProps } from "../paint/effectsII";
import { setLayerProps, transaction } from "./editOps";

/** Makes each layer frosted glass (a background blur, a light tint, an edge light, a little grain). Returns how many changed. */
export function applyFrostedGlass(ids: readonly string[]): number {
  return transaction("Frosted glass", () => {
    let changed = 0;
    for (const id of ids) {
      const l = getDocument().layers[id];
      if (!l || !isPropertyLegalFor("paint.backgroundBlur", l.archetype)) continue;
      const props = Object.fromEntries(Object.entries(frostedGlassProps(l.properties)).filter(([k]) => isPropertyLegalFor(k, l.archetype)));
      changed += setLayerProps([id], props, "Frosted glass");
    }
    return changed;
  });
}
