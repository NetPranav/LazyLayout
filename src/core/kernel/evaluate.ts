"use client";

/**
 * ============================================================================
 * PHASE 9, SUB-PHASE 9.3 — THE DETERMINISTIC EVALUATION KERNEL
 * ============================================================================
 * `evaluate(doc, compositionId, layerId, t, inputs)` is a pure function: the
 * exact value of every property on a layer at any time, for any inputs — the
 * oracle for preview, export parity, AI verification and scrubbing (ROADMAP
 * Phase 9's goal). Composition order (9.3, v2.1/v3.0 amendments):
 *
 *   base props → state → clips (by priority) → behaviours → STA synthesis
 *
 * Composition **time** (in/out, stretch, remap, nesting) is Phase 46's job,
 * already built (`compositions.ts`) — this module calls `clipTimeInComposition`
 * rather than re-deriving time math. Track sampling uses `easing.ts`
 * (9.1) and `interpolators.ts` (9.2). The **behaviours** slot in the
 * composition order is real and tested, but only `loop` (a pure function of
 * `t`) is implemented here — motion.ts's own header names Phase 12 as "the
 * behaviour runtime"; the rest need pointer/scroll history this kernel's
 * `inputs` snapshot doesn't carry (see `KERNEL_GAPS`). Signal bindings (v3.0:
 * evaluated after behaviours, before STA) need Phase 60 and are the same kind
 * of documented gap.
 * ============================================================================
 */

import type { MotionDocument, Clip, Track } from "../document/schema";
import { clipTimeInComposition } from "../document/compositions";
import { getPropertyDefinition } from "../document/properties";
import type { PropValue } from "../document/registry";
import { CLIP_TYPE_TO_CATEGORY } from "../rules/clip-adapter";
import { CATEGORY_PRIORITY_ORDER, type AnimationCategory } from "../types/element-grammar";
import { parseEasing } from "../document/motion";
import { sampleEasing } from "./easing";
import { interpolateValue } from "./interpolators";
import { morphOptions, morphPath } from "../paths/morphMatch";
import { followSettings, followsPath, pathSampler } from "../paths/pathFollow";
import type { StateShare } from "../states/transitions";
import { isDefaultMotionAt, layerAtBreakpoint, motionAtOf, reduceMotion, reducedPolicyOf, scaleDistance } from "../breakpoints/breakpointMotion";
import { synthesizeSingleTransformMatrix, type TransformComponents } from "../engine/EngineAdapters";
import { createSpatialPath, SpatialTrajectoryGeometry, type SpatialDiagnostic } from "../geometry/spatialPath";
import { resolveLayerAnchor } from "../geometry/pins";
import { canvasOrigin, matteShapesPath, matteSourceShapes, sharedAncestor } from "../geometry/matteShape";
import { motionBlurSigma } from "../render/fxStack";
import { hasLinks, mapValue, readLinks, resolveLayerRef } from "../links/linkModel";
import { evaluateExpression, type ExprContext } from "../expressions/evaluate";
import { hasExpressions, readExpressions, type LayerExpression } from "../expressions/exprModel";
import { parseCached } from "../expressions/parse";
import { seedFromText } from "../expressions/noise";
import { readSpeedSettings, speedEffect, speedTransform } from "./speedEffects";
import { layerBar } from "../document/compositions";
import {
  createLayerLocalMatrix,
  multiplyAffineMatrices,
  formatCssMatrix,
  getLayerParentRef,
  MAX_PARENT_CHAIN_DEPTH,
  type AffineMatrix2D,
} from "../geometry/parentTransforms";
import { is3DPath, get3DInterpolationMethod } from "../3d/paths";
import { quatFromEuler, eulerFromQuat } from "../3d/math";

export interface EvaluateInputs {
  /** Which named state (if any) is active on each layer — e.g. `{ [buttonId]: "hover" }`. */
  activeStates?: Record<string, string>;
  /** Design track D15: how far into its active state each layer is, 0-1 (default 1). Numbers blend; anything else switches at one half. */
  stateBlend?: Record<string, number>;
  /**
   * Phase 79: every state a layer is partly in, with its share (0 to 1; a spring may pass 1), in the order they are laid
   * over the base. When a layer has an entry here it is used instead of `activeStates` and `stateBlend`, so two states
   * can cross (hover easing out while pressed eases in) and a property can move on a transition of its own (`amounts`).
   */
  stateMix?: Record<string, ReadonlyArray<StateShare>>;
  /**
   * Phase 80: properties on their way from one look to another (a component instance changing variant). For each path
   * in `to` the layer shows the mix of `from` and `to` at `amount` (0 to 1; a spring may pass 1) instead of what the
   * document says. Applied before states, so a hover still lies over a variant that is changing.
   */
  propMix?: Record<string, PropMix>;
  /**
   * Phase 88: the breakpoint being viewed (null or absent: the base). A layer's properties are then the ones that
   * breakpoint sees (its overrides applied), and with them how its motion plays there (`motion.plays`, `.timeScale`,
   * `.distance`, `.loops`).
   */
  breakpoint?: string | null;
  reducedMotion?: boolean;
  /** The pointer on the page, in page px (or null when it is off the page): a matte made of clones that a pointer effector scales follows it. */
  pointer?: { x: number; y: number } | null;
  /** Where a layer is drawn on the page (its top-left, page px), for taking the pointer into a layer's own pixels. */
  layerOrigin?: (layerId: string) => { x: number; y: number } | null;
  /** A virtual scroll progress, 0-1 — reserved the same way. */
  scrollProgress?: number;
  /**
   * Design track D4: what the binding runtime (`core/bindings`) worked out for this frame, layer id -> property path ->
   * value. A driven property takes this value, after links and expressions. The runtime is stepped by whoever owns the
   * frame (the stage, a replay, an export), so evaluation stays a pure function of its inputs.
   */
  bound?: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /**
   * Phase 81: the clip-local time (seconds) the scroll driver says each scroll-driven clip is at. A scrubbed clip's is
   * progress × duration; a triggered clip's is the seconds since it was entered. A clip listed here plays at that time
   * wherever it is placed and whatever the composition's time; it is how scroll reaches the kernel without the kernel
   * knowing about scrolling.
   */
  scrollClipTime?: Record<string, number>;
  /**
   * Optional diagnostics sink for external consumers who wish to collect non-fatal spatial
   * diagnostics during evaluation without introducing global side-effects to DiagnosticBus.
   */
  diagnosticsSink?: SpatialDiagnostic[];
  /**
   * Optional spatial tolerance (px) for arc-length root inversion.
   * Defaults to 0.015 px.
   */
  spatialTolerance?: number;
}

export type ResolvedProps = Record<string, PropValue>;

export interface KernelGap {
  area: string;
  note: string;
}

/** What this kernel's composition order can't evaluate yet, and why — see the module header. */
export const KERNEL_GAPS: KernelGap[] = [
  // Restored 2026-11-17: Phase 143 removed this entry, but evaluate() still runs only `loop` (see the behaviours
  // step below). Phase 143's presets are binding drafts and a lab-only stepper; neither runs inside this kernel.
  { area: "behaviours", note: "Only `loop` is evaluated (a pure function of t). follow-pointer, magnet, tilt, proximity's spring, spring-to, inertia and noise all need pointer/scroll *history* (springs respond to a path, not a single sample) — that's the Deterministic Replay Law's territory (Phase 64) and Phase 12's behaviour runtime, not this kernel." },
];

/**
 * Per-layer lists of a document collection (clips, states, behaviours), built once per collection object. The document
 * is immutable, so a collection object never changes under its index. Performance (2026-11-18): evaluate() scanned the
 * whole collection for every layer at every sample, O(layers x clips x samples) when baking a timeline.
 */
const byLayerIndex = new WeakMap<object, Map<string, unknown[]>>();
function byLayer<T extends { layerId: string }>(collection: Readonly<Record<string, T>>, layerId: string): readonly T[] {
  let index = byLayerIndex.get(collection) as Map<string, T[]> | undefined;
  if (!index) {
    index = new Map();
    for (const item of Object.values(collection)) {
      const list = index.get(item.layerId);
      if (list) list.push(item);
      else index.set(item.layerId, [item]);
    }
    byLayerIndex.set(collection, index as Map<string, unknown[]>);
  }
  return index.get(layerId) ?? [];
}

function findActiveState(doc: MotionDocument, layerId: string, stateName: string | undefined) {
  if (!stateName) return undefined;
  return byLayer(doc.states, layerId).find((s) => s.name === stateName);
}

/** A layer's drawn path is morphed sub-path by sub-path with matched points (Phase 85), using the layer's own morph settings. */
const MORPHED_PATH = "svg.path";
function mix(property: string, method: Parameters<typeof interpolateValue>[0], from: PropValue, to: PropValue, t: number, own?: Readonly<Record<string, PropValue>>): PropValue {
  if (property === MORPHED_PATH && method === "path" && typeof from === "string" && typeof to === "string") return morphPath(from, to, t, morphOptions(own));
  return interpolateValue(method, from, to, t);
}

/**
 * Finds the keyframe pair surrounding `time` and the eased, interpolated value between them. `own` is the layer's own
 * properties, for the settings a mix depends on (how its path morphs).
 */
export function sampleTrack(track: Track, time: number, own?: Readonly<Record<string, PropValue>>): PropValue | undefined {
  const keyframes = track.keyframes;
  if (keyframes.length === 0) return undefined;
  if (keyframes.length === 1 || time <= keyframes[0].time) return keyframes[0].value;

  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return last.value;

  let i = 1;
  while (i < keyframes.length && keyframes[i].time < time) i++;
  const k0 = keyframes[i - 1];
  const k1 = keyframes[i];

  if (k0.hold) return k0.value;

  const span = k1.time - k0.time;
  const segmentT = span > 0 ? (time - k0.time) / span : 1;
  const easing = parseEasing(k1.ease ?? "linear") ?? { kind: "linear" as const };
  const eased = sampleEasing(easing, segmentT);

  const def = getPropertyDefinition(track.property);
  const method =
    def?.interpolation ??
    (is3DPath(track.property)
      ? get3DInterpolationMethod(track.property, k0.value, k1.value)
      : "discrete");
  return mix(track.property, method, k0.value, k1.value, eased, own);
}

interface CategorizedSample {
  category: AnimationCategory;
  props: ResolvedProps;
}

/**
 * Collision-safe, type-preserving serialization for fallbackProps.
 * Distinguishes numeric 1 from string "1", and absent coordinates from literal "none".
 */
function getFallbackSignature(fallbackProps?: Record<string, PropValue>): string {
  if (!fallbackProps) return "absent";
  const hasX = Object.prototype.hasOwnProperty.call(fallbackProps, "transform.x");
  const hasY = Object.prototype.hasOwnProperty.call(fallbackProps, "transform.y");
  const x = hasX ? fallbackProps["transform.x"] : undefined;
  const y = hasY ? fallbackProps["transform.y"] : undefined;
  return JSON.stringify([typeof x, x, typeof y, y]);
}

/** Maximum cached fallback coordinate variations allowed per clip before FIFO eviction */
export const MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP = 8;

/**
 * Cache for compiled spatial trajectory geometry keyed by Clip reference and fallback coordinates.
 * - Keyed primarily on `Clip` object reference via `WeakMap` for automatic garbage collection when clips mutate or are removed.
 * - Secondary lookup keyed on collision-safe fallback coordinate signature, ensuring geometry is never stale when fallback layer properties change.
 * - Bounded to MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP per clip to prevent unbounded memory growth under dynamic fallbacks.
 */
const spatialTrajectoryCache = new WeakMap<Clip, Map<string, SpatialTrajectoryGeometry | null>>();

/** Test inspection helper returning current number of cached fallback variants for a clip */
export function getSpatialTrajectoryCacheSize(clip: Clip): number {
  return spatialTrajectoryCache.get(clip)?.size ?? 0;
}

/**
 * Retrieves or builds the compiled SpatialTrajectoryGeometry for a clip if spatial trajectory
 * metadata exists with at least 2 waypoints. Returns null for purely scalar clips.
 * Cache is validated against both clip identity and relevant fallback coordinates.
 */
export function getSpatialTrajectory(
  clip: Clip,
  fallbackProps?: Record<string, PropValue>
): SpatialTrajectoryGeometry | null {
  let clipMap = spatialTrajectoryCache.get(clip);
  if (!clipMap) {
    clipMap = new Map<string, SpatialTrajectoryGeometry | null>();
    spatialTrajectoryCache.set(clip, clipMap);
  }

  const spatialTrajectory = clip.spatialTrajectories?.transform;
  if (
    !spatialTrajectory ||
    spatialTrajectory.enabled === false ||
    !spatialTrajectory.waypoints ||
    spatialTrajectory.waypoints.length < 2
  ) {
    clipMap.set("*", null);
    return null;
  }

  if (clipMap.has("*")) {
    return clipMap.get("*")!;
  }

  const fallbackKey = getFallbackSignature(fallbackProps);
  if (clipMap.has(fallbackKey)) {
    return clipMap.get(fallbackKey)!;
  }

  const geom = createSpatialPath(clip, fallbackProps);
  if (clipMap.size >= MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP) {
    const oldestKey = clipMap.keys().next().value;
    if (oldestKey !== undefined) clipMap.delete(oldestKey);
  }
  clipMap.set(fallbackKey, geom);
  return geom;
}

export interface SpeedGraphSample {
  time: number;
  speed: number;
  distance: number;
  normalizedProgress: number;
  point: { x: number; y: number };
}

/**
 * Computes a deterministic speed graph sampling for a clip with a 2D spatial trajectory.
 * Returns instantaneous speed (px/sec), cumulative distance along trajectory, and normalized progress.
 * Returns null for scalar-only clips.
 */
export function computeSpatialSpeedGraph(
  clip: Clip,
  fallbackProps?: Record<string, PropValue>,
  sampleCount = 100
): SpeedGraphSample[] | null {
  const geom = getSpatialTrajectory(clip, fallbackProps);
  if (!geom) return null;
  return geom.computeSpeedGraph(sampleCount);
}

/**
 * Samples a clip at clip-local time `time`.
 * Preserves 100% scalar backward compatibility for clips without spatial metadata.
 * For clips with spatial trajectories, evaluates the 2D spatial path and maps to transform.x / transform.y.
 * Optionally forwards diagnostics to an external sink without introducing global event-bus side effects.
 */
export function sampleClip(
  clip: Clip,
  time: number,
  fallbackProps?: Record<string, PropValue>,
  diagnosticsSink?: SpatialDiagnostic[],
  spatialTolerance = 0.015
): ResolvedProps {
  const props: ResolvedProps = {};
  for (const track of clip.tracks) {
    if (track.muted) continue;
    const value = sampleTrack(track, time, fallbackProps);
    if (value !== undefined) props[track.property] = value;
  }

  // Phase 69 Milestone 3: Single evaluation authority for 2D spatial motion paths
  const spatialTrajectory = clip.spatialTrajectories?.transform;
  if (
    spatialTrajectory &&
    spatialTrajectory.enabled !== false &&
    spatialTrajectory.waypoints &&
    spatialTrajectory.waypoints.length >= 2
  ) {
    const trackX = clip.tracks.find((t) => t.property === "transform.x");
    const trackY = clip.tracks.find((t) => t.property === "transform.y");
    const xMuted = trackX?.muted ?? false;
    const yMuted = trackY?.muted ?? false;

    if (!xMuted || !yMuted) {
      const geom = getSpatialTrajectory(clip, fallbackProps);
      if (geom) {
        if (diagnosticsSink && geom.diagnostics.length > 0) {
          diagnosticsSink.push(...geom.diagnostics);
        }
        if (diagnosticsSink) {
          const detail = geom.evaluateDetailedAtTime(time, spatialTolerance);
          if (detail.diagnostic) diagnosticsSink.push(detail.diagnostic);
          if (detail.point !== null) {
            if (!xMuted) props["transform.x"] = detail.point.x;
            if (!yMuted) props["transform.y"] = detail.point.y;
          }
        } else {
          const point = geom.evaluateAtTime(time);
          if (point !== null) {
            if (!xMuted) props["transform.x"] = point.x;
            if (!yMuted) props["transform.y"] = point.y;
          }
        }
      }
    }
  }

  return props;
}

/** Merges categorized samples onto `base`, lowest grammar §6.2 priority first, so the highest priority wins any shared property. */
function mergeByPriority(base: ResolvedProps, samples: CategorizedSample[]): ResolvedProps {
  const ranked = [...samples].sort((a, b) => {
    const ia = CATEGORY_PRIORITY_ORDER.indexOf(a.category);
    const ib = CATEGORY_PRIORITY_ORDER.indexOf(b.category);
    return (ib === -1 ? 999 : ib) - (ia === -1 ? 999 : ia); // descending priority-index = ascending priority; applied in that order so the highest priority (lowest index) lands last
  });
  let out = base;
  for (const { props } of ranked) out = { ...out, ...props };
  return out;
}

/** The `loop` behaviour: cycles a property between two values forever, a pure function of `t`. */
function applyLoopBehaviours(doc: MotionDocument, layerId: string, t: number, props: ResolvedProps): ResolvedProps {
  let out = props;
  for (const behaviour of byLayer(doc.behaviours, layerId)) {
    if (!behaviour.enabled || behaviour.type !== "loop") continue;
    const { property, from, to, duration, easing, yoyo } = behaviour.params;
    const cycle = duration > 0 ? (t % (duration * (yoyo ? 2 : 1))) / duration : 0;
    const goingBack = yoyo && cycle >= 1;
    const localT = goingBack ? cycle - 1 : Math.min(cycle, 1);
    const easedT = sampleEasing(parseEasing(easing) ?? { kind: "linear" }, localT);
    const def = getPropertyDefinition(property);
    const method = def?.interpolation ?? "discrete";
    const own = doc.layers[layerId]?.properties;
    const value = goingBack ? mix(property, method, to, from, easedT, own) : mix(property, method, from, to, easedT, own);
    out = { ...out, [property]: value };
  }
  return out;
}

const TRANSFORM_PATHS = ["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "skewX", "skewY"] as const;

/** Grammar's Single Transform Authority: every `transform.*` becomes one synthesized `transform` string (reuses `EngineAdapters.ts`'s existing synthesizer). */
function synthesizeTransform(props: ResolvedProps): ResolvedProps {
  const components: Partial<TransformComponents> = {};
  let touched = false;
  for (const key of TRANSFORM_PATHS) {
    const value = props[`transform.${key}`];
    if (typeof value !== "number") continue;
    touched = true;
    if (key === "x" || key === "y" || key === "z") (components as Record<string, string>)[key] = `${value}px`;
    else (components as Record<string, number>)[key] = value;
  }
  if (!touched) return props;
  return { ...props, transform: synthesizeSingleTransformMatrix(components) };
}

/** Converts resolved properties of a layer into its local 2D affine matrix */
function propsToLocalMatrix(layer: import("../document/schema").Layer, props: ResolvedProps): AffineMatrix2D {
  const n = (k: string, d: number) => (typeof props[k] === "number" ? (props[k] as number) : d);
  const fx = n("frame.x", 0);
  const fy = n("frame.y", 0);
  const tx = n("transform.x", 0);
  const ty = n("transform.y", 0);
  const deg = n("transform.rotate", 0);
  const s = n("transform.scale", 1);
  const sx = n("transform.scaleX", 1) * s;
  const sy = n("transform.scaleY", 1) * s;

  const w = n("frame.width", 100);
  const h = n("frame.height", 100);
  const anchor = resolveLayerAnchor(layer, w, h);

  return createLayerLocalMatrix({
    frameOrigin: [fx, fy],
    anchor,
    rotationDeg: deg,
    scaleX: sx,
    scaleY: sy,
    transformOffset: [tx, ty],
  });
}

/**
 * Evaluates the local properties of a single layer without parent transform composition: its base properties, state, clips
 * and behaviours, then its property links (Phase 76), which replace the driven properties with what they read.
 */
export function evaluateLocalProps(
  doc: MotionDocument,
  compositionId: string,
  layerId: string,
  t: number,
  inputs: EvaluateInputs = {}
): ResolvedProps {
  const layer = doc.layers[layerId];
  if (!layer) return {};
  const base = evaluateBaseProps(doc, compositionId, layerId, t, inputs);
  const linked = !hasLinks(layer.properties) && !hasExpressions(layer.properties) ? base : applyLinks({ doc, compositionId, t, inputs, base: new Map([[layerId, base]]) }, layerId, base);
  return withPathFollow(doc, compositionId, layerId, t, inputs, applyBound(linked, inputs.bound?.get(layerId)));
}

/**
 * Phase 86: a layer on a path is moved to its place on it. The place is a share of the path's length (constant speed),
 * and the move is added to `transform.x` / `transform.y` (and the path's direction to `transform.rotate` when the layer
 * turns along it), so everything after this (the single transform, parents, motion blur) sees an ordinary move.
 *
 * With `motionPath.source` the path is another layer's, followed where that layer draws it: its 200 x 200 drawing
 * stretched to its frame, at its place on the canvas (with its own `transform.x` / `transform.y`), so a path that moves
 * carries its follower. Both layers must be placed freely (not in a flow layout), as for a matte. Without a source the
 * layer's own `transform.motionPath` is followed, in px from where the layer rests.
 */
function withPathFollow(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs, props: ResolvedProps): ResolvedProps {
  if (!followsPath(props)) return props;
  const settings = followSettings((path) => props[path]);
  const n = (p: ResolvedProps, path: string): number => (typeof p[path] === "number" && Number.isFinite(p[path] as number) ? (p[path] as number) : 0);
  let dx: number;
  let dy: number;
  let angle: number;
  const sourceId = props["motionPath.source"];
  if (typeof sourceId === "string" && sourceId !== "" && sourceId !== layerId && doc.layers[sourceId]) {
    // the source's properties before any path of its own: a path following a path following this layer can't loop
    const local = new Map<string, ResolvedProps>([[layerId, props]]);
    const baseOf = (id: string): ResolvedProps => {
      let p = local.get(id);
      if (!p) local.set(id, (p = evaluateBaseProps(doc, compositionId, id, t, inputs)));
      return p;
    };
    const source = baseOf(sourceId);
    const d = source["svg.path"];
    const from = canvasOrigin(doc.layers, sourceId, baseOf);
    const own = canvasOrigin(doc.layers, layerId, baseOf);
    if (typeof d !== "string" || !from || !own) return props;
    const sampler = pathSampler(d, n(source, "frame.width") / 200, n(source, "frame.height") / 200);
    if (!sampler) return props;
    const at = sampler.at(settings.share);
    dx = from.x + n(source, "transform.x") + at.x - (own.x + n(props, "frame.width") / 2);
    dy = from.y + n(source, "transform.y") + at.y - (own.y + n(props, "frame.height") / 2);
    angle = at.angle;
  } else {
    const d = props["transform.motionPath"];
    const sampler = typeof d === "string" && d !== "" ? pathSampler(d) : null;
    if (!sampler) return props;
    const at = sampler.at(settings.share);
    dx = at.x;
    dy = at.y;
    angle = at.angle;
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const out: ResolvedProps = { ...props, "transform.x": round(n(props, "transform.x") + dx), "transform.y": round(n(props, "transform.y") + dy) };
  const turn = (settings.autoRotate ? angle : 0) + settings.rotate;
  if (turn !== 0) out["transform.rotate"] = round(n(props, "transform.rotate") + turn);
  return synthesizeTransform(out);
}

/** Design track D4: the binding runtime's values for this layer replace the properties they drive. Nothing bound: the same object back. */
function applyBound(props: ResolvedProps, bound: ReadonlyMap<string, number> | undefined): ResolvedProps {
  if (!bound || bound.size === 0) return props;
  const out: ResolvedProps = { ...props };
  for (const [path, value] of bound) out[path] = value;
  return out;
}

// ---------------------------------------------------------------------------
// Property links (Phase 76)
// ---------------------------------------------------------------------------

interface LinkContext {
  doc: MotionDocument;
  compositionId: string;
  t: number;
  inputs: EvaluateInputs;
  /** Each layer's properties before links, worked out once per evaluation. */
  base: Map<string, ResolvedProps>;
}

const baseOf = (ctx: LinkContext, layerId: string): ResolvedProps => {
  let props = ctx.base.get(layerId);
  if (!props) ctx.base.set(layerId, (props = evaluateBaseProps(ctx.doc, ctx.compositionId, layerId, ctx.t, ctx.inputs)));
  return props;
};

/** When a property's keyframes begin and end, in composition seconds, and what they hold (null with fewer than two). */
function keyRange(ctx: LinkContext, layerId: string, path: string): { first: number; last: number; firstValue: number; lastValue: number } | null {
  const comp = ctx.doc.compositions[ctx.compositionId];
  if (!comp) return null;
  const bar = layerBar(comp, layerId);
  const marks: Array<{ time: number; value: number }> = [];
  for (const placed of comp.clips) {
    const clip = ctx.doc.clips[placed.clipId];
    if (!clip || clip.layerId !== layerId || !clip.enabled) continue;
    for (const track of clip.tracks) {
      if (track.property !== path || track.muted) continue;
      for (const k of track.keyframes) if (typeof k.value === "number") marks.push({ time: bar.start + (placed.offset + (clip.delay ?? 0) + k.time) * bar.stretch, value: k.value });
    }
  }
  if (marks.length < 2) return null;
  marks.sort((a, b) => a.time - b.time);
  return { first: marks[0].time, last: marks[marks.length - 1].time, firstValue: marks[0].value, lastValue: marks[marks.length - 1].value };
}

/** An expression's number for a property, given the value before it; undefined when it can't be worked out (the property then keeps its value). */
function runExpression(ctx: LinkContext, layerId: string, path: string, expr: LayerExpression, value: number, stack: readonly string[]): number | undefined {
  const parsed = parseCached(expr.text);
  if (!parsed.ok) return undefined;
  const comp = ctx.doc.compositions[ctx.compositionId];
  const at = (t: number): LinkContext => (t === ctx.t ? ctx : { ...ctx, t, base: new Map() });
  const exprCtx: ExprContext = {
    time: ctx.t,
    value,
    fps: comp?.fps ?? 60,
    duration: comp?.duration ?? 0,
    seed: seedFromText(`${layerId}|${path}`),
    valueAtTime: (t) => {
      const v = baseOf(at(t), layerId)[path];
      return typeof v === "number" ? v : undefined;
    },
    ref: (ref, property, t) => {
      const other = resolveLayerRef(ctx.doc.layers, ref);
      if (!other) return undefined;
      const v = drivenValue(at(t ?? ctx.t), other, property, stack);
      return typeof v === "number" ? v : undefined;
    },
    keys: () => keyRange(ctx, layerId, path),
  };
  return evaluateExpression(parsed.ast, exprCtx);
}

/**
 * The value one property has at this moment, with its drivers followed: the property's own value (keyframes, behaviours),
 * then a link that drives it (what the link reads, carried across its map), then an expression on it (which sees that as
 * `value`). `stack` holds the properties being worked out, so a cycle (which the commands refuse, but a file can hold) stops
 * there and falls back to the property's own value instead of looping.
 */
function drivenValue(ctx: LinkContext, layerId: string, path: string, stack: readonly string[]): PropValue | undefined {
  const here = `${layerId}|${path}`;
  const layer = ctx.doc.layers[layerId];
  if (!layer || stack.includes(here)) return undefined;
  const inner = [...stack, here];
  let current: PropValue | undefined;
  const link = readLinks(layer.properties).find((l) => l.enabled && l.target === path);
  if (link) {
    const from = drivenValue(ctx, link.source, link.sourceProperty, inner);
    if (typeof from === "number" && Number.isFinite(from)) current = mapValue(link, from);
  }
  if (current === undefined) {
    const own = baseOf(ctx, layerId)[path];
    current = own !== undefined ? own : (getPropertyDefinition(path)?.default as PropValue | undefined);
  }
  const expr = readExpressions(layer.properties).find((e) => e.enabled && e.target === path);
  if (expr && typeof current === "number") {
    const out = runExpression(ctx, layerId, path, expr, current, inner);
    if (out !== undefined) current = out;
  }
  return current;
}

function applyLinks(ctx: LinkContext, layerId: string, base: ResolvedProps): ResolvedProps {
  const layer = ctx.doc.layers[layerId];
  const targets = new Set<string>();
  for (const link of readLinks(layer.properties)) if (link.enabled) targets.add(link.target);
  for (const expr of readExpressions(layer.properties)) if (expr.enabled) targets.add(expr.target);
  let out = base;
  for (const path of targets) {
    const value = drivenValue(ctx, layerId, path, []);
    if (typeof value === "number" && value !== out[path]) out = { ...out, [path]: value };
  }
  return out;
}

/** One layer's properties between two looks (Phase 80). */
export interface PropMix {
  from: Readonly<Record<string, PropValue>>;
  to: Readonly<Record<string, PropValue>>;
  amount: number;
}

/**
 * A value `amount` of the way from one to another, for a state or a variant arriving. Numbers follow the amount past 1
 * (a spring's overshoot); colours and the rest mix by the property's own rule, between 0 and 1; what can't be mixed
 * switches half way.
 */
export function mixValue(path: string, from: PropValue | undefined | null, to: PropValue, amount: number): PropValue | undefined | null {
  if (amount === 1) return to;
  if (from === undefined || from === null) return amount >= 0.5 ? to : from;
  if (typeof to === "number" && typeof from === "number") return from + (to - from) * amount;
  return interpolateValue(getPropertyDefinition(path)?.interpolation ?? "discrete", from, to, Math.min(1, Math.max(0, amount)));
}

function evaluateBaseProps(
  doc: MotionDocument,
  compositionId: string,
  layerId: string,
  t: number,
  inputs: EvaluateInputs = {}
): ResolvedProps {
  const stored = doc.layers[layerId];
  if (!stored) return {};
  // 0. The layer as the breakpoint being viewed sees it (Phase 88), and how its motion plays there.
  const layer = layerAtBreakpoint(doc, stored, inputs.breakpoint);
  // Phase 93: under reduced motion the layer's own policy decides what is left of its animation
  const reduced = inputs.reducedMotion === true ? reducedPolicyOf(layer.properties) : null;
  const motion = reduced ? reduceMotion(motionAtOf(layer.properties), reduced) : motionAtOf(layer.properties);
  const calm = !isDefaultMotionAt(motion);

  // 1. Base props.
  let resolved: ResolvedProps = { ...layer.properties };

  // 1b. A look on its way to another (Phase 80).
  const mix = inputs.propMix?.[layerId];
  if (mix) {
    for (const [path, to] of Object.entries(mix.to)) {
      const value = mixValue(path, mix.from[path], to, mix.amount);
      if (value === undefined || value === null) delete resolved[path];
      else resolved[path] = value;
    }
  }

  // 2. State.
  const shares = inputs.stateMix?.[layerId];
  const activeState = shares ? undefined : findActiveState(doc, layerId, inputs.activeStates?.[layerId]);
  if (shares) {
    for (const share of shares) {
      const state = findActiveState(doc, layerId, share.name);
      if (!state) continue;
      let next: ResolvedProps | null = null;
      for (const [path, to] of Object.entries(state.props)) {
        const amount = share.amounts?.[path] ?? share.amount;
        if (amount === 0) continue;
        // a property the base layer doesn't set starts from its default (a rectangle's opacity is 1 without saying so)
        const from = resolved[path] ?? (getPropertyDefinition(path)?.default as PropValue | undefined);
        const value = mixValue(path, from, to, amount);
        const shown = value === from && resolved[path] === undefined ? undefined : value;
        if (shown !== resolved[path]) (next ??= { ...resolved })[path] = shown as PropValue;
      }
      if (next) resolved = next;
    }
  }
  if (activeState) {
    const amount = inputs.stateBlend?.[layerId];
    if (amount === undefined || amount >= 1) resolved = { ...resolved, ...activeState.props };
    else if (amount > 0) {
      const next: ResolvedProps = { ...resolved };
      for (const [path, to] of Object.entries(activeState.props)) {
        const from = resolved[path];
        if (typeof to === "number" && typeof from === "number") next[path] = from + (to - from) * amount;
        else if (amount >= 0.5) next[path] = to;
      }
      resolved = next;
    }
  }

  // 3. Clips, by grammar §6.2 priority.
  const comp = doc.compositions[compositionId];
  if (comp) {
    const samples: CategorizedSample[] = [];
    // how far a sample goes from where the layer rests (Phase 88: `motion.distance`)
    const far = (props: ResolvedProps): ResolvedProps => {
      if (motion.distance === 1) return props;
      const out: ResolvedProps = {};
      for (const [path, value] of Object.entries(props)) out[path] = scaleDistance(path, value as PropValue, layer.properties, motion.distance);
      return out;
    };
    for (const clip of byLayer(doc.clips, layerId)) {
      if (!clip.enabled || !motion.plays) continue;
      const driven = inputs.scrollClipTime?.[clip.id];
      if (driven !== undefined) {
        samples.push({
          category: CLIP_TYPE_TO_CATEGORY[clip.type],
          props: far(sampleClip(
            clip,
            // a scroll-scrubbed animation doesn't follow the scroll under reduced motion: it shows its end (the fades done)
            reduced === "auto" ? clip.duration : Math.min(clip.duration, Math.max(0, driven)),
            layer.properties,
            inputs.diagnosticsSink,
            inputs.spatialTolerance
          )),
        });
        continue;
      }
      // a slower clip (Phase 88: `motion.timeScale`) is the same clip with its delay and duration stretched
      const k = motion.timeScale;
      const timing = clipTimeInComposition(comp, k === 1 ? clip : { ...clip, duration: clip.duration * k, delay: (clip.delay ?? 0) * k, repeatDelay: (clip.repeatDelay ?? 0) * k }, t);
      if (!timing) continue;
      samples.push({
        category: CLIP_TYPE_TO_CATEGORY[clip.type],
        props: far(sampleClip(
          clip,
          k === 1 ? timing.time : timing.time / k,
          layer.properties,
          inputs.diagnosticsSink,
          inputs.spatialTolerance
        )),
      });
    }
    resolved = mergeByPriority(resolved, samples);
  }

  // 4. Behaviours (composition slot — see KERNEL_GAPS for what's deferred to Phase 12).
  if (!calm) resolved = applyLoopBehaviours(doc, layerId, t, resolved);
  else if (motion.loops) {
    const looped = applyLoopBehaviours(doc, layerId, t / motion.timeScale, resolved);
    if (looped !== resolved && motion.distance !== 1) {
      const next: ResolvedProps = { ...looped };
      for (const path of Object.keys(looped)) if (looped[path] !== resolved[path]) next[path] = scaleDistance(path, looped[path] as PropValue, layer.properties, motion.distance);
      resolved = next;
    } else resolved = looped;
  }

  return resolved;
}

/**
 * Synthesizes 3D rotation quaternion if Euler angle tracks were animated.
 * Converts interpolated Euler angles to quaternion via quatFromEuler("XYZ").
 */
export function synthesize3DQuaternions(doc: MotionDocument, props: ResolvedProps): ResolvedProps {
  // the hot path: a 2D document has no 3D objects, so there is nothing to scan
  if (!doc.objects) return props;
  const eulerPattern = /^3d:objects\/([^/]+)\/transform\.rotationEuler\.(x|y|z)$/;
  const objectsWithEuler = new Set<string>();

  for (const key of Object.keys(props)) {
    const match = eulerPattern.exec(key);
    if (match) {
      objectsWithEuler.add(match[1]);
    }
  }

  if (objectsWithEuler.size === 0) return props;

  const out = { ...props };
  for (const objId of objectsWithEuler) {
    const quatKey = `3d:objects/${objId}/transform.rotationQuat`;
    if (Object.prototype.hasOwnProperty.call(props, quatKey)) {
      continue;
    }

    const baseObj = doc.objects?.[objId];
    const baseQuat = baseObj?.transform?.rotationQuat ?? [0, 0, 0, 1];
    const baseEuler = eulerFromQuat("XYZ", baseQuat);

    const exKey = `3d:objects/${objId}/transform.rotationEuler.x`;
    const eyKey = `3d:objects/${objId}/transform.rotationEuler.y`;
    const ezKey = `3d:objects/${objId}/transform.rotationEuler.z`;

    const ex = typeof props[exKey] === "number" ? (props[exKey] as number) : baseEuler[0];
    const ey = typeof props[eyKey] === "number" ? (props[eyKey] as number) : baseEuler[1];
    const ez = typeof props[ezKey] === "number" ? (props[ezKey] as number) : baseEuler[2];

    const q = quatFromEuler("XYZ", ex, ey, ez);
    out[quatKey] = [q[0], q[1], q[2], q[3]];
  }

  return out;
}

/**
 * The evaluation kernel. Pure: the same `(doc, compositionId, layerId, t,
 * inputs)` always produces the same `ResolvedProps` (fuzz-tested for this in
 * `__tests__/evaluate.test.ts`).
 */
export function evaluate(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs = {}): ResolvedProps {
  const layer = doc.layers[layerId];
  if (!layer) return {};
  return withSpeedEffects(doc, compositionId, layerId, t, inputs, withMotionBlur(doc, compositionId, layerId, t, inputs, withMatte(doc, compositionId, layerId, t, inputs, evaluateWorld(doc, compositionId, layerId, t, inputs))));
}

// ---------------------------------------------------------------------------
// Track mattes (Phase 74): another layer is the mask
// ---------------------------------------------------------------------------

/** Which layers use each layer as a matte, by source id. Built once per document (the document is immutable, so the answer can't go stale). */
const matteTargets = new WeakMap<MotionDocument, Map<string, string[]>>();
export function mattesOf(doc: MotionDocument): Map<string, string[]> {
  let index = matteTargets.get(doc);
  if (!index) {
    index = new Map();
    for (const layer of Object.values(doc.layers)) {
      const source = layer.properties["matte.source"];
      const mode = layer.properties["matte.mode"];
      if (typeof source !== "string" || source === "" || source === layer.id || !doc.layers[source] || typeof mode !== "string" || mode === "none") continue;
      index.set(source, [...(index.get(source) ?? []), layer.id]);
    }
    matteTargets.set(doc, index);
  }
  return index;
}

/**
 * A layer that is a matte's source is hidden (unless a layer using it asks for it to show); a layer with a matte gets
 * the source's shape, at this moment, as its mask. A matte the geometry can't read (see `matteShape.ts`) changes nothing.
 */
function withMatte(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs, resolved: ResolvedProps): ResolvedProps {
  const index = mattesOf(doc);
  if (index.size === 0) return resolved;
  const local = new Map<string, ResolvedProps>();
  const localOf = (id: string): ResolvedProps => {
    let props = local.get(id);
    if (!props) local.set(id, (props = evaluateLocalProps(doc, compositionId, id, t, inputs)));
    return props;
  };
  let out = resolved;

  const targets = index.get(layerId);
  if (targets && targets.length > 0 && (matteSourceShapes(doc.layers, layerId, localOf) || matteSourceShapes(doc.layers, layerId, localOf, { upTo: sharedAncestor(doc.layers, layerId, targets[0]) })) && !targets.some((id) => doc.layers[id].properties["matte.showSource"] === true)) {
    out = { ...out, "appearance.opacity": 0 };
  }

  const layer = doc.layers[layerId];
  const sourceId = layer.properties["matte.source"];
  const mode = layer.properties["matte.mode"];
  if (typeof sourceId === "string" && sourceId !== "" && sourceId !== layerId && typeof mode === "string" && mode !== "none" && doc.layers[sourceId]) {
    // measured on the page when every layer on the way can be read; else from the layer both ends share (a page frame
    // the page lays out itself, say), with the pointer taken into that layer's own pixels
    let shapes = matteSourceShapes(doc.layers, sourceId, localOf, { pointer: inputs.pointer ?? null });
    let origin = canvasOrigin(doc.layers, layerId, localOf);
    if (!shapes || !origin) {
      const upTo = sharedAncestor(doc.layers, sourceId, layerId);
      const at = upTo ? inputs.layerOrigin?.(upTo) : null;
      const pointer = inputs.pointer && at ? { x: inputs.pointer.x - at.x, y: inputs.pointer.y - at.y } : null;
      shapes = matteSourceShapes(doc.layers, sourceId, localOf, { pointer, upTo });
      origin = canvasOrigin(doc.layers, layerId, localOf, upTo);
    }
    if (shapes && origin) {
      const source = localOf(sourceId);
      const fill = source["appearance.background.color"];
      const opacity = typeof source["appearance.opacity"] === "number" ? (source["appearance.opacity"] as number) : 1;
      out = {
        ...out,
        "mask.mode": mode,
        "mask.shape": "path",
        "mask.path": matteShapesPath(shapes, origin),
        ...(typeof fill === "string" && fill !== "" && fill !== "transparent" ? { "mask.fill": fill } : {}),
        "mask.opacity": opacity * (typeof out["mask.opacity"] === "number" ? (out["mask.opacity"] as number) : 1),
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Motion blur (Phase 75): opt-in, from how fast the layer is moving
// ---------------------------------------------------------------------------

/**
 * With the layer's motion blur switch on, adds how much to blur across and down (`motion.blur.x` and `motion.blur.y`, the
 * standard deviations in px) from the layer's velocity at `t`, measured over one frame centred on `t` and scaled by the
 * shutter angle (`motion.shutterAngle`, 180 by default). A layer that is still, or barely moving, gets nothing. It is a
 * pure function of the document and `t`, so scrubbing shows the same blur as playing.
 */
/** A layer's world velocity (px per second) at `t`: its place half a frame either side, as the motion blur measures it. */
function layerVelocity(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs): { x: number; y: number } {
  const fps = doc.compositions[compositionId]?.fps ?? 60;
  const half = 0.5 / fps;
  const at = (time: number) => {
    const world = evaluateWorld(doc, compositionId, layerId, time, inputs)["transform.worldMatrix"] as unknown as AffineMatrix2D | undefined;
    return world ? { x: world[4], y: world[5] } : { x: 0, y: 0 };
  };
  const t0 = Math.max(0, t - half);
  const t1 = t + half;
  const a = at(t0);
  const b = at(t1);
  const dt = t1 - t0;
  return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
}

function withMotionBlur(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs, resolved: ResolvedProps): ResolvedProps {
  const layer = doc.layers[layerId];
  if (!layer || layer.motionBlur !== true) return resolved;
  const fps = doc.compositions[compositionId]?.fps ?? 60;
  const shutter = typeof resolved["motion.shutterAngle"] === "number" ? (resolved["motion.shutterAngle"] as number) : 180;
  const sigma = motionBlurSigma(layerVelocity(doc, compositionId, layerId, t, inputs), fps, shutter);
  return sigma.x > 0.05 || sigma.y > 0.05 ? { ...resolved, "motion.blur.x": sigma.x, "motion.blur.y": sigma.y } : resolved;
}

/**
 * Design track D18: squash and stretch along the motion, lean into turns and a speed-driven blur, from how fast the layer moves.
 * A layer with no speed effect switched on is returned as it was without measuring anything; one that is at rest is too.
 */
function withSpeedEffects(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs, resolved: ResolvedProps): ResolvedProps {
  const settings = readSpeedSettings((path) => resolved[path]);
  if (!settings) return resolved;
  const effect = speedEffect(settings, layerVelocity(doc, compositionId, layerId, t, inputs));
  if (!effect) return resolved;
  const world = resolved["transform.worldMatrix"] as unknown as AffineMatrix2D | undefined;
  const rotation = world ? (Math.atan2(world[1], world[0]) * 180) / Math.PI : 0;
  const extra = speedTransform(effect, rotation);
  const base = typeof resolved.transform === "string" && resolved.transform !== "none" ? resolved.transform : "";
  const out: ResolvedProps = { ...resolved };
  if (extra) out.transform = `${base} ${extra}`.trim();
  if (settings.blur > 0) {
    const bx = Math.max(effect.blurX, typeof resolved["motion.blur.x"] === "number" ? (resolved["motion.blur.x"] as number) : 0);
    const by = Math.max(effect.blurY, typeof resolved["motion.blur.y"] === "number" ? (resolved["motion.blur.y"] as number) : 0);
    if (bx > 0.05 || by > 0.05) {
      out["motion.blur.x"] = bx;
      out["motion.blur.y"] = by;
    }
  }
  return out;
}

function evaluateWorld(doc: MotionDocument, compositionId: string, layerId: string, t: number, inputs: EvaluateInputs): ResolvedProps {
  const layer = doc.layers[layerId];

  let resolved = evaluateLocalProps(doc, compositionId, layerId, t, inputs);
  resolved = synthesize3DQuaternions(doc, resolved);

  // Phase 73: Transform composition across independent parent chain
  const parentRef = getLayerParentRef(layer);
  if (parentRef && doc.layers[parentRef]) {
    // Collect ancestor chain: Child -> Parent -> Grandparent
    const chain: Array<{ layer: import("../document/schema").Layer; props: ResolvedProps }> = [
      { layer, props: resolved },
    ];
    const visited = new Set<string>([layerId]);
    let currentId: string | null | undefined = parentRef;
    let depth = 0;

    while (currentId && depth++ < MAX_PARENT_CHAIN_DEPTH) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const parentLayer = doc.layers[currentId];
      if (!parentLayer) break;
      const parentProps = evaluateLocalProps(doc, compositionId, currentId, t, inputs);
      chain.push({ layer: parentLayer, props: parentProps });
      currentId = getLayerParentRef(parentLayer);
    }

    // Multiply from root ancestor down to child: M_world = M_root · ... · M_child
    let composedM = propsToLocalMatrix(chain[chain.length - 1].layer, chain[chain.length - 1].props);
    for (let i = chain.length - 2; i >= 0; i--) {
      const nextM = propsToLocalMatrix(chain[i].layer, chain[i].props);
      composedM = multiplyAffineMatrices(composedM, nextM);
    }

    resolved = {
      ...resolved,
      transform: formatCssMatrix(composedM),
      "transform.worldMatrix": composedM as unknown as PropValue,
    };
  } else {
    // Unparented layer
    const localM = propsToLocalMatrix(layer, resolved);
    resolved = {
      ...synthesizeTransform(resolved),
      "transform.worldMatrix": localM as unknown as PropValue,
    };
  }

  return resolved;
}
