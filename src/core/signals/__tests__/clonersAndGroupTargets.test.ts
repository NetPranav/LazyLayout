import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLONER_DOM_TIER_CAP,
  generateClonerInstances,
  resolveGroupOrTagTargets,
} from "../clonersAndGroupTargets.js";

describe("Phase 154 · Cloners, tags & group targets", () => {
  it("builds a 20 x 20 dot grid identically across evaluations and honors tier cap", () => {
    const dist = {
      kind: "grid" as const,
      rows: 20,
      cols: 20,
      spacingX: 24,
      spacingY: 24,
      originX: 10,
      originY: 10,
    };
    const stageGrid = generateClonerInstances("dots", dist, { 12: { "appearance.opacity": 0.4 } });
    const exportGrid = generateClonerInstances("dots", dist, { 12: { "appearance.opacity": 0.4 } });

    assert.equal(stageGrid.totalCount, 400);
    assert.equal(stageGrid.exceedsDomTierCap, false);
    assert.equal(stageGrid.recommendedBackend, "dom");
    assert.deepEqual(stageGrid.instances, exportGrid.instances);
    assert.equal(stageGrid.instances[12]!.overrides["appearance.opacity"], 0.4);
    assert.equal(stageGrid.instances[399]!.row, 19);
    assert.equal(stageGrid.instances[399]!.col, 19);

    const overCap = generateClonerInstances("huge", {
      kind: "grid",
      rows: 21,
      cols: 20,
      spacingX: 10,
      spacingY: 10,
    });
    assert.ok(overCap.totalCount > CLONER_DOM_TIER_CAP);
    assert.equal(overCap.exceedsDomTierCap, true);
    assert.equal(overCap.recommendedBackend, "gpu-particles");
  });

  it("supports radial, path, scatter, linear cloners and Group[*] / tag: selectors", () => {
    const radial = generateClonerInstances("ring", {
      kind: "radial",
      count: 4,
      radius: 100,
      alignToAngle: true,
    });
    assert.ok(Math.abs(radial.instances[0]!.homeX - 100) < 1e-6);
    assert.ok(Math.abs(radial.instances[1]!.homeY - 100) < 1e-6);

    const scatterA = generateClonerInstances("dust", { kind: "scatter", count: 8, width: 200, height: 100, seed: 42 });
    const scatterB = generateClonerInstances("dust", { kind: "scatter", count: 8, width: 200, height: 100, seed: 42 });
    assert.deepEqual(scatterA.instances, scatterB.instances);

    const layers = [
      { id: "card-1", parentId: "cards", tags: ["interactive", "hero"] },
      { id: "card-2", parentId: "cards", tags: ["interactive"] },
      { id: "badge-1", parentId: "header", tags: ["badge"] },
    ];
    assert.deepEqual(resolveGroupOrTagTargets("cards[*]", layers), ["card-1", "card-2"]);
    assert.deepEqual(resolveGroupOrTagTargets("tag:interactive", layers), ["card-1", "card-2"]);
    assert.deepEqual(resolveGroupOrTagTargets("Group[*]", layers), ["card-1", "card-2", "badge-1"]);
  });
});
