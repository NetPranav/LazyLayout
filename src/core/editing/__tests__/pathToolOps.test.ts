/**
 * ROADMAP Phase 106 on real documents: each path operation through its command, one undo step each.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { layerCanvasArea } from "../shapeBuilder";
import { divideLayers, joinLayers, knifeLayers, offsetLayers, reverseLayers, simplifyLayers, smoothLayers } from "../pathToolOps";

const rect = (id: string, x: number, y: number, w: number, h: number, fill: string): Layer =>
  createLayer({ id, archetype: "rectangle", parentId: "pg", name: id, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h, "svg.fill": fill } }) as Layer;
/** An open path: a 200 × 200 unit-space line from the left to the right of its frame. */
const line = (id: string, x: number, y: number, w: number): Layer =>
  createLayer({ id, archetype: "svgPath", parentId: "pg", name: id, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": 20, "svg.path": "M0 100 C60 0 140 0 200 100", "svg.fill": "none", "svg.stroke": "#000000", "svg.strokeWidth": 2 } }) as Layer;

const doc = (layers: Layer[]) =>
  createDocumentFromLayers([
    createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: layers.map((l) => l.id), properties: { "frame.x": 0, "frame.y": 0, "frame.width": 800, "frame.height": 600 } }) as Layer,
    ...layers,
  ]);

const L = () => getDocument().layers;
const area = (id: string) => Math.abs(layerCanvasArea(id)?.path.area() ?? 0);
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(2)}, expected ${want}`);

/** The operations behind the `vector.*` commands (registering every edit command needs a browser window). */
const run = (id: string, a: { ids: string[]; distance?: number; join?: "round" | "miter" | "bevel"; points?: [number, number][]; strength?: number }): Record<string, unknown> => {
  switch (id) {
    case "vector.offset": return { changed: offsetLayers(a.ids, a.distance!, a.join) };
    case "vector.knife": return { ids: knifeLayers(a.ids, a.points!.map(([x, y]) => ({ x, y }))) };
    case "vector.divide": return { ids: divideLayers(a.ids) };
    case "vector.join": return { id: joinLayers(a.ids) };
    case "vector.reverse": return { changed: reverseLayers(a.ids) };
    case "vector.simplify": return { changed: simplifyLayers(a.ids, a.strength ?? 0.5) };
    case "vector.smooth": return { changed: smoothLayers(a.ids, a.strength ?? 0.5) };
  }
  throw new Error(id);
};

describe("Phase 106: path operations on layers", () => {
  beforeEach(() => {
    setDocument(doc([rect("a", 0, 0, 100, 60, "#ff0000"), rect("b", 50, 30, 100, 60, "#0000ff"), line("p", 300, 0, 100), line("q", 410, 0, 100)]));
    useSelectionStore.getState().clearSelection();
  });

  it("offset grows a rectangle by 10 with mitre corners, and undo gives it back", () => {
    const r = run("vector.offset", { ids: ["a"], distance: 10, join: "miter" });
    const [id] = r.changed as string[];
    near(area(id), 120 * 80, 1, "grown");
    historyCommands.undo();
    assert.equal(L().a.archetype, "rectangle");
    near(area("a"), 6000, 1e-6, "after undo");
  });

  it("a knife across a rectangle leaves two layers that add up to it", () => {
    const r = run("vector.knife", { ids: ["a"], points: [[50, -20], [50, 80]] });
    const pieces = r.ids as string[];
    assert.equal(pieces.length, 2);
    near(area(pieces[0]) + area(pieces[1]), 6000, 1, "pieces");
    near(area(pieces[0]), 3000, 1, "half");
    historyCommands.undo();
    assert.ok(L().a && L().a.archetype === "rectangle");
  });

  it("divide cuts two overlapping rectangles into three layers and removes them", () => {
    const r = run("vector.divide", { ids: ["a", "b"] });
    const pieces = r.ids as string[];
    assert.equal(pieces.length, 3);
    assert.equal(L().a, undefined);
    const areas = pieces.map(area).sort((x, y) => x - y);
    near(areas[0], 50 * 30, 1, "overlap");
    near(areas[1] + areas[2], 2 * 6000 - 2 * 1500, 1, "the rest");
    // the overlap takes the top shape's colour
    const overlap = pieces.find((id) => Math.abs(area(id) - 1500) < 1)!;
    assert.equal(L()[overlap].properties["svg.fill"], "#0000ff");
    historyCommands.undo();
    assert.ok(L().a && L().b);
  });

  it("join makes two open paths one, and reverse flips which end it starts at", () => {
    const r = run("vector.join", { ids: ["p", "q"] });
    assert.equal(r.id, "p");
    assert.equal(L().q, undefined);
    const d = String(L().p.properties["svg.path"]);
    assert.equal((d.match(/M/g) ?? []).length, 1, d);
    const before = d.trim().split(/[\s,]+/).slice(1, 3).join(" ");
    run("vector.reverse", { ids: ["p"] });
    const after = String(L().p.properties["svg.path"]).trim().split(/[\s,]+/).slice(1, 3).join(" ");
    assert.notEqual(after, before, "starts at the other end");
    historyCommands.undo();
    historyCommands.undo();
    assert.ok(L().q, "two undo steps give both paths back");
  });

  it("simplify and smooth keep a rectangle's area (it has nothing to drop) and change an open path in place", () => {
    run("vector.simplify", { ids: ["a"], strength: 1 });
    near(area(Object.keys(L()).find((k) => k !== "pg" && k !== "b" && k !== "p" && k !== "q")!), 6000, 1, "simplified rectangle");
    const r = run("vector.smooth", { ids: ["p"], strength: 0.5 });
    assert.deepEqual(r.changed, ["p"]);
    assert.equal(L().p.archetype, "svgPath");
  });
});
