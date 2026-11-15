/**
 * ROADMAP Phase 118: several strokes, each with its own weight, position and paint. A shape whose strokes carry their
 * own weight or position draws one masked stroke layer per stroke, the first on top; without them, one as before.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../RenderLayer";

const rect = (strokes: unknown[], extra: Record<string, unknown> = {}): Layer =>
  createLayer({ id: "r", archetype: "rectangle", parentId: null, name: "r", properties: { positioning: "absolute", "frame.width": 120, "frame.height": 80, "svg.fill": "#eeeeee", "paint.strokes": JSON.stringify(strokes), ...extra } }) as Layer;
const draw = (l: Layer) => renderToStaticMarkup(createElement(RenderLayer, { layerId: l.id, layers: { [l.id]: l } }));

describe("Phase 118: several strokes", () => {
  it("each stroke with its own weight and position is its own masked layer, the first drawn last (on top)", () => {
    const html = draw(rect([
      { type: "solid", color: "#000000", weight: 2, align: "center" },
      { type: "linear", stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }], from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, weight: 8, align: "outside" },
      { type: "solid", color: "#ffffff", weight: 3, align: "inside" },
    ]));
    const masks = [...html.matchAll(/<mask id="r__k(\d)__stroke"/g)].map((m) => Number(m[1]));
    assert.deepEqual(masks, [2, 1, 0], "the bottom stroke first");
    assert.match(html, /<mask id="r__k1__stroke"[\s\S]*?stroke-width="16"/, "an outside stroke is drawn twice as wide and the shape cut out of it");
    assert.match(html, /<mask id="r__k0__stroke"[\s\S]*?stroke-width="2"/, "a centre stroke at its weight");
    assert.match(html, /<mask id="r__k2__stroke"[^>]*>\s*<g clip-path="url\(#r__k2__strokeclip\)">/, "an inside stroke is clipped to the shape");
    assert.match(html, /linearGradient id="r__k1__s0"/, "a gradient paint on a stroke");
  });

  it("strokes without their own weight or position still share one layer", () => {
    const html = draw(rect([{ type: "solid", color: "#000000" }, { type: "solid", color: "#ff0000" }], { "svg.strokeWidth": 2 }));
    assert.equal((html.match(/<mask id="r__stroke"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /r__k\d__stroke/);
  });
});
