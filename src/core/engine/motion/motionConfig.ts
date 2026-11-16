/**
 * ROADMAP Phase 87: a layer's interactive motion in Motion's own words. States become `variants`, the layer's
 * transition a Motion `transition` (a spring as stiffness, damping and mass, so it is the same curve the stage draws;
 * a tween as a duration and a cubic bezier), and the built-in states the gesture props: `hover` is `whileHover`,
 * `pressed` is `whileTap`, `focus` is `whileFocus`, and custom states named `inView` and `drag` are `whileInView` and
 * `whileDrag`. Layout motion is `layout`, and enter and exit are `initial`, `animate` and `exit` (inside
 * `AnimatePresence`). Pure: the document in, plain data out. The stage and the exporters (Phase 95) both read it.
 */
import type { MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import { getPropertyDefinition } from "../../document/properties";
import { parseEasing } from "../../document/motion";
import { perceptualToPhysical } from "../../kernel/springs";
import { statesOf } from "../../states/states";
import { transitionOf, transitionOverrides, type TransitionSpec } from "../../states/transitions";
import { layoutMotionOf, PRESENCE_POSES, type PresenceKind } from "./layoutMotion";

export type MotionTransition =
  | { type: "spring"; stiffness: number; damping: number; mass: number }
  | { type: "tween"; duration: number; ease: [number, number, number, number] | "linear" };
export type MotionTarget = Record<string, string | number>;

/** Motion's style key for a property path, or null when Motion has no word for it (it is then left to CSS). */
const KEYS: Record<string, string> = {
  "transform.x": "x",
  "transform.y": "y",
  "transform.scale": "scale",
  "transform.scaleX": "scaleX",
  "transform.scaleY": "scaleY",
  "transform.rotate": "rotate",
  "transform.skewX": "skewX",
  "transform.skewY": "skewY",
  "appearance.opacity": "opacity",
};
export function motionKey(path: string): string | null {
  if (KEYS[path]) return KEYS[path];
  const css = getPropertyDefinition(path)?.css;
  if (!css || css === "transform") return null;
  return css.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;
/** The cubic bezier of the tween curves a transition can name. */
const BEZIERS: Record<string, [number, number, number, number]> = {
  "power2.out": [0.215, 0.61, 0.355, 1],
  "power2.in": [0.55, 0.055, 0.675, 0.19],
  "power2.inOut": [0.645, 0.045, 0.355, 1],
  "power4.out": [0.165, 0.84, 0.44, 1],
};

export function motionTransition(spec: TransitionSpec): MotionTransition {
  if (spec.type === "spring") {
    const p = perceptualToPhysical(spec.bounce, spec.duration);
    return { type: "spring", stiffness: round(p.stiffness, 2), damping: round(p.damping, 2), mass: p.mass };
  }
  const parsed = parseEasing(spec.curve);
  const ease = spec.curve === "linear" || !parsed ? "linear" : (BEZIERS[spec.curve] ?? "linear");
  return { type: "tween", duration: round(spec.duration), ease };
}

function target(layerUnit: (path: string) => string, props: Readonly<Record<string, PropValue>>): { target: MotionTarget; skipped: string[] } {
  const out: MotionTarget = {};
  const skipped: string[] = [];
  for (const [path, value] of Object.entries(props)) {
    const key = motionKey(path);
    if (!key || (typeof value !== "number" && typeof value !== "string")) {
      skipped.push(path);
      continue;
    }
    const def = getPropertyDefinition(path);
    // x, y, scale, rotate and opacity are bare numbers to Motion; a length that isn't a transform carries its unit
    out[key] = typeof value === "number" && def?.valueType === "length" && !(path in KEYS) ? `${value}${layerUnit(path)}` : value;
  }
  return { target: out, skipped };
}

const GESTURES: Record<string, "whileHover" | "whileTap" | "whileFocus" | "whileInView" | "whileDrag"> = { hover: "whileHover", pressed: "whileTap", focus: "whileFocus", inView: "whileInView", drag: "whileDrag" };

export interface MotionProps {
  /** One entry for each state, and `rest`: the base values of everything a state changes, so leaving a state animates back. */
  variants: Record<string, MotionTarget>;
  whileHover?: string;
  whileTap?: string;
  whileFocus?: string;
  whileInView?: string;
  whileDrag?: string;
  /** The layer's transition; a property with one of its own is keyed by Motion's name for it, beside `default`. */
  transition: MotionTransition | ({ default: MotionTransition } & Record<string, MotionTransition>);
  /** Layout changes animate (`layout` on the component). */
  layout?: true;
  /** Enter and exit (`initial`, `animate`, `exit`), for a layer that appears and disappears. */
  initial?: MotionTarget;
  animate?: MotionTarget | string;
  exit?: MotionTarget;
  /** States with no gesture of their own (custom names): the app switches to them with `animate="name"`. */
  custom: string[];
  /** Properties of states Motion can't animate by name; they are left to CSS. */
  skipped: string[];
}

/** A layer's motion props, or null when it has no state, no layout motion and no enter or exit. */
export function motionPropsOf(doc: MotionDocument, layerId: string): MotionProps | null {
  const layer = doc.layers[layerId];
  if (!layer) return null;
  const states = statesOf(doc, layerId);
  const layout = layoutMotionOf(layer.properties);
  if (states.length === 0 && !layout.on && layout.enter === "none" && layout.exit === "none") return null;

  const unit = (path: string) => {
    const u = layer.properties[`${path}Unit`];
    return typeof u === "string" ? u : (getPropertyDefinition(path)?.unit ?? "px");
  };
  const out: MotionProps = { variants: {}, transition: motionTransition(transitionOf(layer.properties)), custom: [], skipped: [] };
  const rest: Record<string, PropValue> = {};
  for (const state of states) {
    const made = target(unit, state.props);
    out.variants[state.name] = made.target;
    for (const s of made.skipped) if (!out.skipped.includes(s)) out.skipped.push(s);
    for (const path of Object.keys(state.props)) {
      const base = layer.properties[path] ?? (getPropertyDefinition(path)?.default as PropValue | undefined);
      if (base !== undefined && base !== null) rest[path] = base;
    }
    const gesture = GESTURES[state.name];
    if (gesture) out[gesture] = state.name;
    else out.custom.push(state.name);
  }
  if (states.length > 0) {
    out.variants.rest = target(unit, rest).target;
    out.animate = "rest";
  }
  const overrides = transitionOverrides(layer.properties);
  if (overrides.size > 0) {
    const keyed: { default: MotionTransition } & Record<string, MotionTransition> = { default: out.transition as MotionTransition };
    for (const [path, spec] of overrides) {
      const key = motionKey(path);
      if (key) keyed[key] = motionTransition(spec);
    }
    out.transition = keyed;
  }
  if (layout.on) out.layout = true;
  const pose = (kind: PresenceKind): MotionTarget => {
    const p = PRESENCE_POSES[kind];
    return { opacity: p.opacity, ...(p.scale !== 1 ? { scale: p.scale } : {}), ...(p.y !== 0 ? { y: p.y } : {}) };
  };
  if (layout.enter !== "none") {
    out.initial = pose(layout.enter);
    if (states.length === 0) out.animate = { opacity: 1, scale: 1, y: 0 };
    else out.variants.rest = { opacity: 1, scale: 1, y: 0, ...out.variants.rest };
  }
  if (layout.exit !== "none") out.exit = pose(layout.exit);
  return out;
}
