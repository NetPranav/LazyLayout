import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRepeater, repeatCopies, repeatPoint, MAX_REPEAT_COUNT, type RepeaterSettings } from "../repeater";

const box = { x: 100, y: 100, width: 40, height: 20 }; // centre (120, 110)
const base: RepeaterSettings = { count: 4, x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
const close = (a: number, b: number, msg: string, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

describe("Repeater (D8)", () => {
  it("count 1 or less, or nothing set, does not repeat", () => {
    assert.equal(readRepeater(() => undefined), null);
    assert.equal(readRepeater((p) => (p === "repeat.count" ? 1 : undefined)), null);
    assert.equal(readRepeater((p) => (p === "repeat.count" ? 0 : undefined)), null);
  });

  it("reads the settings, clamps the count, and ignores nonsense", () => {
    const s = readRepeater((p) => ({ "repeat.count": 12.9, "repeat.x": 30, "repeat.scale": -2, "repeat.opacity": 5, "repeat.rotate": "x" })[p])!;
    assert.deepEqual(s, { count: 12, x: 30, y: 0, rotate: 0, scale: 0, opacity: 1 });
    assert.equal(readRepeater((p) => (p === "repeat.count" ? 1e9 : undefined))!.count, MAX_REPEAT_COUNT);
  });

  it("copy 0 is the layer itself: count N gives N - 1 extra copies", () => {
    assert.equal(repeatCopies({ ...base, count: 1 }, box).length, 0);
    assert.equal(repeatCopies({ ...base, count: 12 }, box).length, 11);
    assert.deepEqual(repeatCopies(base, box).map((c) => c.index), [1, 2, 3]);
  });

  // ten settings with the position of a corner point of the layer in each copy worked out by hand
  const settings: { name: string; s: RepeaterSettings; copy: number; point: [number, number]; expect: [number, number] }[] = [
    { name: "step X", s: { ...base, x: 50 }, copy: 2, point: [100, 100], expect: [200, 100] },
    { name: "step Y", s: { ...base, y: -25 }, copy: 3, point: [140, 120], expect: [140, 45] },
    { name: "step X and Y", s: { ...base, x: 10, y: 20 }, copy: 1, point: [100, 100], expect: [110, 120] },
    { name: "rotate 90 about the centre", s: { ...base, rotate: 90 }, copy: 1, point: [140, 110], expect: [120, 130] },
    { name: "rotate 180", s: { ...base, rotate: 180 }, copy: 1, point: [100, 100], expect: [140, 120] },
    { name: "rotate 45 twice (90)", s: { ...base, rotate: 45 }, copy: 2, point: [140, 110], expect: [120, 130] },
    { name: "scale 2", s: { ...base, scale: 2 }, copy: 1, point: [140, 110], expect: [160, 110] },
    { name: "scale 0.5 twice (0.25)", s: { ...base, scale: 0.5 }, copy: 2, point: [140, 110], expect: [125, 110] },
    { name: "move and scale", s: { ...base, x: 100, scale: 2 }, copy: 1, point: [100, 100], expect: [180, 90] },
    { name: "move, rotate 90 and scale 2", s: { ...base, x: 10, y: 10, rotate: 90, scale: 2 }, copy: 1, point: [140, 110], expect: [130, 160] },
  ];
  for (const t of settings) {
    it(`golden: ${t.name}`, () => {
      const [x, y] = repeatPoint(t.s, box, t.copy, t.point);
      close(x, t.expect[0], `${t.name} x`);
      close(y, t.expect[1], `${t.name} y`);
    });
  }

  it("the CSS says what the maths says, about the layer's centre", () => {
    const [c1, c2] = repeatCopies({ ...base, count: 3, x: 10, y: -5, rotate: 15, scale: 1.5, opacity: 0.5 }, box);
    assert.equal(c1.transform, "translate(10px, -5px) rotate(15deg) scale(1.5)");
    assert.equal(c2.transform, "translate(20px, -10px) rotate(30deg) scale(2.25)");
    assert.equal(c1.origin, "120px 110px");
    assert.equal(c1.opacity, 0.5);
    assert.equal(c2.opacity, 0.25);
  });

  it("is deterministic", () => {
    const s = { ...base, count: 50, x: 7, rotate: 3, scale: 0.97, opacity: 0.99 };
    assert.deepEqual(repeatCopies(s, box), repeatCopies(s, box));
  });
});
