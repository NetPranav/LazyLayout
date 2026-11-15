/**
 * ROADMAP Phase 116: live fills. A shape draws another frame inside its outline, as a copy with its own ids, and the
 * copy follows the source's edits (it is drawn from the same document). A fill whose source contains the shape, or
 * two shapes filled with each other, never draw forever.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { parseFills } from "../../paint/paints";
import { RenderLayer } from "../RenderLayer";
import { cloneSubtree } from "../liveFill";

const L = (o: Partial<Layer> & { id: string; archetype: string; properties: Record<string, unknown> }): Layer =>
  createLayer({ parentId: "pg", name: o.id, ...o } as never) as Layer;

function doc(sourceText = "SALE", fill: Record<string, unknown> = {}) {
  const badge = L({ id: "badge", archetype: "container", children: ["word"], properties: { positioning: "absolute", "frame.x": 300, "frame.y": 0, "frame.width": 80, "frame.height": 40, "appearance.background": "#ffcc00" } });
  const word = L({ id: "word", archetype: "text", parentId: "badge", properties: { "content.text": sourceText } });
  const shape = L({ id: "shape", archetype: "rectangle", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 200, "frame.height": 100, "paint.fills": JSON.stringify([{ type: "live", source: "badge", ...fill }]) } });
  const pg = L({ id: "pg", archetype: "container", parentId: null, children: ["badge", "shape"], properties: { "frame.width": 800, "frame.height": 600 } });
  return { pg, badge, word, shape };
}
const draw = (layers: Record<string, Layer>, id: string) => renderToStaticMarkup(createElement(RenderLayer, { layerId: id, layers }));

describe("Phase 116: live fills", () => {
  it("is stored safely", () => {
    const [p] = parseFills(JSON.stringify([{ type: "live", source: "badge", scale: 99, offset: { x: 5, y: "x" }, tile: true }]))!;
    assert.deepEqual(p, { type: "live", source: "badge", scale: 20, offset: { x: 5, y: 0 }, tile: true, opacity: 1, visible: true });
    assert.equal(parseFills(JSON.stringify([{ type: "live", source: 7 }]))!.length, 0);
  });

  it("a copy has its own ids and sits at the fill's origin", () => {
    const d = doc();
    const copy = cloneSubtree(d, "badge", "live-x-");
    assert.deepEqual(Object.keys(copy.layers).sort(), ["live-x-badge", "live-x-word"]);
    assert.equal(copy.layers["live-x-badge"].properties["frame.x"], 0);
    assert.equal(copy.layers["live-x-word"].parentId, "live-x-badge");
  });

  it("the shape draws the source inside its outline, and an edit to the source shows in the fill", () => {
    const d = doc("SALE");
    const html = draw(d, "shape");
    assert.match(html, /<foreignObject[^>]*clip-path="url\(#shape__f0\)"/);
    assert.match(html, /data-live-fill="badge"/);
    assert.ok(html.includes("SALE"));
    assert.ok(!/data-element-id="word"/.test(html), "the copy never uses the source's ids");
    assert.ok(draw(doc("NEW"), "shape").includes("NEW"), "drawn from the document as it is now");
  });

  it("tiling repeats the source across the shape; scale sizes it", () => {
    const html = draw(doc("T", { tile: true, scale: 0.5 }), "shape");
    // 200 × 100 with tiles of 40 × 20: 5 across and 5 down, plus one row and column for the offset
    assert.equal((html.match(/>T</g) ?? []).length, 36);
    assert.match(html, /transform:scale\(0.5\)/);
  });

  it("a fill whose source contains the shape draws nothing; two shapes filled with each other stop after one copy", () => {
    const d = doc();
    const self = { ...d, shape: { ...d.shape, properties: { ...d.shape.properties, "paint.fills": JSON.stringify([{ type: "live", source: "pg" }]) } } };
    assert.doesNotMatch(draw(self, "shape"), /data-live-fill/);
    const a = L({ id: "a", archetype: "rectangle", properties: { positioning: "absolute", "frame.width": 50, "frame.height": 50, "paint.fills": JSON.stringify([{ type: "live", source: "b" }]) } });
    const b = L({ id: "b", archetype: "rectangle", properties: { positioning: "absolute", "frame.width": 50, "frame.height": 50, "paint.fills": JSON.stringify([{ type: "live", source: "a" }]) } });
    const pg = L({ id: "pg", archetype: "container", parentId: null, children: ["a", "b"], properties: {} });
    const html = draw({ pg, a, b }, "a");
    assert.ok((html.match(/data-live-fill/g) ?? []).length <= 2, "it stops");
  });
});
