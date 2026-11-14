import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REST_SPEED, readSpeedSettings, speedEffect, speedEffectsOn, speedTransform, type SpeedSettings } from "../speedEffects";

const S: SpeedSettings = { stretch: 1, lean: 20, blur: 0.02, ref: 1000 };
const close = (a: number, b: number, m: string, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);

describe("speed effects (D18)", () => {
  it("nothing switched on means no settings, and no work", () => {
    assert.equal(readSpeedSettings(() => undefined), null);
    assert.equal(readSpeedSettings((p) => ({ "speed.stretch": 0, "speed.lean": 0 })[p]), null);
    assert.equal(speedEffectsOn({}), false);
    assert.equal(speedEffectsOn({ "speed.blur": 0.01 }), true);
  });

  it("reads and clamps the settings", () => {
    const s = readSpeedSettings((p) => ({ "speed.stretch": -3, "speed.lean": 15, "speed.ref": 0 })[p])!;
    assert.equal(s.stretch, 0);
    assert.equal(s.lean, 15);
    assert.equal(s.ref, 1);
  });

  it("a layer at rest, or barely moving, gets nothing", () => {
    assert.equal(speedEffect(S, { x: 0, y: 0 }), null);
    assert.equal(speedEffect(S, { x: REST_SPEED - 0.5, y: 0 }), null);
    assert.ok(speedEffect(S, { x: REST_SPEED + 0.5, y: 0 }));
  });

  // the effect amount against the velocity curve, hand-computed at five speeds along +x (reference 1000 px/s, stretch 1)
  const rows: [number, number, number, number][] = [
    // speed, amount, along (1 + amount), across (1 / sqrt(along))
    [100, 0.1, 1.1, 1 / Math.sqrt(1.1)],
    [250, 0.25, 1.25, 1 / Math.sqrt(1.25)],
    [500, 0.5, 1.5, 1 / Math.sqrt(1.5)],
    [750, 0.75, 1.75, 1 / Math.sqrt(1.75)],
    [1000, 1, 2, 1 / Math.sqrt(2)],
  ];
  for (const [speed, amount, along, across] of rows) {
    it(`at ${speed} px/s: amount ${amount}, stretch ${along}x along, squash ${across.toFixed(4)} across`, () => {
      const e = speedEffect(S, { x: speed, y: 0 })!;
      close(e.amount, amount, "amount");
      close(e.along, along, "along");
      close(e.across, across, "across");
      close(e.along * e.across * e.across, 1, "area is kept", 2e-3);
    });
  }

  it("faster than the reference does not stretch more", () => {
    assert.equal(speedEffect(S, { x: 5000, y: 0 })!.along, 2);
  });

  it("the direction is where it is going: right 0, down 90, left 180, up -90, and a diagonal", () => {
    const dir = (x: number, y: number) => speedEffect(S, { x, y })!.direction;
    close(dir(500, 0), 0, "right");
    close(dir(0, 500), 90, "down");
    close(dir(-500, 0), 180, "left");
    close(dir(0, -500), -90, "up");
    close(dir(300, 300), 45, "diagonal");
  });

  it("it leans toward the side it moves: right leans clockwise, left the other way, up and down do not lean", () => {
    close(speedEffect(S, { x: 500, y: 0 })!.lean, 10, "half speed right");
    close(speedEffect(S, { x: 1000, y: 0 })!.lean, 20, "full speed right");
    close(speedEffect(S, { x: -1000, y: 0 })!.lean, -20, "full speed left");
    close(speedEffect(S, { x: 0, y: 800 })!.lean, 0, "straight down");
  });

  it("the blur follows each axis's speed", () => {
    const e = speedEffect(S, { x: 1000, y: 500 })!;
    close(e.blurX, 1000 * 0.02 * 0.2887, "x");
    close(e.blurY, 500 * 0.02 * 0.2887, "y");
  });

  it("the CSS stretches along the motion on the page, whatever the layer's own turn", () => {
    const e = speedEffect(S, { x: 0, y: 1000 })!; // straight down, 2x
    assert.equal(speedTransform(e, 0), "rotate(90deg) scale(2, 0.7071) rotate(-90deg)");
    assert.equal(speedTransform(e, 90), "rotate(0deg) scale(2, 0.7071) rotate(0deg)"); // a layer turned 90: its own x axis already points down
    assert.equal(speedTransform({ ...e, along: 1, across: 1, lean: 0 }, 0), "");
  });
});
