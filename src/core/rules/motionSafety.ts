/**
 * Motion safety (ROADMAP Phase 93, second half): four checks on what a document animates, as one list a person can read
 * and fix. It adds no detector of its own where one exists: flashing is `exceedsFlashLimit` (`rules/accessibility.ts`,
 * the 3 flashes a second of WCAG 2.3.1), and what counts as something to tap is `interactiveIds` and `TOUCH_MIN`
 * (`core/playground`, the same 44 px the Playground's overlay marks). New here is how they are put together, the loop
 * rule and the focus rule.
 *
 *  - `flash`: a clip that flashes more than 3 times a second for as long as it plays. Error.
 *  - `long-loop`: motion that runs on its own for more than 5 seconds (or forever) with no way to pause it and not marked
 *    essential (WCAG 2.2.2). Warning.
 *  - `touch-target`: something to tap that is smaller than 44 px either way (WCAG 2.5.8). Warning.
 *  - `focus`: something that can be reached by keyboard or tap with no visible focus. Warning.
 */

import type { Clip, Layer, MotionDocument } from "../document/schema";
import { MAX_FLASHES_PER_SECOND, estimateFlashesPerSecond, exceedsFlashLimit } from "./accessibility";
import { TOUCH_MIN, interactiveIds } from "../playground/playground";
import { statesOf } from "../states/states";

export const SAFETY_RULES = ["flash", "long-loop", "touch-target", "focus"] as const;
export type SafetyRule = (typeof SAFETY_RULES)[number];
/** Motion that runs on its own for longer than this needs a way to pause it. */
export const PAUSE_AFTER_SECONDS = 5;

export interface SafetyFix {
  label: string;
  command: string;
  args: Record<string, unknown>;
}

export interface SafetyFinding {
  rule: SafetyRule;
  severity: "error" | "warning";
  layerId: string;
  clipId?: string;
  message: string;
  fix?: SafetyFix;
}

const USER_STARTED = new Set(["hover", "press", "custom", "focus", "tap", "click"]);

/** How long a clip runs on its own: infinity for a loop with no end. */
export function runTimeOf(clip: Clip): number {
  const sustained = clip.repeat === -1 || (clip.repeat === undefined && clip.type === "loop");
  if (sustained) return Number.POSITIVE_INFINITY;
  return (clip.delay ?? 0) + clip.duration * ((clip.repeat ?? 0) + 1) + (clip.repeatDelay ?? 0) * (clip.repeat ?? 0);
}

const flag = (layer: Layer, path: string): boolean => layer.properties[path] === true;

function size(layer: Layer): { w: number; h: number } | null {
  const w = layer.properties["frame.width"], h = layer.properties["frame.height"];
  return typeof w === "number" && typeof h === "number" && w > 0 && h > 0 ? { w, h } : null;
}

/** The findings for one layer, or for every layer when none is given. Pure: the same document gives the same list. */
export function motionSafety(doc: MotionDocument, layerId?: string): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  const tappable = interactiveIds(doc);
  const ids = layerId ? [layerId] : Object.keys(doc.layers);
  for (const id of ids) {
    const layer = doc.layers[id];
    if (!layer) continue;

    for (const clip of Object.values(doc.clips)) {
      if (clip.layerId !== id || !clip.enabled) continue;
      if (exceedsFlashLimit(clip)) {
        const rate = estimateFlashesPerSecond(clip);
        out.push({
          rule: "flash", severity: "error", layerId: id, clipId: clip.id,
          message: `"${clip.name}" flashes about ${rate.toFixed(1)} times a second. More than ${MAX_FLASHES_PER_SECOND} can trigger seizures.`,
          fix: { label: "Slow it down", command: "motionSafety.slowFlashing", args: { clipId: clip.id } },
        });
      }
      if (!USER_STARTED.has(clip.trigger) && !flag(layer, "motion.essential") && !flag(layer, "motion.pausable") && runTimeOf(clip) > PAUSE_AFTER_SECONDS) {
        const forever = runTimeOf(clip) === Number.POSITIVE_INFINITY;
        out.push({
          rule: "long-loop", severity: "warning", layerId: id, clipId: clip.id,
          message: `"${clip.name}" ${forever ? "never stops" : `runs for ${Math.round(runTimeOf(clip))} seconds`} and a visitor can't pause it.`,
          fix: { label: "Let visitors pause it", command: "layer.setMotionSafety", args: { ids: [id], pausable: true } },
        });
      }
    }

    if (tappable.has(id)) {
      const s = size(layer);
      if (s && (s.w < TOUCH_MIN || s.h < TOUCH_MIN)) {
        out.push({
          rule: "touch-target", severity: "warning", layerId: id,
          message: `"${layer.name}" is ${Math.round(s.w)} × ${Math.round(s.h)} px. Things to tap should be at least ${TOUCH_MIN} × ${TOUCH_MIN}.`,
          fix: { label: `Make it ${TOUCH_MIN} px`, command: "motionSafety.growToTouchTarget", args: { ids: [id] } },
        });
      }
      const ring = layer.archetype === "button" && Number(layer.properties["button.focusRingWidth"] ?? 2) > 0;
      const hasFocus = statesOf(doc, id).some((st) => st.name === "focus");
      if (!ring && !hasFocus) {
        out.push({
          rule: "focus", severity: "warning", layerId: id,
          message: `"${layer.name}" can be reached by keyboard but shows nothing when it has focus.`,
          fix: { label: "Add a Focus state", command: "layer.addState", args: { id, name: "focus" } },
        });
      }
    }
  }
  return out;
}

/** Counts by rule, for a summary line. */
export function safetySummary(findings: readonly SafetyFinding[]): Record<SafetyRule, number> {
  const out = { flash: 0, "long-loop": 0, "touch-target": 0, focus: 0 } as Record<SafetyRule, number>;
  for (const f of findings) out[f.rule]++;
  return out;
}
