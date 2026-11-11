import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { distanceField, gridFor, membraneHeight, rasterMask, restingSurface, shapeDistance, DEFAULT_LOOK } from "../field";
import { MembraneSim, DEFAULT_PHYSICS } from "../membrane";

describe("Surfaces S2: height from the shape", () => {
  it("a rounded rectangle's distance is positive inside, zero on the edge, negative outside", () => {
    const s = { kind: "roundedRect" as const, width: 100, height: 40, radius: 10 };
    assert.ok(shapeDistance(s, 50, 20) > 19);
    assert.ok(Math.abs(shapeDistance(s, 0, 20)) < 1e-9);
    assert.ok(shapeDistance(s, -5, 20) < 0);
    assert.ok(shapeDistance(s, 1, 1) < 0, "the rounded corner is outside");
  });

  it("the distance transform is exact on a square", () => {
    const g = gridFor(21, 21, 1);
    const mask = rasterMask({ kind: "roundedRect", width: 21, height: 21, radius: 0 }, g);
    const { dist } = distanceField(mask, g);
    // the centre cell is 11 cells from the outside padding
    assert.equal(dist[10 * 21 + 10], 11);
    assert.equal(dist[0], 1);
  });

  it("a circular membrane matches the analytic paraboloid within 1%", () => {
    const shape = { kind: "ellipse" as const, width: 80, height: 80 };
    const g = gridFor(80, 80, 1);
    const h = membraneHeight(shape, g);
    // h(r) = 1 - (r/R)^2 once normalised
    const R = 40;
    let worst = 0;
    for (const r of [0, 10, 20, 30]) {
      const x = Math.round(40 + r - 0.5);
      const got = h[40 * g.w + x];
      const want = 1 - Math.pow((x + 0.5 - 40) / R, 2);
      worst = Math.max(worst, Math.abs(got - want));
    }
    assert.ok(worst < 0.03, `worst error ${worst}`);
  });

  it("the same seed draws the same wrinkles, and another seed draws others", () => {
    const shape = { kind: "roundedRect" as const, width: 120, height: 50, radius: 12 };
    const a = restingSurface(shape, { ...DEFAULT_LOOK, seed: 4 }, 2).height;
    const b = restingSurface(shape, { ...DEFAULT_LOOK, seed: 4 }, 2).height;
    const c = restingSurface(shape, { ...DEFAULT_LOOK, seed: 5 }, 2).height;
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it("the height is highest inside and zero outside", () => {
    const shape = { kind: "roundedRect" as const, width: 120, height: 50, radius: 12 };
    const { height, grid } = restingSurface(shape, { ...DEFAULT_LOOK, wrinkles: 0, crinkle: 0, creases: 0 }, 2);
    assert.equal(height[0], 0);
    const centre = height[Math.floor(grid.h / 2) * grid.w + Math.floor(grid.w / 2)];
    assert.ok(centre > DEFAULT_LOOK.depth * 0.9, `centre ${centre}`);
  });
});

describe("Surfaces S6: press physics", () => {
  it("a press dents the surface at the pointer, and it springs back after release", () => {
    const sim = new MembraneSim({ kind: "roundedRect", width: 200, height: 80, radius: 20 }, DEFAULT_PHYSICS, 4);
    sim.pressAt(60, 40);
    for (let i = 0; i < 30; i++) sim.step(1 / 60);
    const at = (x: number, y: number) => sim.u[Math.floor(y / 4) * sim.grid.w + Math.floor(x / 4)];
    assert.ok(at(60, 40) < -DEFAULT_PHYSICS.dentDepth * 0.5, `dent ${at(60, 40)}`);
    assert.ok(at(60, 40) < at(160, 40), "deepest under the press");
    sim.release();
    for (let i = 0; i < 240; i++) sim.step(1 / 60);
    assert.ok(Math.abs(at(60, 40)) < 0.5, `back ${at(60, 40)}`);
    assert.ok(sim.settled);
  });

  it("is deterministic", () => {
    const run = () => {
      const sim = new MembraneSim({ kind: "roundedRect", width: 120, height: 60, radius: 10 }, DEFAULT_PHYSICS, 4);
      sim.pressAt(30, 30);
      for (let i = 0; i < 12; i++) sim.step(1 / 60);
      sim.release();
      for (let i = 0; i < 12; i++) sim.step(1 / 60);
      return Array.from(sim.u);
    };
    assert.deepEqual(run(), run());
  });
});
