import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSortableController, resolveDropZone, type DropZoneSpec } from "../dragAndDrop.js";

describe("Phase 150 · Drag & drop between layers", () => {
  it("completes a 15-step pointer + keyboard reorder journey across list and grid with animated siblings", () => {
    const list = createSortableController({
      itemIds: ["a", "b", "c", "d"],
      mode: "vertical-list",
      itemWidth: 240,
      itemHeight: 40,
      gap: 10, // pitch = 50px
      animationStiffness: 20,
    });

    const zones: DropZoneSpec[] = [
      { id: "trash", x: 300, y: 0, width: 120, height: 120, accepts: ["card"], priority: 2 },
      { id: "board", x: -10, y: -10, width: 280, height: 260, priority: 1 },
    ];

    // Step 1-4: Pointer drag item "a" from index 0 down past "b" and "c"
    list.beginDrag("a", 50, 20);
    list.moveDrag(50, 75, zones, "card"); // Moves down by 55px -> crosses into index 1
    list.moveDrag(50, 130, zones, "card"); // Moves down by 110px -> crosses into index 2
    let snap = list.endDrag(zones, "card");
    assert.deepEqual(snap.order, ["b", "c", "a", "d"]);

    // Step 5-8: Animate sibling positions converging to their new targets
    for (let i = 0; i < 30; i++) {
      snap = list.stepAnimation(1 / 60);
    }
    const poseA = snap.items.find((item) => item.id === "a")!;
    const poseB = snap.items.find((item) => item.id === "b")!;
    assert.ok(Math.abs(poseB.visualY - 0) < 0.5);
    assert.ok(Math.abs(poseA.visualY - 100) < 0.5);

    // Step 9-12: Keyboard reordering in a 2-column grid
    const grid = createSortableController({
      itemIds: ["g0", "g1", "g2", "g3"],
      mode: "grid",
      itemWidth: 100,
      itemHeight: 100,
      gap: 12,
      columns: 2,
    });
    grid.pickUpKeyboard("g0");
    grid.moveKeyboard("ArrowRight"); // 0 -> 1
    grid.moveKeyboard("ArrowDown"); // 1 -> 3
    grid.moveKeyboard("ArrowLeft"); // 3 -> 2
    const gridDrop = grid.dropKeyboard();
    assert.deepEqual(gridDrop.order, ["g1", "g2", "g0", "g3"]);

    // Step 13-15: Events emitted for rules & Blueprints
    const events = grid.consumeEvents();
    assert.ok(events.some((e) => e.type === "pickup" && e.itemId === "g0" && e.source === "keyboard"));
    assert.ok(events.some((e) => e.type === "reorder" && e.toIndex === 3));
    assert.ok(events.some((e) => e.type === "drop" && e.fromIndex === 0 && e.toIndex === 2));
    assert.equal(grid.consumeEvents().length, 0);
  });

  it("handles swipe-to-remove threshold and drop zone filtering", () => {
    const zones: DropZoneSpec[] = [
      { id: "images-only", x: 0, y: 0, width: 200, height: 200, accepts: ["image"], priority: 5 },
      { id: "generic", x: 0, y: 0, width: 200, height: 200, priority: 1 },
    ];
    assert.equal(resolveDropZone({ x: 50, y: 50 }, zones, "image")?.zoneId, "images-only");
    assert.equal(resolveDropZone({ x: 50, y: 50 }, zones, "text")?.zoneId, "generic");

    const list = createSortableController({
      itemIds: ["row-1", "row-2", "row-3"],
      mode: "vertical-list",
      itemWidth: 300,
      itemHeight: 48,
      swipeRemoveThresholdPx: 80,
    });

    // Sub-threshold swipe springs back
    let snap = list.swipeRow("row-2", -45, true);
    assert.deepEqual(snap.order, ["row-1", "row-2", "row-3"]);
    assert.equal(snap.items[1]!.swipeOffsetX, 0);

    // Threshold swipe removes row and emits "remove" event
    snap = list.swipeRow("row-2", -95, true);
    assert.deepEqual(snap.order, ["row-1", "row-3"]);
    const events = list.consumeEvents();
    assert.ok(events.some((e) => e.type === "remove" && e.itemId === "row-2" && e.fromIndex === 1));
  });
});
