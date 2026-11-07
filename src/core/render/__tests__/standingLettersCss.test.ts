import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { layerBoxStyle } from "../geometry";
import { resolveProps } from "../resolve";
import type { Layer } from "../../document/schema";
import { getDefaultProps, type ArchetypeId, type PropValue } from "@/core/document/registry";

function makeLayer(archetype: ArchetypeId, properties: Record<string, PropValue> = {}): Layer {
  return {
    id: "layer_test",
    archetype,
    name: "Test Layer",
    parentId: "parent_1",
    children: [],
    properties: {
      ...getDefaultProps(archetype),
      ...properties,
    },
  };
}

describe("CSS produced for 3D standing letters", () => {
  it("produces preserve-3d and ground plane tilt on 3D stage group", () => {
    const stageGroup = makeLayer("container", {
      "frame.kind": "group",
      positioning: "absolute",
      "frame.width": 500,
      "frame.height": 200,
      "transform.perspective": 900,
      "transform.rotateX": 55,
      "transform.style3d": "preserve3d",
      "layout.overflowX": "hidden",
      "layout.overflowY": "hidden",
    });

    const resolved = resolveProps(stageGroup);
    const style = layerBoxStyle(stageGroup, resolved, {});

    // Must set transformStyle: preserve-3d
    assert.equal(style.transformStyle, "preserve-3d");

    // Must include perspective and tilt in transform
    assert.ok(typeof style.transform === "string");
    assert.ok(style.transform.includes("perspective(900px)"));
    assert.ok(style.transform.includes("rotateX(55deg)"));

    // Flattening prevention: overflow clipping must be deleted on preserve3d stage
    assert.equal(style.overflowX, undefined);
    assert.equal(style.overflowY, undefined);
  });

  it("produces upright rotation and bottom center origin for standing letter", () => {
    const letter = makeLayer("text", {
      "content.text": "F",
      "frame.width": 40,
      "frame.height": 80,
      "transform.rotateX": -55,
      "transform.origin": "bottom center",
    });

    const resolved = resolveProps(letter);
    const style = layerBoxStyle(letter, resolved, {});

    assert.equal(style.transformOrigin, "bottom center");
    assert.ok(typeof style.transform === "string");
    assert.ok(style.transform.includes("rotateX(-55deg)"));
  });

  it("produces translateZ and rotateX for depth copy", () => {
    const depthCopy = makeLayer("text", {
      "content.text": "F",
      "frame.width": 40,
      "frame.height": 80,
      "transform.rotateX": -55,
      "transform.origin": "bottom center",
      "transform.translateZ": -12,
    });

    const resolved = resolveProps(depthCopy);
    const style = layerBoxStyle(depthCopy, resolved, {});

    assert.equal(style.transformOrigin, "bottom center");
    assert.ok(typeof style.transform === "string");
    assert.ok(style.transform.includes("rotateX(-55deg)"));
    assert.ok(style.transform.includes("translateZ(-12px)"));
  });

  it("does not set transformStyle on default flat layers", () => {
    const flatLayer = makeLayer("container", {
      "transform.style3d": "flat",
    });

    const resolved = resolveProps(flatLayer);
    const style = layerBoxStyle(flatLayer, resolved, {});

    assert.notEqual(style.transformStyle, "preserve-3d");
  });

  it("prevents opacity < 1 and filters from flattening a preserve-3d stage group", () => {
    const stageWithEffects = makeLayer("container", {
      "transform.perspective": 900,
      "transform.rotateX": 55,
      "transform.style3d": "preserve3d",
      "appearance.opacity": 0.5,
      "filter.blur": 10,
    });

    const resolved = resolveProps(stageWithEffects);
    const style = layerBoxStyle(stageWithEffects, resolved, {});

    assert.equal(style.transformStyle, "preserve-3d");
    // Opacity < 1 and filter must be suppressed on preserve3d stage to prevent browser flattening
    assert.equal(style.opacity, undefined);
    assert.equal(style.filter, undefined);
  });
});
