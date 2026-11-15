/**
 * A layer's outline as a path (FigCraft port F5): what it fills, in its own box (0..width, 0..height, unrotated),
 * and the area its visible stroke paints. Boolean groups combine their children's outlines; the Shape Builder cuts
 * the selected layers' outlines into regions. Reads only the layer's own properties (and, for a boolean group, its
 * children's), so it works with or without a stage.
 *
 * Behaviour from FigCraft (`figcraft_render::node_outline` and `stroke_fill` as `crates/engine/src/shapebuilder.rs`
 * and `booleans.rs` use them), commit 6ea44e9. MIT, Copyright (c) 2026 ArtCraft Team and the FigCraft contributors.
 */

import type { Layer } from "../document/schema";
import { BezPath } from "../geometry/bezpath";
import { ellipse, isCornerStyle, polygonPoints, roundedRect, smoothedPolygon, starPoints, type CornerStyle } from "../geometry/shapes";
import { pathDataToBez } from "../paths/bezBridge";
import { fillPath as networkFill, fillRule as networkRule, parseNetwork, strokePath as networkStroke } from "../paths/vectorNetwork";
import { refitCurves } from "../paths/curveRefit";
import { softClose } from "../paths/pathTools";
import { applyModifiers, hasActiveModifiers, parseModifiers, type ModPath } from "../paths/modifiers";
import { combineRegions, mergeRegions, pathRegion, type PathBoolOp, type Region } from "../paths/pathOps";
import { defaultStroke, parseSides, parseWidthProfile, strokeOutline, type StrokeProps } from "../paths/strokes";
import { readCap } from "../render/strokePaint";
import { parseColor } from "../paint/colorMath";

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);

export const BOOLEAN_OPERATIONS: readonly PathBoolOp[] = ["union", "subtract", "intersect", "exclude"];
export const isBooleanOp = (v: unknown): v is PathBoolOp => typeof v === "string" && (BOOLEAN_OPERATIONS as readonly string[]).includes(v);

/** Whether a layer is a live boolean group (a container with `boolean.operation`). */
export const isBooleanGroup = (l: Layer | undefined): boolean => !!l && (l.archetype === "container" || l.archetype === "form") && isBooleanOp(l.properties["boolean.operation"]);

/** A layer's own box size (its frame). */
export const layerSize = (l: Layer): { w: number; h: number } => ({ w: Math.max(0, num(l.properties["frame.width"], 0)), h: Math.max(0, num(l.properties["frame.height"], 0)) });

/** Maps a path from a child's own box into its parent's coordinates: placed at frame.x / frame.y, turned about its centre. */
export function toParent(path: BezPath, l: Layer): BezPath {
  const x = num(l.properties["frame.x"], 0);
  const y = num(l.properties["frame.y"], 0);
  const { w, h } = layerSize(l);
  const rot = (num(l.properties["frame.rotation"], 0) * Math.PI) / 180;
  if (rot === 0) return path.map((p) => ({ x: p.x + x, y: p.y + y }));
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return path.map((p) => {
    const dx = p.x - w / 2;
    const dy = p.y - h / 2;
    return { x: x + w / 2 + dx * c - dy * s, y: y + h / 2 + dx * s + dy * c };
  });
}

/** Maps a path from a layer's own box to the canvas, given its box there (centre, size, clockwise rotation). */
export function toWorld(path: BezPath, box: { cx: number; cy: number; w: number; h: number; rot: number }, own: { w: number; h: number }): BezPath {
  const sx = own.w > 0 ? box.w / own.w : 1;
  const sy = own.h > 0 ? box.h / own.h : 1;
  const r = (box.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return path.map((p) => {
    const dx = p.x * sx - box.w / 2;
    const dy = p.y * sy - box.h / 2;
    return { x: box.cx + dx * c - dy * s, y: box.cy + dx * s + dy * c };
  });
}

/** Maps a canvas path into a box's own coordinates (the inverse of `toWorld` with the box's own size). */
export function fromWorld(path: BezPath, box: { cx: number; cy: number; w: number; h: number; rot: number }): BezPath {
  const r = (-box.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return path.map((p) => {
    const dx = p.x - box.cx;
    const dy = p.y - box.cy;
    return { x: dx * c - dy * s + box.w / 2, y: dx * s + dy * c + box.h / 2 };
  });
}

const styleOf = (l: Layer): CornerStyle => (isCornerStyle(l.properties["shape.cornerStyle"]) ? (l.properties["shape.cornerStyle"] as CornerStyle) : "round");

const radiiOf = (l: Layer): [number, number, number, number] => {
  const shared = Math.max(0, num(l.properties["shape.cornerRadius"], 0));
  const c = (n: string) => Math.max(0, num(l.properties[`shape.cornerRadius.${n}`], shared));
  return [c("topLeft"), c("topRight"), c("bottomRight"), c("bottomLeft")];
};

/** A path layer's path in its own box: the network's (or path data's) 200 × 200 space stretched to the frame. */
function pathLayerPath(l: Layer, kind: "fill" | "stroke"): { path: BezPath; evenOdd: boolean; closed: boolean } | null {
  const { w, h } = layerSize(l);
  const net = parseNetwork(l.properties["svg.network"]);
  const unit = net ? (kind === "fill" ? networkFill(net) : networkStroke(net)) : pathDataToBez(str(l.properties["svg.path"], ""));
  if (!unit || unit.isEmpty()) return null;
  const evenOdd = net ? networkRule(net) === "evenodd" : l.properties["svg.fillRule"] === "evenodd";
  return { path: unit.map((p) => ({ x: (p.x * w) / 200, y: (p.y * h) / 200 })), evenOdd, closed: unit.els.some((e) => e.t === "Z") };
}

/** Layers a modifier stack can apply to (Phase 109). */
export const MODIFIABLE = new Set(["rectangle", "ellipse", "polygon", "star", "svgPath", "line"]);

/** Whether a layer has a modifier stack with at least one modifier switched on. */
export const isModified = (l: Layer | undefined): boolean => !!l && MODIFIABLE.has(l.archetype) && typeof l.properties["shape.modifiers"] === "string" && hasActiveModifiers(parseModifiers(l.properties["shape.modifiers"]));

/** Properties that place a layer without changing its outline. */
const PLACEMENT = new Set(["frame.x", "frame.y", "frame.rotation", "positioning", "layout.zIndex"]);
/** Modified geometry by everything but placement (at most 256 shapes kept). */
const placedCache = new Map<string, ModPath | null>();

/** The modified geometry of a layer, kept per layer object: the layer's identity changes whenever any of its properties do. */
const modifiedCache = new WeakMap<Layer, ModPath | null>();

/**
 * A layer's geometry after its modifier stack, in its own box: a closed shape (from its outline) or an open line (from
 * its spine). Null when it has no geometry. Without modifiers switched on, the layer's own geometry.
 */
export function modifiedGeometry(l: Layer, layers: Readonly<Record<string, Layer>>): ModPath | null {
  if (modifiedCache.has(l)) return modifiedCache.get(l)!;
  // moving or turning a layer doesn't change its outline: a second cache ignores where it is, so a drag doesn't
  // regenerate (say) 2,000 scattered stars every frame
  const key = l.archetype + JSON.stringify(Object.entries(l.properties).filter(([k]) => !PLACEMENT.has(k)).sort(([a], [b]) => (a < b ? -1 : 1)));
  const known = placedCache.get(key);
  if (known !== undefined) {
    modifiedCache.set(l, known);
    return known;
  }
  const fill = baseOutline(l, layers);
  const base: ModPath | null = fill ? { path: fill.path, closed: true } : (() => {
    const s = baseSpine(l, layers);
    return s ? { path: s, closed: false } : null;
  })();
  const out = base ? applyModifiers(base, parseModifiers(l.properties["shape.modifiers"]), layerSize(l)) : null;
  modifiedCache.set(l, out);
  if (placedCache.size >= 256) placedCache.delete(placedCache.keys().next().value!);
  placedCache.set(key, out);
  return out;
}

/** What a layer fills, in its own box, with its fill rule; null for layers with no closed area (lines, open paths, text). */
export function layerOutline(l: Layer, layers: Readonly<Record<string, Layer>>, depth = 0): { path: BezPath; evenOdd: boolean } | null {
  if (!isModified(l)) return baseOutline(l, layers, depth);
  const m = modifiedGeometry(l, layers);
  return m && m.closed && !m.path.isEmpty() ? { path: m.path, evenOdd: false } : null;
}

function baseOutline(l: Layer, layers: Readonly<Record<string, Layer>>, depth = 0): { path: BezPath; evenOdd: boolean } | null {
  const { w, h } = layerSize(l);
  const p = l.properties;
  switch (l.archetype) {
    case "rectangle":
      return { path: roundedRect(w, h, radiiOf(l), Math.min(1, Math.max(0, num(p["shape.cornerSmoothing"], 0))), styleOf(l)), evenOdd: false };
    case "ellipse":
      return { path: ellipse(w, h, (num(p["shape.arcStart"], 0) * Math.PI) / 180, (num(p["shape.arcSweep"], 360) * Math.PI) / 180, Math.min(1, Math.max(0, num(p["shape.arcInnerRatio"], 0)))), evenOdd: true };
    case "polygon":
      return { path: smoothedPolygon(polygonPoints(w, h, num(p["shape.sides"], 6)), num(p["shape.vertexRadius"], 0), num(p["shape.cornerSmoothing"], 0), styleOf(l)), evenOdd: false };
    case "star":
      return { path: smoothedPolygon(starPoints(w, h, num(p["shape.points"], 5), num(p["shape.innerRadius"], 0.5)), num(p["shape.vertexRadius"], 0), num(p["shape.cornerSmoothing"], 0), styleOf(l)), evenOdd: false };
    case "svgPath": {
      const r = pathLayerPath(l, "fill");
      return r && (r.closed || parseNetwork(p["svg.network"])) ? { path: r.path, evenOdd: r.evenOdd } : null;
    }
    case "container":
    case "form": {
      if (isBooleanGroup(l) && depth < 32) {
        const res = booleanGroupResult(l, layers, depth + 1);
        return res ? { path: res, evenOdd: false } : null;
      }
      return { path: roundedRect(w, h, [num(p["appearance.radius"], 0), num(p["appearance.radius"], 0), num(p["appearance.radius"], 0), num(p["appearance.radius"], 0)], 0), evenOdd: false };
    }
    default:
      return null;
  }
}

/**
 * The line a layer draws along, in its own box (what text on a path follows, FigCraft port F8): a line's centre line,
 * a path layer's path (open or closed), any other shape's outline. Null when it has none.
 */
export function layerSpine(l: Layer, layers: Readonly<Record<string, Layer>>): BezPath | null {
  if (isModified(l)) return modifiedGeometry(l, layers)?.path ?? null;
  return baseSpine(l, layers);
}

function baseSpine(l: Layer, layers: Readonly<Record<string, Layer>>): BezPath | null {
  const { w, h } = layerSize(l);
  if (l.archetype === "line") return new BezPath().moveTo({ x: 0, y: h / 2 }).lineTo({ x: w, y: h / 2 });
  if (l.archetype === "svgPath") return pathLayerPath(l, "stroke")?.path ?? null;
  return baseOutline(l, layers)?.path ?? null;
}

/** The layer's stroke settings as the outliner takes them (an archetype without an explicit alignment keeps its older placement). */
function strokePropsOf(l: Layer): StrokeProps | null {
  const p = l.properties;
  const color = str(p["svg.stroke"], "none");
  const weight = num(p["svg.strokeWidth"], 0);
  if (weight <= 0 || color === "none" || !parseColor(color) || parseColor(color)!.a === 0) return null;
  const alignRaw = p["stroke.align"];
  const legacy = l.archetype === "rectangle" || l.archetype === "ellipse" ? "inside" : "center";
  const join = str(p["svg.strokeLinejoin"], "miter");
  const dash = str(p["svg.strokeDasharray"], "none");
  return {
    ...defaultStroke(),
    weight,
    align: alignRaw === "inside" || alignRaw === "center" || alignRaw === "outside" ? alignRaw : legacy,
    sides: parseSides(p["stroke.sides"]),
    capStart: readCap(p["shape.startCap"]),
    capEnd: readCap(p["shape.endCap"]),
    join: join === "round" || join === "bevel" ? join : "miter",
    miterLimit: num(p["stroke.miterLimit"], 4),
    dashes: dash === "none" ? [] : dash.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0),
    widthProfile: parseWidthProfile(p["stroke.widthProfile"]),
  };
}

/** The area a layer's visible stroke paints, in its own box; null when it has no visible stroke. */
export function layerStrokeArea(l: Layer, layers: Readonly<Record<string, Layer>>): BezPath | null {
  const props = strokePropsOf(l);
  if (!props) return null;
  if (isModified(l)) {
    const m = modifiedGeometry(l, layers);
    return m && !m.path.isEmpty() ? strokeOutline(m.path, m.closed ? props : { ...props, align: "center" }, m.closed) : null;
  }
  const { w, h } = layerSize(l);
  if (l.archetype === "line") {
    const line = new BezPath().moveTo({ x: 0, y: h / 2 }).lineTo({ x: w, y: h / 2 });
    return strokeOutline(line, { ...props, align: "center" }, false);
  }
  if (l.archetype === "svgPath") {
    const r = pathLayerPath(l, "stroke");
    return r ? strokeOutline(r.path, props, r.closed, r.evenOdd) : null;
  }
  const fill = layerOutline(l, layers);
  return fill ? strokeOutline(fill.path, props, true, fill.evenOdd) : null;
}

/**
 * A boolean group's result, in its own box: its children's outlines folded bottom to top, each operand above the first
 * combining with what is below by its own `boolean.operandOp`, else the group's operation. Null when nothing is left.
 */
export function booleanGroupResult(group: Layer, layers: Readonly<Record<string, Layer>>, depth = 0): BezPath | null {
  const op = group.properties["boolean.operation"];
  if (!isBooleanOp(op)) return null;
  // Phase 104: the operands are combined as polygons and turned back into curves once, at the end. Operands that
  // combine the same way, one after another, are merged first (a run), and a run remembers its answer, so moving one
  // child of a large group redoes only that child's part.
  const operands: Operand[] = [];
  for (const id of group.children) {
    const child = layers[id];
    if (!child || child.visible === false) continue;
    const own = child.properties["boolean.operandOp"];
    const o = operandOf(child, layers, depth, isBooleanOp(own) ? own : op);
    if (o) operands.push(o);
  }
  if (operands.length === 0) return null;
  const memo = runMemo.get(group) ?? [];
  const next: RunMemo[] = [];
  let acc = operands[0].region;
  let i = 1;
  while (i < operands.length) {
    let j = i + 1;
    while (j < operands.length && operands[j].op === operands[i].op) j++;
    const run = operands.slice(i, j);
    const merged = mergeRun(run, memo[next.length]);
    next.push(merged);
    acc = combineRegions(acc, merged.region, run[0].op);
    i = j;
  }
  runMemo.set(group, next);
  let out = refitCurves(acc, operands.map((o) => o.path));
  // Phase 108: a union group with softness melts its children together
  const softness = num(group.properties["boolean.softness"], 0);
  if (op === "union" && softness > 0 && !out.isEmpty()) out = softClose(out, softness);
  return out.isEmpty() ? null : out;
}

/** One child of a boolean group, placed in the group's box: its path, what it fills, and how it combines. */
interface Operand {
  layer: Layer;
  path: BezPath;
  region: Region;
  op: PathBoolOp;
}

/** A leaf operand's path and region depend on that layer alone, so they are kept by the layer's identity. */
const operandCache = new WeakMap<Layer, { path: BezPath; region: Region }>();

function operandOf(child: Layer, layers: Readonly<Record<string, Layer>>, depth: number, op: PathBoolOp): Operand | null {
  const leaf = child.children.length === 0;
  const hit = leaf ? operandCache.get(child) : undefined;
  if (hit) return { layer: child, path: hit.path, region: hit.region, op };
  const o = layerOutline(child, layers, depth);
  if (!o) return null;
  const path = toParent(o.path, child);
  const region = pathRegion(path, o.evenOdd ? "evenodd" : "nonzero");
  if (leaf) operandCache.set(child, { path, region });
  return { layer: child, path, region, op };
}

/** What a run of operands with the same operation adds up to, and (once one of them starts changing) the rest without it. */
interface RunMemo {
  members: Layer[];
  region: Region;
  without?: { index: number; others: Region };
}
const runMemo = new WeakMap<Layer, RunMemo[]>();

/** Subtracting several shapes subtracts their union; the other operations merge by themselves. */
const mergeHow = (op: PathBoolOp): "union" | "intersect" | "exclude" => (op === "subtract" ? "union" : op);

function mergeRun(run: readonly Operand[], before: RunMemo | undefined): RunMemo {
  const members = run.map((o) => o.layer);
  const how = mergeHow(run[0].op);
  if (before && before.members.length === members.length) {
    const changed: number[] = [];
    for (let k = 0; k < members.length && changed.length < 2; k++) if (before.members[k] !== members[k]) changed.push(k);
    if (changed.length === 0) return before;
    // nested groups are left out: their region can change while the layer object stays the same
    if (changed.length === 1 && members.length > 2 && run.every((o) => o.layer.children.length === 0)) {
      const k = changed[0];
      const others = before.without?.index === k ? before.without.others : mergeRegions(how, run.filter((_, n) => n !== k).map((o) => o.region));
      return { members, region: mergeRegions(how, [others, run[k].region]), without: { index: k, others } };
    }
  }
  return { members, region: mergeRegions(how, run.map((o) => o.region)) };
}

/** Cache for the stage: a group's result path text, recomputed only when the group or one of its descendants changed. */
const cache = new WeakMap<Layer, { deps: Layer[]; d: string }>();

function descendants(group: Layer, layers: Readonly<Record<string, Layer>>, out: Layer[] = [], depth = 0): Layer[] {
  if (depth > 32) return out;
  for (const id of group.children) {
    const c = layers[id];
    if (!c) continue;
    out.push(c);
    descendants(c, layers, out, depth + 1);
  }
  return out;
}

/** A boolean group's result as SVG path data (its own box), cached by the identity of the layers it reads. */
export function booleanGroupD(groupId: string, layers: Readonly<Record<string, Layer>>): string {
  const g = layers[groupId];
  if (!g || !isBooleanGroup(g)) return "";
  const deps = descendants(g, layers);
  const hit = cache.get(g);
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.d;
  const d = booleanGroupResult(g, layers)?.toSvg(3) ?? "";
  cache.set(g, { deps, d });
  return d;
}

