/**
 * The binding evaluator (Design track D4, engine spec §5): turns a `SignalExpr` (a signal plus operators) into a value,
 * one frame at a time.
 *
 * - **Deterministic** (FX-DET): time comes only from the frame (`time`, `dt`), randomness only from a seed, and every
 *   stateful operator integrates at a fixed step, so the same inputs and `dt` sequence always give the same values, in the
 *   editor and in an export.
 * - **Pure**: no page access. A host (the editor's input bus, an export's runtime, a test's tape) supplies the frame.
 * - Operators are frame-rate independent: they use `dt`, never a per-frame constant.
 *
 * Values are a number, a boolean or a vec2. Booleans act as 0 / 1 where a number is needed.
 */
import type { Operator, Signal, SignalExpr } from "../document/signals";
import { parseEasing } from "../document/motion";
import { sampleEasing } from "../kernel/easing";
import { resolveSpringConfig } from "../kernel/springs";

export type Vec2 = readonly [number, number];
export type Value = number | boolean | Vec2;

/** What the host gives the evaluator each frame. `read` answers every signal except `time`, `frameDt`, `seed` and `constant`. */
export interface Frame {
  /** Transport time, seconds. */
  time: number;
  /** Seconds since the last frame (the host clamps it, e.g. to 1/15 after a stall). */
  dt: number;
  /** The instance seed, for `seed` and `noise`. */
  seed: number;
  read(signal: Signal): Value;
}

export interface ExprRuntime {
  step(frame: Frame): Value;
  reset(): void;
}

/** An operator the evaluator does not implement; the Driven by menu never creates one. */
export class UnsupportedOperatorError extends Error {}

const isVec = (v: Value): v is Vec2 => Array.isArray(v);
export const toNumber = (v: Value): number => (isVec(v) ? v[0] : typeof v === "boolean" ? (v ? 1 : 0) : v);
const truthy = (v: Value): boolean => (isVec(v) ? v[0] !== 0 || v[1] !== 0 : typeof v === "boolean" ? v : v !== 0);
const lift = (v: Value, f: (n: number) => number): Value => (isVec(v) ? [f(v[0]), f(v[1])] : f(toNumber(v)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Integration step for springs: fixed, so a spring replays the same at any frame rate. */
const SPRING_STEP = 1 / 240;
/** The longest `dt` one frame may advance state by; a stall does not blow a spring up. */
const MAX_DT = 1 / 15;

/** A small seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1, 1], from a seed: the same input always gives the same output. */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const at = (n: number) => rng((n * 374761393 + seed * 668265263) >>> 0)() * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return lerp(at(i), at(i + 1), u);
}

type Step = (x: Value, f: Frame) => Value;
interface Compiled {
  step: Step;
  reset(): void;
}

function falloffOf(shape: "linear" | "smoothstep" | "gaussian" | "inverse-square", d: number, r: number): number {
  const q = r > 0 ? Math.abs(d) / r : Infinity;
  switch (shape) {
    case "linear":
      return Math.max(0, 1 - q);
    case "smoothstep": {
      const s = clamp(1 - q, 0, 1);
      return s * s * (3 - 2 * s);
    }
    case "gaussian":
      return Math.exp(-4.5 * q * q);
    case "inverse-square":
      return 1 / (1 + q * q);
  }
}

function compileOperator(op: Operator): Compiled {
  switch (op.op) {
    case "smooth": {
      let y: Value | null = null;
      return {
        step: (x, f) => {
          if (y === null || isVec(x) !== isVec(y)) return (y = x);
          const k = 1 - Math.exp(-Math.min(f.dt, MAX_DT) / Math.max(op.tau, 1e-6));
          y = isVec(x) ? [lerp((y as Vec2)[0], x[0], k), lerp((y as Vec2)[1], x[1], k)] : lerp(y as number, toNumber(x), k);
          return y;
        },
        reset: () => (y = null),
      };
    }
    case "spring": {
      const { stiffness: k, damping: c, mass: m } = resolveSpringConfig(op.spring);
      let pos: number | null = null;
      let vel = 0;
      let rest = 0; // time left over from the last frame, below one step
      return {
        step: (x, f) => {
          const target = toNumber(x);
          if (pos === null) return (pos = target);
          let left = Math.min(f.dt, MAX_DT) + rest;
          while (left >= SPRING_STEP) {
            vel += ((-k * (pos - target) - c * vel) / m) * SPRING_STEP; // semi-implicit Euler
            pos += vel * SPRING_STEP;
            left -= SPRING_STEP;
          }
          rest = left;
          return pos;
        },
        reset: () => {
          pos = null;
          vel = 0;
          rest = 0;
        },
      };
    }
    case "remap":
      return {
        step: (x) =>
          lift(x, (n) => {
            const span = op.inMax - op.inMin;
            const t = span === 0 ? 0 : (n - op.inMin) / span;
            return lerp(op.outMin, op.outMax, op.clamp === false ? t : clamp(t, 0, 1));
          }),
        reset: () => undefined,
      };
    case "clamp":
      return { step: (x) => lift(x, (n) => clamp(n, op.min, op.max)), reset: () => undefined };
    case "curve": {
      const easing = parseEasing(op.easing);
      return { step: (x) => lift(x, (n) => (easing ? sampleEasing(easing, clamp(n, 0, 1)) : n)), reset: () => undefined };
    }
    case "deadzone":
      return {
        step: (x) =>
          lift(x, (n) => {
            const a = Math.abs(n);
            if (a <= op.radius) return 0;
            return Math.sign(n) * (op.radius < 1 ? (a - op.radius) / (1 - op.radius) : a - op.radius);
          }),
        reset: () => undefined,
      };
    case "falloff":
      return { step: (x) => falloffOf(op.shape, toNumber(x), op.radius), reset: () => undefined };
    case "noise":
      // wiggle: the input plus seeded noise over time
      return { step: (x, f) => lift(x, (n) => n + op.amplitude * noise1(f.time * op.frequency, op.seed + f.seed)), reset: () => undefined };
    case "delay": {
      let hist: { t: number; v: number }[] = [];
      return {
        step: (x, f) => {
          const v = toNumber(x);
          hist.push({ t: f.time, v });
          const want = f.time - op.seconds;
          while (hist.length > 2 && hist[1].t <= want) hist.shift(); // only what is still needed
          if (want <= hist[0].t) return hist[0].v;
          const a = hist[0];
          const b = hist[1] ?? a;
          return b.t === a.t ? a.v : lerp(a.v, b.v, (want - a.t) / (b.t - a.t));
        },
        reset: () => (hist = []),
      };
    }
    case "velocity": {
      let prev: number | null = null;
      let v = 0;
      return {
        step: (x, f) => {
          const n = toNumber(x);
          const dt = Math.min(f.dt, MAX_DT);
          if (prev === null || dt <= 0) {
            prev = n;
            return 0;
          }
          v = lerp(v, (n - prev) / dt, 1 - Math.exp(-dt / 0.05));
          prev = n;
          return v;
        },
        reset: () => {
          prev = null;
          v = 0;
        },
      };
    }
    case "accumulate": {
      let y = 0;
      return {
        step: (x, f) => {
          const dt = Math.min(f.dt, MAX_DT);
          y = y * Math.exp(-op.decay * dt) + toNumber(x) * dt;
          return y;
        },
        reset: () => (y = 0),
      };
    }
    case "threshold": {
      let on = false;
      return {
        step: (x) => {
          const n = toNumber(x);
          if (!on && n >= op.on) on = true;
          else if (on && n <= op.off) on = false;
          return on;
        },
        reset: () => (on = false),
      };
    }
    case "edge": {
      let prev = false;
      return {
        step: (x) => {
          const now = truthy(x);
          const rise = now && !prev;
          const fall = !now && prev;
          prev = now;
          return op.mode === "rise" ? rise : op.mode === "fall" ? fall : rise || fall;
        },
        reset: () => (prev = false),
      };
    }
    case "toggle": {
      let prev = false;
      let state = false;
      return {
        step: (x) => {
          const now = truthy(x);
          if (now && !prev) state = !state;
          prev = now;
          return state;
        },
        reset: () => {
          prev = false;
          state = false;
        },
      };
    }
    case "sampleHold": {
      // as the spec's table reads: the input is held while the trigger is low, and follows it while the trigger is high
      const trigger = compileExpr(op.trigger);
      let held: Value = 0;
      return {
        step: (x, f) => {
          if (truthy(trigger.step(f))) held = x;
          return held;
        },
        reset: () => {
          trigger.reset();
          held = 0;
        },
      };
    }
    case "quantize":
      return { step: (x) => lift(x, (n) => (op.step > 0 ? Math.round(n / op.step) * op.step : n)), reset: () => undefined };
    case "mix": {
      const other = compileExpr(op.with);
      return {
        step: (x, f) => {
          const b = other.step(f);
          return isVec(x) && isVec(b) ? [lerp(x[0], b[0], op.t), lerp(x[1], b[1], op.t)] : lerp(toNumber(x), toNumber(b), op.t);
        },
        reset: () => other.reset(),
      };
    }
    case "add":
      return { step: (x) => lift(x, (n) => n + op.x), reset: () => undefined };
    case "mul":
      return { step: (x) => lift(x, (n) => n * op.x), reset: () => undefined };
    case "min":
      return { step: (x) => lift(x, (n) => Math.min(n, op.x)), reset: () => undefined };
    case "max":
      return { step: (x) => lift(x, (n) => Math.max(n, op.x)), reset: () => undefined };
    case "abs":
      return { step: (x) => lift(x, Math.abs), reset: () => undefined };
    case "length":
      return { step: (x) => (isVec(x) ? Math.hypot(x[0], x[1]) : Math.abs(toNumber(x))), reset: () => undefined };
    case "normalize":
      return {
        step: (x) => {
          if (!isVec(x)) return Math.sign(toNumber(x));
          const l = Math.hypot(x[0], x[1]);
          return l === 0 ? [0, 0] : [x[0] / l, x[1] / l];
        },
        reset: () => undefined,
      };
    case "rotate":
      return {
        step: (x) => {
          if (!isVec(x)) return x;
          const a = (op.degrees * Math.PI) / 180;
          return [x[0] * Math.cos(a) - x[1] * Math.sin(a), x[0] * Math.sin(a) + x[1] * Math.cos(a)];
        },
        reset: () => undefined,
      };
    case "distance":
    case "angleTo": {
      const to = compileExpr(op.to);
      return {
        step: (x, f) => {
          const t = to.step(f);
          const a: Vec2 = isVec(x) ? x : [toNumber(x), 0];
          const b: Vec2 = isVec(t) ? t : [toNumber(t), 0];
          return op.op === "distance" ? Math.hypot(b[0] - a[0], b[1] - a[1]) : (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        },
        reset: () => to.reset(),
      };
    }
    case "select": {
      const yes = compileExpr(op.whenTrue);
      const no = compileExpr(op.whenFalse);
      return {
        step: (x, f) => {
          const a = yes.step(f); // both branches advance every frame, so their state stays continuous
          const b = no.step(f);
          return truthy(x) ? a : b;
        },
        reset: () => {
          yes.reset();
          no.reset();
        },
      };
    }
    case "component":
      return { step: (x) => (isVec(x) ? x[op.axis === "x" ? 0 : 1] : toNumber(x)), reset: () => undefined };
    case "trail":
      // an array of samples has no scalar value; it feeds ribbons and trails, which this evaluator does not draw
      throw new UnsupportedOperatorError("trail has no single value; it is used by ribbons and trails, not by a property binding.");
  }
}

/** The signal's value for this frame: the four the evaluator answers itself, the rest from the host. */
function readSignal(signal: Signal, f: Frame): Value {
  switch (signal.kind) {
    case "time":
      return f.time;
    case "frameDt":
      return f.dt;
    case "seed":
      return f.seed;
    case "constant":
      return signal.value;
    default:
      return f.read(signal);
  }
}

/** Compiles a signal-and-operators chain. Call `step` once per frame, in time order. */
export function compileExpr(expr: SignalExpr): ExprRuntime {
  const ops = expr.operators.map(compileOperator);
  return {
    step(frame) {
      let v = readSignal(expr.signal, frame);
      for (const o of ops) v = o.step(v, frame);
      return v;
    },
    reset() {
      for (const o of ops) o.reset();
    },
  };
}
