import type { Expr } from "./ast";
import { parseExpression } from "./parse";

/**
 * Exporting an expression (ROADMAP Phase 77): it compiles to a plain JavaScript function, `function (ctx) { return … }`, that
 * calls a small runtime (`EXPRESSION_RUNTIME_SOURCE`) shipped once beside it. Neither uses `eval` or `new Function`; the
 * exporter writes them into the generated files as ordinary code. A target that can't run code (CSS only) bakes the
 * expression to keyframes instead (`layer.bakeExpression`).
 *
 * The runtime repeats the evaluator's functions in plain JavaScript, so a test runs the same expressions through both and
 * compares them. Where the evaluator gives "can't be worked out" (a missing reference, a result that isn't finite) the
 * compiled function gives NaN, and the host keeps the property's own value.
 */

/** The runtime the compiled functions call, as source: define it once, then `var h = createExpressionRuntime();`. */
export const EXPRESSION_RUNTIME_SOURCE = `function createExpressionRuntime() {
  function hashInt(i, seed) {
    var h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((seed | 0) + 0x165667b1, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
  }
  function lattice(i, seed) { return (hashInt(i, seed) / 4294967295) * 2 - 1; }
  function noise1(x, seed) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = lattice(i, seed), b = lattice(i + 1, seed);
    return a + (b - a) * u;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function loopTime(type, t, first, last, out) {
    var length = last - first;
    if (!(length > 0)) return null;
    if (out ? t < last : t > first) return null;
    var from = out ? t - first : last - t, cycles = Math.floor(from / length), phase = from - cycles * length;
    if (type === "pingpong") {
      var along = cycles % 2 === 1 ? length - phase : phase;
      return { time: out ? first + along : last - along, cycles: cycles };
    }
    return { time: out ? first + phase : last - phase, cycles: cycles };
  }
  function loop(name, ctx, type) {
    var keys = ctx.keys();
    if (!keys) return ctx.value;
    var out = name === "loopOut", looped = loopTime(type || "cycle", ctx.time, keys.first, keys.last, out);
    if (!looped) return ctx.value;
    if (type === "continue") {
      var edge = out ? keys.last : keys.first, step = 1 / Math.max(1, ctx.fps);
      var at = ctx.valueAtTime(edge), near = ctx.valueAtTime(out ? edge - step : edge + step);
      if (at === undefined || near === undefined) return NaN;
      var speed = out ? (at - near) / step : (near - at) / step;
      return at + speed * (ctx.time - edge);
    }
    var v = ctx.valueAtTime(looped.time);
    if (v === undefined) return NaN;
    return type === "offset" ? v + (out ? 1 : -1) * looped.cycles * (keys.lastValue - keys.firstValue) : v;
  }
  function num(v) { return v === undefined ? NaN : v; }
  return {
    abs: function (c, a) { return Math.abs(a); }, floor: function (c, a) { return Math.floor(a); }, ceil: function (c, a) { return Math.ceil(a); },
    round: function (c, a) { return Math.round(a); }, sqrt: function (c, a) { return a < 0 ? NaN : Math.sqrt(a); },
    min: function (c, a, b) { return Math.min(a, b); }, max: function (c, a, b) { return Math.max(a, b); }, pow: function (c, a, b) { return Math.pow(a, b); },
    mod: function (c, a, b) { return b === 0 ? NaN : ((a % b) + b) % b; },
    clamp: function (c, x, a, b) { return clamp(x, Math.min(a, b), Math.max(a, b)); },
    sin: function (c, a) { return Math.sin(a); }, cos: function (c, a) { return Math.cos(a); },
    radians: function (c, a) { return (a * Math.PI) / 180; }, degrees: function (c, a) { return (a * 180) / Math.PI; },
    linear: function (c, t, t0, t1, a, b) { return t1 === t0 ? (t < t0 ? a : b) : a + (b - a) * clamp((t - t0) / (t1 - t0), 0, 1); },
    ease: function (c, t, t0, t1, a, b) { return t1 === t0 ? (t < t0 ? a : b) : a + (b - a) * smooth(clamp((t - t0) / (t1 - t0), 0, 1)); },
    smoothstep: function (c, e0, e1, x) { return e1 === e0 ? (x < e0 ? 0 : 1) : smooth(clamp((x - e0) / (e1 - e0), 0, 1)); },
    noise: function (c, x, seed) { return noise1(x, seed === undefined ? c.seed : Math.round(seed)); },
    wiggle: function (c, freq, amp, seed) { return c.value + amp * noise1(c.time * freq, seed === undefined ? c.seed : Math.round(seed)); },
    loopOut: function (c, type) { return loop("loopOut", c, type); },
    loopIn: function (c, type) { return loop("loopIn", c, type); },
    valueAtTime: function (c, t) { return num(c.valueAtTime(t)); },
    ref: function (c, layer, property) { return num(c.ref(layer, property)); },
    refAtTime: function (c, layer, property, t) { return num(c.ref(layer, property, t)); }
  };
}`;

const ID_JS: Record<string, string> = { time: "ctx.time", value: "ctx.value", fps: "ctx.fps", duration: "ctx.duration", PI: "Math.PI", E: "Math.E" };

function js(e: Expr): string {
  switch (e.k) {
    case "num": return Number.isFinite(e.v) ? String(e.v) : "NaN";
    case "bool": return String(e.v);
    case "str": return JSON.stringify(e.v);
    case "id": return ID_JS[e.name];
    case "un": return `(${e.op}${js(e.a)})`;
    case "bin":
      if (e.op === "**") return `Math.pow(${js(e.a)}, ${js(e.b)})`;
      if (e.op === "%") return `h.mod(ctx, ${js(e.a)}, ${js(e.b)})`;
      return `(${js(e.a)} ${e.op === "==" ? "===" : e.op === "!=" ? "!==" : e.op} ${js(e.b)})`;
    case "cond": return `(${js(e.c)} ? ${js(e.a)} : ${js(e.b)})`;
    case "call": return `h.${e.name}(${["ctx", ...e.args.map(js)].join(", ")})`;
  }
}

export type CompileResult = { ok: true; source: string } | { ok: false; message: string };

/**
 * The expression as a function's source: `function (ctx, h) { … }`, where `h` is `createExpressionRuntime()` and `ctx` has
 * `time`, `value`, `fps`, `duration`, `seed`, `valueAtTime(t)`, `ref(layer, property, t?)` and `keys()` (see `ExprContext`). It
 * returns a number, NaN when the expression can't be worked out.
 */
export function compileExpression(text: string): CompileResult {
  const parsed = parseExpression(text);
  if (!parsed.ok) return { ok: false, message: `[${parsed.errors[0].code}] ${parsed.errors[0].message}` };
  return { ok: true, source: `function (ctx, h) { var r = ${js(parsed.ast)}; return typeof r === "boolean" ? (r ? 1 : 0) : r; }` };
}
