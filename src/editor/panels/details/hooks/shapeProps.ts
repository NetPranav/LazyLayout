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

/** A rectangle's corners live under `shape.cornerRadius` (it is an SVG shape, so the box radius is not what draws). */
const RECT_KEY: Record<string, string> = {
  "appearance.radius": "shape.cornerRadius",
  borderRadius: "shape.cornerRadius",
  "appearance.radiusTopLeft": "shape.cornerRadius.topLeft",
  "appearance.radiusTopRight": "shape.cornerRadius.topRight",
  "appearance.radiusBottomRight": "shape.cornerRadius.bottomRight",
  "appearance.radiusBottomLeft": "shape.cornerRadius.bottomLeft",
};

/** How a border style is written on an SVG layer. */
const DASH: Record<string, string> = { solid: "none", dashed: "8 6", dotted: "1 6" };

/** The divider controls, on a `line` (an SVG stroke) and on a `divider` (a styled box): the property each one is really stored under. */
const LINE_KEY: Record<string, string> = {
  "divider.color": "svg.stroke",
  "divider.thickness": "svg.strokeWidth",
  "divider.style": "svg.strokeDasharray",
  "divider.cap": "svg.strokeLinecap",
  "divider.dashOffset": "svg.strokeDashoffset",
  "divider.length": "frame.width",
  "divider.orientation": "frame.rotation",
};
const DIVIDER_KEY: Record<string, string> = { "divider.cap": "divider.capStyle", "divider.dashOffset": "divider.strokeDashoffset" };

/** Some layers are painted by something other than the box colour: shapes by `svg.*`, text by its glyph colour, dividers by their own keys. */
export const isRemapped = (layer: Pick<Layer, "archetype">): boolean => isSvgPainted(layer) || layer.archetype === "text" || layer.archetype === "divider";

/** The property to read or write for `key` on this layer. */
export function propertyFor(layer: Pick<Layer, "archetype">, key: string): string {
  if (layer.archetype === "text") return key === "appearance.background.color" || key === "backgroundColor" ? "typography.color" : key;
  if (layer.archetype === "divider") return DIVIDER_KEY[key] ?? key;
  if (!isSvgPainted(layer)) return key;
  if (layer.archetype === "line" && LINE_KEY[key]) return LINE_KEY[key];
  if (key === "appearance.border.style") return "svg.strokeDasharray";
  if (layer.archetype === "rectangle" && RECT_KEY[key]) return RECT_KEY[key];
  return SHAPE_KEY[key] ?? key;
}

const asHex = (v: string): string => (/^[0-9a-fA-F]{3,8}$/.test(v) ? `#${v}` : v);

/** The value to write to `propertyFor(layer, key)`. */
export function valueFor(layer: Pick<Layer, "archetype">, key: string, value: PropValue | null): PropValue | null {
  if (typeof value !== "string") return value;
  if (key === "divider.color") return asHex(value); // the field types a hex without its #
  if (layer.archetype === "line" && key === "divider.orientation") return value === "vertical" ? 90 : 0;
  if (layer.archetype === "line") {
    if (key === "divider.style") return DASH[value] ?? "none";
    if (key === "divider.cap") return value.toLowerCase();
  }
  if (layer.archetype === "divider" && key === "divider.cap") return value.toLowerCase();
  if (isSvgPainted(layer) && key === "appearance.border.style") return DASH[value] ?? "none";
  return value;
}

/** The value a field shows for this layer, or undefined when the layer has none. A colour of "none" or "currentColor" is no colour. */
export function readFor(layer: Pick<Layer, "archetype" | "properties">, key: string): PropValue | undefined {
  const real = propertyFor(layer, key);
  let v: PropValue | undefined = layer.properties?.[real];
  if (layer.archetype === "line") {
    if (key === "divider.orientation") return v === 90 || v === 270 ? "vertical" : "horizontal";
    if (key === "divider.style" && typeof v === "string") return v === "none" ? "solid" : v === "1 6" ? "dotted" : "dashed";
    if (key === "divider.cap" && typeof v === "string") return v.charAt(0).toUpperCase() + v.slice(1);
  }
  // Not set on this layer: the engine's default for it, never "Mixed" (Mixed means selected layers differ).
  // (A size is not guessed: an unset width means the layer sizes itself.)
  if (v === undefined && real !== "frame.width" && real !== "frame.height") v = getPropertyDefinition(real)?.default;
  if (typeof v === "string" && (real === "svg.fill" || real === "svg.stroke") && (v === "none" || v === "currentColor")) return undefined;
  return v;
}
