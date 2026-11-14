import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { layerBoxStyle } from "../geometry";
import { resolveProps } from "../resolve";

/** Design track D16: a poster, a headline or a clip is set onto a plane the same way as a shape: the corner pin is on the layer's box, whatever it draws. */
describe("corner pin on every kind of layer (D16)", () => {
  const PIN = "40,30,260,10,300,170,10,190";
  for (const archetype of ["image", "text", "rectangle", "ellipse", "container", "button"] as const) {
    it(`${archetype} gets a perspective matrix about its own top left`, () => {
      const l = createLayer({ id: "l", archetype, properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 300, "frame.height": 200, "transform.pin": PIN } }) as Layer;
      const s = layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>;
      assert.match(String(s.transform), /^matrix3d\(/, archetype);
      assert.equal(s.transformOrigin, "0 0");
    });
  }
  it("a pin that would fold the layer is refused: it is drawn flat instead", () => {
    const l = createLayer({ id: "l", archetype: "image", properties: { positioning: "absolute", "frame.width": 300, "frame.height": 200, "transform.pin": "0,0,300,200,300,0,0,200" } }) as Layer;
    const s = layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>;
    assert.ok(!String(s.transform ?? "").startsWith("matrix3d("));
  });
});
