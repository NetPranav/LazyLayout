import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPinInLayer, pinInLayer, pinInParent, type Quad } from "../cornerPin";
import { defaultMesh, formatMeshInLayer, meshInLayer, meshInParent } from "../meshWarp";

const quad: Quad = [[100, 50], [300, 60], [310, 200], [90, 190]];

describe("pins and meshes are stored relative to the layer", () => {
  it("a pin written at one place reads back in the layer's own px, whatever the layer's position", () => {
    const stored = formatPinInLayer(quad, [100, 50]);
    assert.ok(stored.startsWith("rel:"));
    assert.deepEqual(pinInLayer(stored, [100, 50]), [[0, 0], [200, 10], [210, 150], [-10, 140]]);
    // the layer moved by (40, 5): the pin moves with it
    assert.deepEqual(pinInLayer(stored, [140, 55]), [[0, 0], [200, 10], [210, 150], [-10, 140]]);
    assert.deepEqual(pinInParent(stored, [140, 55]), [[140, 55], [340, 65], [350, 205], [130, 195]]);
  });

  it("a pin written before (parent px, no marker) still reads where it was", () => {
    const legacy = "100,50,300,60,310,200,90,190";
    assert.deepEqual(pinInParent(legacy, [100, 50]), quad);
    assert.deepEqual(pinInLayer(legacy, [100, 50]), [[0, 0], [200, 10], [210, 150], [-10, 140]]);
  });

  it("a mesh round-trips the same way, and moves with its layer", () => {
    const m = defaultMesh(20, 30, 200, 100, 3, 2);
    const stored = formatMeshInLayer(m, [20, 30]);
    assert.ok(stored.startsWith("rel:"));
    assert.deepEqual(meshInLayer(stored, [999, 999])!.points[0], [0, 0]);
    assert.deepEqual(meshInParent(stored, [25, 30])!.points[2], [225, 30]);
    const legacy = stored.slice(4).split(";").map((part, i) => (i === 0 ? part : part.split(",").map((v, k) => Number(v) + (k === 0 ? 20 : 30)).join(","))).join(";");
    assert.deepEqual(meshInParent(legacy, [20, 30])!.points, m.points);
  });
});

describe("old absolute pins heal when their layer moves", () => {
  it("rewrites an old pin and mesh relative to where the layer was, and leaves relative ones alone", async () => {
    const { relativizeLegacyPoints } = await import("../cornerPin");
    const out = relativizeLegacyPoints({ "frame.x": 100, "frame.y": 50, "transform.pin": "100,50,300,60,310,200,90,190", "transform.mesh": "2,2;100,50;300,50;100,150;300,150" });
    assert.equal(out["transform.pin"], "rel:0,0,200,10,210,150,-10,140");
    assert.equal(out["transform.mesh"], "rel:2,2;0,0;200,0;0,100;200,100");
    assert.deepEqual(relativizeLegacyPoints({ "frame.x": 5, "transform.pin": "rel:0,0,1,0,1,1,0,1" }), {});
  });
});
