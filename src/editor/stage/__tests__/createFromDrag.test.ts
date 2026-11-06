/**
 * Drawing on the new stage: what each tool makes, the box a drag gives, and the layer that lands in the document (one
 * undo step, in the page, with the engine's defaults). The pointer handling that calls these is covered in the browser by
 * `tests/e2e/new-ui-tools.spec.ts`.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "@/core/document/factories";
import type { Layer } from "@/core/document/schema";
import { getDocument, historyCommands } from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { createLayerFromBox, creationSpecFor, drawBox } from "../createFromDrag";

const NONE = { shift: false, alt: false };
const made = (spec: ReturnType<typeof creationSpecFor> & object, from: { x: number; y: number }, to: { x: number; y: number }) => {
  const id = createLayerFromBox(spec, drawBox(spec, from, to, NONE, 1));
  return getDocument().layers[id];
};

const fresh = () =>
  setDocument(createDocumentFromLayers([createLayer({ id: "page", archetype: "container", parentId: null, name: "Page", children: [], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 100, "frame.height": 100 } }) as Layer]));

describe("the new stage's creation tools", () => {
  beforeEach(fresh);

  it("each tool makes what its button says, and Select, Hand and Image make nothing", () => {
    assert.equal(creationSpecFor("frame", "box")?.archetype, "container");
    assert.equal(creationSpecFor("text", "box")?.archetype, "text");
    const shapes = { box: "rectangle", circle: "ellipse", line: "line", arrow: "arrow", poly: "polygon", star: "star" } as const;
    for (const [shape, archetype] of Object.entries(shapes)) assert.equal(creationSpecFor("shape", shape as keyof typeof shapes)?.archetype, archetype, shape);
    for (const tool of ["select", "hand", "image"] as const) assert.equal(creationSpecFor(tool, "box"), null, tool);
  });

  it("a drag makes the box between the press and the pointer; Shift makes it square; a click gives the default size", () => {
    const rect = creationSpecFor("shape", "box")!;
    const b = drawBox(rect, { x: 100, y: 100 }, { x: 220, y: 160 }, NONE, 1);
    assert.deepEqual([b.x, b.y, b.width, b.height, b.click], [100, 100, 120, 60, false]);
    const square = drawBox(rect, { x: 100, y: 100 }, { x: 220, y: 160 }, { shift: true, alt: false }, 1);
    assert.equal(square.width, square.height);
    const click = drawBox(rect, { x: 100, y: 100 }, { x: 101, y: 101 }, NONE, 1);
    assert.equal(click.click, true);
    assert.ok(click.width > 1 && click.height > 1, "a click is the tool's default size, not nothing");
    const line = drawBox(creationSpecFor("shape", "line")!, { x: 0, y: 0 }, { x: 100, y: 0 }, NONE, 1);
    assert.equal(line.width, 100);
  });

  it("a drawn layer goes in the page with its box and the archetype's defaults, as one undo step", () => {
    const spec = creationSpecFor("shape", "circle")!;
    const id = createLayerFromBox(spec, drawBox(spec, { x: 10.123, y: 20 }, { x: 110, y: 90 }, NONE, 1));
    const layer = getDocument().layers[id];
    assert.equal(layer.archetype, "ellipse");
    assert.equal(layer.parentId, "page");
    assert.equal(layer.name, "Ellipse");
    assert.equal(layer.properties.positioning, "absolute");
    assert.equal(layer.properties["frame.x"], 10.12);
    assert.equal(layer.properties["frame.width"], 99.88);
    assert.ok(layer.properties["svg.fill"], "it has the engine's own fill");
    historyCommands.undo();
    assert.equal(getDocument().layers[id], undefined, "one undo takes it back");
  });

  it("text has words from the start, and a click makes it auto-width while a drag makes a fixed box", () => {
    const spec = creationSpecFor("text", "box")!;
    const clicked = made(spec, { x: 5, y: 5 }, { x: 5, y: 5 });
    assert.equal(clicked.properties["content.text"], "Text");
    assert.equal(clicked.properties["text.sizing"], "autoWidth");
    const dragged = made(spec, { x: 5, y: 50 }, { x: 205, y: 90 });
    assert.equal(dragged.properties["text.sizing"], "fixed");
    assert.equal(dragged.properties["frame.width"], 200);
  });

  it("a frame is a white container; a line drawn at an angle carries its rotation", () => {
    const frame = creationSpecFor("frame", "box")!;
    const f = made(frame, { x: 0, y: 0 }, { x: 80, y: 60 });
    assert.equal(f.archetype, "container");
    assert.equal(f.properties["appearance.background.color"], "#ffffff");
    const spec = creationSpecFor("shape", "line")!;
    const l = made(spec, { x: 0, y: 0 }, { x: 100, y: 100 });
    assert.ok(Math.abs(Number(l.properties["frame.rotation"]) - 45) < 0.01, `${l.properties["frame.rotation"]}`);
  });

  it("with no page in the document, a drawn layer is a top-level frame's own", () => {
    setDocument(createDocumentFromLayers([]));
    const spec = creationSpecFor("frame", "box")!;
    const id = createLayerFromBox(spec, drawBox(spec, { x: 0, y: 0 }, { x: 50, y: 50 }, NONE, 1));
    assert.equal(getDocument().layers[id].parentId, null);
  });
});
