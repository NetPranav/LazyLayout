import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding } from "../../document/signals";
import { toNumber } from "../evaluate";
import { busFrame, distanceToRect, insideRect, newBusState, unservedSignals, viewOf, type InputSource } from "../inputBus";

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

  describe("pointer.inside, hover, press and proximity (a layer's rectangle against the pointer)", () => {
    const rect = { x: 100, y: 100, width: 200, height: 50 };
    const withRect = (p: { x: number; y: number; down?: boolean } | null): InputSource => ({ ...source(p), layerRect: (id) => (id === "box" ? rect : null) });
    it("inside is the rectangle's closed interior", () => {
      assert.equal(insideRect(rect, 150, 120), true);
      assert.equal(insideRect(rect, 100, 100), true);
      assert.equal(insideRect(rect, 300, 150), true);
      assert.equal(insideRect(rect, 301, 120), false);
      assert.equal(insideRect(rect, 150, 99), false);
    });
    it("distance to the edge is 0 inside and Euclidean outside (hand-computed at 5 points), to the centre is to (200, 125)", () => {
      assert.equal(distanceToRect(rect, 150, 120), 0);
      assert.equal(distanceToRect(rect, 50, 125), 50); // left of it
      assert.equal(distanceToRect(rect, 200, 200), 50); // below it
      assert.equal(distanceToRect(rect, 340, 190), Math.hypot(40, 40)); // off a corner
      assert.equal(distanceToRect(rect, 100, 40), 60); // above its corner
      assert.equal(distanceToRect(rect, 200, 125, "center"), 0);
      assert.equal(distanceToRect(rect, 300, 125, "center"), 100);
    });
    it("the bus serves pointer.inside and proximity; no pointer or no rectangle reads as 0", () => {
      const f = busFrame(withRect({ x: 340, y: 190 }), newBusState(), 0, 1 / 60);
      assert.equal(f.read({ kind: "pointerInside", layer: "box" }), false);
      assert.equal(toNumber(f.read({ kind: "proximity", layer: "box" })), Math.hypot(40, 40));
      assert.equal(toNumber(f.read({ kind: "proximity", layer: "box", measure: "center" })), Math.hypot(140, 65));
      const g = busFrame(withRect(null), newBusState(), 0, 1 / 60);
      assert.equal(toNumber(g.read({ kind: "proximity", layer: "box" })), 0);
      assert.equal(toNumber(g.read({ kind: "layerState", channel: "hover", layer: "box" })), 0);
      assert.equal(toNumber(busFrame(withRect({ x: 150, y: 120 }), newBusState(), 0, 1 / 60).read({ kind: "proximity", layer: "ghost" })), 0);
    });
    it("hover settles over about 80 ms, the same at 30 and 120 fps; press needs the button; leaving settles back", () => {
      for (const fps of [30, 60, 120]) {
        const st = newBusState();
        let v = 0;
        for (let i = 0; i < Math.round(fps * 0.4); i++) v = toNumber(busFrame(withRect({ x: 150, y: 120 }), st, i / fps, 1 / fps).read({ kind: "layerState", channel: "hover", layer: "box" }));
        // 1 - e^(-0.4/0.08) = 0.9933 after 400 ms of being over it
        assert.ok(Math.abs(v - (1 - Math.exp(-0.4 / 0.08))) < 0.02, `fps ${fps}: ${v}`);
        for (let i = 0; i < Math.round(fps * 0.4); i++) v = toNumber(busFrame(withRect({ x: 20, y: 20 }), st, 1 + i / fps, 1 / fps).read({ kind: "layerState", channel: "hover", layer: "box" }));
        assert.ok(v < 0.02, `settles back at ${fps} fps: ${v}`);
      }
      const st = newBusState();
      let press = 0;
      for (let i = 0; i < 60; i++) press = toNumber(busFrame(withRect({ x: 150, y: 120, down: false }), st, i / 60, 1 / 60).read({ kind: "layerState", channel: "press", layer: "box" }));
      assert.ok(press < 0.001, "over it but not pressed");
      for (let i = 60; i < 120; i++) press = toNumber(busFrame(withRect({ x: 150, y: 120, down: true }), st, i / 60, 1 / 60).read({ kind: "layerState", channel: "press", layer: "box" }));
      assert.ok(press > 0.99, "pressed");
    });
    it("a signal read twice in one frame is smoothed once", () => {
      const st = newBusState();
      const f = busFrame(withRect({ x: 150, y: 120 }), st, 0, 1 / 60);
      const a = toNumber(f.read({ kind: "layerState", channel: "hover", layer: "box" }));
      const b = toNumber(f.read({ kind: "layerState", channel: "hover", layer: "box" }));
      assert.equal(a, b);
    });
    it("focus is not measured and is flagged; the others are served", () => {
      assert.equal(unservedSignals(parseBinding("focus(box) -> hero.transform.x").expr).length, 1);
      for (const t of ["hover(box)", "press(box)", "pointer.inside(box)", "proximity(box)", "proximity(box, center)"]) assert.deepEqual(unservedSignals(parseBinding(`${t} -> hero.transform.x`).expr), [], t);
    });
  });
});
