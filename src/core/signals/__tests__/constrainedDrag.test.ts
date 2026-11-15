import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConstrainedDragController } from "../constrainedDrag";

describe("Stage 4 Phase 148: drag with constraints, snaps, momentum & slide-to-confirm", () => {
  it("locks axis, applies rubber-band overscroll resistance, and clamps momentum to bounds", () => {
    const drag = createConstrainedDragController({
      axis: "x",
      home: { x: 0, y: 0 },
      bounds: { minX: 0, maxX: 200, minY: 0, maxY: 0 },
      rubberBand: 0.55,
      rubberBandDimension: 200,
    });
    drag.stepPointer(true, 0, 0, 1 / 60);
    // Pulling past maxX=200 to 300 yields rubber-banded position strictly > 200 and < 300
    const over = drag.stepPointer(true, 300, 99, 1 / 60);
    assert.equal(over.y, 0);
    assert.ok(over.x > 200 && over.x < 300);

    // Releasing clamps hard back inside [0, 200]
    const released = drag.stepPointer(false, 300, 99, 1 / 60);
    assert.ok(released.x <= 200);
  });

  it("handles slide-to-confirm snap vs return home and polyline path constraint", () => {
    const slider = createConstrainedDragController({
      axis: "x",
      home: { x: 0, y: 0 },
      bounds: { minX: 0, maxX: 200, minY: 0, maxY: 0 },
      snapPoints: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    });
    // Early drag to 40 -> releases back to snap index 0
    slider.stepPointer(true, 0, 0, 1 / 60);
    slider.stepPointer(true, 40, 0, 1 / 60);
    const early = slider.stepPointer(false, 40, 0, 1 / 60);
    assert.equal(early.snappedIndex, 0);

    // Drag to 180 -> releases forward to snap index 1 (confirmed end)
    slider.stepPointer(true, 40, 0, 1 / 60);
    slider.stepPointer(true, 180, 0, 1 / 60);
    let confirmed = slider.stepPointer(false, 180, 0, 1 / 60);
    assert.equal(confirmed.snappedIndex, 1);
    for (let i = 0; i < 60; i++) confirmed = slider.stepPointer(false, 180, 0, 1 / 60);
    assert.ok(Math.abs(confirmed.x - 200) < 1);
    assert.ok(confirmed.progress > 0.99);

    // Diagonal path projection + keyboard nudging
    const pathDrag = createConstrainedDragController({
      path: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      home: { x: 0, y: 0 },
    });
    const nudged = pathDrag.nudgeByKey("right", 100);
    assert.ok(Math.abs(nudged.x - 50) < 1e-4 && Math.abs(nudged.y - 50) < 1e-4);
    assert.equal(nudged.progress, 0.5);
  });

  it("supports spring returnHome without snaps", () => {
    const homeDrag = createConstrainedDragController({
      home: { x: 10, y: 20 },
      returnHome: true,
    });
    homeDrag.stepPointer(true, 10, 20, 1 / 60);
    homeDrag.stepPointer(true, 90, 60, 1 / 60);
    let st = homeDrag.stepPointer(false, 90, 60, 1 / 60);
    for (let i = 0; i < 90; i++) st = homeDrag.stepPointer(false, 90, 60, 1 / 60);
    assert.ok(Math.hypot(st.x - 10, st.y - 20) < 0.5);
  });
});
