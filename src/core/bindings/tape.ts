/**
 * Input tapes (Design track D4, engine spec §4): a signal recorded or authored over time, played back as the frame's input
 * so the same tape always gives the same values: in tests, when scrubbing, and in an export.
 *
 * - `recorded` and `authored` tapes carry samples; numbers interpolate linearly, booleans and enums hold the last sample.
 * - `autopilot` tapes are generated from their seed: a pointer that wanders the page (uv or ndc), the same every run.
 * - A signal the tape has no channel for reads as 0 (false), so a partial tape still plays.
 */
import { InputTapeSchema, type InputTape } from "../document/effects";
import { formatSignal, type Signal } from "../document/signals";
import { noise1, type ExprRuntime, type Frame, type Value, type Vec2 } from "./evaluate";

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

export interface TapeRecorder {
  record(t: number, values: readonly { signal: Signal; value: number | boolean | readonly [number, number] }[]): void;
  finish(): InputTape;
}

/** Records live pointer, scroll, key, device, and audio samples into a schema-valid `InputTape`. */
export function createTapeRecorder(id: string, name: string, fps = 60, seed = 1): TapeRecorder {
  const map = new Map<string, { signal: Signal; samples: Sample[] }>();
  let maxT = 1 / fps;
  return {
    record(t, values) {
      const safeT = Math.max(0, t);
      if (safeT > maxT) maxT = safeT;
      for (const item of values) {
        const key = channelKey(item.signal);
        let ch = map.get(key);
        if (!ch) {
          ch = { signal: item.signal, samples: [] };
          map.set(key, ch);
        }
        const prev = ch.samples[ch.samples.length - 1];
        if (prev && safeT <= prev.t) {
          // Ensure strictly monotonic sample timestamps per InputTapeSchema
          ch.samples[ch.samples.length - 1] = { t: prev.t, v: item.value };
        } else {
          ch.samples.push({ t: safeT, v: item.value });
        }
      }
    },
    finish() {
      const tape: InputTape = {
        id,
        name,
        origin: "recorded",
        duration: Math.max(1 / fps, maxT),
        fps,
        seed,
        channels: Array.from(map.values()).filter((c) => c.samples.length > 0),
      };
      return InputTapeSchema.parse(tape);
    },
  };
}

/** Creates a deterministic synthetic tape for pointer paths, scroll sweeps, and key presses. */
export function authorScriptedTape(options: {
  id: string;
  name: string;
  duration: number;
  fps?: number;
  seed?: number;
  channels: readonly {
    signal: Signal;
    samples: readonly { t: number; v: number | boolean | readonly [number, number] }[];
  }[];
}): InputTape {
  const tape: InputTape = {
    id: options.id,
    name: options.name,
    origin: "authored",
    duration: options.duration,
    fps: options.fps ?? 60,
    seed: options.seed ?? 0,
    channels: options.channels.map((ch) => ({
      signal: ch.signal,
      samples: ch.samples.map((s) => ({ t: s.t, v: Array.isArray(s.v) ? [s.v[0], s.v[1]] as [number, number] : s.v })),
    })),
  };
  return InputTapeSchema.parse(tape);
}

export function serializeInputTape(tape: InputTape): string {
  return JSON.stringify(InputTapeSchema.parse(tape));
}

export function deserializeInputTape(json: string): InputTape {
  return InputTapeSchema.parse(JSON.parse(json));
}

/** Runs an expression evaluator over every frame of a tape deterministically and returns snapshots. */
export function replayTapeExpressions(
  tape: InputTape,
  factories: Record<string, () => ExprRuntime>,
  fps = tape.fps ?? 60
): readonly { t: number; values: Record<string, Value> }[] {
  const runtimes = Object.entries(factories).map(([k, mk]) => [k, mk()] as const);
  for (const [, rt] of runtimes) rt.reset();
  const snapshots: { t: number; values: Record<string, Value> }[] = [];
  for (const frame of playTape(tape, fps, tape.seed ?? 0)) {
    const values: Record<string, Value> = {};
    for (const [k, rt] of runtimes) values[k] = rt.step(frame);
    snapshots.push({ t: frame.time, values });
  }
  return snapshots;
}
