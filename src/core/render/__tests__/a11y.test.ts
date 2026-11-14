import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../RenderLayer";
import { a11yAttrs } from "../a11y";
import { resolveProps } from "../resolve";

const text = (id: string, props: Record<string, string | number | boolean>) => createLayer({ id, archetype: "text", properties: { positioning: "absolute", "frame.width": 100, "frame.height": 30, "content.text": id, ...props } }) as Layer;
const draw = (layers: Layer[], root: string) => renderToStaticMarkup(createElement(RenderLayer, { layerId: root, layers: createDocumentFromLayers(layers).layers }));

describe("accessibility attributes (D12)", () => {
  it("a label, a role and hidden become aria-label, role and aria-hidden", () => {
    const a = a11yAttrs(resolveProps(text("t", { "a11y.label": "Hello world", "a11y.role": "heading", "a11y.hidden": true })));
    assert.deepEqual(a, { "aria-label": "Hello world", role: "heading", "aria-hidden": true });
    assert.deepEqual(a11yAttrs(resolveProps(text("t", {}))), {});
  });

  it("a role that is not a plain word is refused, and a long label is cut", () => {
    assert.equal(a11yAttrs(resolveProps(text("t", { "a11y.role": 'x" onload="y' }))).role, undefined);
    assert.equal(a11yAttrs(resolveProps(text("t", { "a11y.label": "a".repeat(5000) })))["aria-label"]!.length, 2000);
  });

  it("a split text is exposed once: the group is named with the whole text and each piece is hidden", () => {
    const group = createLayer({ id: "g", archetype: "container", children: ["w1", "w2"], properties: { positioning: "absolute", "frame.width": 200, "frame.height": 30, "a11y.label": "Hello world", "a11y.role": "group" } }) as Layer;
    const w1 = createLayer({ ...text("w1", { "content.text": "Hello", "a11y.hidden": true }), parentId: "g" } as never) as Layer;
    const w2 = createLayer({ ...text("w2", { "content.text": "world", "a11y.hidden": true }), parentId: "g" } as never) as Layer;
    const html = draw([group, w1, w2], "g");
    assert.match(html, /role="group"/);
    assert.equal((html.match(/aria-label="Hello world"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  });
});

import { buildSiteExport } from "../../export/site";

describe("a split text in the site export (D12)", () => {
  it("the exported page names the group with the whole text and hides each piece", async () => {
    const page = createLayer({ id: "page", archetype: "container", children: ["g"], properties: { "frame.width": 1440, "frame.height": 900 } }) as Layer;
    const group = createLayer({ id: "g", archetype: "container", parentId: "page", children: ["w1", "w2"], properties: { positioning: "absolute", "frame.width": 200, "frame.height": 30, "a11y.label": "Hello world", "a11y.role": "group" } } as never) as Layer;
    const w1 = createLayer({ ...text("w1", { "content.text": "Hello", "a11y.hidden": true }), parentId: "g" } as never) as Layer;
    const w2 = createLayer({ ...text("w2", { "content.text": "world", "a11y.hidden": true }), parentId: "g" } as never) as Layer;
    const out = await buildSiteExport(createDocumentFromLayers([page, group, w1, w2]), { target: "html", styling: "css" });
    const html = out.files.find((f) => f.path === "index.html")!.content as string;
    assert.equal((html.match(/aria-label="Hello world"/g) ?? []).length, 1, html);
    assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
    assert.match(html, /role="group"/);
  });
});
