import type { Expr } from "./ast";
import { noise1 } from "./noise";

/**
 * Running an expression (ROADMAP Phase 77): a walk over the checked tree. No `eval`, no `Function`, no loops, and a step
 * budget, so an expression always finishes. Everything it can see is the `ExprContext` it is handed, so it is a pure
 * function of the context: the same context gives the same number, on any machine.
 */

export interface ExprContext {
  /** Composition time in seconds. */
  time: number;
  /** The property's value before the expression (keyframes, behaviours and links applied). */
  value: number;
  fps: number;
  /** The composition's length in seconds. */
  duration: number;
  /** The seed `wiggle` and `noise` use when the text gives none (the host derives it from the layer and property). */
  seed: number;
  /** This property's keyframed value at another time; undefined when it can't be worked out. */
  valueAtTime(t: number): number | undefined;
  /** Another layer's property at `t` (default: now); undefined when the layer or property can't be found or read. */
  ref(layer: string, property: string, t?: number): number | undefined;
  /** This property's keyframes: when the first and last are and what they hold, or null when it has fewer than two. */
  keys(): { first: number; last: number; firstValue: number; lastValue: number } | null;
}

/** The most parts an evaluation walks. */
const STEP_BUDGET = 5000;

class Invalid extends Error {}
const invalid = (): never => {
  throw new Invalid();
};

type Value = number | boolean | string;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const smooth = (u: number) => u * u * (3 - 2 * u);

/** `loopOut` and `loopIn`: the time to read the keyframes at, and how many whole loops it is past. */
function loopTime(type: string, t: number, first: number, last: number, out: boolean): { time: number; cycles: number } | null {
  const length = last - first;
  if (!(length > 0)) return null;
  if (out ? t < last : t > first) return null;
  const from = out ? t - first : last - t; // how far past the end that is looped
  const cycles = Math.floor(from / length);
  const phase = from - cycles * length;
  if (type === "pingpong") {
    const back = cycles % 2 === 1;
    const along = back ? length - phase : phase;
    return { time: out ? first + along : last - along, cycles };
  }
  return { time: out ? first + phase : last - phase, cycles };
}

function call(name: string, a: Value[], ctx: ExprContext): number {
  const n = (i: number): number => {
    const v = a[i];
    return typeof v === "number" ? v : invalid();
  };
  switch (name) {
    case "abs": return Math.abs(n(0));
    case "floor": return Math.floor(n(0));
    case "ceil": return Math.ceil(n(0));
    case "round": return Math.round(n(0));
    case "sqrt": return n(0) < 0 ? invalid() : Math.sqrt(n(0));
    case "min": return Math.min(n(0), n(1));
    case "max": return Math.max(n(0), n(1));
    case "pow": return Math.pow(n(0), n(1));
    case "mod": return n(1) === 0 ? invalid() : ((n(0) % n(1)) + n(1)) % n(1);
    case "clamp": return clamp(n(0), Math.min(n(1), n(2)), Math.max(n(1), n(2)));
    case "sin": return Math.sin(n(0));
    case "cos": return Math.cos(n(0));
    case "radians": return (n(0) * Math.PI) / 180;
    case "degrees": return (n(0) * 180) / Math.PI;
    case "linear": {
      const [t, t0, t1, from, to] = [n(0), n(1), n(2), n(3), n(4)];
      if (t1 === t0) return t < t0 ? from : to;
      return from + (to - from) * clamp((t - t0) / (t1 - t0), 0, 1);
    }
    case "ease": {
      const [t, t0, t1, from, to] = [n(0), n(1), n(2), n(3), n(4)];
      if (t1 === t0) return t < t0 ? from : to;
      return from + (to - from) * smooth(clamp((t - t0) / (t1 - t0), 0, 1));
    }
    case "smoothstep": {
      const [e0, e1, x] = [n(0), n(1), n(2)];
      return e1 === e0 ? (x < e0 ? 0 : 1) : smooth(clamp((x - e0) / (e1 - e0), 0, 1));
    }
    case "noise": return noise1(n(0), a.length > 1 ? Math.round(n(1)) : ctx.seed);
    case "wiggle": return ctx.value + n(1) * noise1(ctx.time * n(0), a.length > 2 ? Math.round(n(2)) : ctx.seed);
    case "loopOut":
    case "loopIn": {
      const type = typeof a[0] === "string" ? a[0] : "cycle";
      const keys = ctx.keys();
      if (!keys) return ctx.value;
      const out = name === "loopOut";
      const looped = loopTime(type, ctx.time, keys.first, keys.last, out);
      if (!looped) return ctx.value;
      if (type === "continue") {
        // carry on at the speed the animation had at its end
        const edge = out ? keys.last : keys.first;
        const step = 1 / Math.max(1, ctx.fps);
        const at = ctx.valueAtTime(edge);
        const near = ctx.valueAtTime(out ? edge - step : edge + step);
        if (at === undefined || near === undefined) return invalid();
        const speed = out ? (at - near) / step : (near - at) / step;
        return at + speed * (ctx.time - edge);
      }
      const v = ctx.valueAtTime(looped.time);
      if (v === undefined) return invalid();
      return type === "offset" ? v + (out ? 1 : -1) * looped.cycles * (keys.lastValue - keys.firstValue) : v;
    }
    case "valueAtTime": return ctx.valueAtTime(n(0)) ?? invalid();
    case "ref": return ctx.ref(String(a[0]), String(a[1])) ?? invalid();
    case "refAtTime": return ctx.ref(String(a[0]), String(a[1]), n(2)) ?? invalid();
    default: return invalid();
  }
}

function walk(e: Expr, ctx: ExprContext, budget: { left: number }): Value {
  if (--budget.left < 0) invalid();
  switch (e.k) {
    case "num": return e.v;
    case "bool": return e.v;
    case "str": return e.v;
    case "id":
      switch (e.name) {
        case "time": return ctx.time;
        case "value": return ctx.value;
        case "fps": return ctx.fps;
        case "duration": return ctx.duration;
        case "PI": return Math.PI;
        case "E": return Math.E;
        default: return invalid();
      }
    case "un": {
      const a = walk(e.a, ctx, budget);
      return e.op === "-" ? -(a as number) : !(a as boolean);
    }
    case "bin": {
      if (e.op === "&&") return (walk(e.a, ctx, budget) as boolean) && (walk(e.b, ctx, budget) as boolean);
      if (e.op === "||") return (walk(e.a, ctx, budget) as boolean) || (walk(e.b, ctx, budget) as boolean);
      const a = walk(e.a, ctx, budget) as number;
      const b = walk(e.b, ctx, budget) as number;
      switch (e.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return b === 0 ? invalid() : ((a % b) + b) % b;
        case "**": return Math.pow(a, b);
        case "<": return a < b;
        case ">": return a > b;
        case "<=": return a <= b;
        case ">=": return a >= b;
        case "==": return a === b;
        case "!=": return a !== b;
        default: return invalid();
      }
    }
    case "cond": return walk(e.c, ctx, budget) ? walk(e.a, ctx, budget) : walk(e.b, ctx, budget);
    case "call": return call(e.name, e.args.map((x) => walk(x, ctx, budget)), ctx);
  }
}

/** The number an expression gives, or undefined when it can't (a missing reference, a divide by zero, a result that isn't finite). Never throws. */
export function evaluateExpression(ast: Expr, ctx: ExprContext): number | undefined {
  try {
    const v = walk(ast, ctx, { left: STEP_BUDGET });
    const n = typeof v === "boolean" ? (v ? 1 : 0) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  } catch (error) {
    if (error instanceof Invalid) return undefined;
    throw error;
  }
}
