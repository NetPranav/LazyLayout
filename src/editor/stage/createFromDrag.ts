/**
 * Drawing on the new stage: what the Frame, Shape and Text tools make from a drag.
 *
 * This is the old editor's creation tools (`legacy-editor/canvas/tools/toolRuntime.ts`, ROADMAP Phase 25) on the new
 * stage, using the same engine pieces: `dragBox` for the box a drag makes (Shift constrains, Alt draws from the centre,
 * a click gives the tool's default size), `getDefaultProps` for the archetype's defaults, and one document command per
 * layer, so a drawn layer is one undo step. Nothing here draws or styles anything: the stage draws the layer through the
 * engine's render definition, like any other layer.
 */

import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { documentOrder } from "@/core/selection/selectionOps";
import { getDefaultProps, type ArchetypeId, type PropValue } from "@/core/document/registry";
import { dragBox, type DragBox, type DragDefaults, type DragKind, type DragModifiers } from "@/core/geometry/shapeDrag";
import type { Point } from "@/core/viewport/camera";
import type { CanvasTool, ShapeTool } from "@/editor/shell/canvas-chrome/types";

/** A press that moves less than this (in screen px) is a click: the tool's default size. */
export const CLICK_SLOP = 4;

export interface CreationSpec {
  archetype: ArchetypeId;
  label: string;
  kind: DragKind;
}

const SHAPES: Record<ShapeTool, CreationSpec> = {
  box: { archetype: "rectangle", label: "Rectangle", kind: "box" },
  circle: { archetype: "ellipse", label: "Ellipse", kind: "box" },
  line: { archetype: "line", label: "Line", kind: "segment" },
  arrow: { archetype: "arrow", label: "Arrow", kind: "segment" },
  poly: { archetype: "polygon", label: "Polygon", kind: "box" },
  star: { archetype: "star", label: "Star", kind: "box" },
};

/** What the active tool draws, or null when it draws nothing (Select, Hand, and the Image tool, which has no drawing). */
export function creationSpecFor(tool: CanvasTool, shape: ShapeTool): CreationSpec | null {
  if (tool === "frame") return { archetype: "container", label: "Frame", kind: "box" };
  if (tool === "text") return { archetype: "text", label: "Text", kind: "box" };
  if (tool === "shape") return SHAPES[shape] ?? SHAPES.box;
  return null;
}

/** The size a click gives the tool's layer. */
function clickSize(spec: CreationSpec): { width: number; height: number } {
  const props = getDefaultProps(spec.archetype);
  const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);
  if (spec.archetype === "text") return { width: 240, height: 32 };
  if (spec.archetype === "container") return { width: 320, height: 240 };
  return { width: num(props["frame.width"], 120), height: num(props["frame.height"], 120) };
}

/** The box a drag from `start` to `current` makes, in the artboard's own pixels. `zoom` turns the click slop into document px. */
export function drawBox(spec: CreationSpec, start: Point, current: Point, mods: DragModifiers, zoom: number): DragBox {
  const defaults = clickSize(spec);
  const segment = spec.kind === "segment";
  const dragDefaults: DragDefaults = segment ? { width: defaults.width, height: spec.archetype === "arrow" ? 32 : 2 } : defaults;
  return dragBox(spec.kind, start, current, mods, dragDefaults, CLICK_SLOP / (zoom || 1));
}

/** Where a layer's own position starts on the page: the sum of its ancestors' positions (the page root is the origin). */
function worldOrigin(layers: ReturnType<typeof getDocument>["layers"], id: string): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let cur = layers[id];
  let guard = 0;
  while (cur && cur.parentId !== null && guard++ < 1000) {
    const parent = layers[cur.parentId];
    if (!parent || parent.parentId === null) break;
    x += (parent.properties["frame.x"] as number) ?? 0;
    y += (parent.properties["frame.y"] as number) ?? 0;
    cur = parent;
  }
  return { x, y };
}

/**
 * The innermost frame (a container with a size) that a page point is inside, with where it starts on the page, so a layer
 * drawn inside a frame becomes that frame's child. Null when the point is on bare page.
 */
export function frameAt(point: { x: number; y: number }): { id: string; x: number; y: number } | null {
  const layers = getDocument().layers;
  const order = documentOrder(layers);
  for (let i = order.length - 1; i >= 0; i--) {
    const l = layers[order[i]];
    if (!l || l.parentId === null || l.archetype !== "container" || l.visible === false || l.locked === true) continue;
    const w = l.properties["frame.width"];
    const h = l.properties["frame.height"];
    if (typeof w !== "number" || typeof h !== "number") continue; // the sample sections have no box of their own
    const o = worldOrigin(layers, l.id);
    const x = o.x + ((l.properties["frame.x"] as number) ?? 0);
    const y = o.y + ((l.properties["frame.y"] as number) ?? 0);
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) return { id: l.id, x, y };
  }
  return null;
}

/**
 * Makes the layer a drag describes, absolutely positioned in the page (the document's top-level frame; its children are
 * placed in the artboard's own pixels). One document command: one undo step. Returns the new layer's id.
 */
export function createLayerFromBox(spec: CreationSpec, box: DragBox): string {
  const roots = Object.values(getDocument().layers).filter((l) => l.parentId === null);
  // Drawn inside a frame, it belongs to that frame (and is placed from the frame's corner); on bare page it belongs to the page.
  const inside = frameAt({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const parentId = inside?.id ?? roots[0]?.id ?? null;
  const props: Record<string, PropValue> = {
    ...getDefaultProps(spec.archetype),
    positioning: "absolute",
    "frame.x": Math.round((box.x - (inside?.x ?? 0)) * 100) / 100,
    "frame.y": Math.round((box.y - (inside?.y ?? 0)) * 100) / 100,
  };
  if (spec.archetype === "text") {
    // A click makes auto-width text; a drag makes a text box of the dragged size. It has words from the start, so it shows at once.
    if (!box.click) {
      props["frame.width"] = box.width;
      props["frame.height"] = box.height;
    }
    props["content.text"] = "Text";
    props["text.sizing"] = box.click ? "autoWidth" : "fixed";
  } else {
    props["frame.width"] = box.width;
    props["frame.height"] = box.height;
  }
  if (box.rotation !== 0) props["frame.rotation"] = box.rotation;
  if (spec.archetype === "container") props["appearance.background.color"] = "#ffffff";
  return documentCommands.addLayer({ archetype: spec.archetype, parentId, name: spec.label, properties: props }, `Draw ${spec.label}`);
}
