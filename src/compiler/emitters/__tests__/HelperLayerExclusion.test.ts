import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReactComponentEmitter } from "../ReactComponentEmitter";
import { VanillaHtmlEmitter } from "../vanilla/VanillaHtmlEmitter";
import { VueComponentEmitter } from "../vue/VueComponentEmitter";
import { createLayer } from "@/core/document/factories";
import type { Layer } from "@/core/document/schema";
import { selectRenderable } from "@/core/render/RenderLayer";

describe("Phase 73: Helper Layer Export & Preview Exclusion", () => {
  it("ReactComponentEmitter excludes helper layers from JSX output", () => {
    const parentFrame = createLayer({
      id: "frame1",
      archetype: "container",
      children: ["helperNull", "contentButton"],
    }) as Layer;

    const helperNull = createLayer({
      id: "helperNull",
      archetype: "container",
      name: "Null 1",
      parentId: "frame1",
      properties: {
        "render.role": "helper",
      },
    }) as Layer;

    const contentButton = createLayer({
      id: "contentButton",
      archetype: "button",
      name: "Submit Button",
      parentId: "frame1",
      properties: {
        "content.label": "Click Me",
        "render.role": "content",
      },
    }) as Layer;

    const elements: Record<string, Layer> = {
      frame1: parentFrame,
      helperNull,
      contentButton,
    };

    // Emit helper directly: must return empty string
    const helperJsx = ReactComponentEmitter.emitJsxNode("helperNull", elements);
    assert.equal(helperJsx, "", "Direct JSX emission of helper layer must be empty string");

    // Emit parent container: must contain button but NOT helper
    const containerJsx = ReactComponentEmitter.emitJsxNode("frame1", elements);
    assert.ok(containerJsx.includes("Click Me"), "Parent JSX must include content button");
    assert.ok(!containerJsx.includes("helperNull"), "Parent JSX must NOT include helper layer id");
    assert.ok(!containerJsx.includes("Null 1"), "Parent JSX must NOT include helper layer name");
  });

  it("VanillaHtmlEmitter returns empty markup for helper layer", () => {
    const helperLayer = createLayer({
      id: "nullHelper",
      archetype: "container",
      name: "Null Controller",
      properties: {
        "render.role": "helper",
      },
    }) as Layer;

    const emitted = VanillaHtmlEmitter.emit(helperLayer);
    assert.equal(emitted.htmlMarkup, "", "Helper HTML markup must be empty");
    assert.equal(emitted.cssStyles, "", "Helper CSS styles must be empty");
    assert.equal(emitted.jsScript, "", "Helper JS script must be empty");
  });

  it("VueComponentEmitter returns empty SFC code for helper layer", () => {
    const helperLayer = createLayer({
      id: "nullHelper",
      archetype: "container",
      name: "Null Driver",
      properties: {
        "render.role": "helper",
      },
    }) as Layer;

    const emitted = VueComponentEmitter.emit(helperLayer);
    assert.equal(emitted.sfcCode, "", "Helper SFC code must be empty");
  });

  it("selectRenderable filters out helper layers when previewOrExport is true", () => {
    const root = createLayer({
      id: "root",
      archetype: "container",
      children: ["helper", "content"],
    }) as Layer;

    const helper = createLayer({
      id: "helper",
      archetype: "container",
      parentId: "root",
      properties: { "render.role": "helper" },
    }) as Layer;

    const content = createLayer({
      id: "content",
      archetype: "rectangle",
      parentId: "root",
      properties: { "render.role": "content" },
    }) as Layer;

    const layers = { root, helper, content };

    // In design mode (previewOrExport = false): helper is kept
    const designPlan = selectRenderable(layers, ["root"], false);
    assert.ok(designPlan.get("root")?.includes("helper"), "Design plan includes helper");
    assert.ok(designPlan.get("root")?.includes("content"), "Design plan includes content");

    // In preview/export (previewOrExport = true): helper is omitted
    const previewPlan = selectRenderable(layers, ["root"], true);
    assert.ok(!previewPlan.get("root")?.includes("helper"), "Preview plan excludes helper");
    assert.ok(previewPlan.get("root")?.includes("content"), "Preview plan preserves content");
  });
});
