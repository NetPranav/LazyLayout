/**
 * Outline Stroke (FigCraft port F3): turns the area a layer's stroke paints into a filled path layer of its own, so the
 * stroke can be edited, combined with booleans or exported as a shape.
 *
 * - A line, or a path with no fill, is replaced by its outline.
 * - Any other shape keeps its fill and loses its stroke; the outline is a new layer just above it.
 * - The new layer is fitted to the outline's own bounds, because a thick or outside stroke reaches past the layer's box.
 *
 * Uses `layerStrokeArea` (which wraps `strokeOutline`), commit 6ea44e9. MIT, Copyright (c) 2026 ArtCraft Team and the
 * FigCraft contributors. See THIRD_PARTY_NOTICES.md.
 */

import type { Layer } from "../document/schema";
import { fromPath, serializeNetwork } from "../paths/vectorNetwork";
import { documentCommands } from "../store/useDocumentStore";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { setLayerProps, transaction } from "./editOps";
import { layerSize, layerStrokeArea } from "./layerOutline";

const layers = () => getDocument().layers;
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Whether the layer paints anything inside its outline (a line never does). */
function hasFill(l: Layer): boolean {
  if (l.archetype === "line") return false;
  const p = l.properties;
  const fills = typeof p["paint.fills"] === "string" ? p["paint.fills"].trim() : "";
  if (fills !== "" && fills !== "[]") return true;
  if (l.archetype === "svgPath") return typeof p["svg.fill"] === "string" && p["svg.fill"] !== "none";
  return true;
}

/** Outlines the visible stroke of each layer in `ids`. Returns the new layers; layers without a visible stroke are skipped. */
export function outlineStrokes(ids: readonly string[]): string[] {
  const out: string[] = [];
  transaction("Outline Stroke", () => {
    for (const id of ids) {
      const l = layers()[id];
      if (!l?.parentId) continue;
      const area = layerStrokeArea(l, layers());
      if (!area || area.isEmpty()) continue;
      const box = area.boundingBox();
      const bw = box.x1 - box.x0;
      const bh = box.y1 - box.y0;
      if (!(bw > 0) || !(bh > 0)) continue;

      // The outline's box in the parent: the layer turns about its centre, so move the outline's centre the same way.
      const p = l.properties;
      const { w, h } = layerSize(l);
      const rot = num(p["frame.rotation"], 0);
      const r = (rot * Math.PI) / 180;
      const dx = (box.x0 + box.x1) / 2 - w / 2;
      const dy = (box.y0 + box.y1) / 2 - h / 2;
      const cx = num(p["frame.x"], 0) + w / 2 + dx * Math.cos(r) - dy * Math.sin(r);
      const cy = num(p["frame.y"], 0) + h / 2 + dx * Math.sin(r) + dy * Math.cos(r);

      const unit = area.map((q) => ({ x: ((q.x - box.x0) / bw) * 200, y: ((q.y - box.y0) / bh) * 200 }));
      const net = fromPath(unit);
      for (const region of net.regions) region.winding = "nonzero";

      const strokes = typeof p["paint.strokes"] === "string" ? p["paint.strokes"] : "";
      const parent = layers()[l.parentId];
      const index = parent.children.indexOf(id) + 1;
      const created = documentCommands.addLayer(
        {
          archetype: "svgPath",
          parentId: l.parentId,
          name: `${l.name ?? "Path"} outline`,
          index,
          properties: {
            positioning: "absolute",
            "frame.x": cx - bw / 2,
            "frame.y": cy - bh / 2,
            "frame.width": bw,
            "frame.height": bh,
            ...(rot !== 0 ? { "frame.rotation": rot } : {}),
            "svg.network": serializeNetwork(net),
            "svg.path": unit.toSvg(3),
            "svg.fillRule": "nonzero",
            "svg.fill": typeof p["svg.stroke"] === "string" ? p["svg.stroke"] : "#000000",
            ...(strokes ? { "paint.fills": strokes } : {}),
            "svg.stroke": "none",
            "svg.strokeWidth": 0,
          },
        },
        "Outline Stroke",
      );
      if (hasFill(l)) setLayerProps([id], { "svg.stroke": "none", "svg.strokeWidth": 0, "paint.strokes": null }, "Outline Stroke");
      else documentCommands.removeLayer(id);
      out.push(created);
    }
    if (out.length) useSelectionStore.getState().selectMultiple(out, "element");
  });
  return out;
}
