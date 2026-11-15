/**
 * Colour tools in the document (ROADMAP Phase 123), each one undo step: save colours as colour tokens (a palette from a
 * picture, a harmony, a tint-and-shade scale), and fix a text's contrast against what is behind it.
 */

import { getDocument } from "../store/documentState";
import { parseColor, toHex, type Rgba } from "../paint/colorMath";
import { createVariable } from "../tokens/tokenOps";
import { harmony, suggestPassing, tintsAndShades, type ContrastTarget, type HarmonyRule } from "../paint/colorTools";
import { setLayerProps, transaction } from "./editOps";

const hex = (c: Rgba) => toHex({ ...c, a: 1 }).toUpperCase();

/** Saves colours as colour tokens named `<name>/<label>`. Returns their ids (one per colour saved). */
export function saveColorTokens(name: string, colors: readonly { label: string; color: string }[]): string[] {
  const group = name.trim().replace(/\/+$/, "").slice(0, 80) || "Palette";
  return transaction("Save colours as tokens", () =>
    colors
      .map(({ label, color }) => {
        const c = parseColor(color);
        return c ? createVariable(`${group}/${label}`, "color", { value: hex(c) }) : null;
      })
      .filter((id): id is string => id !== null),
  );
}

/** A palette (most common colour first) saved as tokens `<name>/1`, `<name>/2` … */
export const savePalette = (name: string, colors: readonly string[]): string[] => saveColorTokens(name, colors.map((color, i) => ({ label: String(i + 1), color })));

/** A harmony around `base` saved as tokens: `<name>/base`, then `<name>/2` … */
export function saveHarmony(name: string, base: string, rule: HarmonyRule): string[] {
  const c = parseColor(base);
  if (!c) return [];
  return saveColorTokens(name, harmony(c, rule).map((x, i) => ({ label: i === 0 && rule !== "monochrome" ? "base" : String(i + 1), color: hex(x) })));
}

/** Tints and shades of `base` saved as tokens `<name>/50` … `<name>/950`. */
export function saveScale(name: string, base: string): string[] {
  const c = parseColor(base);
  return c ? saveColorTokens(name, tintsAndShades(c).map((s) => ({ label: String(s.step), color: hex(s.color) }))) : [];
}

/** The colour behind a layer: the nearest parent with an opaque enough background (white when none has one). */
export function backgroundBehind(id: string): Rgba {
  const layers = getDocument().layers;
  let at = layers[id]?.parentId ?? null;
  for (let guard = 0; at && guard < 1000; guard++) {
    const l = layers[at];
    if (!l) break;
    const v = l.properties["appearance.background.color"];
    const c = typeof v === "string" ? parseColor(v) : null;
    if (c && c.a >= 0.5) return { ...c, a: 1 };
    at = l.parentId;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** A text's colour (its `typography.color`, black when unset). */
export function textColorOf(id: string): Rgba {
  const v = getDocument().layers[id]?.properties["typography.color"];
  return (typeof v === "string" ? parseColor(v) : null) ?? { r: 0, g: 0, b: 0, a: 1 };
}

/** Gives each text the nearest colour that reaches the target on what's behind it. Returns how many changed. */
export function fixContrast(ids: readonly string[], target: ContrastTarget): number {
  return transaction("Fix contrast", () => {
    let changed = 0;
    for (const id of ids) {
      if (getDocument().layers[id]?.archetype !== "text") continue;
      const now = textColorOf(id);
      const next = suggestPassing(now, backgroundBehind(id), target);
      if (next && hex(next) !== hex(now)) changed += setLayerProps([id], { "typography.color": hex(next) }, "Fix contrast");
    }
    return changed;
  });
}
