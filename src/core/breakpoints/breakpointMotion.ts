/**
 * ROADMAP Phase 88: motion per breakpoint. Four settings on a layer say how its animation plays; like any property
 * they can be overridden at a breakpoint (Phase 43), so Mobile can be calmer than Desktop:
 *
 * - `motion.plays` (on by default): off, and the layer's clips don't play: it stays as drawn.
 * - `motion.timeScale` (1): every clip's delay and duration are multiplied by it. 2 is twice as slow.
 * - `motion.distance` (1): how far the layer travels, turns and grows, as a share of what the keyframes say. 0.5 is
 *   half the movement; 0 leaves only what isn't movement (opacity, colour).
 * - `motion.loops` (on): off, and its looping behaviours stop.
 *
 * The kernel reads them from the layer as the breakpoint being viewed sees it (`EvaluateInputs.breakpoint`). Pure.
 */
import type { Layer, MotionDocument } from "../document/schema";
import type { PropValue } from "../document/registry";
import { getPropertyDefinition } from "../document/properties";
import { appliedBreakpoints, breakpointsOf, resolveLayerAt, type Breakpoint } from "./breakpoints";

export interface MotionAt {
  plays: boolean;
  timeScale: number;
  distance: number;
  loops: boolean;
}
export const MOTION_AT_DEFAULT: MotionAt = { plays: true, timeScale: 1, distance: 1, loops: true };
export const MOTION_AT_PATHS = ["motion.plays", "motion.timeScale", "motion.distance", "motion.loops"] as const;

const num = (v: unknown, fallback: number, min: number, max: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

export function motionAtOf(props: Readonly<Record<string, unknown>>): MotionAt {
  return { plays: props["motion.plays"] !== false, timeScale: num(props["motion.timeScale"], 1, 0.1, 10), distance: num(props["motion.distance"], 1, 0, 4), loops: props["motion.loops"] !== false };
}
export const isDefaultMotionAt = (m: MotionAt): boolean => m.plays && m.loops && m.timeScale === 1 && m.distance === 1;

const appliedCache = new WeakMap<object, Map<string, Breakpoint[]>>();
/** The breakpoints whose overrides apply at `breakpointId`, remembered per document. */
function appliedAt(doc: MotionDocument, breakpointId: string): Breakpoint[] {
  let per = appliedCache.get(doc);
  if (!per) appliedCache.set(doc, (per = new Map()));
  let hit = per.get(breakpointId);
  if (!hit) per.set(breakpointId, (hit = appliedBreakpoints(breakpointsOf(doc), breakpointId)));
  return hit;
}

/** A layer as the breakpoint sees it (its own object when nothing is overridden there, or no breakpoint is given). */
export function layerAtBreakpoint(doc: MotionDocument, layer: Layer, breakpointId: string | null | undefined): Layer {
  if (!breakpointId || !layer.overrides) return layer;
  return resolveLayerAt(layer, appliedAt(doc, breakpointId));
}

/** The properties that are movement: a place, a turn, a size. `motion.distance` scales how far these go from where the layer rests. */
const MOVEMENT = /^(transform\.(x|y|z|scale|scaleX|scaleY|rotate|rotateX|rotateY|rotateZ|skewX|skewY)|frame\.(x|y|width|height|rotation)|motionPath\.(progress|offset))$/;
export const isMovement = (path: string): boolean => MOVEMENT.test(path);

/** An animated value brought `distance` of the way from where the layer rests. Anything that isn't a moving number is returned as it is. */
export function scaleDistance(path: string, value: PropValue, rest: Readonly<Record<string, unknown>>, distance: number): PropValue {
  if (distance === 1 || typeof value !== "number" || !MOVEMENT.test(path)) return value;
  const own = rest[path];
  const from = typeof own === "number" ? own : (getPropertyDefinition(path)?.default as unknown);
  return typeof from === "number" ? from + (value - from) * distance : value;
}
