/**
 * The export of drivers (Design track D4, FX-EXP-01): a small, readable script that makes the exported page react to the
 * pointer, the scroll and time the way the editor does. It imports nothing from LazyLayout; it is written out as plain
 * source with only the operators this project's drivers use, and a NOTICE at the top.
 *
 * Two parts, in one file:
 *  - the CORE: the same bus and the same operator maths as `core/bindings` (`inputBus.ts`, `evaluate.ts`), with no page access,
 *    so a test can run it against the core on the same inputs and compare (`__tests__/driversParity.test.ts`);
 *  - the GLUE: reads the real page (pointer, scroll, the clock), steps the CORE each frame, and applies the results.
 *
 * Results are applied with CSS's independent `translate`, `rotate` and `scale` properties and with `opacity`, which compose
 * with the layer's own `transform`, so the script needs no knowledge of what the layer already does. That limits it to the
 * offsets the editor adds (`transform.x`, `transform.y`, `transform.rotate`, `transform.scale`, `appearance.opacity`, blends
 * `add` and `multiply`). A driver the export cannot carry is left out with a warning that says why.
 */
import type { Binding, Operator, Signal, SignalExpr } from "../../document/signals";
import { defaultBlend } from "../../document/signals";
import type { MotionDocument } from "../../document/schema";
import { resolveSpringConfig } from "../../kernel/springs";
import { getLayerGeometry } from "../../document/properties";
import { resolveProps } from "../../render/resolve";
import { baseCopies, hasLiveEffector } from "../../render/copies";
import { readEffector } from "../../render/effector";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { getPropertyDefinition } from "../../document/properties";
import { readLinks, resolveLayerRef } from "../../links/linkModel";
import { readExpressions } from "../../expressions/exprModel";
import { expressionRefs, parseExpression } from "../../expressions/parse";
import { seedFromText } from "../../expressions/noise";
import { EXPRESSION_RUNTIME_SOURCE } from "./generated/expressionRuntime";

/** The properties a driver may drive in an export, and the CSS each becomes. */
const EXPORTABLE = ["transform.x", "transform.y", "transform.rotate", "transform.scale", "appearance.opacity"] as const;

/** One driver, resolved to what the script needs: numbers only, spring terms already physical. */
interface DriverJson {
  layer: string;
  /** A property path, or `--name` for a CSS variable. */
  prop: string;
  /** `set`: a CSS variable's value (the last driver wins). */
  blend: "add" | "multiply" | "set";
  signal: Signal;
  ops: Record<string, unknown>[];
}

export interface DriversExport {
  /** The script, or null when there is nothing to carry. */
  source: string | null;
  /** The layers the page script looks for (`data-ll`). */
  layerIds: Set<string>;
  /** Every layer the page script moves or fades (drivers, links, expressions), found by `data-ll`. */
  propLayerIds: Set<string>;
  /** The layers whose copies the page script restyles (`data-ll-copy` on each copy's wrapper). */
  effectorLayerIds: Set<string>;
  warnings: string[];
}

const SERVED_SIGNALS = new Set(["pointer", "pointerIn", "pointerInside", "layerState", "proximity", "scroll", "view", "time", "frameDt", "seed", "constant"]);
const SUPPORTED_OPS = new Set(["smooth", "spring", "remap", "clamp", "add", "mul", "min", "max", "abs", "component", "quantize", "deadzone", "falloff", "length"]);

function opsOf(expr: SignalExpr): { ops: Record<string, unknown>[]; problem: string | null } {
  const ops: Record<string, unknown>[] = [];
  for (const o of expr.operators as Operator[]) {
    if (!SUPPORTED_OPS.has(o.op)) return { ops, problem: `the operator ${o.op} is not in the export yet` };
    if (o.op === "spring") {
      const p = resolveSpringConfig(o.spring);
      ops.push({ op: "spring", k: p.stiffness, c: p.damping, m: p.mass });
    } else ops.push({ ...o });
  }
  return { ops, problem: null };
}

/** The drivers the export can carry, and a warning for each it cannot. */
export function exportableDrivers(doc: MotionDocument): { drivers: DriverJson[]; warnings: string[] } {
  const drivers: DriverJson[] = [];
  const warnings: string[] = [];
  for (const b of Object.values(doc.bindings ?? {}) as Binding[]) {
    if (!b.enabled) continue;
    const name = b.name ?? b.id;
    const skip = (why: string) => warnings.push(`The driver "${name}" is not in the export: ${why}.`);
    if (b.target.kind !== "property" && b.target.kind !== "cssvar") { skip(`${b.target.kind} targets are not exported yet`); continue; }
    if (b.target.on.kind !== "layer") { skip("only drivers on one layer are exported"); continue; }
    if (b.target.kind === "property" && !(EXPORTABLE as readonly string[]).includes(b.target.path)) { skip(`${b.target.path} cannot be driven in an export yet`); continue; }
    const blend = b.target.kind === "cssvar" ? (b.blend ?? "replace") : (b.blend ?? defaultBlend(b.target));
    if (b.target.kind === "cssvar" ? blend !== "replace" : blend !== "add" && blend !== "multiply") { skip(`the ${blend} blend is not exported`); continue; }
    if (b.guard) { skip("a driver with a condition is not exported yet"); continue; }
    if (!SERVED_SIGNALS.has(b.expr.signal.kind) || (b.expr.signal.kind === "layerState" && b.expr.signal.channel === "focus")) { skip(`the ${b.expr.signal.kind === "layerState" ? b.expr.signal.channel : b.expr.signal.kind} signal is not exported yet`); continue; }
    const { ops, problem } = opsOf(b.expr);
    if (problem) { skip(problem); continue; }
    if (!doc.layers[b.target.on.ref]) { skip("its layer is gone"); continue; }
    drivers.push(b.target.kind === "cssvar"
      ? { layer: b.target.on.ref, prop: `--${b.target.name}`, blend: "set", signal: b.expr.signal, ops }
      : { layer: b.target.on.ref, prop: b.target.path, blend: blend as "add" | "multiply", signal: b.expr.signal, ops });
  }
  return { drivers, warnings };
}

/** A number property's value as the editor reads it: the layer's own, else the registry default; null when it is neither a number. */
function designValue(doc: MotionDocument, layerId: string, prop: string): { own: number | null; base: number | null } {
  const own = doc.layers[layerId]?.properties[prop];
  const dflt = getPropertyDefinition(prop)?.default;
  const ownNum = typeof own === "number" && Number.isFinite(own) ? own : null;
  return { own: ownNum, base: ownNum ?? (typeof dflt === "number" ? dflt : null) };
}

interface GraphNode {
  key: string;
  own: number | null;
  base: number | null;
  link?: { src: string; map: "direct" | "range"; clamp: boolean; inMin: number; inMax: number; outMin: number; outMax: number };
  expr?: { ast: unknown; seed: number };
}
interface GraphJson {
  fps: number;
  duration: number;
  nodes: GraphNode[];
  /** Values of properties no link or expression drives, read by links and by `ref`. */
  statics: Record<string, { base: number | null }>;
  /** Layer names (and ids) an expression's `ref("Name", ...)` uses, to ids. */
  names: Record<string, string>;
}
interface PropJson {
  key: string;
  layer: string;
  prop: (typeof EXPORTABLE)[number];
  /** The layer's design value, already in the page's CSS. */
  base: number;
}

/** Links and expressions the export can carry: on one of the five exportable properties, direct or range maps. */
export function exportableGraph(doc: MotionDocument): { graph: GraphJson | null; warnings: string[]; nodeProps: PropJson[] } {
  const warnings: string[] = [];
  const nodes = new Map<string, GraphNode>();
  const refs = new Set<string>();
  const names: Record<string, string> = {};
  const nameOf = (id: string) => doc.layers[id]?.name ?? id;
  for (const layer of Object.values(doc.layers)) {
    const on = (path: string) => (EXPORTABLE as readonly string[]).includes(path);
    for (const l of readLinks(layer.properties)) {
      if (!l.enabled) continue;
      const label = `The link on ${layer.name} ${l.target}`;
      if (!on(l.target)) { warnings.push(`${label} is not in the export: only position, rotation, scale and opacity can be driven.`); continue; }
      if (l.map === "curve") { warnings.push(`${label} is not in the export: curve maps are not exported yet (direct and range are).`); continue; }
      if (!doc.layers[l.source]) { warnings.push(`${label} is not in the export: its source layer is gone.`); continue; }
      const key = `${layer.id}|${l.target}`;
      const d = designValue(doc, layer.id, l.target);
      const node = nodes.get(key) ?? { key, own: d.own, base: d.base };
      node.link = { src: `${l.source}|${l.sourceProperty}`, map: l.map, clamp: l.clamp, inMin: l.inMin, inMax: l.inMax, outMin: l.outMin, outMax: l.outMax };
      nodes.set(key, node);
      refs.add(node.link.src);
    }
    for (const e of readExpressions(layer.properties)) {
      if (!e.enabled) continue;
      const label = `The expression on ${layer.name} ${e.target}`;
      if (!on(e.target)) { warnings.push(`${label} is not in the export: only position, rotation, scale and opacity can be driven.`); continue; }
      const parsed = parseExpression(e.text);
      if (!parsed.ok) { warnings.push(`${label} is not in the export: it does not parse.`); continue; }
      const key = `${layer.id}|${e.target}`;
      const d = designValue(doc, layer.id, e.target);
      const node = nodes.get(key) ?? { key, own: d.own, base: d.base };
      node.expr = { ast: JSON.parse(JSON.stringify(parsed.ast)), seed: seedFromText(key) };
      nodes.set(key, node);
      for (const r of expressionRefs(parsed.ast)) {
        const id = resolveLayerRef(doc.layers, r.layer);
        if (id) { names[r.layer] = id; refs.add(`${id}|${r.property}`); }
      }
    }
  }
  if (nodes.size === 0) return { graph: null, warnings, nodeProps: [] };
  const statics: GraphJson["statics"] = {};
  for (const ref of refs) {
    if (nodes.has(ref)) continue;
    const [layerId, ...rest] = ref.split("|");
    statics[ref] = { base: designValue(doc, layerId, rest.join("|")).base };
  }
  // a layer that a clip also animates is drawn by the static export as designed: say so
  const clipped = new Set(Object.values(doc.clips ?? {}).filter((c) => c.enabled).map((c) => c.layerId));
  for (const n of nodes.values()) if (clipped.has(n.key.split("|")[0])) warnings.push(`${nameOf(n.key.split("|")[0])} is also animated by a clip, which the export does not play: its link or expression reads its design value.`);
  const comp = doc.compositions?.[MAIN_COMPOSITION_ID];
  const nodeProps = [...nodes.values()].filter((n) => n.base !== null).map((n) => ({ key: n.key, layer: n.key.split("|")[0], prop: n.key.split("|")[1] as PropJson["prop"], base: n.base as number }));
  return { graph: { fps: comp?.fps ?? 60, duration: comp?.duration ?? 0, nodes: [...nodes.values()], statics, names }, warnings, nodeProps };
}

/** Every (layer, property) the page script writes: the drivers' and the links' and expressions'. */
export function exportableProps(doc: MotionDocument): { props: PropJson[]; warnings: string[]; graph: GraphJson | null; drivers: DriverJson[]; layerIds: Set<string> } {
  const d = exportableDrivers(doc);
  const g = exportableGraph(doc);
  const byKey = new Map<string, PropJson>();
  for (const n of g.nodeProps) byKey.set(n.key, n);
  for (const dr of d.drivers) {
    if (dr.prop.startsWith("--")) continue; // a CSS variable has no base to write against
    const key = `${dr.layer}|${dr.prop}`;
    const base = designValue(doc, dr.layer, dr.prop).base;
    if (!byKey.has(key) && base !== null) byKey.set(key, { key, layer: dr.layer, prop: dr.prop as PropJson["prop"], base });
  }
  const props = [...byKey.values()];
  return { props, warnings: [...d.warnings, ...g.warnings], graph: g.graph, drivers: d.drivers, layerIds: new Set([...props.map((p) => p.layer), ...d.drivers.filter((x) => x.prop.startsWith("--")).map((x) => x.layer)]) };
}

/** The layers a driver reads the position of (`view`, `pointer.inside`, `hover`, `press`, `proximity`): the page script finds them by `data-ll-view`. */
export const viewLayerIdsOf = (drivers: readonly { signal: Signal }[]): Set<string> =>
  new Set(drivers.flatMap((d) => (d.signal.kind === "view" || d.signal.kind === "pointerInside" || d.signal.kind === "layerState" || d.signal.kind === "proximity" ? [d.signal.layer] : [])));

/** One live effector, resolved to what the script needs: the copies as made (their centres, transforms, opacities) and the settings. */
interface EffectorJson {
  layer: string;
  mode: "pointer" | "scroll";
  scale: number;
  fade: number;
  offsetX: number;
  offsetY: number;
  hue: number;
  radius: number;
  spread: number;
  falloff: string;
  copies: { i: number; cx: number; cy: number; t: string; o: number }[];
}

/** The layers whose copies react to the pointer or the scroll, with the copies as made. Static effectors are already drawn into the page. */
export function exportableEffectors(doc: MotionDocument): EffectorJson[] {
  const out: EffectorJson[] = [];
  for (const layer of Object.values(doc.layers)) {
    const get = resolveProps(layer).get;
    if (!hasLiveEffector(get)) continue;
    const g = getLayerGeometry(layer);
    if (g.positioning !== "absolute") continue;
    const parent = layer.parentId ? doc.layers[layer.parentId] : undefined;
    const pf = parent ? getLayerGeometry(parent).frame : null;
    const e = readEffector(get)!;
    const copies = baseCopies(get, g.frame, { width: pf?.width ?? 0, height: pf?.height ?? 0 });
    if (copies.length === 0) continue;
    out.push({ layer: layer.id, mode: e.mode as "pointer" | "scroll", scale: e.scale, fade: e.fade, offsetX: e.offsetX, offsetY: e.offsetY, hue: e.hue, radius: e.radius, spread: e.spread, falloff: e.falloff, copies: copies.map((c) => ({ i: c.index, cx: c.centre[0], cy: c.centre[1], t: c.transform, o: c.opacity })) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------------------------------------------------

/** Operator source, one factory each, mirroring `core/bindings/evaluate.ts`. Only the used ones are written out. */
const OPERATORS: Record<string, string> = {
  smooth: `  smooth: function (o) {
    var y = null;
    return function (x, f) {
      if (y === null || isVec(x) !== isVec(y)) return (y = x);
      var k = 1 - Math.exp(-Math.min(f.dt, MAX_DT) / Math.max(o.tau, 1e-6));
      y = isVec(x) ? [lerp(y[0], x[0], k), lerp(y[1], x[1], k)] : lerp(y, num(x), k);
      return y;
    };
  },`,
  spring: `  spring: function (o) {
    var pos = null, vel = 0, rest = 0;
    return function (x, f) {
      var target = num(x);
      if (pos === null) return (pos = target);
      var left = Math.min(f.dt, MAX_DT) + rest;
      while (left >= SPRING_STEP) {
        vel += ((-o.k * (pos - target) - o.c * vel) / o.m) * SPRING_STEP;
        pos += vel * SPRING_STEP;
        left -= SPRING_STEP;
      }
      rest = left;
      return pos;
    };
  },`,
  remap: `  remap: function (o) {
    return function (x) {
      return lift(x, function (n) {
        var span = o.inMax - o.inMin;
        var t = span === 0 ? 0 : (n - o.inMin) / span;
        return lerp(o.outMin, o.outMax, o.clamp === false ? t : clamp(t, 0, 1));
      });
    };
  },`,
  clamp: `  clamp: function (o) { return function (x) { return lift(x, function (n) { return clamp(n, o.min, o.max); }); }; },`,
  add: `  add: function (o) { return function (x) { return lift(x, function (n) { return n + o.x; }); }; },`,
  mul: `  mul: function (o) { return function (x) { return lift(x, function (n) { return n * o.x; }); }; },`,
  min: `  min: function (o) { return function (x) { return lift(x, function (n) { return Math.min(n, o.x); }); }; },`,
  max: `  max: function (o) { return function (x) { return lift(x, function (n) { return Math.max(n, o.x); }); }; },`,
  abs: `  abs: function () { return function (x) { return lift(x, Math.abs); }; },`,
  component: `  component: function (o) { return function (x) { return isVec(x) ? x[o.axis === "x" ? 0 : 1] : num(x); }; },`,
  quantize: `  quantize: function (o) { return function (x) { return lift(x, function (n) { return o.step > 0 ? Math.round(n / o.step) * o.step : n; }); }; },`,
  deadzone: `  deadzone: function (o) {
    return function (x) {
      return lift(x, function (n) {
        var a = Math.abs(n);
        if (a <= o.radius) return 0;
        return Math.sign(n) * (o.radius < 1 ? (a - o.radius) / (1 - o.radius) : a - o.radius);
      });
    };
  },`,
  falloff: `  falloff: function (o) { return function (x) { return falloffOf(o.shape, num(x), o.radius); }; },`,
  length: `  length: function () { return function (x) { return isVec(x) ? Math.hypot(x[0], x[1]) : Math.abs(num(x)); }; },`,
};

const HEADER = `/*
 * Drivers, exported from LazyLayout. This file stands alone: it imports nothing and needs no package.
 * It makes the page react to the pointer, the scroll and time, as designed in the editor.
 * Written out as readable source; edit the numbers in CONFIG to change a driver.
 */`;

const CORE = `var MAX_DT = 1 / 15, SPRING_STEP = 1 / 240;
function isVec(v) { return Array.isArray(v); }
function num(v) { return isVec(v) ? v[0] : typeof v === "boolean" ? (v ? 1 : 0) : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function lift(v, f) { return isVec(v) ? [f(v[0]), f(v[1])] : f(num(v)); }
/* How far a box has scrolled through the screen: 0 when its top reaches the bottom of the screen, 1 when its bottom leaves the top. */
function viewOf(box, scrollY, viewport) {
  if (!(viewport > 0)) return { progress: 0, visible: 0 };
  var progress = Math.min(1, Math.max(0, (scrollY + viewport - box.top) / (viewport + box.height)));
  var overlap = Math.max(0, Math.min(box.top + box.height, scrollY + viewport) - Math.max(box.top, scrollY));
  return { progress: progress, visible: box.height > 0 ? overlap / box.height : 0 };
}
function r4(n) { return Math.round(n * 1e4) / 1e4; }
function falloffOf(shape, d, r) {
  var q = r > 0 ? Math.abs(d) / r : Infinity;
  if (shape === "linear") return Math.max(0, 1 - q);
  if (shape === "smoothstep") { var s = clamp(1 - q, 0, 1); return s * s * (3 - 2 * s); }
  if (shape === "gaussian") return Math.exp(-4.5 * q * q);
  return 1 / (1 + q * q);
}

/* The input bus: the pointer, the scroll and what is worked out from how they move. */
function newBus() { return { last: null, speed: 0, dx: 0, dy: 0, angle: 0, vel: 0, dir: 0, frame: 0, smooth: {} }; }
var EDGE_TAU = 0.08;
function insideRect(r, x, y) { return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height; }
function distanceToRect(r, x, y, measure) {
  if (measure === "center") return Math.hypot(x - (r.x + r.width / 2), y - (r.y + r.height / 2));
  return Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.width)), Math.max(r.y - y, 0, y - (r.y + r.height)));
}
function busFrame(src, st, time, dt) {
  var p = src.pointer(), size = src.pageSize(), sc = src.scroll();
  var x = p ? p.x : 0, y = p ? p.y : 0;
  st.frame++;
  if (st.last && dt > 0) {
    st.dx = x - st.last.x; st.dy = y - st.last.y;
    st.speed += (Math.hypot(st.dx, st.dy) / dt - st.speed) * (1 - Math.exp(-dt / 0.05));
    if (st.dx !== 0 || st.dy !== 0) st.angle = (Math.atan2(st.dy, st.dx) * 180) / Math.PI;
    var ds = sc.y - st.last.sy;
    st.vel += (ds / dt - st.vel) * (1 - Math.exp(-dt / 0.05));
    if (ds !== 0) st.dir = Math.sign(ds);
  }
  st.last = { x: x, y: y, sy: sc.y };
  var u = size.width > 0 ? x / size.width : 0, v = size.height > 0 ? y / size.height : 0;
  var progress = sc.max > 0 ? Math.min(1, Math.max(0, sc.y / sc.max)) : 0;
  return { time: time, dt: dt, read: function (s) {
    if (s.kind === "time") return time;
    if (s.kind === "frameDt") return dt;
    if (s.kind === "seed") return 0;
    if (s.kind === "constant") return s.value;
    if (s.kind === "pointer") {
      switch (s.channel) {
        case "x": return x; case "y": return y; case "dx": return st.dx; case "dy": return st.dy;
        case "speed": return st.speed; case "angle": return st.angle;
        case "velocity": return [st.dx / Math.max(dt, 1e-6), st.dy / Math.max(dt, 1e-6)];
        case "down": return p && p.down ? 1 : 0; case "pressure": return p ? (p.down && p.pressure === 0 ? 0.5 : p.pressure) : 0;
        case "type": return p ? (p.type === "mouse" ? 0 : p.type === "pen" ? 1 : 2) : 0;
        case "coarse": return p && p.coarse ? 1 : 0;
      }
      return 0;
    }
    if (s.kind === "pointerInside") { var ri = src.layerRect ? src.layerRect(s.layer) : null; return !!(p && ri && insideRect(ri, x, y)); }
    if (s.kind === "layerState") {
      if (s.channel === "focus") return 0;
      var rs = src.layerRect ? src.layerRect(s.layer) : null;
      var on = !!(p && rs && insideRect(rs, x, y) && (s.channel === "hover" || p.down));
      var key = s.channel + "|" + s.layer;
      var cur = st.smooth[key] || { frame: -1, value: on ? 1 : 0 };
      if (cur.frame !== st.frame) { cur.value += ((on ? 1 : 0) - cur.value) * (1 - Math.exp(-Math.min(dt, MAX_DT) / EDGE_TAU)); cur.frame = st.frame; }
      st.smooth[key] = cur;
      return cur.value;
    }
    if (s.kind === "proximity") { var rp = src.layerRect ? src.layerRect(s.layer) : null; return p && rp ? distanceToRect(rp, x, y, s.measure || "edge") : 0; }
    if (s.kind === "view") {
      var b = src.layerBox ? src.layerBox(s.layer) : null;
      if (!b) return 0;
      var vw = viewOf(b, sc.y, sc.viewport || 0);
      return s.channel === "progress" ? vw.progress : vw.visible;
    }
    if (s.kind === "pointerIn") return s.channel === "uv" ? [u, v] : s.channel === "ndc" ? [u * 2 - 1, v * 2 - 1] : [x, y];
    if (s.kind === "scroll") return s.channel === "y" ? sc.y : s.channel === "progress" ? progress : s.channel === "velocity" ? st.vel : st.dir;
    return 0;
  } };
}

/* Links and expressions: a property that follows another (through a map) and/or runs an expression, worked out the way the editor does:
   a link carries what it reads through its map, an expression sees that as "value", and a cycle stops at the property's own value. */
function createGraph(g) {
  var nodes = {};
  g.nodes.forEach(function (n) { nodes[n.key] = n; });
  function mapLink(l, v) {
    if (l.map === "direct") return v;
    var w = l.inMax - l.inMin, t = w === 0 ? 0 : (v - l.inMin) / w;
    if (l.clamp) t = clamp(t, 0, 1);
    return l.outMin + t * (l.outMax - l.outMin);
  }
  function val(key, t, stack) {
    var node = nodes[key];
    if (!node) { var st = g.statics[key]; return st && st.base !== null ? st.base : undefined; }
    if (stack.indexOf(key) >= 0) return undefined;
    var inner = stack.concat([key]), cur;
    if (node.link) {
      var from = val(node.link.src, t, inner);
      if (typeof from === "number" && isFinite(from)) cur = mapLink(node.link, from);
    }
    if (cur === undefined) cur = node.base === null ? undefined : node.base;
    if (node.expr && typeof cur === "number") {
      var out = EXPR.evaluateExpression(node.expr.ast, {
        time: t, value: cur, fps: g.fps, duration: g.duration, seed: node.expr.seed,
        valueAtTime: function () { return node.own === null ? undefined : node.own; },
        ref: function (name, prop, tt) {
          var id = g.names[name]; if (!id) return undefined;
          var v = val(id + "|" + prop, tt === undefined ? t : tt, inner);
          return typeof v === "number" ? v : undefined;
        },
        keys: function () { return null; }
      });
      if (out !== undefined) cur = out;
    }
    return cur;
  }
  return { values: function (time) { var out = {}; g.nodes.forEach(function (n) { out[n.key] = val(n.key, time, []); }); return out; } };
}

/* Everything the page moves or fades: the graph's value (or the layer's own), plus the drivers' adds, times their multiplies. */
function createLive(cfg) {
  var drivers = cfg.drivers.length ? createDrivers(cfg.drivers) : null, graph = cfg.graph ? createGraph(cfg.graph) : null;
  var live = { vars: [], step: null };
  live.step = function (frame) {
    var add = {}, mul = {};
    live.vars = [];
    if (drivers) drivers.step(frame).forEach(function (r) {
      if (r.set !== undefined) { live.vars.push({ layer: r.layer, name: r.prop, value: Math.round(r.set * 1e6) / 1e6 }); return; }
      var k = r.layer + "|" + r.prop; add[k] = r.add; mul[k] = r.mul;
    });
    var abs = graph ? graph.values(frame.time) : {};
    return cfg.props.map(function (p) {
      var v0 = abs[p.key] !== undefined ? abs[p.key] : p.base;
      return { layer: p.layer, prop: p.prop, base: p.base, value: (v0 + (add[p.key] || 0)) * (p.key in mul ? mul[p.key] : 1) };
    });
  };
  return live;
}

/* Effectors: each copy of a repeater or cloner varied by the pointer's distance or by where the page is scrolled. */
function createEffectors(cfg) {
  return { step: function (live) {
    var out = [];
    cfg.forEach(function (e) {
      var count = e.copies.length + 1;
      e.copies.forEach(function (c) {
        var f = 0;
        if (e.mode === "pointer") { if (live.pointer) f = falloffOf(e.falloff, Math.hypot(c.cx - live.pointer.x, c.cy - live.pointer.y), e.radius); }
        else if (live.progress !== null && count > 1) f = falloffOf(e.falloff, Math.abs(c.i - clamp(live.progress, 0, 1) * (count - 1)), e.spread);
        if (f === 0) { out.push({ layer: e.layer, i: c.i, transform: c.t, opacity: c.o, filter: "" }); return; }
        var hue = e.hue * f + 0;
        out.push({ layer: e.layer, i: c.i,
          transform: "translate(" + r4(e.offsetX * f + 0) + "px, " + r4(e.offsetY * f + 0) + "px) " + c.t + " scale(" + r4(1 + (e.scale - 1) * f) + ")",
          opacity: r4(c.o * (1 + (e.fade - 1) * f)),
          filter: hue !== 0 ? "hue-rotate(" + Math.round(hue * 100) / 100 + "deg)" : "" });
      });
    });
    return out;
  } };
}

/* Every driver is a signal, then operators. The result of each is applied to one property of one layer. */
function createDrivers(config) {
  var runs = config.map(function (d) {
    var steps = d.ops.map(function (o) { return OPERATORS[o.op](o); });
    return { d: d, step: function (f) { var v = f.read(d.signal); for (var i = 0; i < steps.length; i++) v = steps[i](v, f); return num(v); } };
  });
  return { step: function (frame) {
    var out = {};
    runs.forEach(function (r) {
      var v = r.step(frame), d = r.d, key = d.layer + "|" + d.prop;
      if (!(key in out)) out[key] = { layer: d.layer, prop: d.prop, add: 0, mul: 1 };
      if (d.blend === "set") out[key].set = v; else if (d.blend === "add") out[key].add += v; else out[key].mul *= v;
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  } };
}`;

const GLUE = `/* The page: the pointer, the scroll and the clock in, CSS out. */
(function () {
  if (typeof window === "undefined") return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; /* a visitor who asked for less motion gets the page as designed */
  var root = document.body.firstElementChild || document.body;
  var pointer = null;
  function onMove(e) { var r = root.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top, down: e.buttons !== 0, coarse: e.pointerType === "touch", pressure: e.pressure, type: e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse" }; }
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  var source = {
    pointer: function () { return pointer; },
    pageSize: function () { var r = root.getBoundingClientRect(); return { width: r.width, height: r.height }; },
    scroll: function () { return { y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight, viewport: window.innerHeight }; },
    layerRect: function (id) {
      var e = document.querySelector('[data-ll-view="' + id + '"]'); if (!e) return null;
      var r = e.getBoundingClientRect(), b = root.getBoundingClientRect();
      return { x: r.left - b.left, y: r.top - b.top, width: r.width, height: r.height };
    },
    layerBox: function (id) {
      var e = document.querySelector('[data-ll-view="' + id + '"]'); if (!e) return null;
      var r = e.getBoundingClientRect(); return { top: r.top + window.scrollY, height: r.height };
    }
  };
  var els = {}, copyEls = {}, wrote = {};
  function find(id) { return els[id] || (els[id] = document.querySelector('[data-ll="' + id + '"]')); }
  function copy(layer, i) {
    if (!copyEls[layer]) { copyEls[layer] = {}; Array.prototype.forEach.call(document.querySelectorAll('[data-ll-copy^="' + layer + ':"]'), function (e) { copyEls[layer][e.getAttribute("data-ll-copy").split(":").pop()] = e; }); }
    return copyEls[layer][i];
  }
  var live = (CONFIG.length || GRAPH) ? createLive({ drivers: CONFIG, graph: GRAPH, props: PROPS }) : null, effectors = EFFECTORS.length ? createEffectors(EFFECTORS) : null;
  var bus = newBus(), t0 = performance.now(), last = t0, lastKey = "";
  function frame(now) {
    var dt = Math.min((now - last) / 1000, MAX_DT); last = now;
    var f = busFrame(source, bus, (now - t0) / 1000, dt);
    if (live) {
      var per = {};
      live.step(f).forEach(function (r) { (per[r.layer] = per[r.layer] || {})[r.prop] = r; });
      live.vars.forEach(function (v) { var el = find(v.layer); if (el) el.style.setProperty(v.name, String(v.value)); });
      Object.keys(per).forEach(function (id) {
        var el = find(id); if (!el) return;
        var p = per[id], tx = p["transform.x"], ty = p["transform.y"], rot = p["transform.rotate"], sc = p["transform.scale"], op = p["appearance.opacity"];
        /* The layer's own value is already in its CSS, so position and rotation go on top as the difference, and scale as a ratio. */
        if (tx || ty) el.style.translate = (tx ? tx.value - tx.base : 0) + "px " + (ty ? ty.value - ty.base : 0) + "px";
        if (rot) el.style.rotate = rot.value - rot.base + "deg";
        if (sc) el.style.scale = String(sc.base !== 0 ? sc.value / sc.base : sc.value);
        if (op) el.style.opacity = String(Math.min(1, Math.max(0, op.value)));
      });
    }
    if (effectors) {
      var sc2 = source.scroll(), p2 = source.pointer();
      var key = (p2 ? Math.round(p2.x * 10) + "," + Math.round(p2.y * 10) : "") + "|" + (sc2.max > 0 ? Math.round(Math.min(1, Math.max(0, sc2.y / sc2.max)) * 1000) : "");
      if (key !== lastKey) { /* only when the pointer or the scroll moved */
        lastKey = key;
        effectors.step({ pointer: p2 ? { x: p2.x, y: p2.y } : null, progress: sc2.max > 0 ? Math.min(1, Math.max(0, sc2.y / sc2.max)) : null }).forEach(function (r) {
          var el = copy(r.layer, r.i); if (!el) return;
          var next = r.transform + "|" + r.opacity + "|" + r.filter;
          if (wrote[r.layer + ":" + r.i] === next) return;
          wrote[r.layer + ":" + r.i] = next;
          el.style.transform = r.transform; el.style.opacity = String(r.opacity); el.style.filter = r.filter;
        });
      }
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();`;

/** The export's live script for this document (drivers, links, expressions and live effectors), with only the operators it uses. */
export function buildDriversExport(doc: MotionDocument): DriversExport {
  const { props, warnings, graph, drivers, layerIds } = exportableProps(doc);
  const effectors = exportableEffectors(doc);
  const none = { source: null, layerIds: new Set<string>(), propLayerIds: new Set<string>(), effectorLayerIds: new Set<string>(), warnings };
  if (props.length === 0 && drivers.length === 0 && effectors.length === 0) return none;
  const used = [...new Set(drivers.flatMap((d) => d.ops.map((o) => String(o.op))))].sort();
  const operators = `var OPERATORS = {\n${used.map((u) => OPERATORS[u]).join("\n")}\n};`;
  const needsExpressions = !!graph?.nodes.some((n) => n.expr);
  const source = [
    HEADER, "", operators, "",
    ...(needsExpressions ? [EXPRESSION_RUNTIME_SOURCE, ""] : ["var EXPR = null;", ""]),
    CORE, "",
    `var CONFIG = ${JSON.stringify(drivers, null, 2)};`,
    `var GRAPH = ${JSON.stringify(graph)};`,
    `var PROPS = ${JSON.stringify(props)};`,
    `var EFFECTORS = ${JSON.stringify(effectors)};`, "", GLUE, "",
  ].join("\n");
  return { source, layerIds: new Set(drivers.map((d) => d.layer)), propLayerIds: layerIds, effectorLayerIds: new Set(effectors.map((e) => e.layer)), warnings };
}
