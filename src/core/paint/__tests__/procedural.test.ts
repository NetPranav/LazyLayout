/**
 * ROADMAP Phase 114: noise, grain and pattern fills. Stored safely, the same picture every time for a seed, and the
 * same picture for a frame (a CSS background) and a shape (an SVG pattern). Pixels are compared in the browser
 * against the exported site (`tests/e2e/procedural-fills.spec.ts`).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../../render/RenderLayer";
import { paintCss, parseFills, proceduralSvg, serializeFills, type Paint } from "../paints";
import { svgDataUrl } from "../procedural";
import { tileFromLayer } from "../../editing/patternTile";

const noise = { type: "noise", kind: "grain", scale: 2, contrast: 0.6, color: "#112233", seed: 7, opacity: 0.4 };
const pattern = { type: "pattern", tile: { w: 20, h: 20, shapes: [{ d: "M10 5A5 5 0 1 1 10 15A5 5 0 1 1 10 5Z", color: "#ff0000" }] }, scale: 1.5, spacing: 4, offset: { x: 2, y: 3 }, rotation: 30 };

describe("Phase 114: stored safely", () => {
  it("noise and pattern round-trip; hostile path data, colours and sizes are refused or clamped", () => {
    const parsed = parseFills(JSON.stringify([noise, pattern]))!;
    assert.equal(parsed.length, 2);
    assert.deepEqual(parseFills(serializeFills(parsed)), parsed);
    const hostile = parseFills(JSON.stringify([
      { ...pattern, tile: { w: 20, h: 20, shapes: [{ d: "M0 0\"/><script>alert(1)</script>", color: "#f00" }, { d: "M0 0L1 1", color: "url(javascript:x)" }] } },
      { ...noise, scale: 1e9, contrast: -4, seed: 3.7 },
    ]))!;
    assert.equal(hostile.length, 1, "a pattern with no safe shape is dropped");
    const n = hostile[0] as Extract<Paint, { type: "noise" }>;
    assert.deepEqual([n.scale, n.contrast, n.seed], [2000, 0, 4]);
  });
});

describe("Phase 114: the same picture every time, on frames and shapes", () => {
  it("a seed gives exactly the same noise, another seed another; the picture has the box's size", () => {
    const [p] = parseFills(JSON.stringify([noise]))!;
    const a = proceduralSvg(p, 200, 100)!;
    assert.equal(proceduralSvg(p, 200, 100), a);
    assert.notEqual(proceduralSvg({ ...p, seed: 8 } as Paint, 200, 100), a);
    assert.match(a, /seed="7"/);
    assert.match(a, /width="200" height="100"/);
    assert.match(a, /opacity="0.4"/);
  });

  it("a frame's CSS background and a shape's SVG pattern draw the same picture", () => {
    const fills = serializeFills(parseFills(JSON.stringify([pattern, noise]))!);
    const frame = createLayer({ id: "f", archetype: "container", parentId: null, name: "f", properties: { "frame.width": 200, "frame.height": 100, "paint.fills": fills } }) as Layer;
    const rect = createLayer({ id: "r", archetype: "rectangle", parentId: null, name: "r", properties: { positioning: "absolute", "frame.width": 200, "frame.height": 100, "paint.fills": fills, "svg.stroke": "none" } }) as Layer;
    const [pat, noi] = parseFills(fills)!;
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "r", layers: { r: rect } }));
    for (const p of [pat, noi]) {
      const url = svgDataUrl(proceduralSvg(p, 200, 100)!);
      assert.ok(html.includes(url.replace(/&/g, "&amp;")), `the shape draws the ${p.type}`);
      assert.equal(paintCss(p, 200, 100), `url("${url}")`, `the frame's background is the same ${p.type}`);
    }
    assert.ok(renderToStaticMarkup(createElement(RenderLayer, { layerId: "f", layers: { f: frame } })).includes("data:image/svg+xml"));
  });

  it("a pattern's tile is made from a layer, or from a group's children with their colours", () => {
    const dot = createLayer({ id: "d", archetype: "ellipse", parentId: "g", name: "d", properties: { positioning: "absolute", "frame.x": 2, "frame.y": 2, "frame.width": 8, "frame.height": 8, "svg.fill": "#00ff00" } }) as Layer;
    const sq = createLayer({ id: "s", archetype: "rectangle", parentId: "g", name: "s", properties: { positioning: "absolute", "frame.x": 12, "frame.y": 12, "frame.width": 6, "frame.height": 6, "svg.fill": "#0000ff" } }) as Layer;
    const group = createLayer({ id: "g", archetype: "container", parentId: null, name: "g", children: ["d", "s"], properties: { "frame.width": 20, "frame.height": 20 } }) as Layer;
    const tile = tileFromLayer("g", { g: group, d: dot, s: sq })!;
    assert.deepEqual([tile.w, tile.h], [20, 20]);
    assert.deepEqual(tile.shapes.map((s) => s.color), ["#00ff00", "#0000ff"]);
    assert.match(tile.shapes[1].d, /^M12 12/);
    assert.equal(tileFromLayer("d", { d: dot })!.shapes.length, 1);
  });
});
