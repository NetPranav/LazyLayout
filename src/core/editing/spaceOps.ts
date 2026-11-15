/**
 * 2.5D spaces (ROADMAP Phase 127). A frame or group becomes a 3D space for its children:
 * - its perspective strength (`transform.perspective`, px: smaller is more dramatic);
 * - the vanishing point (`transform.origin`, % of its box);
 * - the angle it is seen from (`transform.rotateX` / `rotateY`);
 * - `transform.style3d: preserve3d`, so its children keep their depth.
 * Each child has a depth (`transform.translateZ`, px towards the viewer) and a tilt (`transform.rotateX` / `rotateY`).
 *
 * They are real page layers drawn with CSS 3D (`perspective()` and `preserve-3d`); the browser draws them in depth
 * order, on the stage and in the export alike, so the export needs no 3D library. Each edit is one undo step.
 */

import type { Layer } from "../document/schema";
import { getDocument } from "../store/documentState";
import { setLayerProps, transaction } from "./editOps";

const SPACE_ARCHETYPES = new Set(["container", "form"]);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Whether a layer is a 3D space. */
export const isSpace = (l: Layer | undefined): boolean => !!l && SPACE_ARCHETYPES.has(l.archetype) && l.properties["transform.style3d"] === "preserve3d" && num(l.properties["transform.perspective"], 0) > 0;

/** The space a layer stands in (its parent, when that is a space), or null. */
export function spaceOf(id: string): string | null {
  const layers = getDocument().layers;
  const parent = layers[id]?.parentId;
  return parent && isSpace(layers[parent]) ? parent : null;
}

/** The vanishing point of a space, in % of its box (default the middle). */
export function vanishingPoint(l: Layer): { x: number; y: number } {
  const m = /^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(String(l.properties["transform.origin"] ?? ""));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}

export const DEFAULT_PERSPECTIVE = 900;

/** Makes frames and groups 3D spaces (seen straight on, vanishing in the middle). Returns how many changed. */
export function makeSpace(ids: readonly string[], perspective = DEFAULT_PERSPECTIVE): number {
  const layers = getDocument().layers;
  const targets = ids.filter((id) => layers[id] && SPACE_ARCHETYPES.has(layers[id].archetype) && layers[id].locked !== true);
  if (!targets.length) return 0;
  return setLayerProps(targets, { "transform.perspective": Math.min(10_000, Math.max(50, perspective)), "transform.style3d": "preserve3d", "transform.origin": "50% 50%" }, "Make 3D space");
}

/** Makes spaces flat again: the space's own settings go; its children keep their depth and tilt (shown flat). */
export function releaseSpace(ids: readonly string[]): number {
  const targets = ids.filter((id) => isSpace(getDocument().layers[id]));
  if (!targets.length) return 0;
  return setLayerProps(targets, { "transform.perspective": null, "transform.style3d": null, "transform.origin": null, "transform.rotateX": null, "transform.rotateY": null }, "Flatten 3D space");
}

export interface SpacePatch {
  perspective?: number;
  /** The vanishing point, % of the box. */
  vanishX?: number;
  vanishY?: number;
  /** The angle the space is seen from, degrees. */
  viewX?: number;
  viewY?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Changes a space's perspective, vanishing point and viewing angle. */
export function setSpace(id: string, patch: SpacePatch): boolean {
  const l = getDocument().layers[id];
  if (!l || !isSpace(l)) return false;
  const vp = vanishingPoint(l);
  const props: Record<string, number | string> = {};
  if (patch.perspective !== undefined && Number.isFinite(patch.perspective)) props["transform.perspective"] = clamp(patch.perspective, 50, 10_000);
  if ((patch.vanishX !== undefined && Number.isFinite(patch.vanishX)) || (patch.vanishY !== undefined && Number.isFinite(patch.vanishY))) {
    const r = (v: number) => Math.round(clamp(v, -200, 300) * 100) / 100;
    props["transform.origin"] = `${r(patch.vanishX ?? vp.x)}% ${r(patch.vanishY ?? vp.y)}%`;
  }
  if (patch.viewX !== undefined && Number.isFinite(patch.viewX)) props["transform.rotateX"] = clamp(patch.viewX, -89, 89);
  if (patch.viewY !== undefined && Number.isFinite(patch.viewY)) props["transform.rotateY"] = clamp(patch.viewY, -89, 89);
  return Object.keys(props).length > 0 && setLayerProps([id], props, "3D space") > 0;
}

/** Sets the depth (px towards the viewer) and/or tilt of layers standing in a space. Returns how many changed. */
export function setDepth(ids: readonly string[], patch: { z?: number; tiltX?: number; tiltY?: number }): number {
  const targets = ids.filter((id) => spaceOf(id));
  if (!targets.length) return 0;
  const props: Record<string, number> = {};
  if (patch.z !== undefined && Number.isFinite(patch.z)) props["transform.translateZ"] = clamp(patch.z, -5000, 5000);
  if (patch.tiltX !== undefined && Number.isFinite(patch.tiltX)) props["transform.rotateX"] = clamp(patch.tiltX, -180, 180);
  if (patch.tiltY !== undefined && Number.isFinite(patch.tiltY)) props["transform.rotateY"] = clamp(patch.tiltY, -180, 180);
  if (!Object.keys(props).length) return 0;
  return transaction("Depth", () => setLayerProps(targets, props, "Depth"));
}

/** Where a point at depth `z` in a space appears (seen straight on): pulled towards or away from the vanishing point. */
export function projectAtDepth(p: { x: number; y: number }, z: number, vanish: { x: number; y: number }, perspective: number): { x: number; y: number } {
  const k = perspective / Math.max(1e-6, perspective - z);
  return { x: vanish.x + (p.x - vanish.x) * k, y: vanish.y + (p.y - vanish.y) * k };
}
