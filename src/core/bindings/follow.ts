/**
 * Follow (Design track D6): make a point of a layer follow the pointer, with a lag and an offset. It is two drivers (X and
 * Y) built from the layer's measured box, so the engine, the editor and an export all run the same bindings.
 *
 * The drivers carry a displacement added on top of where the layer is drawn: the pointer's page position, minus where the
 * chosen pin is now, plus the offset, then smoothed (the lag). Measured from the drawn box, so it holds in auto layout too.
 * It does not account for a layer that is itself rotated or scaled (its box is then not the pin's place); that is a named gap.
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

export function followDrafts(layerId: string, box: PageBox, options: FollowOptions): BindingDraft[] {
  const [px, py] = resolvePresetPinPosition(options.pin, box.width, box.height);
  const lag = Math.max(0, options.lag);
  const make = (axis: "x" | "y"): BindingDraft => {
    const here = axis === "x" ? box.x + px : box.y + py;
    const operators: Operator[] = [{ op: "component", axis }, { op: "add", x: -here + (axis === "x" ? options.offsetX : options.offsetY) }];
    if (lag > 0) operators.push({ op: "smooth", tau: lag });
    return {
      expr: { signal: { kind: "pointerIn", channel: "px", space: "page" }, operators },
      target: { kind: "property", on: { kind: "layer", ref: layerId }, path: axis === "x" ? "transform.x" : "transform.y" },
      blend: "add",
    };
  };
  return [...(options.axis !== "y" ? [make("x")] : []), ...(options.axis !== "x" ? [make("y")] : [])];
}
