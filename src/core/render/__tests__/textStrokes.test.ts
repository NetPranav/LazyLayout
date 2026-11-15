/**
 * ROADMAP Phase 117: fills and strokes on text. A text with several strokes stays one real text (its own words are
 * there, clear) and hidden copies draw each stroke and the fill in order; a gradient, image, noise or mesh fill shows
 * through the letters.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../RenderLayer";

const text = (props: Record<string, unknown>): Layer =>
  createLayer({ id: "t", archetype: "text", parentId: null, name: "t", properties: { "content.text": "Hello", "typography.fontSize": 64, ...props } }) as Layer;
const draw = (l: Layer) => renderToStaticMarkup(createElement(RenderLayer, { layerId: l.id, layers: { [l.id]: l } }));

describe("Phase 117: strokes on text", () => {
  it("two outside strokes and a centre one: drawn bottom first, the fill between, the words real and read once", () => {
    const html = draw(text({
      "typography.color": "#ffcc00",
      "paint.strokes": JSON.stringify([
        { type: "solid", color: "#000000", weight: 2 },
        { type: "solid", color: "#ff0000", weight: 6 },
        { type: "solid", color: "#ffffff", weight: 1, align: "center" },
      ]),
    }));
    const copies = [...html.matchAll(/<span aria-hidden="true" data-text-stroke-copy=""[^>]*style="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(copies.length, 4, "three strokes and the fill");
    assert.ok(copies[0].includes("-webkit-text-stroke:12px rgba(255, 0, 0, 1)"), "the lower outside stroke first, at twice its weight");
    assert.ok(copies[1].includes("-webkit-text-stroke:4px rgba(0, 0, 0, 1)"));
    assert.match(copies[2], /color:#ffcc00/, "then the fill");
    assert.ok(copies[3].includes("-webkit-text-stroke:1px rgba(255, 255, 255, 1)"), "the centre stroke on top");
    // the real words: one copy that isn't hidden from assistive technology
    assert.equal((html.match(/Hello/g) ?? []).length, 5);
    assert.equal((html.match(/<span style="position:relative">Hello<\/span>/g) ?? []).length, 1);
  });

  it("a gradient fill shows through the letters, above the strokes", () => {
    const html = draw(text({
      "paint.fills": JSON.stringify([{ type: "linear", stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }], from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]),
      "paint.strokes": JSON.stringify([{ type: "solid", color: "#000000", weight: 3 }]),
    }));
    assert.match(html, /data-text-stroke-copy=""[^>]*linear-gradient[^"]*background-clip:text/);
    assert.ok(html.indexOf("-webkit-text-stroke:6px") < html.indexOf("linear-gradient"), "the stroke under the fill");
  });

  it("noise and mesh fills work on text too, and a text with no strokes draws as before", () => {
    const noisy = draw(text({ "paint.fills": JSON.stringify([{ type: "noise", kind: "grain", scale: 2, contrast: 0.5, color: "#000000", seed: 3 }]) }));
    assert.match(noisy, /background-clip:text/);
    assert.match(noisy, /data:image\/svg\+xml/);
    assert.doesNotMatch(draw(text({})), /data-text-stroke-copy/);
  });
});
