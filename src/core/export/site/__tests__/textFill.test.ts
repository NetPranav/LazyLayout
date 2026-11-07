import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import { exportLayerCode, buildSiteExport } from "../index";
import { fillsOf, hasFills, setFills } from "../../../paint/paintOps";
import { RenderLayer } from "../../../render/RenderLayer";
import { setDocument } from "../../../store/documentState";

describe("Text with image or gradient fill (Phase 35/37 Task A)", () => {
  it("hasFills recognizes text archetype", () => {
    assert.equal(hasFills("text"), true);
  });

  it("fillsOf on a plain text layer reflects typography.color as a solid paint", () => {
    const textLayer = createLayer({
      id: "txt_plain",
      archetype: "text",
      name: "Plain Text",
      properties: {
        "content.text": "Plain Text",
        "typography.color": "#3b82f6",
      },
    });
    setDocument(createDocumentFromLayers([textLayer]));
    const fills = fillsOf("txt_plain");
    assert.equal(fills.length, 1);
    assert.equal(fills[0].type, "solid");
    assert.equal((fills[0] as { color: string }).color, "#3b82f6");
  });

  it("setFills writes paint.fills for non-solid fills and one undo step", () => {
    const textLayer = createLayer({
      id: "txt_fill",
      archetype: "text",
      name: "Fill Text",
      properties: {
        "content.text": "Fill Text",
        "typography.color": "#0f172a",
      },
    });
    setDocument(createDocumentFromLayers([textLayer]));
    const gradient = {
      type: "linear" as const,
      opacity: 1,
      visible: true,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      stops: [
        { at: 0, color: "#ff0000" },
        { at: 1, color: "#0000ff" },
      ],
    };
    setFills(["txt_fill"], [gradient]);
    const fills = fillsOf("txt_fill");
    assert.equal(fills.length, 1);
    assert.equal(fills[0].type, "linear");

    // Removing the fill restores the solid colour
    setFills(["txt_fill"], []);
    const restoredFills = fillsOf("txt_fill");
    assert.equal(restoredFills.length, 1);
    assert.equal(restoredFills[0].type, "solid");
    assert.equal((restoredFills[0] as { color: string }).color, "#0f172a");
  });

  it("rendering a text layer with solid-only fills produces plain color and no background-clip text", () => {
    const textLayer = createLayer({
      id: "txt_solid",
      archetype: "text",
      name: "Solid Text",
      properties: {
        "content.text": "Solid",
        "typography.color": "#10b981",
      },
    });
    const layers = { txt_solid: textLayer };
    const markup = renderToStaticMarkup(createElement(RenderLayer, { layerId: "txt_solid", layers }));
    assert.ok(!markup.includes("background-clip:text") && !markup.includes("background-clip: text"));
    assert.ok(!markup.includes("-webkit-background-clip:text") && !markup.includes("-webkit-background-clip: text"));
    assert.ok(markup.includes("color:#10b981") || markup.includes("color: #10b981"));
  });

  it("rendering a text layer with gradient fill produces background-clip text and linear-gradient", () => {
    const textLayer = createLayer({
      id: "txt_grad",
      archetype: "text",
      name: "Grad Text",
      properties: {
        "content.text": "Grad",
        "typography.color": "#000000",
        "frame.width": 200,
        "frame.height": 50,
        "paint.fills": JSON.stringify([
          {
            type: "linear",
            opacity: 1,
            visible: true,
            from: { x: 0, y: 0 },
            to: { x: 1, y: 0 },
            stops: [
              { at: 0, color: "#ff0000" },
              { at: 1, color: "#ffff00" },
            ],
          },
        ]),
      },
    });
    const layers = { txt_grad: textLayer };
    const markup = renderToStaticMarkup(createElement(RenderLayer, { layerId: "txt_grad", layers }));
    assert.ok(markup.includes("background-clip:text") || markup.includes("background-clip: text"));
    assert.ok(markup.includes("-webkit-background-clip:text") || markup.includes("-webkit-background-clip: text"));
    assert.ok(markup.includes("-webkit-text-fill-color:transparent") || markup.includes("-webkit-text-fill-color: transparent"));
    assert.ok(markup.includes("color:transparent") || markup.includes("color: transparent"));
    assert.ok(markup.includes("linear-gradient("));
  });

  it("rendering a text layer with image fill produces background-clip text and background-image", () => {
    const textLayer = createLayer({
      id: "txt_img",
      archetype: "text",
      name: "Image Text",
      properties: {
        "content.text": "Picture",
        "typography.color": "#000000",
        "frame.width": 300,
        "frame.height": 80,
        "paint.fills": JSON.stringify([
          {
            type: "image",
            opacity: 1,
            visible: true,
            src: "https://example.com/test.png",
            mode: "fill",
            crop: { x: 0, y: 0, w: 1, h: 1 },
            scale: 1,
            brightness: 1,
            contrast: 1,
            saturation: 1,
          },
        ]),
      },
    });
    const layers = { txt_img: textLayer };
    const markup = renderToStaticMarkup(createElement(RenderLayer, { layerId: "txt_img", layers }));
    assert.ok(markup.includes("background-clip:text") || markup.includes("background-clip: text"));
    assert.ok(markup.includes("-webkit-background-clip:text") || markup.includes("-webkit-background-clip: text"));
    assert.ok(markup.includes("-webkit-text-fill-color:transparent") || markup.includes("-webkit-text-fill-color: transparent"));
    assert.ok(markup.includes("color:transparent") || markup.includes("color: transparent"));
    assert.ok(markup.includes("background-image:") && markup.includes("https://example.com/test.png"));
    assert.ok(markup.includes("background-size:cover") || markup.includes("background-size: cover"));
    assert.ok(markup.includes("background-position:center") || markup.includes("background-position: center"));
    assert.ok(markup.includes("background-repeat:no-repeat") || markup.includes("background-repeat: no-repeat"));
  });

  it("exportLayerCode produces CSS with background-clip: text and -webkit- prefix", () => {
    const root = createLayer({
      id: "page_root",
      archetype: "container",
      name: "Page",
      children: ["txt_export"],
      properties: { "frame.width": 1200, "frame.height": 800 },
    });
    const textLayer = createLayer({
      id: "txt_export",
      archetype: "text",
      name: "HeroHeading",
      parentId: "page_root",
      properties: {
        "content.text": "Clipped Text",
        "typography.fontSize": 64,
        "typography.color": "#000000",
        "frame.width": 600,
        "frame.height": 120,
        "paint.fills": JSON.stringify([
          {
            type: "image",
            opacity: 1,
            visible: true,
            src: "https://example.com/photo.jpg",
            mode: "fill",
            crop: { x: 0, y: 0, w: 1, h: 1 },
            scale: 1,
            brightness: 1,
            contrast: 1,
            saturation: 1,
          },
        ]),
      },
    });
    const doc = createDocumentFromLayers([root, textLayer]);
    const layerCode = exportLayerCode(doc, "txt_export");
    assert.ok(layerCode !== null);

    // CSS must include standard and -webkit- prefixed background-clip as well as transparent fill
    assert.ok(layerCode.css.includes("background-clip: text;"), "CSS must contain background-clip: text;");
    assert.ok(layerCode.css.includes("-webkit-background-clip: text;"), "CSS must contain -webkit-background-clip: text;");
    assert.ok(layerCode.css.includes("-webkit-text-fill-color: transparent;"), "CSS must contain -webkit-text-fill-color: transparent;");
    assert.ok(layerCode.css.includes("color: transparent;"), "CSS must contain color: transparent;");
    assert.ok(layerCode.css.includes('background-image: url("https://example.com/photo.jpg");'), "CSS must contain background-image;");
  });

  it("buildSiteExport preserves text fill effect in exported site stylesheet", async () => {
    const root = createLayer({
      id: "site_root",
      archetype: "container",
      name: "SitePage",
      children: ["txt_site"],
      properties: { "frame.width": 1200, "frame.height": 800 },
    });
    const textLayer = createLayer({
      id: "txt_site",
      archetype: "text",
      name: "SiteTitle",
      parentId: "site_root",
      properties: {
        "content.text": "Site Gradient Title",
        "typography.fontSize": 48,
        "typography.color": "#334155",
        "frame.width": 400,
        "frame.height": 80,
        "paint.fills": JSON.stringify([
          {
            type: "linear",
            opacity: 1,
            visible: true,
            from: { x: 0, y: 0 },
            to: { x: 1, y: 0 },
            stops: [
              { at: 0, color: "#6366f1" },
              { at: 1, color: "#ec4899" },
            ],
          },
        ]),
      },
    });
    const doc = createDocumentFromLayers([root, textLayer]);
    const site = await buildSiteExport(doc, { target: "html", styling: "css" });
    const cssFile = site.files.find((f) => f.path === "styles.css");
    assert.ok(cssFile !== null && cssFile !== undefined);
    const cssContent = typeof cssFile.content === "string" ? cssFile.content : "";
    assert.ok(cssContent.includes("background-clip: text;"));
    assert.ok(cssContent.includes("-webkit-background-clip: text;"));
    assert.ok(cssContent.includes("-webkit-text-fill-color: transparent;"));
  });
});
