import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer } from "../../../document/schema";
import { EDITOR_ONLY_ATTRIBUTES, isEditorOnlyLayer } from "../../../document/editorOnly";
import { buildSiteExport } from "..";

/** A page with a Desktop frame, a Tablet mirror of it, and a helper layer: only the Desktop frame may ship. */
function docWithMirror() {
  const root = { ...(createLayer({ id: "root", archetype: "container", parentId: null, name: "Home", children: ["desk", "mirror"], properties: { "frame.width": 1440, "frame.height": 900 } }) as Layer), page: { route: "/" } };
  const desk = createLayer({ id: "desk", archetype: "container", parentId: "root", name: "Desktop", children: ["card", "guide"], properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 900, "frame.device": "desktop" } }) as Layer;
  const card = createLayer({ id: "card", archetype: "text", parentId: "desk", name: "Card", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 10, "frame.width": 200, "frame.height": 40, "content.text": "Only once" } }) as Layer;
  const guide = createLayer({ id: "guide", archetype: "container", parentId: "desk", name: "Guide", properties: { positioning: "absolute", "frame.width": 10, "frame.height": 10, "render.role": "helper" } }) as Layer;
  const mirror = createLayer({ id: "mirror", archetype: "container", parentId: "root", name: "Tablet", properties: { positioning: "absolute", "frame.x": 1560, "frame.y": 0, "frame.width": 768, "frame.height": 1024, "frame.mirrorOf": "desk", "frame.device": "tablet" } }) as Layer;
  return createDocumentFromLayers([root, desk, card, guide, mirror]);
}

describe("editor-only layers and attributes never ship", () => {
  it("knows which layers are editor-only", () => {
    const doc = docWithMirror();
    assert.equal(isEditorOnlyLayer(doc.layers.mirror), true);
    assert.equal(isEditorOnlyLayer(doc.layers.guide), true);
    assert.equal(isEditorOnlyLayer(doc.layers.desk), false);
    assert.equal(isEditorOnlyLayer({ properties: { "frame.mirrorOf": "" } }), false);
  });

  for (const target of ["html", "vite", "next"] as const) {
    it(`${target}: the mirror and the helper are left out, the frame's content is there once, no editor attribute`, async () => {
      const { files } = await buildSiteExport(docWithMirror(), { target, styling: "css" });
      const code = files.filter((f) => typeof f.content === "string").map((f) => f.content as string).join("\n");
      assert.equal(code.split("Only once").length - 1, 1, "the frame's text appears exactly once");
      for (const attr of EDITOR_ONLY_ATTRIBUTES) assert.ok(!code.includes(attr), `${attr} must not be exported`);
      assert.ok(!/\btablet_/i.test(code), "no class for the mirror frame");
      assert.ok(!/\bguide_/i.test(code), "no class for the helper layer");
    });
  }
});

describe("invariant: no editor attribute in any export, for every kind of layer", () => {
  it("every gallery case, through all three targets", async () => {
    const { GALLERY_CASES, buildGalleryLayers } = await import("../../../render/gallery");
    const layers = Object.values(buildGalleryLayers());
    const roots = layers.filter((l) => l.parentId === null);
    const page = { ...(createLayer({ id: "gallery", archetype: "container", parentId: null, name: "Gallery", children: roots.map((r) => r.id), properties: { "frame.width": 1440, "frame.height": 900 } }) as Layer), page: { route: "/" } };
    const doc = createDocumentFromLayers([
      page,
      ...layers.map((l) => (l.parentId === null ? { ...l, parentId: "gallery", properties: { ...l.properties, positioning: "absolute", "frame.x": (roots.indexOf(l) % 6) * 240, "frame.y": Math.floor(roots.indexOf(l) / 6) * 160 } } : l)),
    ]);
    assert.ok(GALLERY_CASES.length > 40);
    for (const target of ["html", "vite", "next"] as const) {
      const { files } = await buildSiteExport(doc, { target, styling: "css" });
      const code = files.filter((f) => typeof f.content === "string").map((f) => f.content as string).join("\n");
      for (const attr of EDITOR_ONLY_ATTRIBUTES) assert.ok(!code.includes(attr), `${target}: ${attr} must not be exported`);
    }
  });
});
