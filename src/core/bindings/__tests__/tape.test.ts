import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputTape } from "../../document/effects";
import { parseBinding, resolveLayerRefs, type Binding } from "../../document/signals";
import { toNumber } from "../evaluate";
import { createBindingRuntime, type BindingHost } from "../runtime";
import { autopilotUv, playTape, tapeFrame } from "../tape";

const scrollTape: InputTape = {
  id: "tape_1",
  name: "scroll down",
  origin: "authored",
  duration: 2,
  channels: [{ signal: { kind: "scroll", channel: "progress" }, samples: [{ t: 0, v: 0 }, { t: 1, v: 1 }, { t: 2, v: 0.5 }] }],
};
const pointerTape: InputTape = { id: "tape_2", name: "wander", origin: "autopilot", seed: 7, duration: 3, channels: [] };

const binding = (text: string): Binding => ({
  ...resolveLayerRefs(parseBinding(text), (n) => (n === "hero" ? "lay_hero" : undefined)),
  id: "b1",
  ownerLayerId: "lay_hero",
  enabled: true,
});
const host: BindingHost = { layersOf: (s) => (s.kind === "layer" ? [s.ref] : []), base: () => undefined, env: { pointerCoarse: false, reducedMotion: false, breakpoint: "desktop", states: new Set() } };

/** Every value a binding writes to a property over a whole tape, at a frame rate. */
function record(tape: InputTape, text: string, path: string, fps = 60): number[] {
  const rt = createBindingRuntime([binding(text)], host);
  return [...playTape(tape, fps)].map((f) => rt.step(f).get("lay_hero")?.get(path) ?? NaN);
}

describe("input tapes (D4)", () => {
  it("numbers interpolate between samples and hold past the end", () => {
    assert.equal(toNumber(tapeFrame(scrollTape, 0.5, 1 / 60).read({ kind: "scroll", channel: "progress" })), 0.5);
    assert.equal(toNumber(tapeFrame(scrollTape, 1.5, 1 / 60).read({ kind: "scroll", channel: "progress" })), 0.75);
    assert.equal(toNumber(tapeFrame(scrollTape, 9, 1 / 60).read({ kind: "scroll", channel: "progress" })), 0.5);
  });

  it("a signal with no channel reads as 0", () => {
    assert.equal(toNumber(tapeFrame(scrollTape, 1, 1 / 60).read({ kind: "pointer", channel: "x" })), 0);
  });

  it("the same tape gives the same values, run after run", () => {
    const text = "scroll.progress |> smooth(0.1) |> remap(0, 1, 0, 100)\n-> hero.transform.x blend replace";
    assert.deepEqual(record(scrollTape, text, "transform.x"), record(scrollTape, text, "transform.x"));
  });

  it("a recording matches a golden value at fixed times, whatever the frame rate", () => {
    const text = "scroll.progress |> remap(0, 1, 0, 100)\n-> hero.transform.x blend replace";
    for (const fps of [30, 60, 120]) {
      const out = record(scrollTape, text, "transform.x", fps);
      assert.ok(Math.abs(out[fps] - 100) < 1e-9, `fps ${fps}: x at t = 1 s is ${out[fps]}`);
      assert.ok(Math.abs(out[Math.round(fps * 1.5)] - 75) < 1e-6);
      assert.ok(Math.abs(out[out.length - 1] - 50) < 1e-9);
    }
  });

  it("an autopilot pointer wanders inside the page, and is the same for the same seed only", () => {
    const run = (seed: number) => Array.from({ length: 200 }, (_, i) => autopilotUv(seed, i / 30));
    const a = run(7);
    assert.deepEqual(a, run(7));
    assert.notDeepEqual(a, run(8));
    assert.ok(a.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
    const xs = a.map((p) => p[0]);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 0.2, "it moves");
  });

  it("an autopilot pointer drives a binding deterministically", () => {
    const text = "pointer.uv(page) |> component(x) |> remap(0, 1, -20, 20)\n-> hero.transform.x blend replace";
    const out = record(pointerTape, text, "transform.x");
    assert.deepEqual(out, record(pointerTape, text, "transform.x"));
    assert.ok(out.every((v) => v >= -20 && v <= 20));
  });
});
