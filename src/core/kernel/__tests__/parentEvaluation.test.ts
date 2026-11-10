import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../evaluate";
import { createLayer, createDocumentFromLayers } from "../../document/factories";
import type { Layer, Clip } from "../../document/schema";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import {
  computeComposedWorldMatrix,
  applyAffineMatrix,
  type AffineMatrix2D,
} from "../../geometry/parentTransforms";

const close = (actual: number, expected: number, tol = 1e-4, msg = "") => {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} (actual: ${actual}, expected: ${expected}, diff: ${diff})`);
};

describe("Phase 73: Kernel Parent Transform Composition (evaluate)", () => {
  it("evaluates a 3-level parent chain (C -> B -> A) and matches stage world matrix", () => {
    // Grandparent A: Frame at (0, 0), rotated 90°, translated by [100, 200]
    const layerA = createLayer({
      id: "layerA",
      archetype: "container",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 200,
        "frame.height": 200,
        "transform.x": 100,
        "transform.y": 200,
        "transform.rotate": 90,
        "transform.scaleX": 1,
        "transform.scaleY": 1,
      },
    }) as Layer;

    // Parent B: Frame at (0, 0), scaled [2, 0.5], translated [50, 0], anchor at [50, 50]
    const layerB = createLayer({
      id: "layerB",
      archetype: "container",
      parentRef: "layerA",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 100,
        "frame.height": 100,
        "transform.origin": "center",
        "transform.x": 50,
        "transform.y": 0,
        "transform.rotate": 0,
        "transform.scaleX": 2,
        "transform.scaleY": 0.5,
      },
    }) as Layer;

    // Child C: Frame at (0, 0), rotated 45°, translated [10, 10], anchor at [10, 20]
    const layerC = createLayer({
      id: "layerC",
      archetype: "rectangle",
      parentRef: "layerB",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 100,
        "frame.height": 100,
        "transform.origin": "10px 20px",
        "transform.x": 10,
        "transform.y": 10,
        "transform.rotate": 45,
        "transform.scaleX": 1,
        "transform.scaleY": 1,
      },
    }) as Layer;

    const doc = createDocumentFromLayers([layerA, layerB, layerC]);

    // 1. Evaluate child C via the kernel
    const evaluatedProps = evaluate(doc, MAIN_COMPOSITION_ID, "layerC", 0);

    const worldMatrix = evaluatedProps["transform.worldMatrix"] as AffineMatrix2D;
    assert.ok(Array.isArray(worldMatrix) && worldMatrix.length === 6, "Must emit transform.worldMatrix");

    // 2. Independently compute world matrix from geometry engine
    const expectedWorldM = computeComposedWorldMatrix(doc.layers, "layerC");

    // Verify all 6 affine elements match
    for (let i = 0; i < 6; i++) {
      close(worldMatrix[i], expectedWorldM[i], 1e-4, `matrix element ${i}`);
    }

    // 3. Stage Parity: Verify 4 transformed corners match
    const corners: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
    for (let i = 0; i < 4; i++) {
      const ptEval = applyAffineMatrix(worldMatrix, corners[i]);
      const ptStage = applyAffineMatrix(expectedWorldM, corners[i]);
      close(ptEval[0], ptStage[0], 1e-4, `corner ${i} x`);
      close(ptEval[1], ptStage[1], 1e-4, `corner ${i} y`);
    }

    // CSS transform output check
    assert.match(String(evaluatedProps.transform), /^matrix\(/);
  });

  it("rotating a parent helper layer rotates the child layer in evaluate()", () => {
    // Null helper layer
    const nullHelper = createLayer({
      id: "nullHelper",
      archetype: "container",
      name: "AE Null 1",
      properties: {
        "render.role": "helper",
        "frame.x": 100,
        "frame.y": 100,
        "frame.width": 0,
        "frame.height": 0,
        "transform.origin": "top left",
        "transform.rotate": 0,
      },
    }) as Layer;

    // Child layer: positioned at local [50, 0] relative to parent
    const child = createLayer({
      id: "child",
      archetype: "rectangle",
      parentRef: "nullHelper",
      properties: {
        "frame.x": 50,
        "frame.y": 0,
        "frame.width": 50,
        "frame.height": 50,
        "transform.origin": "top left",
      },
    }) as Layer;

    const doc = createDocumentFromLayers([nullHelper, child]);

    // Initial pose (null rotation = 0)
    const eval0 = evaluate(doc, MAIN_COMPOSITION_ID, "child", 0);
    const m0 = eval0["transform.worldMatrix"] as AffineMatrix2D;
    const pt0 = applyAffineMatrix(m0, [0, 0]);

    // Now rotate null helper by 90 degrees
    doc.layers.nullHelper.properties["transform.rotate"] = 90;

    const eval90 = evaluate(doc, MAIN_COMPOSITION_ID, "child", 0);
    const m90 = eval90["transform.worldMatrix"] as AffineMatrix2D;
    const pt90 = applyAffineMatrix(m90, [0, 0]);

    // In initial pose, child's top-left (150, 100) relative to null (100, 100) is delta (50, 0).
    // When null rotates 90° clockwise, delta (50, 0) rotates to (0, 50).
    // Plus null's origin (100, 100) => (100, 150).
    close(pt0[0], 150, 0.1, "initial child x");
    close(pt0[1], 100, 0.1, "initial child y");

    close(pt90[0], 100, 0.1, "rotated child x");
    close(pt90[1], 150, 0.1, "rotated child y");
  });

  it("cascades animated parent keyframes to child in evaluate()", () => {
    const parent = createLayer({
      id: "parent",
      archetype: "container",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "transform.x": 0,
      },
    }) as Layer;

    const child = createLayer({
      id: "child",
      archetype: "rectangle",
      parentRef: "parent",
      properties: {
        "frame.x": 50,
        "frame.y": 50,
      },
    }) as Layer;

    // Animate parent's transform.x from 0 to 200 over 1 second
    const clip: Clip = {
      id: "clipParent",
      layerId: "parent",
      name: "Clip",
      type: "entrance",
      trigger: "mount",
      easing: "linear",
      duration: 1,
      enabled: true,
      tracks: [
        {
          id: "trackX",
          property: "transform.x",
          keyframes: [
            { id: "k1", time: 0, value: 0 },
            { id: "k2", time: 1, value: 200, ease: "linear" },
          ],
        },
      ],
    };

    const doc = createDocumentFromLayers([parent, child], [clip]);

    // At t = 0: parent offset = 0 => child x = 50
    const evalAt0 = evaluate(doc, MAIN_COMPOSITION_ID, "child", 0);
    const mAt0 = evalAt0["transform.worldMatrix"] as AffineMatrix2D;
    const ptAt0 = applyAffineMatrix(mAt0, [0, 0]);
    close(ptAt0[0], 50, 0.1);

    // At t = 0.5: parent offset = 100 => child x = 150
    const evalAtHalf = evaluate(doc, MAIN_COMPOSITION_ID, "child", 0.5);
    const mAtHalf = evalAtHalf["transform.worldMatrix"] as AffineMatrix2D;
    const ptAtHalf = applyAffineMatrix(mAtHalf, [0, 0]);
    close(ptAtHalf[0], 150, 0.1);

    // At t = 1.0: parent offset = 200 => child x = 250
    const evalAt1 = evaluate(doc, MAIN_COMPOSITION_ID, "child", 1.0);
    const mAt1 = evalAt1["transform.worldMatrix"] as AffineMatrix2D;
    const ptAt1 = applyAffineMatrix(mAt1, [0, 0]);
    close(ptAt1[0], 250, 0.1);
  });
});
