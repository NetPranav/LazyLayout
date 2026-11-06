/**
 * Which document property an inspector field really is, for the layer it is shown for.
 *
 * The Fill and Stroke sections speak in a box's terms (`appearance.background.color`, `appearance.border.*`). A shape, a
 * line or a star is not a box: the engine paints it from `svg.fill`, `svg.stroke` and `svg.strokeWidth`, so a box colour
 * written to it changes nothing on the canvas. This maps the field to the property the layer is painted by, in one place,
 * so every section keeps working the way it does and nothing in the sections changes.
 */

import { isPropertyLegalFor, getPropertyDefinition } from "@/core/document/properties";
import type { Layer } from "@/core/document/schema";
import type { PropValue } from "@/core/document/registry";

/** Painted as an SVG shape (rectangle, ellipse, polygon, star, line, arrow, path, icon). */
export const isSvgPainted = (layer: Pick<Layer, "archetype">): boolean => isPropertyLegalFor("svg.fill", layer.archetype);

const SHAPE_KEY: Record<string, string> = {
  "appearance.background.color": "svg.fill",
  backgroundColor: "svg.fill",
  "appearance.border.color": "svg.stroke",
  "appearance.border.width": "svg.strokeWidth",
};

/** How a border style is written on an SVG layer. */
const DASH: Record<string, string> = { solid: "none", dashed: "8 6", dotted: "1 6" };

/** The property to read or write for `key` on this layer. */
export function propertyFor(layer: Pick<Layer, "archetype">, key: string): string {
  if (!isSvgPainted(layer)) return key;
  if (key === "appearance.border.style") return "svg.strokeDasharray";
  return SHAPE_KEY[key] ?? key;
}

/** The value to write to `propertyFor(layer, key)`. */
export function valueFor(layer: Pick<Layer, "archetype">, key: string, value: PropValue | null): PropValue | null {
  if (isSvgPainted(layer) && key === "appearance.border.style" && typeof value === "string") return DASH[value] ?? "none";
  return value;
}

/** What a field shows when a layer has not set it: the engine's default for these, never "Mixed" (Mixed means layers differ). */
const DEFAULTED = new Set(["frame.rotation", "appearance.opacity", "appearance.radius"]);

/** The value a field shows for this layer, or undefined when the layer has none. A colour of "none" or "currentColor" is no colour. */
export function readFor(layer: Pick<Layer, "archetype" | "properties">, key: string): PropValue | undefined {
  const real = propertyFor(layer, key);
  let v: PropValue | undefined = layer.properties?.[real];
  if (v === undefined && DEFAULTED.has(key)) v = getPropertyDefinition(key)?.default;
  if (typeof v === "string" && (real === "svg.fill" || real === "svg.stroke") && (v === "none" || v === "currentColor")) return undefined;
  return v;
}
