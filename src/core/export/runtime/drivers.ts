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

/** The properties a driver may drive in an export, and the CSS each becomes. */
const EXPORTABLE = ["transform.x", "transform.y", "transform.rotate", "transform.scale", "appearance.opacity"] as const;

/** One driver, resolved to what the script needs: numbers only, spring terms already physical. */
interface DriverJson {
  layer: string;
  prop: (typeof EXPORTABLE)[number];
  blend: "add" | "multiply";
  signal: Signal;
  ops: Record<string, unknown>[];
}

export interface DriversExport {
  /** The script, or null when there is nothing to carry. */
  source: string | null;
  /** The layers the page script looks for (`data-ll`). */
  layerIds: Set<string>;
  /** The layers whose copies the page script restyles (`data-ll-copy` on each copy's wrapper). */
  effectorLayerIds: Set<string>;
  warnings: string[];
}

const SERVED_SIGNALS = new Set(["pointer", "pointerIn", "scroll", "time", "frameDt", "seed", "constant"]);
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
    if (b.target.kind !== "property") { skip(`${b.target.kind} targets are not exported yet`); continue; }
    if (b.target.on.kind !== "layer") { skip("only drivers on one layer are exported"); continue; }
    if (!(EXPORTABLE as readonly string[]).includes(b.target.path)) { skip(`${b.target.path} cannot be driven in an export yet`); continue; }
    const blend = b.blend ?? defaultBlend(b.target);
    if (blend !== "add" && blend !== "multiply") { skip(`the ${blend} blend is not exported`); continue; }
    if (b.guard) { skip("a driver with a condition is not exported yet"); continue; }
    if (!SERVED_SIGNALS.has(b.expr.signal.kind)) { skip(`the ${b.expr.signal.kind} signal is not exported yet`); continue; }
    const { ops, problem } = opsOf(b.expr);
    if (problem) { skip(problem); continue; }
    if (!doc.layers[b.target.on.ref]) { skip("its layer is gone"); continue; }
    drivers.push({ layer: b.target.on.ref, prop: b.target.path as DriverJson["prop"], blend, signal: b.expr.signal, ops });
  }
  return { drivers, warnings };
}

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
function r4(n) { return Math.round(n * 1e4) / 1e4; }
function falloffOf(shape, d, r) {
  var q = r > 0 ? Math.abs(d) / r : Infinity;
  if (shape === "linear") return Math.max(0, 1 - q);
  if (shape === "smoothstep") { var s = clamp(1 - q, 0, 1); return s * s * (3 - 2 * s); }
  if (shape === "gaussian") return Math.exp(-4.5 * q * q);
  return 1 / (1 + q * q);
}

/* The input bus: the pointer, the scroll and what is worked out from how they move. */
function newBus() { return { last: null, speed: 0, dx: 0, dy: 0, angle: 0, vel: 0, dir: 0 }; }
function busFrame(src, st, time, dt) {
  var p = src.pointer(), size = src.pageSize(), sc = src.scroll();
  var x = p ? p.x : 0, y = p ? p.y : 0;
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
    if (s.kind === "pointerIn") return s.channel === "uv" ? [u, v] : s.channel === "ndc" ? [u * 2 - 1, v * 2 - 1] : [x, y];
    if (s.kind === "scroll") return s.channel === "y" ? sc.y : s.channel === "progress" ? progress : s.channel === "velocity" ? st.vel : st.dir;
    return 0;
  } };
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
      if (d.blend === "add") out[key].add += v; else out[key].mul *= v;
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
    scroll: function () { return { y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }; }
  };
  var els = {}, base = {}, copyEls = {}, wrote = {};
  function find(id) { return els[id] || (els[id] = document.querySelector('[data-ll="' + id + '"]')); }
  function copy(layer, i) {
    if (!copyEls[layer]) { copyEls[layer] = {}; Array.prototype.forEach.call(document.querySelectorAll('[data-ll-copy^="' + layer + ':"]'), function (e) { copyEls[layer][e.getAttribute("data-ll-copy").split(":").pop()] = e; }); }
    return copyEls[layer][i];
  }
  var drivers = CONFIG.length ? createDrivers(CONFIG) : null, effectors = EFFECTORS.length ? createEffectors(EFFECTORS) : null;
  var bus = newBus(), t0 = performance.now(), last = t0, lastKey = "";
  function frame(now) {
    var dt = Math.min((now - last) / 1000, MAX_DT); last = now;
    var f = busFrame(source, bus, (now - t0) / 1000, dt);
    if (drivers) {
      var per = {};
      drivers.step(f).forEach(function (r) { (per[r.layer] = per[r.layer] || {})[r.prop] = r; });
      Object.keys(per).forEach(function (id) {
        var el = find(id); if (!el) return;
        var p = per[id];
        var tx = p["transform.x"], ty = p["transform.y"], rot = p["transform.rotate"], sc = p["transform.scale"], op = p["appearance.opacity"];
        /* The editor's blend is (the layer's own value + the adds) x the multiplies; the layer's own value is already in its CSS. */
        if (tx || ty) el.style.translate = (tx ? tx.add * tx.mul : 0) + "px " + (ty ? ty.add * ty.mul : 0) + "px";
        if (rot) el.style.rotate = rot.add * rot.mul + "deg";
        if (sc) el.style.scale = String((1 + sc.add) * sc.mul);
        if (op) {
          if (base[id] === undefined) base[id] = parseFloat(getComputedStyle(el).opacity);
          if (isNaN(base[id])) base[id] = 1;
          el.style.opacity = String(Math.min(1, Math.max(0, (base[id] + op.add) * op.mul)));
        }
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

/** The export's live script for this document (drivers and live effectors), with only the operators it uses. */
export function buildDriversExport(doc: MotionDocument): DriversExport {
  const { drivers, warnings } = exportableDrivers(doc);
  const effectors = exportableEffectors(doc);
  if (drivers.length === 0 && effectors.length === 0) return { source: null, layerIds: new Set(), effectorLayerIds: new Set(), warnings };
  const used = [...new Set(drivers.flatMap((d) => d.ops.map((o) => String(o.op))))].sort();
  const operators = `var OPERATORS = {\n${used.map((u) => OPERATORS[u]).join("\n")}\n};`;
  const source = [HEADER, "", operators, "", CORE, "", `var CONFIG = ${JSON.stringify(drivers, null, 2)};`, `var EFFECTORS = ${JSON.stringify(effectors)};`, "", GLUE, ""].join("\n");
  return { source, layerIds: new Set(drivers.map((d) => d.layer)), effectorLayerIds: new Set(effectors.map((e) => e.layer)), warnings };
}
