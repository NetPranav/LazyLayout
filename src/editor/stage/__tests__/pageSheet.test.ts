import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldDrawPageSheet, type LayerLike } from "../pageSheet";

describe("Task E: shouldDrawPageSheet pure rule", () => {
  it("returns false when layers or rootId are missing or empty", () => {
    assert.equal(shouldDrawPageSheet(undefined, null), false);
    assert.equal(shouldDrawPageSheet({}, null), false);
    assert.equal(shouldDrawPageSheet({}, "root"), false);
  });

  it("returns false when the page is empty (root has 0 children)", () => {
    const layers: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: [] },
    };
    assert.equal(shouldDrawPageSheet(layers, "root"), false);
  });

  it("returns false when every direct child of the page is a frame (archetype container)", () => {
    const layers: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["frame1"] },
      frame1: { id: "frame1", archetype: "container", parentId: "root", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layers, "root"), false);
  });

  it("returns false when multiple frames sit on the page, even with children inside them", () => {
    const layers: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["frame1", "frame2"] },
      frame1: { id: "frame1", archetype: "container", parentId: "root", children: ["rectInside1", "textInside1"] },
      rectInside1: { id: "rectInside1", archetype: "rectangle", parentId: "frame1", children: [] },
      textInside1: { id: "textInside1", archetype: "text", parentId: "frame1", children: [] },
      frame2: { id: "frame2", archetype: "container", parentId: "root", children: ["buttonInside2"] },
      buttonInside2: { id: "buttonInside2", archetype: "button", parentId: "frame2", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layers, "root"), false);
  });

  it("returns true when at least one direct child of the page is a loose shape (e.g. rectangle)", () => {
    const layers: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["rect1"] },
      rect1: { id: "rect1", archetype: "rectangle", parentId: "root", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layers, "root"), true);
  });

  it("returns true when at least one direct child is loose text or an image", () => {
    const layersText: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["text1"] },
      text1: { id: "text1", archetype: "text", parentId: "root", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layersText, "root"), true);

    const layersImg: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["img1"] },
      img1: { id: "img1", archetype: "image", parentId: "root", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layersImg, "root"), true);
  });

  it("returns true when there is a frame AND a loose shape on the page", () => {
    const layers: Record<string, LayerLike> = {
      root: { id: "root", archetype: "container", parentId: null, children: ["frame1", "rectLoose"] },
      frame1: { id: "frame1", archetype: "container", parentId: "root", children: [] },
      rectLoose: { id: "rectLoose", archetype: "rectangle", parentId: "root", children: [] },
    };
    assert.equal(shouldDrawPageSheet(layers, "root"), true);
  });
});
