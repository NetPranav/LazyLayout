import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayer } from "@/core/document/factories";
import type { Layer } from "@/core/document/schema";
import { marqueeHits, type MarqueeBox } from "../marquee";

const layer = (id: string, parentId: string | null, extra: Partial<Layer> = {}): Layer =>
  ({ ...createLayer({ id, archetype: id.startsWith("f") ? "container" : "rectangle", parentId, name: id }), ...extra }) as Layer;
const box = (id: string, x: number, y: number, width: number, height: number, locked = false): MarqueeBox => ({ id, x, y, width, height, locked });

// page > frame f1 (holds a, b) and f2 (empty); loose c on the page
const layers: Record<string, Layer> = {
  root: layer("root", null),
  f1: layer("f1", "root"),
  a: layer("a", "f1"),
  b: layer("b", "f1"),
  f2: layer("f2", "root"),
  c: layer("c", "root"),
};
layers.root.children = ["f1", "f2", "c"];
layers.f1.children = ["a", "b"];
const boxes = [box("f1", 0, 0, 400, 400), box("a", 20, 20, 50, 50), box("b", 120, 20, 50, 50), box("f2", 500, 0, 200, 200), box("c", 800, 20, 50, 50)];
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe("marquee selection", () => {
  it("picks what is inside frames, not the frame that holds it", () => {
    assert.deepEqual(marqueeHits(layers, boxes, rect(0, 0, 900, 100), null).sort(), ["a", "b", "c", "f2"]);
  });
  it("picks the frame itself when only its empty part is swept", () => {
    assert.deepEqual(marqueeHits(layers, boxes, rect(300, 300, 350, 350), null), ["f1"]);
    assert.deepEqual(marqueeHits(layers, boxes, rect(520, 20, 560, 60), null), ["f2"]);
  });
  it("picks one of two siblings when only one is touched, and the frame is left out", () => {
    assert.deepEqual(marqueeHits(layers, boxes, rect(10, 10, 80, 80), null), ["a"]);
  });
  it("a drag that started in a frame picks only what is in it", () => {
    assert.deepEqual(marqueeHits(layers, boxes, rect(0, 0, 900, 100), "f1").sort(), ["a", "b"]);
  });
  it("leaves out locked layers, hidden ones and ones inside hidden frames", () => {
    assert.deepEqual(marqueeHits(layers, boxes.map((b) => (b.id === "a" ? { ...b, locked: true } : b)), rect(0, 0, 900, 100), null).sort(), ["b", "c", "f2"]);
    assert.deepEqual(marqueeHits({ ...layers, c: { ...layers.c, visible: false } }, boxes, rect(790, 0, 900, 100), null), []);
    assert.deepEqual(marqueeHits({ ...layers, f1: { ...layers.f1, visible: false } }, boxes, rect(0, 0, 450, 100), null), []);
  });
  it("leaves out boxes with no size, and a box it only touches along an edge", () => {
    assert.deepEqual(marqueeHits(layers, [...boxes, box("z", 10, 10, 0, 0)], rect(0, 0, 20, 20), null), ["f1"]);
    assert.deepEqual(marqueeHits(layers, boxes, rect(70, 20, 120, 70), null), ["f1"], "between a and b: only the frame");
  });
});
