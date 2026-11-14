import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema, type Binding } from "../../document/signals";
import { PARALLAX_NAME, parallaxDrafts } from "../follow";
import { busFrame, newBusState, type InputSource } from "../inputBus";
import { createBindingRuntime, type BindingHost } from "../runtime";

const host: BindingHost = { layersOf: (s) => (s.kind === "layer" ? [s.ref] : []), base: () => undefined, env: { pointerCoarse: false, reducedMotion: false, breakpoint: "", states: new Set() } };
const bind = (depth: number, cursor: number): Binding[] => parallaxDrafts("L", depth, cursor).map((d, i) => BindingSchema.parse({ ...d, id: `p${i}`, ownerLayerId: "L", enabled: true, name: PARALLAX_NAME }));
const src = (scrollY: number, px: number, py: number): InputSource => ({
  pointer: () => ({ x: px, y: py, down: false, coarse: false, pressure: 0, type: "mouse" }),
  pageSize: () => ({ width: 1000, height: 600 }),
  scroll: () => ({ y: scrollY, max: 3000, viewport: 600 }),
});
const offsets = (b: Binding[], scrollY: number, px: number, py: number) => {
  const out = createBindingRuntime(b, host).step(busFrame(src(scrollY, px, py), newBusState(), 0, 1 / 60)).get("L");
  return { x: out?.get("transform.x") ?? 0, y: out?.get("transform.y") ?? 0 };
};

describe("depth parallax (D14)", () => {
  it("depth 0 and no cursor is no drivers at all", () => {
    assert.deepEqual(parallaxDrafts("L", 0, 0), []);
    assert.equal(parallaxDrafts("L", 0, 80).length, 0);
  });

  it("scroll: a layer at depth d is moved d x the scroll, so it scrolls at (1 - d) of the page's speed (hand-computed at five scroll positions)", () => {
    const b = bind(0.3, 0);
    assert.equal(b.length, 1);
    for (const y of [0, 100, 600, 1500, 3000]) assert.ok(Math.abs(offsets(b, y, 500, 300).y - 0.3 * y) < 1e-9, `scroll ${y}`);
    // a near layer (negative depth) is pushed the other way: it scrolls faster than the page
    assert.ok(Math.abs(offsets(bind(-0.5, 0), 400, 500, 300).y + 200) < 1e-9);
    assert.equal(offsets(b, 800, 500, 300).x, 0, "scroll alone does not move it sideways");
  });

  it("cursor: a layer at depth 1 moves the full amount across the page, a layer at depth 0.5 half of it", () => {
    const full = bind(1, 100);
    const half = bind(0.5, 100);
    // ndc: the left edge is -1, the middle 0, the right edge 1
    assert.ok(Math.abs(offsets(full, 0, 0, 300).x + 100) < 1e-9);
    assert.ok(Math.abs(offsets(full, 0, 500, 300).x) < 1e-9);
    assert.ok(Math.abs(offsets(full, 0, 1000, 300).x - 100) < 1e-9);
    assert.ok(Math.abs(offsets(half, 0, 1000, 300).x - 50) < 1e-9);
    assert.ok(Math.abs(offsets(full, 0, 500, 600).y - 100) < 1e-9, "the bottom edge is +1 in y");
  });

  it("scroll and cursor add: both drivers write the same property by adding", () => {
    const b = bind(0.5, 40);
    assert.equal(b.length, 3);
    const o = offsets(b, 200, 1000, 600);
    assert.ok(Math.abs(o.x - 20) < 1e-9);
    assert.ok(Math.abs(o.y - (0.5 * 200 + 20)) < 1e-9);
  });
});
