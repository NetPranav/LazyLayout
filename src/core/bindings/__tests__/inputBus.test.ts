import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding } from "../../document/signals";
import { toNumber } from "../evaluate";
import { busFrame, newBusState, unservedSignals, type InputSource } from "../inputBus";

const source = (p: { x: number; y: number; down?: boolean } | null, scroll = { y: 0, max: 1000 }): InputSource => ({
  pointer: () => (p ? { x: p.x, y: p.y, down: p.down ?? false, coarse: false, pressure: 0, type: "mouse" } : null),
  pageSize: () => ({ width: 1000, height: 500 }),
  scroll: () => scroll,
});

describe("input bus (D4)", () => {
  it("serves the pointer in px, uv and ndc of the page", () => {
    const f = busFrame(source({ x: 250, y: 125 }), newBusState(), 0, 1 / 60);
    assert.equal(toNumber(f.read({ kind: "pointer", channel: "x" })), 250);
    assert.deepEqual(f.read({ kind: "pointerIn", channel: "uv", space: "page" as never }), [0.25, 0.25]);
    assert.deepEqual(f.read({ kind: "pointerIn", channel: "ndc", space: "page" as never }), [-0.5, -0.5]);
    assert.deepEqual(f.read({ kind: "pointerIn", channel: "px", space: "page" as never }), [250, 125]);
  });

  it("pointer speed, delta and angle come from motion between frames, in px per second", () => {
    const st = newBusState();
    busFrame(source({ x: 0, y: 0 }), st, 0, 1 / 60);
    let f = busFrame(source({ x: 0, y: 0 }), st, 0, 1 / 60);
    for (let i = 1; i <= 60; i++) f = busFrame(source({ x: i * 10, y: 0 }), st, i / 60, 1 / 60); // 600 px/s along +x
    assert.ok(Math.abs(toNumber(f.read({ kind: "pointer", channel: "speed" })) - 600) < 30);
    assert.equal(toNumber(f.read({ kind: "pointer", channel: "dx" })), 10);
    assert.equal(toNumber(f.read({ kind: "pointer", channel: "angle" })), 0);
  });

  it("scroll progress is position over the scrollable distance, clamped; direction follows the last move", () => {
    const st = newBusState();
    busFrame(source(null, { y: 0, max: 1000 }), st, 0, 1 / 60);
    let f = busFrame(source(null, { y: 250, max: 1000 }), st, 1 / 60, 1 / 60);
    assert.equal(toNumber(f.read({ kind: "scroll", channel: "progress" })), 0.25);
    assert.equal(toNumber(f.read({ kind: "scroll", channel: "direction" })), 1);
    f = busFrame(source(null, { y: 5000, max: 1000 }), st, 2 / 60, 1 / 60);
    assert.equal(toNumber(f.read({ kind: "scroll", channel: "progress" })), 1);
    assert.equal(toNumber(busFrame(source(null, { y: 10, max: 0 }), newBusState(), 0, 1 / 60).read({ kind: "scroll", channel: "progress" })), 0); // nothing to scroll
  });

  it("the same source gives the same frames", () => {
    const run = () => {
      const st = newBusState();
      return Array.from({ length: 30 }, (_, i) => toNumber(busFrame(source({ x: i * 7, y: i }), st, i / 60, 1 / 60).read({ kind: "pointer", channel: "speed" })));
    };
    assert.deepEqual(run(), run());
  });

  it("names the signals it does not serve yet, so the editor can say so", () => {
    assert.deepEqual(unservedSignals(parseBinding("scroll.progress -> hero.transform.x").expr), []);
    assert.equal(unservedSignals(parseBinding("device.tiltX -> hero.transform.rotate").expr)[0]?.kind, "device");
  });
});
