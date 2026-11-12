/**
 * ============================================================================
 * UNIT TESTS: LAYER OUTLINE RINGS & LAYER SDF (ROADMAP Phase 3D-028)
 * ============================================================================
 * Verifies extracting polygonal rings and signed distance fields from document
 * layers, as well as the LayerTextureSource interface contract.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDocument } from "../../../document/schema";
import { createLayer } from "../../../document/factories";
import {
  layerOutlineRings,
  layerSdf,
  type LayerTextureSource,
} from "../layerSources";
import { sampleSdf } from "../sdf";

describe("layerSources: layerOutlineRings & layerSdf", () => {
  it("extracts rings from a rectangle layer", () => {
    const doc = createEmptyDocument();
    const rectLayer = createLayer({
      archetype: "rectangle",
      id: "rect-1",
      name: "Box",
      properties: {
        "frame.width": 40,
        "frame.height": 20,
        "shape.cornerRadius": 0,
      },
    });
    doc.layers[rectLayer.id] = rectLayer;

    const rings = layerOutlineRings(doc, "rect-1", 0.1);
    assert.ok(rings.length > 0);
    assert.equal(rings[0].length, 5); // 4 corners + closed point
  });

  it("extracts rings and computes SDF for an ellipse layer", () => {
    const doc = createEmptyDocument();
    const ellipseLayer = createLayer({
      archetype: "ellipse",
      id: "ellipse-1",
      name: "Circle",
      properties: {
        "frame.width": 50,
        "frame.height": 50,
      },
    });
    doc.layers[ellipseLayer.id] = ellipseLayer;

    const rings = layerOutlineRings(doc, "ellipse-1", 0.05);
    assert.ok(rings.length > 0);
    assert.ok(rings[0].length >= 8);

    const sdf = layerSdf(doc, "ellipse-1", { cellSize: 1, padding: 5 });
    assert.ok(sdf !== null);
    assert.ok(sdf.width > 50);
    assert.ok(sdf.height > 50);

    // Center of ellipse (25, 25) should be negative
    const centerVal = sampleSdf(sdf, 25, 25);
    assert.ok(centerVal < -10, `Center value should be negative, got ${centerVal}`);

    // Exterior of ellipse (0, 0) should be positive
    const cornerVal = sampleSdf(sdf, 0, 0);
    assert.ok(cornerVal > 0, `Exterior value should be positive, got ${cornerVal}`);
  });

  it("returns empty rings and null SDF for non-existent layer", () => {
    const doc = createEmptyDocument();
    const rings = layerOutlineRings(doc, "non-existent");
    assert.deepEqual(rings, []);

    const sdf = layerSdf(doc, "non-existent");
    assert.equal(sdf, null);
  });

  it("implements LayerTextureSource interface cleanly", () => {
    const source: LayerTextureSource = {
      layerId: "layer-123",
      width: 256,
      height: 256,
      pixels: new Uint8Array(256 * 256 * 4),
    };
    assert.equal(source.layerId, "layer-123");
    assert.equal(source.width, 256);
    assert.equal(source.height, 256);
    assert.ok(source.pixels instanceof Uint8Array);
  });
});
