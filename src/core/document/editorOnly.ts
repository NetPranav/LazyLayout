/**
 * Layers that exist only to help design, never in what is shipped: they are drawn in the editor and left out of the
 * preview and of every export (the site export and the code emitters). One definition, used everywhere, so a new kind
 * of design-time layer is added here once instead of in each exporter.
 *
 * - a helper layer (`render.role: "helper"`, Phase 73): a null, a guide, a controller;
 * - a linked view (`frame.mirrorOf`): a mirror frame showing another frame at a breakpoint. The page itself already
 *   carries that breakpoint as @media rules, so exporting the mirror would ship a second copy of the frame.
 */

type LayerLike = { properties?: Record<string, unknown> } | null | undefined;

export function isEditorOnlyLayer(layer: LayerLike): boolean {
  const p = layer?.properties;
  if (!p) return false;
  if (p["render.role"] === "helper") return true;
  const mirrorOf = p["frame.mirrorOf"];
  return typeof mirrorOf === "string" && mirrorOf !== "";
}

/**
 * Attributes the editor puts on drawn elements for its own use (hit testing, measuring, linked views). The exporter
 * removes them; the export tests assert none of them reaches shipped code.
 */
export const EDITOR_ONLY_ATTRIBUTES: readonly string[] = ["data-element-id", "data-archetype", "data-mirror-id", "data-mirror-of", "data-testid", "data-repeat-copy"];
