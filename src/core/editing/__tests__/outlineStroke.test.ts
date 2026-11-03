/**
 * FigCraft port F3: Outline Stroke on real documents. A line becomes its outline, a filled shape keeps its fill and
 * gains an outline layer, an outside stroke reaches past the box, a rotated layer's outline lands on the same place,
 * and one undo brings it all back. MIT, Copyright (c) 2026 ArtCraft Team and the FigCraft contributors.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { layerOutline, layerStrokeArea, toParent } from "../layerOutline";
import { outlineStrokes } from "../outlineStroke";

const shape = (id: string, archetype: "rectangle" | "line", props: Record<string, unknown>): Layer =>
  createLayer({ id, archetype, parentId: "pg", name: id, properties: { positioning: "absolute", ...props } as Layer["properties"] }) as Layer;

const doc = (layers: Layer[]) =>
  createDocumentFromLayers([
    createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: layers.map((l) => l.id), properties: { "frame.x": 0, "frame.y": 0, "frame.width": 800, "frame.height": 600 } }) as Layer,
    ...layers,
  ]);

const L = () => getDocument().layers;
const rectangle = (extra: Record<string, unknown> = {}) =>
  shape("r", "rectangle", { "frame.x": 100, "frame.y": 100, "frame.width": 100, "frame.height": 60, "svg.fill": "#ff0000", "svg.stroke": "#0000ff", "svg.strokeWidth": 10, ...extra });

describe("FigCraft port F3: Outline Stroke", () => {
  beforeEach(() => {
    setDocument(doc([rectangle()]));
    useSelectionStore.getState().clearSelection();
  });

  it("a filled shape keeps its fill, loses its stroke, and gets an outline layer above it", () => {
    const [o] = outlineStrokes(["r"]);
    assert.ok(o, "an outline layer was made");
    assert.equal(L().r.properties["svg.stroke"], "none");
    assert.equal(L().r.properties["svg.fill"], "#ff0000");
    const kids = L().pg.children;
    assert.equal(kids.indexOf(o), kids.indexOf("r") + 1, "just above the shape");
    assert.equal(L()[o].archetype, "svgPath");
    assert.equal(L()[o].properties["svg.fill"], "#0000ff", "filled with the stroke's colour");
    assert.equal(L()[o].properties["svg.stroke"], "none");
  });

  it("the outline's area is the stroke's area, and its box fits it", () => {
    const before = Math.abs(layerStrokeArea(L().r, L())!.area());
    const [o] = outlineStrokes(["r"]);
    const outline = L()[o];
    const placed = Math.abs(toParent(layerOutline(outline, L())!.path, outline).area());
    assert.ok(before > 0);
    assert.ok(Math.abs(placed - before) / before < 0.01, `${placed} vs ${before}`);
  });

  it("an outside stroke reaches past the shape's box, and the new layer's box grows with it", () => {
    setDocument(doc([rectangle({ "stroke.align": "outside" })]));
    const [o] = outlineStrokes(["r"]);
    const p = L()[o].properties;
    assert.ok(Number(p["frame.width"]) > 100 && Number(p["frame.height"]) > 60, `${p["frame.width"]} × ${p["frame.height"]}`);
    assert.ok(Number(p["frame.x"]) < 100 && Number(p["frame.y"]) < 100, "it starts up and left of the shape");
  });

  it("a rotated layer's outline sits on the same place", () => {
    setDocument(doc([rectangle({ "frame.rotation": 30, "stroke.align": "outside" })]));
    const before = layerStrokeArea(L().r, L())!;
    const bb = before.boundingBox();
    const [o] = outlineStrokes(["r"]);
    const outline = L()[o];
    assert.equal(outline.properties["frame.rotation"], 30);
    // the outline's centre, turned the way the original's would be, is where the original stroke's centre was
    const centre = (l: Layer, c: { x: number; y: number }) => {
      const w = Number(l.properties["frame.width"]);
      const h = Number(l.properties["frame.height"]);
      const r = (Number(l.properties["frame.rotation"]) * Math.PI) / 180;
      const dx = c.x - w / 2;
      const dy = c.y - h / 2;
      return { x: Number(l.properties["frame.x"]) + w / 2 + dx * Math.cos(r) - dy * Math.sin(r), y: Number(l.properties["frame.y"]) + h / 2 + dx * Math.sin(r) + dy * Math.cos(r) };
    };
    const original = { ...L().r, properties: { ...L().r.properties } };
    const was = centre(original, { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 });
    const now = centre(outline, { x: Number(outline.properties["frame.width"]) / 2, y: Number(outline.properties["frame.height"]) / 2 });
    assert.ok(Math.hypot(was.x - now.x, was.y - now.y) < 0.01, `${JSON.stringify(was)} vs ${JSON.stringify(now)}`);
  });

  it("a line is replaced by its outline", () => {
    setDocument(doc([shape("ln", "line", { "frame.x": 20, "frame.y": 20, "frame.width": 200, "frame.height": 0, "svg.stroke": "#000000", "svg.strokeWidth": 8 })]));
    const [o] = outlineStrokes(["ln"]);
    assert.ok(o);
    assert.equal(L().ln, undefined, "the line is gone");
    assert.ok(Math.abs(Number(L()[o].properties["frame.height"]) - 8) < 0.5, `${L()[o].properties["frame.height"]}`);
  });

  it("skips a layer with no visible stroke", () => {
    setDocument(doc([rectangle({ "svg.stroke": "none" })]));
    assert.deepEqual(outlineStrokes(["r"]), []);
    assert.equal(L().pg.children.length, 1);
  });

  it("is one undo step", () => {
    const [o] = outlineStrokes(["r"]);
    historyCommands.undo();
    assert.equal(L()[o], undefined);
    assert.equal(L().r.properties["svg.stroke"], "#0000ff");
    assert.equal(L().r.properties["svg.strokeWidth"], 10);
  });
});
