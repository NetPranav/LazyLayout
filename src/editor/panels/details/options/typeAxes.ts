import { axesFor, parseVariations, serializeVariations } from "@/core/fonts/families";
import type { FontAxis } from "@/core/fonts/catalog";

/** The axes a text's font offers as sliders (Phase 125): weight first, then the font's own (width, optical size …). */
export function axisSliders(family: string | null): FontAxis[] {
  // weight over the whole CSS range (1–1000); a variable font draws what it has
  return [{ tag: "wght", name: "Weight", min: 1, max: 1000, default: 400 }, ...axesFor(family)];
}

/** An axis's value on a layer: from `typography.fontVariations`; weight falls back to `typography.fontWeight`. */
export function axisValue(props: Readonly<Record<string, unknown>>, axis: FontAxis): number {
  const own = parseVariations(String(props["typography.fontVariations"] ?? "")).find((v) => v.tag === axis.tag)?.value;
  if (axis.tag === "wght") {
    if (own !== undefined) return own;
    const w = Number(props["typography.fontWeight"] ?? 400);
    return Number.isFinite(w) ? w : 400;
  }
  return own ?? axis.default;
}

/** The properties that set an axis to `value` (weight: the exact `wght` variation and the nearest hundred as the weight). */
export function axisPatch(props: Readonly<Record<string, unknown>>, axis: FontAxis, value: number): Record<string, string> {
  const rest = parseVariations(String(props["typography.fontVariations"] ?? "")).filter((v) => v.tag !== axis.tag);
  const variations = { "typography.fontVariations": serializeVariations([...rest, { tag: axis.tag, value }]) };
  // the weight: exact on a variable font's axis, and the nearest hundred as the weight (what a static font shows)
  if (axis.tag === "wght") return { ...variations, "typography.fontWeight": String(Math.min(900, Math.max(100, Math.round(value / 100) * 100))) };
  return variations;
}
