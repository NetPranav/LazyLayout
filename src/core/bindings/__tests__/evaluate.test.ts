import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Operator, Signal, SignalExpr } from "../../document/signals";
import { UnsupportedOperatorError, compileExpr, noise1, toNumber, type Frame, type Value } from "../evaluate";

const constant = (value: number): Signal => ({ kind: "constant", value });
const chain = (signal: Signal, ...operators: Operator[]): SignalExpr => ({ signal, operators });
/** Runs a chain over `seconds` at `fps`, feeding `input(t)` as the pointer x channel. */
function run(expr: SignalExpr, input: (t: number) => Value, fps: number, seconds: number, seed = 0): Value[] {
  const rt = compileExpr(expr);
  const out: Value[] = [];
  const dt = 1 / fps;
  for (let i = 0; i <= Math.round(seconds * fps); i++) {
    const t = i * dt;
    const frame: Frame = { time: t, dt, seed, read: () => input(t) };
    out.push(rt.step(frame));
  }
  return out;
}
const pointer: Signal = { kind: "pointer", channel: "x" };
const last = (a: Value[]) => toNumber(a[a.length - 1]);
const stepAt = (t0: number) => (t: number) => (t >= t0 ? 1 : 0);

describe("binding evaluator (D4)", () => {
  it("the same inputs give the same values, every time", () => {
    const e = chain(pointer, { op: "smooth", tau: 0.2 }, { op: "spring", spring: { stiffness: 120, damping: 12 } }, { op: "noise", frequency: 3, amplitude: 0.1, seed: 4 });
    const input = (t: number) => Math.sin(t * 3);
    assert.deepEqual(run(e, input, 60, 3, 7), run(e, input, 60, 3, 7));
  });

  it("smooth follows y += (x - y)(1 - e^(-dt/tau)) and does not depend on the frame rate", () => {
    const e = chain(pointer, { op: "smooth", tau: 0.1 });
    for (const fps of [30, 60, 120]) {
      const out = run(e, stepAt(0.0001), fps, 0.5);
      assert.ok(Math.abs(last(out) - (1 - Math.exp(-0.5 / 0.1))) < 0.02, `fps ${fps}: ${last(out)}`);
    }
  });

  it("spring settles on its target, the same at 60 and 120 fps", () => {
    const e = chain(pointer, { op: "spring", spring: { stiffness: 100, damping: 10 } });
    const a = last(run(e, stepAt(0.0001), 60, 4));
    const b = last(run(e, stepAt(0.0001), 120, 4));
    assert.ok(Math.abs(a - 1) < 0.01 && Math.abs(b - 1) < 0.01);
    assert.ok(Math.abs(a - b) < 0.01);
  });

  it("a bouncy spring overshoots; an overdamped one does not", () => {
    const peak = (c: number) => Math.max(...run(chain(pointer, { op: "spring", spring: { stiffness: 100, damping: c } }), stepAt(0.0001), 120, 3).map(toNumber));
    assert.ok(peak(4) > 1.1);
    assert.ok(peak(60) <= 1.0001);
  });

  it("a stall does not blow a spring up", () => {
    const rt = compileExpr(chain(pointer, { op: "spring", spring: { stiffness: 400, damping: 4 } }));
    rt.step({ time: 0, dt: 1 / 60, seed: 0, read: () => 0 });
    const v = toNumber(rt.step({ time: 5, dt: 5, seed: 0, read: () => 1 }));
    assert.ok(Number.isFinite(v) && Math.abs(v) < 2);
  });

  it("remap maps and clamps; clamp, quantize, abs, add, mul, min, max do what they say", () => {
    const at = (op: Operator, x: number) => toNumber(run(chain(constant(x), op), () => 0, 60, 0)[0]);
    assert.equal(at({ op: "remap", inMin: 0, inMax: 10, outMin: 0, outMax: 100 }, 5), 50);
    assert.equal(at({ op: "remap", inMin: 0, inMax: 10, outMin: 0, outMax: 100 }, 20), 100);
    assert.equal(at({ op: "remap", inMin: 0, inMax: 10, outMin: 0, outMax: 100, clamp: false }, 20), 200);
    assert.equal(at({ op: "clamp", min: 0, max: 1 }, 3), 1);
    assert.equal(at({ op: "quantize", step: 0.25 }, 0.6), 0.5);
    assert.equal(at({ op: "abs" }, -3), 3);
    assert.equal(at({ op: "add", x: 2 }, 3), 5);
    assert.equal(at({ op: "mul", x: 2 }, 3), 6);
    assert.equal(at({ op: "min", x: 2 }, 3), 2);
    assert.equal(at({ op: "max", x: 5 }, 3), 5);
  });

  it("deadzone is 0 inside the radius and rescaled outside", () => {
    const at = (x: number) => toNumber(run(chain(constant(x), { op: "deadzone", radius: 0.2 }), () => 0, 60, 0)[0]);
    assert.equal(at(0.1), 0);
    assert.equal(at(-0.2), 0);
    assert.ok(Math.abs(at(1) - 1) < 1e-9);
    assert.ok(Math.abs(at(-0.6) + 0.5) < 1e-9);
  });

  it("falloff maps a distance to 0..1: 1 at the centre, 0 at the radius for the finite shapes", () => {
    for (const shape of ["linear", "smoothstep"] as const) {
      const at = (d: number) => toNumber(run(chain(constant(d), { op: "falloff", shape, radius: 100 }), () => 0, 60, 0)[0]);
      assert.equal(at(0), 1);
      assert.equal(at(100), 0);
      assert.ok(at(50) > 0 && at(50) < 1);
    }
    const g = (d: number) => toNumber(run(chain(constant(d), { op: "falloff", shape: "gaussian", radius: 100 }), () => 0, 60, 0)[0]);
    assert.equal(g(0), 1);
    assert.ok(g(100) < 0.02);
  });

  it("threshold has hysteresis, edge pulses once, toggle flips on each rising edge", () => {
    const wave = (t: number) => (t < 0.3 ? 0 : t < 0.6 ? 0.7 : t < 0.9 ? 0.45 : 0.1);
    const th = run(chain(pointer, { op: "threshold", on: 0.6, off: 0.3 }), wave, 20, 1.2).map(Boolean);
    assert.equal(th[0], false);
    assert.equal(th[8], true); // t = 0.4: over `on`
    assert.equal(th[14], true); // t = 0.7: 0.45 is between off and on, so it stays on
    assert.equal(th[22], false); // t = 1.1: under `off`
    const pulses = run(chain(pointer, { op: "edge", mode: "rise" }), (t) => (t >= 0.2 && t < 0.5 ? 1 : 0), 20, 1).filter(Boolean).length;
    assert.equal(pulses, 1);
    const flips = run(chain(pointer, { op: "toggle" }), (t) => (Math.floor(t * 4) % 2 === 1 ? 1 : 0), 40, 1.9);
    assert.deepEqual([flips[0], flips[15], flips[25], flips[35]], [false, true, true, false]); // on at the first rise, kept through the fall, off at the second rise
  });

  it("delay returns the input from `seconds` ago", () => {
    const out = run(chain(pointer, { op: "delay", seconds: 0.5 }), (t) => t * 10, 20, 2);
    assert.ok(Math.abs(toNumber(out[30]) - 10) < 1e-6, String(out[30])); // t = 1.5 gives the input at t = 1.0
    assert.equal(toNumber(out[2]), 0); // before the history begins: the oldest value
  });

  it("velocity of a ramp is its slope; accumulate builds and decays", () => {
    const v = run(chain(pointer, { op: "velocity" }), (t) => t * 5, 60, 2);
    assert.ok(Math.abs(last(v) - 5) < 0.05, String(last(v)));
    const acc = run(chain(pointer, { op: "accumulate", decay: 1 }), (t) => (t < 1 ? 1 : 0), 60, 4);
    const peak = Math.max(...acc.map(toNumber));
    assert.ok(peak > 0.5 && last(acc) < peak * 0.1);
  });

  it("noise is seeded and bounded by its amplitude", () => {
    const e = chain(constant(0), { op: "noise", frequency: 2, amplitude: 0.5, seed: 9 });
    const a = run(e, () => 0, 60, 3, 1).map(toNumber);
    assert.deepEqual(a, run(e, () => 0, 60, 3, 1).map(toNumber));
    assert.notDeepEqual(a, run(e, () => 0, 60, 3, 2).map(toNumber)); // another instance seed, another wiggle
    assert.ok(a.every((x) => Math.abs(x) <= 0.5 + 1e-9));
    assert.ok(Math.max(...a) - Math.min(...a) > 0.1);
    assert.equal(noise1(3, 5), noise1(3, 5));
  });

  it("mix, select, sampleHold, component and the vector operators", () => {
    const frame = (read: Frame["read"]): Frame => ({ time: 0, dt: 1 / 60, seed: 0, read });
    assert.equal(toNumber(compileExpr(chain(constant(0), { op: "mix", with: chain(constant(10)), t: 0.25 })).step(frame(() => 0))), 2.5);
    assert.equal(toNumber(compileExpr(chain(constant(1), { op: "select", whenTrue: chain(constant(7)), whenFalse: chain(constant(9)) })).step(frame(() => 0))), 7);
    assert.equal(toNumber(compileExpr(chain(constant(0), { op: "select", whenTrue: chain(constant(7)), whenFalse: chain(constant(9)) })).step(frame(() => 0))), 9);
    const uv: Signal = { kind: "pointerIn", channel: "uv", space: "page" as never };
    const vec = (read: () => Value) => frame(read as Frame["read"]);
    assert.equal(toNumber(compileExpr(chain(uv, { op: "component", axis: "y" })).step(vec(() => [0.3, 0.8]))), 0.8);
    assert.equal(toNumber(compileExpr(chain(uv, { op: "length" })).step(vec(() => [3, 4]))), 5);
    const n = compileExpr(chain(uv, { op: "normalize" })).step(vec(() => [3, 4])) as readonly number[];
    assert.ok(Math.abs(n[0] - 0.6) < 1e-9 && Math.abs(n[1] - 0.8) < 1e-9);
    const r = compileExpr(chain(uv, { op: "rotate", degrees: 90 })).step(vec(() => [1, 0])) as readonly number[];
    assert.ok(Math.abs(r[0]) < 1e-9 && Math.abs(r[1] - 1) < 1e-9);
    assert.equal(toNumber(compileExpr(chain(uv, { op: "distance", to: chain(constant(0)) })).step(vec(() => [3, 4]))), Math.hypot(3 - 0, 4 - 0));
    // sampleHold: follows the input while the trigger is high, holds while it is low
    const rt = compileExpr(chain(pointer, { op: "sampleHold", trigger: chain({ kind: "pointer", channel: "down" }) }));
    let down = true;
    const f = (x: number): Frame => ({ time: 0, dt: 1 / 60, seed: 0, read: (s) => (s.kind === "pointer" && s.channel === "down" ? down : x) });
    assert.equal(toNumber(rt.step(f(5))), 5);
    down = false;
    assert.equal(toNumber(rt.step(f(9))), 5);
  });

  it("reset forgets state; trail has no scalar value and says so", () => {
    const rt = compileExpr(chain(pointer, { op: "accumulate", decay: 0.1 }));
    const f: Frame = { time: 0, dt: 1 / 60, seed: 0, read: () => 10 };
    const first = toNumber(rt.step(f));
    rt.step(f);
    rt.reset();
    assert.equal(toNumber(rt.step(f)), first);
    assert.throws(() => compileExpr(chain(pointer, { op: "trail", samples: 8 })), UnsupportedOperatorError);
  });
});
