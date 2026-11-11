import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fitScene, guessTier, addCosts, fill, TIER_BUDGETS, type FeatureCost } from "../tiers";

const f = (id: string, cost: Partial<FeatureCost["cost"]>, dropOrder?: number): FeatureCost => ({ id, label: id, cost: { frameMs: 0, gpuMB: 0, drawCalls: 0, kTriangles: 0, simMs: 0, ...cost }, dropOrder });

describe("3D-005: tiers and budgets", () => {
  it("a light scene fits every tier", () => {
    const scene = [f("mesh", { frameMs: 1, gpuMB: 10, drawCalls: 10, kTriangles: 20 }), f("light", { frameMs: 0.5, drawCalls: 2 })];
    for (const tier of ["low", "mid", "high"] as const) assert.equal(fitScene(scene, tier).fits, true);
  });

  it("budgets grow with the tier", () => {
    assert.ok(TIER_BUDGETS.low.gpuMB < TIER_BUDGETS.mid.gpuMB && TIER_BUDGETS.mid.gpuMB < TIER_BUDGETS.high.gpuMB);
    assert.ok(TIER_BUDGETS.low.sceneContexts <= TIER_BUDGETS.mid.sceneContexts);
  });

  it("an over-budget scene names the feature to drop first, in the documented order", () => {
    const scene = [
      f("base", { frameMs: 4, gpuMB: 40, drawCalls: 40, kTriangles: 60 }, Infinity),
      f("shadows", { frameMs: 2, gpuMB: 30 }, 1),
      f("ao", { frameMs: 1.5, gpuMB: 20 }, 2),
      f("bloom", { frameMs: 1, gpuMB: 20 }, 3),
    ];
    const r = fitScene(scene, "low"); // 8.5 ms and 110 MB against 6 ms and 96 MB
    assert.equal(r.fits, false);
    assert.deepEqual(r.over.sort(), ["frameMs", "gpuMB"]);
    assert.deepEqual(r.drop.map((x) => x.id), ["shadows", "ao"], "shadows first (order 1), then AO, and it fits without bloom");
    assert.equal(r.hopeless, false);
  });

  it("only features that help a line that is over are dropped", () => {
    const scene = [f("base", { gpuMB: 90 }, Infinity), f("sim", { simMs: 1 }, 1), f("huge", { gpuMB: 20 }, 5)];
    const r = fitScene(scene, "low"); // memory over by 14; sim doesn't help
    assert.deepEqual(r.drop.map((x) => x.id), ["huge"]);
  });

  it("a scene too heavy even with everything dropped is called hopeless for that tier", () => {
    const r = fitScene([f("base", { frameMs: 20 }, Infinity), f("fx", { frameMs: 1 }, 1)], "mid");
    assert.equal(r.hopeless, true);
    assert.equal(r.drop[0].id, "fx");
  });

  it("sums costs and reports how full each line is", () => {
    const used = addCosts([f("a", { frameMs: 2, gpuMB: 64 }), f("b", { frameMs: 2 })]);
    assert.equal(used.frameMs, 4);
    assert.equal(fill(used, TIER_BUDGETS.mid).frameMs, 0.5);
  });

  it("guesses the tier from what the browser says", () => {
    assert.equal(guessTier({ renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))" }), "low");
    assert.equal(guessTier({ coarsePointer: true, deviceMemory: 4, hardwareConcurrency: 8 }), "low");
    assert.equal(guessTier({ coarsePointer: true, deviceMemory: 8, hardwareConcurrency: 8 }), "mid");
    assert.equal(guessTier({ deviceMemory: 16, hardwareConcurrency: 12 }), "high");
    assert.equal(guessTier({}), "mid");
    assert.equal(guessTier({ saveData: true, deviceMemory: 16, hardwareConcurrency: 12 }), "low");
  });
});
