import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../evaluate";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { applyAffineMatrix, type AffineMatrix2D } from "../../geometry/parentTransforms";

/**
 * Design track D6: a label pinned to a point on an image (parented to it where it sits) stays on that point of the image
 * through any transform of the image: moves, rotations, scales and skews about different origins.
 */
const IMAGE = { x: 100, y: 50, width: 400, height: 300 };
const PIN = { u: 0.62, v: 0.18 }; // a point on the image, e.g. a watch crown
const local: [number, number] = [IMAGE.width * PIN.u, IMAGE.height * PIN.v];

const TRANSFORMS: Record<string, unknown>[] = [
  {},
  { "transform.x": 120, "transform.y": -40 },
  { "transform.rotate": 90 },
  { "transform.rotate": -37 },
  { "transform.scale": 2 },
  { "transform.scaleX": 0.5, "transform.scaleY": 1.7 },
  { "transform.scale": 1.5, "transform.rotate": 30, "transform.x": 60, "transform.y": 25 },
  { "transform.origin": "top left", "transform.rotate": 45 },
  { "transform.origin": "bottom right", "transform.scale": 0.6, "transform.rotate": -120 },
  { "transform.origin": "40px 70px", "transform.scaleX": 2.5, "transform.scaleY": 2.5, "transform.rotate": 180, "transform.x": -200 },
];

describe("a pin holds through transforms (D6)", () => {
  TRANSFORMS.forEach((t, i) => {
    it(`transform ${i + 1}: ${JSON.stringify(t)}`, () => {
      const image = createLayer({ id: "image", archetype: "container", properties: { "frame.x": IMAGE.x, "frame.y": IMAGE.y, "frame.width": IMAGE.width, "frame.height": IMAGE.height, ...t } }) as Layer;
      // the label's frame position is the pin's place inside the image (what parenting at a preserved pose gives)
      const label = createLayer({ id: "label", archetype: "container", parentRef: "image", properties: { "frame.x": local[0], "frame.y": local[1], "frame.width": 60, "frame.height": 24 } }) as Layer;
      const doc = createDocumentFromLayers([image, label]);
      const imageM = evaluate(doc, MAIN_COMPOSITION_ID, "image", 0)["transform.worldMatrix"] as AffineMatrix2D;
      const labelM = evaluate(doc, MAIN_COMPOSITION_ID, "label", 0)["transform.worldMatrix"] as AffineMatrix2D;
      const expected = applyAffineMatrix(imageM, local); // where the pin point of the image is, in the page
      const actual = applyAffineMatrix(labelM, [0, 0]); // where the label's own top left is
      assert.ok(Math.abs(actual[0] - expected[0]) <= 0.5 && Math.abs(actual[1] - expected[1]) <= 0.5, `label at ${actual}, pin at ${expected}`);
    });
  });

  it("control: a label 10 px off its pin is caught by the same check", () => {
    const image = createLayer({ id: "image", archetype: "container", properties: { "frame.x": IMAGE.x, "frame.y": IMAGE.y, "frame.width": IMAGE.width, "frame.height": IMAGE.height, "transform.rotate": 30 } }) as Layer;
    const label = createLayer({ id: "label", archetype: "container", parentRef: "image", properties: { "frame.x": local[0] + 10, "frame.y": local[1], "frame.width": 60, "frame.height": 24 } }) as Layer;
    const doc = createDocumentFromLayers([image, label]);
    const expected = applyAffineMatrix(evaluate(doc, MAIN_COMPOSITION_ID, "image", 0)["transform.worldMatrix"] as AffineMatrix2D, local);
    const actual = applyAffineMatrix(evaluate(doc, MAIN_COMPOSITION_ID, "label", 0)["transform.worldMatrix"] as AffineMatrix2D, [0, 0]);
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) > 9);
  });
});
