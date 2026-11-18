/**
 * The Animation Playground (ROADMAP Phase 90): a focused way of looking at an animation and tuning it. The Playground
 * adds no player of its own: it drives what the editor already has (the transport's rate, loop and frame step; the
 * canvas backdrop; the device-screen preview; the reduced-motion view from Phase 93; the scheduler's frame rate).
 * What is new is here: the state a layer is held in, the overlays, and the numbers they show.
 */

import type { MotionDocument } from "../document/schema";
import { stateLayerIds } from "../states/states";

/** Playback speeds the Playground offers: a tenth of normal to double. */
export const TIME_SCALES = [0.1, 0.25, 0.5, 1, 1.5, 2] as const;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2;
export const clampScale = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(n * 100) / 100)) : 1);

export const OVERLAYS = ["wireframe", "box", "dimensions", "touch"] as const;
export type Overlay = (typeof OVERLAYS)[number];
export const OVERLAY_LABEL: Record<Overlay, string> = { wireframe: "Wireframes", box: "Box model", dimensions: "Dimensions", touch: "Touch targets" };

/** The smallest a thing to tap should be, in px (the same 44 the accessibility rules use). */
export const TOUCH_MIN = 44;

export interface Box {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A layer someone can tap or click: it links somewhere, has states, or switches its variant. */
export function interactiveIds(doc: MotionDocument): Set<string> {
  const out = stateLayerIds(doc);
  for (const layer of Object.values(doc.layers)) {
    const trigger = layer.properties["variantTrigger.on"];
    if (layer.link || (typeof trigger === "string" && trigger !== "none")) out.add(layer.id);
  }
  return out;
}

/** The boxes that are tap targets and smaller than 44 px either way. */
export function smallTouchTargets(boxes: readonly Box[], interactive: ReadonlySet<string>): Box[] {
  return boxes.filter((b) => interactive.has(b.id) && (b.w < TOUCH_MIN || b.h < TOUCH_MIN));
}

/** "120 × 48", whole pixels. */
export const dimensionLabel = (b: Pick<Box, "w" | "h">): string => `${Math.round(b.w)} × ${Math.round(b.h)}`;
