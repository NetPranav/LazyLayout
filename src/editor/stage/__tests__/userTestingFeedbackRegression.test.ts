import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { documentCommands } from "@/core/store/useDocumentStore";
import { getDocument, setDocument, DEFAULT_DOCUMENT } from "@/core/store/documentState";
import { addAutoLayout, isAutoLayout } from "@/core/editing/layoutOps";
import { createLayerFromBox } from "../createFromDrag";
import { fitStroke } from "@/core/paths/pathFit";
import { createPathLayer, PEN_STYLE, PENCIL_STYLE } from "@/core/paths/createPath";
import { penPress, penDrag, penClose, penFinishable, EMPTY_PEN } from "@/core/paths/penModel";
import { moveLayers } from "@/core/layers/reparent";

describe("User Testing Feedback & Remediation Suite", () => {
  beforeEach(() => {
    setDocument(JSON.parse(JSON.stringify(DEFAULT_DOCUMENT)));
  });

  it("Auto Layout: newly drawn children inside an Auto Layout frame automatically flow", () => {
    // 1. Create a frame
    const frameId = createLayerFromBox(
      { archetype: "container", label: "Frame", kind: "box" },
      { x: 40, y: 40, width: 500, height: 400, rotation: 0, click: false }
    );
    assert.equal(isAutoLayout(getDocument().layers[frameId]), false);

    // 2. Enable Auto Layout on the frame
    addAutoLayout([frameId]);
    assert.equal(isAutoLayout(getDocument().layers[frameId]), true);

    // 3. Draw two rectangles inside the auto-layout frame
    const r1 = createLayerFromBox(
      { archetype: "rectangle", label: "Box 1", kind: "box" },
      { x: 80, y: 80, width: 100, height: 50, rotation: 0, click: false }
    );
    const r2 = createLayerFromBox(
      { archetype: "rectangle", label: "Box 2", kind: "box" },
      { x: 80, y: 160, width: 100, height: 50, rotation: 0, click: false }
    );

    const doc = getDocument();
    const l1 = doc.layers[r1];
    const l2 = doc.layers[r2];
    const frame = doc.layers[frameId];

    // Verify children belong to frame
    assert.deepEqual(frame.children, [r1, r2]);
    // Verify children have flow positioning and fixed sizing so flexbox lays them out
    assert.equal(l1.properties.positioning, "flow");
    assert.equal(l1.properties["sizing.horizontal"], "fixed");
    assert.equal(l1.properties["sizing.vertical"], "fixed");
    assert.equal(l2.properties.positioning, "flow");
    assert.equal(l2.properties["sizing.horizontal"], "fixed");
    assert.equal(l2.properties["sizing.vertical"], "fixed");
  });

  it("Constraints: a right-constrained child follows the right edge when parent frame is resized", () => {
    // 1. Create a free frame of width 400 at (100, 100)
    const frameId = createLayerFromBox(
      { archetype: "container", label: "Frame", kind: "box" },
      { x: 100, y: 100, width: 400, height: 300, rotation: 0, click: false }
    );

    // 2. Create a child rectangle inside the frame: placed at frame.x = 250, width = 50 (100px from right edge: 400 - (250+50) = 100)
    const rectId = createLayerFromBox(
      { archetype: "rectangle", label: "Rect", kind: "box" },
      { x: 350, y: 150, width: 50, height: 50, rotation: 0, click: false }
    );

    assert.equal(getDocument().layers[rectId].properties["frame.x"], 250);

    // 3. Set Right constraint
    documentCommands.updateProps(rectId, { "constraints.horizontal": "right" });
    assert.equal(getDocument().layers[rectId].properties["constraints.horizontal"], "right");

    // 4. Resize parent frame by +120px (from 400 to 520)
    documentCommands.updateProps(frameId, { "frame.width": 520 });

    const updatedRect = getDocument().layers[rectId];
    // Expected new position: 250 + 120 = 370px (maintaining exactly 520 - (370+50) = 100px distance from right edge)
    assert.equal(updatedRect.properties["frame.x"], 370);
  });

  it("Reparenting: moving layers between free and auto-layout containers updates positioning policy", () => {
    // Free frame
    const freeFrameId = createLayerFromBox(
      { archetype: "container", label: "Free Frame", kind: "box" },
      { x: 50, y: 50, width: 300, height: 200, rotation: 0, click: false }
    );
    // Auto frame
    const autoFrameId = createLayerFromBox(
      { archetype: "container", label: "Auto Frame", kind: "box" },
      { x: 400, y: 50, width: 300, height: 200, rotation: 0, click: false }
    );
    addAutoLayout([autoFrameId]);

    // Create rect in free frame
    const rectId = createLayerFromBox(
      { archetype: "rectangle", label: "Movable Rect", kind: "box" },
      { x: 70, y: 70, width: 60, height: 40, rotation: 0, click: false }
    );
    assert.equal(getDocument().layers[rectId].properties.positioning, "absolute");

    // Move rect into auto-layout frame
    moveLayers([rectId], autoFrameId);
    assert.equal(getDocument().layers[rectId].properties.positioning, "flow");

    // Move rect back into free frame
    moveLayers([rectId], freeFrameId);
    assert.equal(getDocument().layers[rectId].properties.positioning, "absolute");
  });

  it("Vector Pen & Pencil: create valid SVG path layers with bezier curves", () => {
    const rootId = Object.keys(getDocument().layers)[0];

    // Test Pen tool
    let pen = EMPTY_PEN;
    pen = penPress(pen, { x: 50, y: 50 });
    pen = penDrag(pen, { x: 80, y: 60 });
    pen = penPress(pen, { x: 150, y: 120 });
    pen = penClose(pen);
    assert.equal(penFinishable(pen), true);

    const penLayerId = createPathLayer(pen.nodes, pen.closed, { id: rootId, origin: { x: 0, y: 0 } }, PEN_STYLE, "Path");
    assert.ok(penLayerId);
    const penLayer = getDocument().layers[penLayerId!];
    assert.equal(penLayer.archetype, "svgPath");
    assert.match(String(penLayer.properties["svg.path"]), /^M/);

    // Test Pencil tool
    const samples = [
      { x: 0, y: 0, t: 0, p: 0.5 },
      { x: 10, y: 15, t: 10, p: 0.5 },
      { x: 25, y: 35, t: 20, p: 0.5 },
      { x: 45, y: 60, t: 30, p: 0.5 },
    ];
    const { nodes, closed } = fitStroke(samples, {}, 8);
    const pencilLayerId = createPathLayer(nodes, closed, { id: rootId, origin: { x: 0, y: 0 } }, PENCIL_STYLE, "Pencil");
    assert.ok(pencilLayerId);
    const pencilLayer = getDocument().layers[pencilLayerId!];
    assert.equal(pencilLayer.archetype, "svgPath");
    assert.match(String(pencilLayer.properties["svg.path"]), /^M/);
  });
});
