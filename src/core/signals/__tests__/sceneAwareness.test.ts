import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSceneAwarenessState,
  queryLayerRelation,
  readSelfChannel,
  stepSceneAwareness,
  type LayerPoseSample,
} from "../sceneAwareness";

describe("Phase 134 — Scene Awareness (self.* & Layer-to-Layer Signals)", () => {
  it("computes local/parent/frame/page geometry, velocity, view progress, and pointer distance only for watched layers", () => {
    const state = createSceneAwarenessState();
    let cardX = 100;
    const measured: string[] = [];

    const host = {
      watchedLayers: new Set(["card"]),
      pointer: { x: 250, y: 150, down: false },
      scroll: { y: 400, viewport: 600 },
      measureLayer: (id: string): LayerPoseSample | null => {
        measured.push(id);
        if (id !== "card") return null;
        return {
          id: "card",
          localRect: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 15 },
          parentRect: { x: 50, y: 50, width: 400, height: 400 },
          frameRect: { x: 20, y: 20, width: 800, height: 800 },
          pageRect: { x: cardX, y: 100, width: 100, height: 100, rotationDeg: 15 },
          scrollBox: { top: 400, height: 200 },
        };
      },
    };

    stepSceneAwareness(host, state, 1 / 60);
    cardX = 110;
    const snap = stepSceneAwareness(host, state, 1 / 60);
    const card = snap.get("card")!;
    assert.ok(card);
    assert.deepEqual(measured, ["card", "card"]);
    assert.equal(Math.round(card.velocityX), 600);
    assert.equal(Math.round(card.speed), 600);
    assert.equal(readSelfChannel(card, "parentX"), 60);
    assert.equal(readSelfChannel(card, "distanceToPointer"), 40); // edge at 210, pointer at 250
    assert.equal(card.visible, 1);
    assert.ok(card.viewProgress > 0 && card.viewProgress < 1);
    assert.equal(readSelfChannel(card, "rotation"), 15);
  });

  it("computes layer-to-layer distance, angle, and overlap accurately", () => {
    const a = { page: { x: 0, y: 0, width: 100, height: 100, rotation: 0 } };
    const b = { page: { x: 50, y: 0, width: 100, height: 100, rotation: 0 } };
    const overlapping = queryLayerRelation(a, b);
    assert.equal(overlapping.distanceTo, 0);
    assert.equal(overlapping.angleTo, 0);
    assert.equal(overlapping.overlap, 0.5);

    const far = { page: { x: 140, y: 0, width: 100, height: 100, rotation: 0 } };
    const apart = queryLayerRelation(a, far);
    assert.equal(apart.distanceTo, 40);
    assert.equal(apart.overlap, 0);
  });
});
