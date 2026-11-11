import { placesChildren, isGrid, readStack } from "@/core/editing/layoutOps";
import { insertionIndex, insertionLine } from "@/core/layout/stack";
import { gridInsertion } from "@/core/layout/grid";
import type { Layer } from "@/core/document/schema";
import type { StageElement } from "../types";

export interface FlowDrop {
  parentId: string;
  /** Where the dragged layers take their place among the frame's other children. */
  index: number;
  /** The insertion line, in artboard pixels. */
  line: { x1: number; y1: number; x2: number; y2: number } | null;
}

/** The pointer in the artboard's own pixels (the space the stage elements are measured in). */
export function artboardPoint(art: HTMLElement | null | undefined, e: { clientX: number; clientY: number }): { x: number; y: number } | null {
  if (!art) return null;
  const r = art.getBoundingClientRect();
  const scale = art.offsetWidth > 0 ? r.width / art.offsetWidth : 1;
  return { x: (e.clientX - r.left) / scale - art.clientLeft, y: (e.clientY - r.top) / scale - art.clientTop };
}

/**
 * Where layers dragged inside a stack or grid frame would land: they keep their place in the flow and take a new position in the order,
 * as long as the pointer is over their frame. Null when the drag is not a reorder (a layer placed by hand, or the pointer left the frame).
 */
export function flowDrop(ids: readonly string[], pointer: { x: number; y: number } | null, elements: Record<string, StageElement>, layers: Record<string, Layer>): FlowDrop | null {
  if (!pointer || ids.length === 0) return null;
  const first = layers[ids[0]];
  const parent = first?.parentId ? layers[first.parentId] : undefined;
  if (!parent || !placesChildren(parent)) return null;
  if (!ids.every((id) => layers[id]?.parentId === parent.id && layers[id].properties.positioning !== "absolute" && !elements[id]?.mirrorId)) return null;
  const frame = elements[parent.id];
  if (!frame || frame.mirrorId) return null;
  if (pointer.x < frame.x || pointer.x > frame.x + frame.width || pointer.y < frame.y || pointer.y > frame.y + frame.height) return null;
  const rects = parent.children
    .filter((id) => !ids.includes(id) && layers[id]?.visible !== false && layers[id]?.properties.positioning !== "absolute" && elements[id])
    .map((id) => ({ x: elements[id].x, y: elements[id].y, w: elements[id].width, h: elements[id].height }));
  if (rects.length === 0) return null;
  if (isGrid(parent)) {
    const spot = gridInsertion(rects, pointer);
    return spot ? { parentId: parent.id, index: spot.index, line: spot.line } : null;
  }
  const stack = readStack(parent);
  const index = insertionIndex(stack.direction, rects, pointer);
  return { parentId: parent.id, index, line: insertionLine(stack.direction, rects, index, stack.gap) };
}
