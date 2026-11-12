import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import { evaluate } from "../evaluate";
import { matteShapePath, matteSourceShape, canvasOrigin } from "../../geometry/matteShape";
import { animatedLayers, animatedPaths, styleWrites } from "../../engine/stage/styleWrites";
import { layerBoxStyle } from "../../render/geometry";
import { resolveProps } from "../../render/resolve";

const box = (id: string, parentId: string | null, properties: Layer["properties"] = {}, archetype: Layer["archetype"] = "container"): Layer =>
  createLayer({ id, archetype, parentId, children: [], properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 100, "frame.height": 100, ...properties } }) as Layer;

const scene = (extra: { source?: Layer["properties"]; target?: Layer["properties"]; sourceArchetype?: Layer["archetype"]; clips?: ReturnType<typeof attachClip>[] } = {}): MotionDocument => {
  const root = createLayer({ id: "root", archetype: "container", parentId: null, children: ["target", "source"], properties: { "frame.width": 800, "frame.height": 400 } }) as Layer;
  const target = box("target", "root", { "frame.x": 80, "frame.y": 40, "frame.width": 200, "frame.height": 100, "matte.source": "source", "matte.mode": "alpha", ...extra.target });
  const source = box("source", "root", { "frame.x": 100, "frame.y": 50, "frame.width": 60, "frame.height": 40, ...extra.source }, extra.sourceArchetype ?? "container");
  return createDocumentFromLayers([root, target, source], extra.clips ?? []);
};
const ev = (doc: MotionDocument, id: string, t = 0) => evaluate(doc, "comp_main", id, t);
const num = (s: string) => s.match(/-?\d+(?:\.\d+)?/g)!.map(Number);

describe("Phase 74: track mattes (a layer is the mask)", () => {
  it("a box source becomes a path in the target's pixels", () => {
    // the source's corners on the canvas are (100,50)..(160,90); the target starts at (80,40): so (20,10)..(80,50)
    assert.deepEqual(num(ev(scene(), "target")["mask.path"] as string), [20, 10, 80, 10, 80, 50, 20, 50]);
    const resolved = ev(scene(), "target");
    assert.equal(resolved["mask.mode"], "alpha");
    assert.equal(resolved["mask.shape"], "path");
  });

  it("an ellipse source is an ellipse (four curves); a corner radius rounds the box", () => {
    const ellipse = ev(scene({ sourceArchetype: "ellipse" }), "target")["mask.path"] as string;
    assert.equal((ellipse.match(/C/g) ?? []).length, 4);
    assert.equal((ellipse.match(/L/g) ?? []).length, 0);
    const rounded = ev(scene({ source: { "appearance.radius": 10 } }), "target")["mask.path"] as string;
    assert.equal((rounded.match(/C/g) ?? []).length, 4);
    assert.equal((rounded.match(/L/g) ?? []).length, 4);
  });

  it("position, scale and rotation of the source move the matte", () => {
    const moved = num(ev(scene({ source: { "transform.x": 30, "transform.y": 5 } }), "target")["mask.path"] as string);
    assert.deepEqual(moved, [50, 15, 110, 15, 110, 55, 50, 55]);
    // scaled 2x about its centre (130, 70 on canvas = 50, 30 in the target): the box grows to (-10,-10)..(110,70)
    const scaled = num(ev(scene({ source: { "transform.scale": 2 } }), "target")["mask.path"] as string);
    assert.deepEqual(scaled, [-10, -10, 110, -10, 110, 70, -10, 70]);
    // a quarter turn about its centre: a 60 x 40 box becomes 40 wide, 60 tall, around (50, 30)
    const turned = num(ev(scene({ source: { "frame.rotation": 90 } }), "target")["mask.path"] as string).map((n) => Math.round(n));
    assert.deepEqual(turned, [70, 0, 70, 60, 30, 60, 30, 0]);
  });

  it("an animated source animates the matte, at any time, to the pixel", () => {
    const clip = attachClip(hydrateClip({ name: "Wipe", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property: "transform.x", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 100 }] }] }), "source");
    const doc = scene({ clips: [clip] });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [x0] = num(ev(doc, "target", t)["mask.path"] as string);
      assert.ok(Math.abs(x0 - (20 + 100 * t)) < 1e-6, `at ${t}: ${x0}`);
    }
  });

  it("the source is hidden, unless a layer using it says to show it", () => {
    assert.equal(ev(scene(), "source")["appearance.opacity"], 0);
    assert.equal(ev(scene({ target: { "matte.showSource": true } }), "source")["appearance.opacity"], undefined);
    assert.equal(ev(scene(), "target")["appearance.opacity"], undefined, "the target is not hidden");
  });

  it("alpha, luma and inverted modes carry through, and a luma matte brings the source's colour and opacity", () => {
    const luma = ev(scene({ target: { "matte.mode": "lumaInverted" }, source: { "appearance.background.color": "#808080", "appearance.opacity": 0.5 } }), "target");
    assert.equal(luma["mask.mode"], "lumaInverted");
    assert.equal(luma["mask.fill"], "#808080");
    assert.equal(luma["mask.opacity"], 0.5);
    assert.equal(ev(scene({ target: { "matte.mode": "none" } }), "target")["mask.mode"], undefined, "mode none: no matte");
  });

  it("a source the geometry can't read gives no matte, and the source stays visible", () => {
    const flow = scene({ source: { positioning: "flow" } });
    assert.equal(ev(flow, "target")["mask.path"], undefined);
    assert.equal(ev(flow, "source")["appearance.opacity"], undefined);
    assert.equal(ev(scene({ target: { "matte.source": "nobody" } }), "target")["mask.path"], undefined);
    assert.equal(ev(scene({ source: { "frame.width": 0 } }), "target")["mask.path"], undefined);
    assert.equal(ev(scene({ target: { "matte.source": "target" } }), "target")["mask.path"], undefined, "a layer can't be its own matte");
  });

  it("two layers that matte each other don't loop", () => {
    const doc = scene({ source: { "matte.source": "target", "matte.mode": "alpha" } });
    assert.equal(typeof ev(doc, "target")["mask.path"], "string");
    assert.equal(typeof ev(doc, "source")["mask.path"], "string");
  });

  it("measures the source on the canvas through its ancestors, and refuses a flow ancestor", () => {
    const root = createLayer({ id: "root", archetype: "container", parentId: null, children: ["group", "target"], properties: { "frame.width": 800 } }) as Layer;
    const group = createLayer({ id: "group", archetype: "container", parentId: "root", children: ["inner"], properties: { positioning: "absolute", "frame.x": 200, "frame.y": 100, "frame.width": 300, "frame.height": 200 } }) as Layer;
    const inner = box("inner", "group", { "frame.x": 10, "frame.y": 20, "frame.width": 50, "frame.height": 50 });
    const target = box("target", "root", { "frame.x": 0, "frame.y": 0, "matte.source": "inner", "matte.mode": "alpha" });
    const doc = createDocumentFromLayers([root, group, inner, target], []);
    assert.deepEqual(canvasOrigin(doc.layers, "inner", (id) => doc.layers[id].properties as never), { x: 210, y: 120 });
    assert.deepEqual(num(ev(doc, "target")["mask.path"] as string), [210, 120, 260, 120, 260, 170, 210, 170]);
    const flowGroup = createDocumentFromLayers([root, { ...group, properties: { ...group.properties, positioning: "flow" } } as Layer, inner, target], []);
    assert.equal(canvasOrigin(flowGroup.layers, "inner", (id) => flowGroup.layers[id].properties as never), null);
  });

  it("a document with no mattes is evaluated as before", () => {
    const plain = createDocumentFromLayers([createLayer({ id: "root", archetype: "container", parentId: null, children: [], properties: {} }) as Layer], []);
    assert.deepEqual(Object.keys(ev(plain, "root")).filter((k) => k.startsWith("mask.")), []);
  });

  it("the engine plans the target and the source, and writes the mask the render definition would draw", () => {
    const doc = scene();
    const planned = animatedLayers(doc);
    assert.ok(planned.get("target")!.has("mask.path"));
    assert.ok(planned.get("source")!.has("appearance.opacity"));
    assert.ok(animatedPaths(doc, "target").has("mask.path"));
    const resolved = ev(doc, "target");
    const written = styleWrites(["mask.path"], resolved);
    const still = { ...doc.layers.target, properties: { ...doc.layers.target.properties, ...resolved } } as Layer;
    assert.equal(written["mask-image"], (layerBoxStyle(still, resolveProps(still), {}) as Record<string, unknown>).maskImage);
    assert.equal(styleWrites(["appearance.opacity"], ev(doc, "source"))["opacity"], "0");
  });

  it("the shape maths on its own: a unit box, scaled and turned", () => {
    const shape = matteSourceShape(scene().layers, "source", (id) => scene().layers[id].properties as never)!;
    assert.deepEqual([shape.cx, shape.cy, shape.width, shape.height, shape.ellipse], [130, 70, 60, 40, false]);
    // a half turn about its centre (50, 30 in the target) maps the box onto itself, starting from the opposite corner
    assert.deepEqual(num(matteShapePath({ ...shape, rotation: 180 }, { x: 80, y: 40 })).map(Math.round), [80, 50, 20, 50, 20, 10, 80, 10]);
  });
});
