/**
 * ROADMAP Phase 125: text that fills a shape. A circle's rows are its chords (pulled in by the inset); a line gets the
 * narrowest span across its height; the floats' polygons follow the rows' edges and the text starts at the first line
 * wide enough; the text draws the two floats; columns are CSS columns; pouring text into a shape and out again.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { RenderLayer } from "../../render/RenderLayer";
import { bandOf, parseTextShape, shapeFloats, shapeRows } from "../textShape";
import { fillShape, releaseShape, setShapeInset } from "../textOps";

const CIRCLE = "M100 0 A100 100 0 1 1 99.99 0 Z";

describe("Phase 125: the shape's rows and floats", () => {
  it("a circle's rows are its chords, pulled in by the inset; above and below it there is no room", () => {
    const rows = shapeRows(parseTextShape(JSON.stringify({ d: CIRCLE, inset: 10 }))!, 200, 200);
    const mid = rows.find((r) => r.y === 100)!;
    assert.ok(Math.abs(mid.l - 10) < 0.5 && Math.abs(mid.r - 190) < 0.5);
    const at40 = rows.find((r) => r.y === 40)!;
    const half = Math.sqrt(100 ** 2 - 60 ** 2);
    assert.ok(Math.abs(at40.r - at40.l - (2 * half - 20)) < 0.5);
    assert.ok(rows[0].r - rows[0].l <= 0 && rows[rows.length - 1].r - rows[rows.length - 1].l <= 0);
  });

  it("a line gets the narrowest span across its height", () => {
    const rows = shapeRows(parseTextShape(JSON.stringify({ d: "M100 0 L200 200 L0 200 Z", inset: 0 }))!, 200, 200);
    const b = bandOf(rows, 100, 124);
    assert.ok(Math.abs(b.l - 50) < 0.6 && Math.abs(b.r - 150) < 0.6, JSON.stringify(b));
  });

  it("the floats follow the rows' edges, and the text starts at the first line wide enough", () => {
    const rows = shapeRows(parseTextShape(JSON.stringify({ d: CIRCLE, inset: 0 }))!, 200, 200);
    const f = shapeFloats(rows, 200, 200, 20, 120);
    assert.ok(bandOf(rows, f.top, f.top + 20).r - bandOf(rows, f.top, f.top + 20).l >= 120);
    assert.ok(bandOf(rows, f.top - 2, f.top + 18).r - bandOf(rows, f.top - 2, f.top + 18).l < 120);
    assert.match(f.left.polygon, /^polygon\(0 0, /);
    assert.ok(f.left.width <= 100 && f.right.width <= 100);
  });
});

describe("Phase 125: in the document", () => {
  beforeEach(() =>
    setDocument(
      createDocumentFromLayers([
        createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["c", "t"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
        createLayer({ id: "c", archetype: "ellipse", parentId: "pg", name: "Circle", properties: { positioning: "absolute", "frame.x": 50, "frame.y": 50, "frame.width": 200, "frame.height": 200 } }) as Layer,
        createLayer({ id: "t", archetype: "text", parentId: "pg", name: "Words", properties: { positioning: "absolute", "content.text": "Words that wrap inside a circle", "typography.fontSize": 14 } }) as Layer,
      ]),
    ),
  );
  const draw = () => renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: getDocument().layers }));

  it("poured into a circle: the circle's box and outline; the text draws two shaped floats; out again", () => {
    assert.ok(fillShape("t", "c", 12));
    const p = getDocument().layers.t.properties;
    assert.equal(p["text.sizing"], "fixed");
    assert.equal(parseTextShape(p["text.shape"])?.inset, 12);
    assert.equal(parseTextShape(p["text.shape"])?.source, "c");
    const html = draw();
    assert.match(html, /data-text-shape=""/);
    assert.match(html, /data-text-shape-float="left" style="float:left;width:[\d.]+px;height:[\d.]+px;shape-outside:polygon\(/);
    assert.match(html, /data-text-shape-float="right" style="float:right/);
    assert.equal(setShapeInset(["t"], 20), 1);
    assert.equal(parseTextShape(getDocument().layers.t.properties["text.shape"])?.inset, 20);
    assert.equal(releaseShape(["t"]), 1);
    assert.doesNotMatch(draw(), /data-text-shape/);
  });

  it("columns are CSS columns, and not with a shape", () => {
    setDocument(createDocumentFromLayers([createLayer({ id: "t", archetype: "text", parentId: null, name: "W", properties: { "content.text": "One two three", "typography.columns": 3, "typography.columnGap": 18, "frame.width": 300, "frame.height": 100, "text.sizing": "fixed" } }) as Layer]));
    assert.match(draw(), /column-count:3;column-gap:18px/);
  });
});
