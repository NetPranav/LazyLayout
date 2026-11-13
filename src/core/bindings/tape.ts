/**
 * Input tapes (Design track D4, engine spec §4): a signal recorded or authored over time, played back as the frame's input
 * so the same tape always gives the same values: in tests, when scrubbing, and in an export.
 *
 * - `recorded` and `authored` tapes carry samples; numbers interpolate linearly, booleans and enums hold the last sample.
 * - `autopilot` tapes are generated from their seed: a pointer that wanders the page (uv or ndc), the same every run.
 * - A signal the tape has no channel for reads as 0 (false), so a partial tape still plays.
 */
import type { InputTape } from "../document/effects";
import { formatSignal, type Signal } from "../document/signals";
import { noise1, type Frame, type Value, type Vec2 } from "./evaluate";

type Sample = { t: number; v: number | boolean | readonly [number, number] };

const channelKey = (s: Signal) => formatSignal(s);

function sampleAt(samples: readonly Sample[], t: number): Value {
  if (samples.length === 0) return 0;
  if (t <= samples[0].t) return samples[0].v as Value;
  const lastIx = samples.length - 1;
  if (t >= samples[lastIx].t) return samples[lastIx].v as Value;
  let lo = 0;
  let hi = lastIx;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const k = (t - a.t) / (b.t - a.t);
  if (typeof a.v === "number" && typeof b.v === "number") return a.v + (b.v - a.v) * k;
  if (Array.isArray(a.v) && Array.isArray(b.v)) return [a.v[0] + (b.v[0] - a.v[0]) * k, a.v[1] + (b.v[1] - a.v[1]) * k] as Vec2;
  return a.v as Value; // booleans and enums hold
}

/** The seeded wandering pointer in uv (0..1, 0..1): smooth, bounded and the same for the same seed and time. */
export function autopilotUv(seed: number, t: number): Vec2 {
  const n = (x: number, s: number) => 0.5 + 0.5 * noise1(x, s);
  return [n(t * 0.55, seed * 2 + 1), n(t * 0.45, seed * 2 + 2)];
}

function autopilotRead(seed: number, signal: Signal, t: number): Value {
  const uv = autopilotUv(seed, t);
  if (signal.kind === "pointerIn") return signal.channel === "uv" ? uv : signal.channel === "ndc" ? [uv[0] * 2 - 1, uv[1] * 2 - 1] : [uv[0] * 1000, uv[1] * 1000];
  if (signal.kind === "pointer") {
    const next = autopilotUv(seed, t + 0.016);
    if (signal.channel === "x") return uv[0] * 1000;
    if (signal.channel === "y") return uv[1] * 1000;
    if (signal.channel === "dx") return (next[0] - uv[0]) * 1000;
    if (signal.channel === "dy") return (next[1] - uv[1]) * 1000;
    if (signal.channel === "speed") return Math.hypot(next[0] - uv[0], next[1] - uv[1]) * 1000 / 0.016;
    if (signal.channel === "down" || signal.channel === "coarse") return false;
  }
  return 0;
}

/** The frame at time `t` (and step `dt`) of a tape. Time past the tape's end holds the last sample. */
export function tapeFrame(tape: InputTape, t: number, dt: number, seed = tape.seed ?? 0): Frame {
  const channels = new Map(tape.channels.map((c) => [channelKey(c.signal), c.samples as readonly Sample[]]));
  return {
    time: t,
    dt,
    seed,
    read(signal) {
      if (tape.origin === "autopilot") return autopilotRead(tape.seed ?? 0, signal, Math.min(t, tape.duration));
      const samples = channels.get(channelKey(signal));
      return samples ? sampleAt(samples, Math.min(t, tape.duration)) : 0;
    },
  };
}

/** Plays a tape at a fixed rate and returns one frame per step: the deterministic input run a test or a replay uses. */
export function* playTape(tape: InputTape, fps = 60, seed?: number): Generator<Frame> {
  const dt = 1 / fps;
  const steps = Math.round(tape.duration * fps);
  for (let i = 0; i <= steps; i++) yield tapeFrame(tape, i * dt, dt, seed);
}
