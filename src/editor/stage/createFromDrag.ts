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

/**
 * Makes the layer a drag describes, absolutely positioned in the page (the document's top-level frame; its children are
 * placed in the artboard's own pixels). One document command: one undo step. Returns the new layer's id.
 */
export function createLayerFromBox(spec: CreationSpec, box: DragBox): string {
  const roots = Object.values(getDocument().layers).filter((l) => l.parentId === null);
  const parentId = roots[0]?.id ?? null;
  const props: Record<string, PropValue> = {
    ...getDefaultProps(spec.archetype),
    positioning: "absolute",
    "frame.x": Math.round(box.x * 100) / 100,
    "frame.y": Math.round(box.y * 100) / 100,
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
