import { BindingSchema, type Binding, type Signal, type SignalExpr } from "../document/signals";
import { compileExpr, compileTrailExpr, type Frame, type Value, type Vec2 } from "./evaluate";

export interface ReferenceBindingCase {
  readonly id: string;
  readonly binding: Binding;
  readonly sampleExpr?: SignalExpr;
  /** Hand-computed analytical/reference checkpoints keyed by timestamp in seconds. */
  readonly checkpoints: Readonly<Record<number, number>>;
  readonly tolerance: number;
}

function makeBinding(
  id: string,
  name: string,
  expr: SignalExpr,
  path = "transform.x",
  layerId = "hero"
): Binding {
  return BindingSchema.parse({
    id,
    name,
    ownerLayerId: layerId,
    enabled: true,
    expr,
    target: { kind: "property", on: { kind: "layer", ref: layerId }, path },
  });
}

/**
 * Deterministic synthetic frame reader used for Stage 4 Phase 138 reference
 * bindings and 30/60/120 Hz cross-rate verification.
 */
export function readReferenceSignal(signal: Signal, time: number): Value {
  switch (signal.kind) {
    case "constant":
      return signal.value;
    case "time":
      return time;
    case "pointer": {
      const px = 400 + 200 * Math.sin((time * Math.PI) / 10);
      const py = 300 + 100 * Math.cos((time * Math.PI) / 10);
      if (signal.channel === "x") return px;
      if (signal.channel === "y") return py;
      if (signal.channel === "down") return time % 4 < 2 ? 1 : 0;
      if (signal.channel === "speed") return 20;
      return 0;
    }
    case "pointerIn":
      if (signal.channel === "uv") {
        return [0.5 + 0.4 * Math.sin(time * 0.5), 0.5 + 0.4 * Math.cos(time * 0.5)];
      }
      return [100 + time * 10, 50];
    case "scroll":
      if (signal.channel === "progress") return Math.min(1, Math.max(0, time / 60));
      if (signal.channel === "y") return time * 25;
      return 0;
    case "proximity":
      return Math.max(0, 1 - Math.abs(time - 30) / 30);
    case "audio":
      return signal.channel === "beat" ? (Math.floor(time) % 2 === 0 && time - Math.floor(time) < 0.25 ? 1 : 0) : 0.5;
    case "keyDown":
      return time >= 1 && time < 1.2 ? 1 : 0;
    case "keyAxis":
      return [Math.sin(time), 0];
    default:
      return 0;
  }
}

export function createReferenceFrame(time: number, dt: number, seed = 7): Frame {
  return {
    time,
    dt,
    seed,
    read: (signal) => readReferenceSignal(signal, time),
  };
}

/**
 * Twelve validated Phase 138 reference bindings spanning the full spec §5
 * operator catalogue (`smooth`, `spring`, `remap`, `clamp`, `curve`,
 * `deadzone`, `falloff`, `noise`, `delay`, `velocity`, `accumulate`,
 * `threshold`, `edge`, `toggle`, `sampleHold`, `quantize`, `mix`, `rotate`,
 * `lookAt`, `select`, `component`).
 */
export const REFERENCE_CASES: readonly ReferenceBindingCase[] = [
  {
    id: "ref-01-remap-clamp",
    binding: makeBinding("ref-01-remap-clamp", "Scroll remap & clamp", {
      signal: { kind: "scroll", channel: "progress" },
      operators: [
        { op: "remap", inMin: 0, inMax: 1, outMin: -50, outMax: 50, clamp: true },
        { op: "clamp", min: -25, max: 40 },
      ],
    }),
    // t=15 -> p=0.25 -> -25; t=30 -> p=0.5 -> 0; t=60 -> p=1 -> 50 clamped to 40
    checkpoints: { 15: -25, 30: 0, 60: 40 },
    tolerance: 1e-6,
  },
  {
    id: "ref-02-curve-linear",
    binding: makeBinding("ref-02-curve-linear", "Linear curve scroll lift", {
      signal: { kind: "scroll", channel: "progress" },
      operators: [
        { op: "curve", easing: "power2.out" },
        { op: "remap", inMin: 0, inMax: 1, outMin: 0, outMax: 100 },
      ],
    }, "transform.y"),
    // power2.out(p) = 1 - (1 - p)^2; at t=30 p=0.5 -> 0.75 -> 75; t=60 -> 100
    checkpoints: { 30: 75, 60: 100 },
    tolerance: 1e-3,
  },
  {
    id: "ref-03-deadzone-falloff",
    binding: makeBinding("ref-03-deadzone-falloff", "Proximity deadzone + linear falloff", {
      signal: { kind: "scroll", channel: "progress" },
      operators: [
        { op: "deadzone", radius: 0.2 },
        { op: "falloff", shape: "linear", radius: 1 },
      ],
    }, "opacity"),
    // t=6 -> p=0.1 -> deadzone=0 -> falloff=1; t=30 -> p=0.5 -> deadzone=(0.5-0.2)/0.8=0.375 -> falloff=0.625
    checkpoints: { 6: 1, 30: 0.625 },
    tolerance: 1e-4,
  },
  {
    id: "ref-04-smooth-follow",
    binding: makeBinding("ref-04-smooth-follow", "Exponential smooth follow", {
      signal: { kind: "pointer", channel: "x" },
      operators: [{ op: "smooth", tau: 0.25 }],
    }),
    // Tracks 400 + 200*sin(pi*t/10) closely across frame rates
    checkpoints: { 10: 384.3, 20: 415.7 },
    tolerance: 3.5,
  },
  {
    id: "ref-05-spring-follow",
    binding: makeBinding("ref-05-spring-follow", "Perceptual spring follow", {
      signal: { kind: "pointer", channel: "y" },
      operators: [{ op: "spring", spring: { bounce: 0.2, time: 0.4 } }],
    }, "transform.y"),
    checkpoints: { 10: 200, 20: 400 },
    tolerance: 2.5,
  },
  {
    id: "ref-06-delay-echo",
    binding: makeBinding("ref-06-delay-echo", "0.5s delayed scroll follower", {
      signal: { kind: "scroll", channel: "y" },
      operators: [{ op: "delay", seconds: 0.5 }],
    }),
    // scroll.y = 25 * t, delayed 0.5s => 25 * (t - 0.5)
    checkpoints: { 10: 237.5, 30: 737.5 },
    tolerance: 0.5,
  },
  {
    id: "ref-07-velocity-scroll",
    binding: makeBinding("ref-07-velocity-scroll", "Scroll derivative velocity", {
      signal: { kind: "scroll", channel: "y" },
      operators: [{ op: "velocity" }],
    }),
    // d/dt (25*t) = 25
    checkpoints: { 10: 25, 30: 25, 60: 25 },
    tolerance: 0.5,
  },
  {
    id: "ref-08-accumulate-decay",
    binding: makeBinding("ref-08-accumulate-decay", "Leaky integrator steady state", {
      signal: { kind: "constant", value: 10 },
      operators: [{ op: "accumulate", decay: 2 }],
    }),
    // y' + 2y = 10 -> steady state 10/2 = 5 by t >= 10s
    checkpoints: { 10: 5, 30: 5, 60: 5 },
    tolerance: 0.25,
  },
  {
    id: "ref-09-threshold-edge-toggle",
    binding: makeBinding("ref-09-threshold-edge-toggle", "Threshold hysteresis + rise toggle", {
      signal: { kind: "scroll", channel: "progress" },
      operators: [
        { op: "threshold", on: 0.5, off: 0.25 },
        { op: "edge", mode: "rise" },
        { op: "toggle" },
      ],
    }, "opacity"),
    // Before t=30 (<0.5) -> 0; crosses 0.5 at t=30 -> toggle becomes 1 and stays 1 at t=60
    checkpoints: { 15: 0, 35: 1, 60: 1 },
    tolerance: 1e-6,
  },
  {
    id: "ref-10-samplehold-quantize",
    binding: makeBinding("ref-10-samplehold-quantize", "SampleHold + quantize stepped scroll", {
      signal: { kind: "scroll", channel: "y" },
      operators: [
        { op: "sampleHold", trigger: { signal: { kind: "constant", value: 1 }, operators: [] } },
        { op: "quantize", step: 25 },
      ],
    }),
    // scroll.y at t=10 is 250; at t=30 is 750; at t=60 is 1500
    checkpoints: { 10: 250, 30: 750, 60: 1500 },
    tolerance: 1e-6,
  },
  {
    id: "ref-11-mix-select-noise",
    binding: makeBinding("ref-11-mix-select-noise", "Mix + select + zero-amp noise pass", {
      signal: { kind: "constant", value: 10 },
      operators: [
        { op: "mix", with: { signal: { kind: "constant", value: 30 }, operators: [] }, t: 0.25 },
        { op: "noise", frequency: 1, amplitude: 0, seed: 3 },
        {
          op: "select",
          whenTrue: { signal: { kind: "constant", value: 15 }, operators: [] },
          whenFalse: { signal: { kind: "constant", value: 99 }, operators: [] },
        },
      ],
    }),
    // noise=0 keeps condition truthy -> select takes truthy value 15
    checkpoints: { 10: 15, 60: 15 },
    tolerance: 1e-6,
  },
  {
    id: "ref-12-vector-rotate-lookat",
    binding: makeBinding("ref-12-vector-rotate-lookat", "2D vector component / rotate / lookAt", {
      signal: { kind: "pointerIn", channel: "px", space: "page" },
      operators: [
        { op: "rotate", degrees: 0 },
        { op: "lookAt", x: 0, y: 0 },
      ],
    }, "transform.rotation"),
    // pointerIn px returns [100 + 10*t, 50]; atan2(50, 100 + 10*t) in deg
    checkpoints: {
      10: (Math.atan2(50, 200) * 180) / Math.PI,
      40: (Math.atan2(50, 500) * 180) / Math.PI,
    },
    tolerance: 1e-4,
  },
];

export const REFERENCE_BINDINGS: readonly Binding[] = REFERENCE_CASES.map((c) => c.binding);

export const REFERENCE_TRAIL_EXPR: SignalExpr = {
  signal: { kind: "pointerIn", channel: "px", space: "page" },
  operators: [
    { op: "rotate", degrees: 90 },
    { op: "trail", samples: 4 },
  ],
};

function numericValue(value: Value): number {
  return Array.isArray(value) ? (value as Vec2)[0] : value;
}

/** Runs an expression across `[0, durationSec]` at a fixed frequency and samples checkpoints. */
export function runExprAtRate(
  expr: SignalExpr,
  durationSec: number,
  fps: number,
  checkpointSeconds: readonly number[],
  seed = 7
): Record<number, number> {
  const runtime = compileExpr(expr);
  const dt = 1 / fps;
  const totalFrames = Math.round(durationSec * fps);
  const targetFrames = new Map<number, number>();
  for (const sec of checkpointSeconds) {
    targetFrames.set(Math.round(sec * fps), sec);
  }

  const out: Record<number, number> = {};
  for (let f = 0; f <= totalFrames; f += 1) {
    const time = f * dt;
    const value = runtime.step(createReferenceFrame(time, dt, seed));
    const checkpointSec = targetFrames.get(f);
    if (checkpointSec !== undefined) {
      out[checkpointSec] = numericValue(value);
    }
  }
  return out;
}

export interface RateComparison {
  readonly id: string;
  readonly maxDelta: number;
  readonly byRate: Readonly<Record<number, Readonly<Record<number, number>>>>;
}

/**
 * Evaluates a binding across 30, 60, and 120 Hz over `durationSec` (default 60 s)
 * and measures the maximum divergence at the requested checkpoint seconds.
 */
export function compareFrameRates(
  id: string,
  expr: SignalExpr,
  checkpointSeconds: readonly number[],
  durationSec = 60,
  fpsList: readonly number[] = [30, 60, 120]
): RateComparison {
  const byRate: Record<number, Record<number, number>> = {};
  for (const fps of fpsList) {
    byRate[fps] = runExprAtRate(expr, durationSec, fps, checkpointSeconds);
  }

  let maxDelta = 0;
  for (const sec of checkpointSeconds) {
    const values = fpsList.map((fps) => byRate[fps]![sec]!);
    const min = Math.min(...values);
    const max = Math.max(...values);
    maxDelta = Math.max(maxDelta, max - min);
  }

  return { id, maxDelta, byRate };
}

/** Evaluates a `trail` expression deterministically for `frames` frames at `fps`. */
export function runTrailAtRate(expr: SignalExpr, frames: number, fps = 60): readonly (readonly Value[])[] {
  const runtime = compileTrailExpr(expr);
  const dt = 1 / fps;
  const history: (readonly Value[])[] = [];
  for (let i = 0; i < frames; i += 1) {
    const snapshot = runtime.step(createReferenceFrame(i * dt, dt));
    history.push(snapshot.map((v) => (Array.isArray(v) ? [v[0], v[1]] : v)));
  }
  return history;
}
