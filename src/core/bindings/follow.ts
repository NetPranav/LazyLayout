/**
 * Follow (Design track D6): make a point of a layer follow the pointer, with a lag and an offset. It is two drivers (X and
 * Y) built from the layer's measured box, so the engine, the editor and an export all run the same bindings.
 *
 * The drivers carry a displacement added on top of where the layer is drawn: the pointer's page position, minus where the
 * chosen pin is now, plus the offset, then smoothed (the lag). Measured from the drawn box, so it holds in auto layout too.
 * A layer that is rotated or scaled (about its centre) has its pin carried through that pose: the pin is the layer's own point,
 * not a corner of the box it fills.
 */
import type { BindingDraft, Operator } from "../document/signals";
import { PRESET_PIN_NAMES, resolvePresetPinPosition, type PresetPinName } from "../geometry/pins";

export const FOLLOW_NAME = "Follow pointer";
export { PRESET_PIN_NAMES };
export type { PresetPinName };

export interface FollowOptions {
  /** The point of the layer that follows: one of the nine preset pins. */
  pin: PresetPinName;
  /** Seconds the layer takes to catch up (0 follows at once). */
  lag: number;
  offsetX: number;
  offsetY: number;
  axis: "both" | "x" | "y";
}
export const DEFAULT_FOLLOW: FollowOptions = { pin: "center", lag: 0.15, offsetX: 0, offsetY: 0, axis: "both" };

/** The layer's drawn box in page px. */
export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How the layer is turned and scaled about its centre right now. */
export interface Pose {
  /** Degrees, clockwise: everything that turns the layer on the page, for where its pin is. */
  rotate?: number;
  scaleX?: number;
  scaleY?: number;
  /**
   * Degrees: the layer's frame rotation. The engine applies it outermost, so the layer's `transform.x` and `transform.y` move it
   * along its own turned axes; Follow expresses the page-space move in those axes.
   */
  frameRotation?: number;
}

/** Where a pin of the layer is on the page: the pin's offset from the box centre, scaled, turned, and added to the centre. `box` is the layer's own (unturned, unscaled) box. */
export function pinOnPage(box: PageBox, pin: PresetPinName, pose: Pose = {}): [number, number] {
  const [px, py] = resolvePresetPinPosition(pin, box.width, box.height);
  const ox = (px - box.width / 2) * (pose.scaleX ?? 1);
  const oy = (py - box.height / 2) * (pose.scaleY ?? 1);
  const a = (((pose.rotate ?? 0)) * Math.PI) / 180;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return [cx + ox * Math.cos(a) - oy * Math.sin(a), cy + ox * Math.sin(a) + oy * Math.cos(a)];
}

export function followDrafts(layerId: string, box: PageBox, options: FollowOptions, pose: Pose = {}): BindingDraft[] {
  const [pinX, pinY] = pinOnPage(box, options.pin, pose);
  const lag = Math.max(0, options.lag);
  const theta = pose.frameRotation ?? 0;
  const a = (-theta * Math.PI) / 180;
  // where the pin must move to (pointer + offset) minus where it is, in the layer's own axes: R(-theta) · pointer + R(-theta) · (offset - pin)
  const dx = options.offsetX - pinX;
  const dy = options.offsetY - pinY;
  const local = { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  const make = (axis: "x" | "y"): BindingDraft => {
    const operators: Operator[] = [];
    if (theta !== 0) operators.push({ op: "rotate", degrees: -theta });
    operators.push({ op: "component", axis }, { op: "add", x: Math.round((axis === "x" ? local.x : local.y) * 1e6) / 1e6 });
    if (lag > 0) operators.push({ op: "smooth", tau: lag });
    return {
      expr: { signal: { kind: "pointerIn", channel: "px", space: "page" }, operators },
      target: { kind: "property", on: { kind: "layer", ref: layerId }, path: axis === "x" ? "transform.x" : "transform.y" },
      blend: "add",
    };
  };
  return [...(options.axis !== "y" ? [make("x")] : []), ...(options.axis !== "x" ? [make("y")] : [])];
}

export const LOOK_NAME = "Look at pointer";

/**
 * Look at the pointer: one driver that turns the layer to face the pointer, about the centre of its drawn box. The turn is the
 * angle from the centre to the pointer (0 points right, 90 down). `offset` is added to it for artwork that does not point right
 * when it is not turned: artwork that points up needs 90 (it must turn a quarter clockwise to face a pointer on its right).
 */
export function lookAtDrafts(layerId: string, box: PageBox, offset: number): BindingDraft[] {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const operators: Operator[] = [{ op: "lookAt", x: cx, y: cy }];
  if (offset !== 0) operators.push({ op: "add", x: offset });
  return [
    {
      expr: { signal: { kind: "pointerIn", channel: "px", space: "page" }, operators },
      target: { kind: "property", on: { kind: "layer", ref: layerId }, path: "transform.rotate" },
      blend: "add",
    },
  ];
}

export const PARALLAX_NAME = "Parallax";

/**
 * Depth parallax (Design track D14): a layer that sits at a depth moves against the scroll and the cursor, so a page's layers drift at
 * their own speeds. It is plain drivers (so the export, reduced motion and the scroll tapes all work as they do for any driver).
 *
 * `depth` is how far away the layer is, from -1 (near, it moves faster than the page) through 0 (on the page) to 1 (infinitely far,
 * it stays on the screen): a layer at depth 0.3 scrolls at 0.7 of the page's speed. `cursor` is how far, in px, a layer at depth 1
 * moves with the cursor across the whole page (it moves the same way as the cursor, scaled by depth).
 */
export function parallaxDrafts(layerId: string, depth: number, cursor: number): BindingDraft[] {
  const on = (path: string): BindingDraft["target"] => ({ kind: "property", on: { kind: "layer", ref: layerId }, path });
  const out: BindingDraft[] = [];
  const d = Math.round(depth * 1e4) / 1e4;
  if (d !== 0) {
    out.push({ expr: { signal: { kind: "scroll", channel: "y" }, operators: [{ op: "mul", x: d }] }, target: on("transform.y"), blend: "add" });
  }
  const c = Math.round(cursor * d * 1e4) / 1e4;
  if (c !== 0) {
    for (const axis of ["x", "y"] as const) {
      out.push({
        expr: { signal: { kind: "pointerIn", channel: "ndc", space: "page" }, operators: [{ op: "component", axis }, { op: "mul", x: c }] },
        target: on(axis === "x" ? "transform.x" : "transform.y"),
        blend: "add",
      });
    }
  }
  return out;
}
