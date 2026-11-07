import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { AnchorOverlay } from "../AnchorOverlay";
import { setDocument, getDocument } from "@/core/store/documentState";
import { historyCommands } from "@/core/store/useDocumentStore";
import { setLayerProps } from "@/core/editing/editOps";
import type { Layer } from "@/core/document/schema";
import { resolveLayerAnchor, resolvePresetPinPosition } from "@/core/geometry/pins";
import { compensateTransformForAnchorChange } from "@/core/geometry/transforms";

describe("Phase 72: AnchorOverlay UI & Stage Integration", () => {
  it("renders the interactive anchor point handle for the selected layer", () => {
    const elements = {
      layer_1: {
        id: "layer_1",
        x: 100,
        y: 150,
        width: 200,
        height: 100,
        type: "container",
      },
    };

    const layers = {
      layer_1: {
        id: "layer_1",
        archetype: "container",
        name: "Box",
        properties: {
          "transform.origin": "center",
          "transform.x": 0,
          "transform.y": 0,
        },
      } as unknown as Layer,
    };

    const html = renderToStaticMarkup(
      <AnchorOverlay
        selectedIds={["layer_1"]}
        elements={elements}
        layers={layers}
        zoom={1}
      />
    );

    assert.ok(html.includes('data-testid="anchor-overlay"'));
    assert.ok(html.includes('data-testid="anchor-point-handle"'));
    // Center of 200x100 is (100, 50). Canvas pos: (100 + 100, 150 + 50) = (200, 200)
    assert.ok(html.includes('data-anchor-x="100"'));
    assert.ok(html.includes('data-anchor-y="50"'));
    assert.ok(html.includes('data-anchor-preset="center"'));
    assert.ok(html.includes("left:200px"));
    assert.ok(html.includes("top:200px"));
  });

  it("positions anchor handle at preset pin location (topRight)", () => {
    const elements = {
      box: {
        id: "box",
        x: 50,
        y: 60,
        width: 120,
        height: 80,
        type: "container",
      },
    };

    const layers = {
      box: {
        id: "box",
        archetype: "container",
        name: "Box",
        properties: {
          "transform.origin": "topRight",
          "transform.x": 0,
          "transform.y": 0,
        },
      } as unknown as Layer,
    };

    const html = renderToStaticMarkup(
      <AnchorOverlay
        selectedIds={["box"]}
        elements={elements}
        layers={layers}
        zoom={1}
      />
    );

    // topRight of 120x80 is (120, 0). Canvas pos: (50 + 120, 60 + 0) = (170, 60)
    assert.ok(html.includes('data-anchor-x="120"'));
    assert.ok(html.includes('data-anchor-y="0"'));
    assert.ok(html.includes('data-anchor-preset="topRight"'));
    assert.ok(html.includes("left:170px"));
    assert.ok(html.includes("top:60px"));
  });

  it("handles custom pins and out-of-bounds coordinates", () => {
    const elements = {
      custom_box: {
        id: "custom_box",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        type: "container",
      },
    };

    const layers = {
      custom_box: {
        id: "custom_box",
        archetype: "container",
        name: "Custom Box",
        pins: {
          external_lever: { x: -25, y: -15, unit: "px" as const },
        },
        properties: {
          "transform.origin": "external_lever",
        },
      } as unknown as Layer,
    };

    const html = renderToStaticMarkup(
      <AnchorOverlay
        selectedIds={["custom_box"]}
        elements={elements}
        layers={layers}
        zoom={1}
      />
    );

    assert.ok(html.includes('data-anchor-x="-25"'));
    assert.ok(html.includes('data-anchor-y="-15"'));
    assert.ok(html.includes('data-anchor-preset="external_lever"'));
    assert.ok(html.includes("left:-25px"));
    assert.ok(html.includes("top:-15px"));
  });

  it("supports transactional undo and redo of anchor movements", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "PivotLayer", null, {
      "frame.x": 100,
      "frame.y": 100,
      "frame.width": 100,
      "frame.height": 60,
      "transform.origin": "center",
      "transform.x": 0,
      "transform.y": 0,
      "transform.rotate": 45,
    });
    const doc = b.build();
    setDocument(doc);

    // Initial state
    assert.equal(getDocument().layers[layerId].properties["transform.origin"], "center");

    // Move anchor to topRight with compensation
    const oldAnchor = resolveLayerAnchor(getDocument().layers[layerId], 100, 60);
    const newAnchor = resolvePresetPinPosition("topRight", 100, 60);
    const [compTx, compTy] = compensateTransformForAnchorChange(
      oldAnchor,
      newAnchor,
      45,
      1,
      1,
      [0, 0]
    );

    setLayerProps(
      [layerId],
      {
        "transform.origin": "topRight",
        "transform.x": compTx,
        "transform.y": compTy,
      },
      "Move anchor point"
    );

    // Updated state
    assert.equal(getDocument().layers[layerId].properties["transform.origin"], "topRight");
    assert.notEqual(getDocument().layers[layerId].properties["transform.x"], 0);

    // Undo
    historyCommands.undo();
    assert.equal(getDocument().layers[layerId].properties["transform.origin"], "center");
    assert.equal(getDocument().layers[layerId].properties["transform.x"], 0);

    // Redo
    historyCommands.redo();
    assert.equal(getDocument().layers[layerId].properties["transform.origin"], "topRight");
    assert.equal(getDocument().layers[layerId].properties["transform.x"], compTx);
  });
});
