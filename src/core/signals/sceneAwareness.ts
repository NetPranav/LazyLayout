/**
 * Phase 134 — Scene Awareness (`self.*` and layer-to-layer live signals).
 *
 * Computes live per-layer geometric, kinematic, visibility, pointer-relative, and
 * layer-to-layer signals lazily once per frame ONLY for watched layer IDs (Laws 10 & 12),
 * from measurement rectangles (`local`, `parent`, `frame`, `page`).
 */
import type { SpaceRect } from "./inputBus";
import { distanceToRect, insideRect, viewOf } from "../bindings/inputBus";

export interface LayerPoseSample {
  id: string;
  localRect: SpaceRect;
  parentRect?: SpaceRect | null;
  frameRect?: SpaceRect | null;
  pageRect: SpaceRect;
  scrollBox?: { top: number; height: number } | null;
  scaleX?: number;
  scaleY?: number;
  hovered?: boolean;
  pressed?: boolean;
  focused?: boolean;
  dragged?: boolean;
}

export interface LayerAwareness {
  readonly id: string;
  readonly local: { x: number; y: number; width: number; height: number; rotation: number };
  readonly parent: { x: number; y: number; width: number; height: number; rotation: number };
  readonly frame: { x: number; y: number; width: number; height: number; rotation: number };
  readonly page: { x: number; y: number; width: number; height: number; rotation: number };
  readonly scaleX: number;
  readonly scaleY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly speed: number;
  readonly visible: number;
  readonly viewProgress: number;
  readonly distanceToPointer: number;
  readonly angleToPointer: number;
  readonly hovered: boolean;
  readonly pressed: boolean;
  readonly focused: boolean;
  readonly dragged: boolean;
}

export interface AwarenessHost {
  readonly watchedLayers: ReadonlySet<string>;
  readonly pointer: { x: number; y: number; down: boolean } | null;
  readonly scroll: { y: number; viewport: number };
  readonly focusedLayerId?: string | null;
  readonly draggedLayerId?: string | null;
  measureLayer(layerId: string): LayerPoseSample | null;
}

export interface SceneAwarenessState {
  prevCenters: Map<string, { x: number; y: number; frame: number }>;
  frame: number;
  snapshot: Map<string, LayerAwareness>;
}

export function createSceneAwarenessState(): SceneAwarenessState {
  return { prevCenters: new Map(), frame: 0, snapshot: new Map() };
}

function toRelRect(child: SpaceRect, parent: SpaceRect | null | undefined): { x: number; y: number; width: number; height: number; rotation: number } {
  if (!parent) {
    return { x: child.x, y: child.y, width: child.width, height: child.height, rotation: child.rotationDeg ?? 0 };
  }
  return {
    x: child.x - parent.x,
    y: child.y - parent.y,
    width: child.width,
    height: child.height,
    rotation: (child.rotationDeg ?? 0) - (parent.rotationDeg ?? 0),
  };
}

/**
 * Evaluates scene awareness signals for only the layers in `host.watchedLayers`.
 * Computing only watched layers keeps 200+ idle/unwatched layers at zero cost.
 */
export function stepSceneAwareness(host: AwarenessHost, state: SceneAwarenessState, dt: number): ReadonlyMap<string, LayerAwareness> {
  state.frame += 1;
  const next = new Map<string, LayerAwareness>();
  const ptr = host.pointer;
  const safeDt = dt > 0 ? Math.min(dt, 1 / 15) : 0;

  for (const id of host.watchedLayers) {
    const sample = host.measureLayer(id);
    if (!sample) continue;

    const r = sample.pageRect;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;

    const prev = state.prevCenters.get(id);
    let vx = 0;
    let vy = 0;
    if (prev && safeDt > 0) {
      vx = (cx - prev.x) / safeDt;
      vy = (cy - prev.y) / safeDt;
    }
    state.prevCenters.set(id, { x: cx, y: cy, frame: state.frame });

    const view = sample.scrollBox
      ? viewOf(sample.scrollBox, host.scroll.y, host.scroll.viewport)
      : { progress: 0, visible: r.height > 0 ? 1 : 0 };

    const distPtr = ptr ? distanceToRect(r, ptr.x, ptr.y, "edge") : 0;
    const angPtr = ptr ? (Math.atan2(ptr.y - cy, ptr.x - cx) * 180) / Math.PI : 0;
    const inBox = !!(ptr && insideRect(r, ptr.x, ptr.y));

    next.set(id, {
      id,
      local: {
        x: sample.localRect.x,
        y: sample.localRect.y,
        width: sample.localRect.width,
        height: sample.localRect.height,
        rotation: sample.localRect.rotationDeg ?? 0,
      },
      parent: toRelRect(r, sample.parentRect),
      frame: toRelRect(r, sample.frameRect),
      page: { x: r.x, y: r.y, width: r.width, height: r.height, rotation: r.rotationDeg ?? 0 },
      scaleX: sample.scaleX ?? 1,
      scaleY: sample.scaleY ?? 1,
      velocityX: vx,
      velocityY: vy,
      speed: Math.hypot(vx, vy),
      visible: view.visible,
      viewProgress: view.progress,
      distanceToPointer: distPtr,
      angleToPointer: angPtr,
      hovered: sample.hovered ?? inBox,
      pressed: sample.pressed ?? !!(inBox && ptr?.down),
      focused: sample.focused ?? host.focusedLayerId === id,
      dragged: sample.dragged ?? host.draggedLayerId === id,
    });
  }

  for (const existingId of Array.from(state.prevCenters.keys())) {
    if (!host.watchedLayers.has(existingId)) state.prevCenters.delete(existingId);
  }
  state.snapshot = next;
  return next;
}

/** Layer-to-layer spatial queries in page space (`distanceTo`, `angleTo`, `overlap`). */
export function queryLayerRelation(
  source: Pick<LayerAwareness, "page">,
  target: Pick<LayerAwareness, "page">
): { distanceTo: number; angleTo: number; overlap: number } {
  const a = source.page;
  const b = target.page;
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;

  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  const distanceTo = Math.hypot(dx, dy);
  const angleTo = (Math.atan2(bcy - acy, bcx - acx) * 180) / Math.PI;

  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const interArea = ix * iy;
  const minArea = Math.max(1e-6, Math.min(a.width * a.height, b.width * b.height));
  const overlap = a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 ? Math.min(1, interArea / minArea) : 0;

  return { distanceTo, angleTo, overlap };
}

/** Reads a named `self.*` channel for a layer from an awareness snapshot. */
export function readSelfChannel(awareness: LayerAwareness | undefined, channel: string): number {
  if (!awareness) return 0;
  switch (channel) {
    case "x":
      return awareness.page.x;
    case "y":
      return awareness.page.y;
    case "width":
      return awareness.page.width;
    case "height":
      return awareness.page.height;
    case "rotation":
      return awareness.page.rotation;
    case "localX":
      return awareness.local.x;
    case "localY":
      return awareness.local.y;
    case "parentX":
      return awareness.parent.x;
    case "parentY":
      return awareness.parent.y;
    case "frameX":
      return awareness.frame.x;
    case "frameY":
      return awareness.frame.y;
    case "scaleX":
      return awareness.scaleX;
    case "scaleY":
      return awareness.scaleY;
    case "velocityX":
      return awareness.velocityX;
    case "velocityY":
      return awareness.velocityY;
    case "speed":
      return awareness.speed;
    case "visible":
      return awareness.visible;
    case "viewProgress":
      return awareness.viewProgress;
    case "distanceToPointer":
      return awareness.distanceToPointer;
    case "angleToPointer":
      return awareness.angleToPointer;
    case "hovered":
      return awareness.hovered ? 1 : 0;
    case "pressed":
      return awareness.pressed ? 1 : 0;
    case "focused":
      return awareness.focused ? 1 : 0;
    case "dragged":
      return awareness.dragged ? 1 : 0;
    default:
      return 0;
  }
}
