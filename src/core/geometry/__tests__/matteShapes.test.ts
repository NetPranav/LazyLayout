import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MotionDocument } from "../../document/schema";
import { matteShapesPath, matteSourceShapes } from "../matteShape";

type Props = Record<string, unknown>;
function doc(spec: Record<string, { archetype: string; parent: string | null; props: Props; children?: string[]; visible?: boolean }>): MotionDocument["layers"] {
  const layers: Record<string, unknown> = {};
  for (const [id, l] of Object.entries(spec)) layers[id] = { id, name: id, archetype: l.archetype, parentId: l.parent, children: l.children ?? [], properties: l.props, ...(l.visible === false ? { visible: false } : {}) };
  return layers as MotionDocument["layers"];
}
const abs = (x: number, y: number, w: number, h: number, extra: Props = {}): Props => ({ positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h, ...extra });

describe("a matte made of many shapes", () => {
  it("one dot with a grid clone is every dot", () => {
    const layers = doc({
      root: { archetype: "container", parent: null, props: { "frame.width": 400, "frame.height": 400 }, children: ["dot"] },
      dot: { archetype: "ellipse", parent: "root", props: abs(10, 20, 8, 8, { "clone.mode": "grid", "clone.cols": 3, "clone.rows": 2, "clone.gapX": 4, "clone.gapY": 4 }) },
    });
    const shapes = matteSourceShapes(layers, "dot", (id) => layers[id].properties)!;
    assert.equal(shapes.length, 6);
    assert.deepEqual(shapes.map((s) => [s.cx, s.cy]), [[14, 24], [26, 24], [38, 24], [14, 36], [26, 36], [38, 36]]);
    assert.ok(shapes.every((s) => s.ellipse));
  });

  it("a dot filling its frame covers the frame", () => {
    const layers = doc({
      root: { archetype: "container", parent: null, props: {}, children: ["area"] },
      area: { archetype: "container", parent: "root", props: abs(0, 0, 120, 60), children: ["dot"] },
      dot: { archetype: "ellipse", parent: "area", props: abs(0, 0, 10, 10, { "clone.mode": "fill", "clone.gapX": 2, "clone.gapY": 2 }) },
    });
    const shapes = matteSourceShapes(layers, "area", (id) => layers[id].properties)!;
    assert.equal(shapes.length, 10 * 5);
  });

  it("a group is everything in it, moved with it, leaving hidden layers out", () => {
    const layers = doc({
      root: { archetype: "container", parent: null, props: {}, children: ["g"] },
      g: { archetype: "container", parent: "root", props: abs(100, 100, 300, 300, { "transform.x": 50 }), children: ["a", "b", "hidden"] },
      a: { archetype: "ellipse", parent: "g", props: abs(0, 0, 20, 20) },
      b: { archetype: "rectangle", parent: "g", props: abs(40, 0, 20, 20, { "appearance.radius": 4 }) },
      hidden: { archetype: "rectangle", parent: "g", props: abs(80, 0, 20, 20), visible: false },
    });
    const shapes = matteSourceShapes(layers, "g", (id) => layers[id].properties)!;
    assert.deepEqual(shapes.map((s) => [s.cx, s.cy, s.ellipse]), [[160, 110, true], [200, 110, false]]);
    const d = matteShapesPath(shapes, { x: 0, y: 0 });
    assert.equal((d.match(/M/g) ?? []).length, 2, "two outlines in one path");
    assert.match(d, /^M150 110a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z M /, "a dot is two short arcs");
  });

  it("an empty frame is still its own box, as before", () => {
    const layers = doc({
      root: { archetype: "container", parent: null, props: {}, children: ["f"] },
      f: { archetype: "container", parent: "root", props: abs(10, 10, 50, 40), children: [] },
    });
    const shapes = matteSourceShapes(layers, "f", (id) => layers[id].properties)!;
    assert.deepEqual(shapes.map((s) => [s.cx, s.cy, s.width]), [[35, 30, 50]]);
  });
});
