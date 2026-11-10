import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../RenderLayer";

const gradient = JSON.stringify([{ type: "linear", from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 }, stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }], opacity: 1, visible: true }]);

function draw(properties: Record<string, unknown>): string {
  const t = createLayer({ id: "t", archetype: "text", name: "T", parentId: null, properties: { "content.text": "A", "frame.width": 40, "frame.height": 60, ...properties } }) as Layer;
  return renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: { t } }));
}

describe("depth is drawn by the text itself", () => {
  it("text.depth draws that many copies behind the glyphs, the deepest at -depth", () => {
    const html = draw({ "text.depth": 24, "text.depthSteps": 8, "typography.color": "#ffffff" });
    assert.equal(html.split("data-depth-copy").length - 1, 8);
    assert.ok(html.includes("translateZ(-3px)"));
    assert.ok(html.includes("translateZ(-24px)"));
    assert.ok(html.includes("preserve-3d"));
    assert.ok(html.includes('aria-hidden="true"'), "the copies are decoration, not read twice");
  });

  it("no depth, no copies", () => {
    assert.ok(!draw({}).includes("data-depth-copy"));
  });
});

describe("a fill laid out on the word's box", () => {
  it("a letter with a fill box shows its part of the word's gradient", () => {
    const html = draw({ "paint.fills": gradient, "paint.fillBox": "25,0,200,48" });
    assert.ok(/background-size:\s*200px 48px/.test(html), html);
    assert.ok(/background-position:\s*-25px -0px|background-position:\s*-25px 0px/.test(html), html);
  });

  it("a self-sizing text is estimated from its words instead of a 100px square", () => {
    const html = draw({ "paint.fills": gradient, "text.sizing": "autoWidth", "frame.width": 0, "frame.height": 0, "content.text": "A long headline", "typography.fontSize": 40 });
    assert.ok(html.includes("background-clip:text") || html.includes("background-clip: text"));
  });
});
