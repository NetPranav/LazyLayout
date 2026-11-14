import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effectCopy, influence, readEffector, type EffectorSettings } from "../effector";

const base: EffectorSettings = { mode: "pointer", scale: 3, fade: 0.5, offsetX: 10, offsetY: -20, hue: 60, radius: 100, spread: 3, falloff: "linear", seed: 1 };
const close = (a: number, b: number, msg: string, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

describe("Effectors (D10)", () => {
  it("off or missing is no effector; values are read and clamped", () => {
    assert.equal(readEffector(() => undefined), null);
    assert.equal(readEffector((p) => (p === "effector.mode" ? "off" : undefined)), null);
    const s = readEffector((p) => ({ "effector.mode": "pointer", "effector.fade": 7, "effector.radius": -3, "effector.falloff": "nonsense", "effector.scale": -2 })[p])!;
    assert.equal(s.fade, 1);
    assert.equal(s.radius, 1);
    assert.equal(s.falloff, "smoothstep");
    assert.equal(s.scale, 0);
  });

  // five pointer distances, with the influence worked out by hand for each falloff shape (radius 100)
  const distances = [0, 25, 50, 75, 100];
  it("linear falloff at 5 distances: 1, 0.75, 0.5, 0.25, 0", () => {
    [1, 0.75, 0.5, 0.25, 0].forEach((want, i) => close(influence({ ...base, falloff: "linear" }, 1, 10, distances[i]), want, `d ${distances[i]}`));
  });
  it("smoothstep falloff at 5 distances: s = 1 - d/r, then s*s*(3 - 2s)", () => {
    // s = 1, 0.75, 0.5, 0.25, 0  ->  1, 0.84375, 0.5, 0.15625, 0
    [1, 0.84375, 0.5, 0.15625, 0].forEach((want, i) => close(influence({ ...base, falloff: "smoothstep" }, 1, 10, distances[i]), want, `d ${distances[i]}`));
  });
  it("gaussian falloff at 5 distances: exp(-4.5 q^2)", () => {
    distances.forEach((d) => close(influence({ ...base, falloff: "gaussian" }, 1, 10, d), Math.exp(-4.5 * (d / 100) ** 2), `d ${d}`, 1e-12));
  });
  it("inverse-square falloff at 5 distances: 1 / (1 + q^2)", () => {
    [1, 1 / 1.0625, 1 / 1.25, 1 / 1.5625, 0.5].forEach((want, i) => close(influence({ ...base, falloff: "inverse-square" }, 1, 10, distances[i]), want, `d ${distances[i]}`));
  });

  it("beyond the radius there is no influence (finite falloffs)", () => {
    assert.equal(influence({ ...base, falloff: "linear" }, 1, 10, 250), 0);
    assert.equal(influence({ ...base, falloff: "smoothstep" }, 1, 10, 250), 0);
  });

  it("a pointer field with no pointer does nothing", () => {
    assert.equal(influence(base, 1, 10, undefined), 0);
  });

  it("index mode ramps from the layer (0) to the last copy (1)", () => {
    const s: EffectorSettings = { ...base, mode: "index" };
    close(influence(s, 0, 5), 0, "layer");
    close(influence(s, 2, 5), 0.5, "middle");
    close(influence(s, 4, 5), 1, "last");
    assert.equal(influence(s, 0, 1), 0);
  });

  it("noise mode is seeded, in 0..1, and varies between copies", () => {
    const s: EffectorSettings = { ...base, mode: "noise", seed: 3 };
    const a = Array.from({ length: 50 }, (_, i) => influence(s, i, 50));
    assert.deepEqual(a, Array.from({ length: 50 }, (_, i) => influence(s, i, 50)));
    assert.notDeepEqual(a, Array.from({ length: 50 }, (_, i) => influence({ ...s, seed: 4 }, i, 50)));
    assert.ok(a.every((v) => v >= 0 && v <= 1));
    assert.ok(Math.max(...a) - Math.min(...a) > 0.3);
  });

  it("the effect moves a copy from as-made (f = 0) to the full setting (f = 1)", () => {
    assert.deepEqual(effectCopy(base, 0), { scale: 1, opacity: 1, dx: 0, dy: 0, hue: 0 });
    assert.deepEqual(effectCopy(base, 1), { scale: 3, opacity: 0.5, dx: 10, dy: -20, hue: 60 });
    assert.deepEqual(effectCopy(base, 0.5), { scale: 2, opacity: 0.75, dx: 5, dy: -10, hue: 30 });
  });

  it("scroll mode: a wave along the copies, 1 at the scroll position, falling off over `spread` copies", () => {
    const s: EffectorSettings = { ...base, mode: "scroll", falloff: "linear", spread: 3 };
    // 11 copies (0..10), scrolled halfway: the wave is on copy 5
    close(influence(s, 5, 11, undefined, 0.5), 1, "at the wave");
    close(influence(s, 6, 11, undefined, 0.5), 2 / 3, "one copy away");
    close(influence(s, 4, 11, undefined, 0.5), 2 / 3, "one copy the other way");
    close(influence(s, 7, 11, undefined, 0.5), 1 / 3, "two copies away");
    close(influence(s, 8, 11, undefined, 0.5), 0, "three copies away: out of the wave");
    // the wave moves with the scroll: at the top it is on the layer, at the bottom on the last copy
    close(influence(s, 0, 11, undefined, 0), 1, "top");
    close(influence(s, 10, 11, undefined, 1), 1, "bottom");
    close(influence(s, 10, 11, undefined, 0), 0, "bottom copy at the top");
  });

  it("scroll mode with no scroll reading leaves the copies as made; progress is clamped", () => {
    const s: EffectorSettings = { ...base, mode: "scroll", falloff: "linear" };
    assert.equal(influence(s, 3, 11), 0);
    close(influence(s, 10, 11, undefined, 7), 1, "past the bottom is the bottom");
  });
});
