/**
 * ROADMAP Phase 124: text on a path. Putting text on a shape keeps where it came from and its start as its own,
 * animatable number; the start drawn follows that number; the motion engine writes it as the CSS variable the text
 * follows; taking it off clears both; the export writes SVG text inline, so no white space is added to it.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { getPropertyDefinition } from "../../document/properties";
import { RenderLayer } from "../../render/RenderLayer";
import { styleWrites } from "../../engine/stage/styleWrites";
import { attachToPath, detachFromPath, setTextPath } from "../textOps";
import { parseTextPath } from "../textFeatures";
import { toHtml } from "../../export/site/serialize";

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["c", "t"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "c", archetype: "ellipse", parentId: "pg", name: "Circle", properties: { positioning: "absolute", "frame.x": 100, "frame.y": 100, "frame.width": 200, "frame.height": 200 } }) as Layer,
      createLayer({ id: "t", archetype: "text", parentId: "pg", name: "Words", properties: { positioning: "absolute", "content.text": "Around", "typography.fontSize": 20 } }) as Layer,
    ]),
  ),
);

const draw = () => renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: getDocument().layers }));

describe("Phase 124: text on a path", () => {
  it("put on a circle: the path, where it came from, and the start as its own number", () => {
    assert.ok(attachToPath("t", "c", { start: 0.25 }));
    const p = getDocument().layers.t.properties;
    assert.equal(parseTextPath(p["typography.textPath"])?.source, "c");
    assert.equal(p["typography.textPathStart"], 25);
    assert.match(draw(), /<textPath href="#tp-t" startOffset="25%"/);
  });

  it("the start moves with its number; the old stored start is read when there is none", () => {
    attachToPath("t", "c");
    setTextPath(["t"], { start: 0.6, flip: true });
    assert.equal(getDocument().layers.t.properties["typography.textPathStart"], 60);
    assert.equal(parseTextPath(getDocument().layers.t.properties["typography.textPath"])?.flip, true);
    assert.match(draw(), /startOffset="60%"/);
    // a file from before Phase 124 has the start only inside the path
    setDocument(createDocumentFromLayers([createLayer({ id: "t", archetype: "text", parentId: null, name: "W", properties: { "content.text": "Old", "typography.textPath": JSON.stringify({ d: "M0 0 L100 0", start: 0.4 }) } }) as Layer]));
    assert.match(draw(), /startOffset="40%"/);
  });

  it("the start is animatable, and the engine writes it as the CSS variable the text follows", () => {
    const def = getPropertyDefinition("typography.textPathStart")!;
    assert.equal(def.animatable, true);
    assert.deepEqual(styleWrites(["typography.textPathStart"], { "typography.textPathStart": 37.5 } as never, "t"), { "--ll-text-path-start": "37.5" });
  });

  it("taken off the path, both go", () => {
    attachToPath("t", "c", { start: 0.1 });
    assert.equal(detachFromPath(["t"]), 1);
    const p = getDocument().layers.t.properties;
    assert.equal(p["typography.textPath"], undefined);
    assert.equal(p["typography.textPathStart"], undefined);
    assert.doesNotMatch(draw(), /textPath/);
  });

  it("the export writes SVG text inline: no line break or indent inside <text>", () => {
    const html = toHtml([{ tag: "svg", attrs: {}, children: [{ tag: "text", attrs: {}, children: [{ tag: "textPath", attrs: { href: "#p" }, children: [{ tag: "#text", text: "Around" }] }] }] }] as never);
    assert.match(html, /<text><textPath href="#p">Around<\/textPath><\/text>/);
  });
});
