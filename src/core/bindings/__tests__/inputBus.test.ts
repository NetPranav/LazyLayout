import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding } from "../../document/signals";
import { toNumber } from "../evaluate";
import { busFrame, newBusState, unservedSignals, viewOf, type InputSource } from "../inputBus";

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

  describe("view(layer): how far a section has scrolled through the screen", () => {
    // a section 400 px tall whose top is 1000 px down the page, on a screen 800 px tall
    const box = { top: 1000, height: 400 };
    it("is 0 when the top reaches the bottom of the screen, 1 when the bottom leaves the top (hand-computed at 5 scroll positions)", () => {
      const at = (y: number) => viewOf(box, y, 800).progress;
      assert.equal(at(0), 0); // far below the screen
      assert.equal(at(200), 0); // its top exactly at the screen's bottom: (200 + 800 - 1000) / 1200 = 0
      assert.ok(Math.abs(at(800) - 600 / 1200) < 1e-12); // 0.5
      assert.ok(Math.abs(at(1000) - 800 / 1200) < 1e-12);
      assert.equal(at(1400), 1); // its bottom exactly at the screen's top
      assert.equal(at(3000), 1);
    });
    it("the share showing: 0 off screen, 1 when it is all in view, partial while it enters and leaves", () => {
      const vis = (y: number) => viewOf(box, y, 800).visible;
      assert.equal(vis(0), 0);
      assert.equal(vis(200), 0);
      assert.equal(vis(400), 0.5); // the top 200 of 400 px is in (screen 400..1200, box 1000..1400)
      assert.equal(vis(700), 1); // screen 700..1500 holds it all
      assert.equal(vis(1200), 0.5); // screen 1200..2000: the box's bottom 200 px
      assert.equal(vis(1400), 0);
    });
    it("no screen height or no box reads as 0", () => {
      assert.deepEqual(viewOf(box, 500, 0), { progress: 0, visible: 0 });
      const f = busFrame({ ...source(null), scroll: () => ({ y: 500, max: 2000, viewport: 800 }) }, newBusState(), 0, 1 / 60);
      assert.equal(toNumber(f.read({ kind: "view", layer: "x", channel: "progress" })), 0); // the source has no layerBox
    });
    it("the bus serves it from the source's layer boxes", () => {
      const src: InputSource = { ...source(null), scroll: () => ({ y: 800, max: 2000, viewport: 800 }), layerBox: (id) => (id === "sec" ? box : null) };
      const f = busFrame(src, newBusState(), 0, 1 / 60);
      assert.ok(Math.abs(toNumber(f.read({ kind: "view", layer: "sec", channel: "progress" })) - 0.5) < 1e-12);
      assert.equal(toNumber(f.read({ kind: "view", layer: "ghost", channel: "progress" })), 0);
    });
    it("view is no longer unserved", () => {
      assert.deepEqual(unservedSignals(parseBinding("view(sec).progress -> hero.transform.x").expr), []);
    });
  });
});
