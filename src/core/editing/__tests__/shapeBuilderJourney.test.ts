/**
 * ROADMAP Phase 105: the Shape Builder, a 12-step journey on three overlapping circles, with the area and the node
 * count of every result. Since Phase 103 the pieces are curves, so a lens between two circles is two arcs, not a
 * polygon.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { layerOutline, toParent } from "../layerOutline";
import { arrangement, buildShapes, regionAt } from "../shapeBuilder";

const R = 50;
const circle = (id: string, cx: number, cy: number, fill: string): Layer =>
  createLayer({ id, archetype: "ellipse", parentId: "pg", name: id, properties: { positioning: "absolute", "frame.x": cx - R, "frame.y": cy - R, "frame.width": 2 * R, "frame.height": 2 * R, "svg.fill": fill } }) as Layer;

const L = () => getDocument().layers;
const outline = (id: string) => toParent(layerOutline(L()[id], L())!.path, L()[id]);
const area = (id: string) => Math.abs(outline(id).area());
const curves = (id: string) => outline(id).els.filter((e) => e.t === "C").length;
/** Straight pieces a person could see (a stored path may close with a joint of no length). */
const lines = (id: string) => {
  let prev = { x: 0, y: 0 };
  let n = 0;
  for (const e of outline(id).els) {
    if (e.t === "L" && Math.hypot(e.p.x - prev.x, e.p.y - prev.y) > 0.01) n++;
    if (e.t === "M" || e.t === "L") prev = e.p;
    else if (e.t === "C") prev = e.p3;
  }
  return n;
};
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(2)}, expected ${want.toFixed(2)}`);

/** The lens two circles of radius r make when their centres are d apart. */
const lens = (d: number, r = R) => 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);


describe("Phase 105: a 12-step Shape Builder journey", () => {
  it("three circles: regions, merge, remove, undo and redo, with areas and node counts", () => {
    // A and B are 60 apart on a line; C sits below, 58.31 from each
    setDocument(
      createDocumentFromLayers([
        createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["a", "b", "c"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 800, "frame.height": 600 } }) as Layer,
        circle("a", 100, 100, "#ff0000"),
        circle("b", 160, 100, "#00ff00"),
        circle("c", 130, 150, "#0000ff"),
      ]),
    );
    useSelectionStore.getState().selectMultiple(["a", "b", "c"], "element");
    const dAC = Math.hypot(30, 50);
    // a circle drawn with four curves is a hair larger than the true disc, so its own area is the reference
    const DISC = area("a");

    // 1. three circles cut the canvas into seven regions
    const arr = arrangement(["a", "b", "c"]);
    assert.equal(arr.regions.length, 7);

    // 2. their areas add up to the union, and each pair's regions add up to its lens
    const total = arr.regions.reduce((s, r) => s + Math.abs(r.path.area()), 0);
    const centre = regionAt(arr, { x: 130, y: 118 })!;
    assert.deepEqual([...arr.regions[centre].sources].sort(), ["a", "b", "c"]);
    const triple = Math.abs(arr.regions[centre].path.area());
    const pair = (x: string, y: string) => arr.regions.filter((r) => r.sources.includes(x) && r.sources.includes(y)).reduce((s, r) => s + Math.abs(r.path.area()), 0);
    near(pair("a", "b"), lens(60), 1.5, "A∩B");
    near(pair("a", "c"), lens(dAC), 1.5, "A∩C");
    near(total, 3 * DISC - lens(60) - 2 * lens(dAC) + triple, 3, "union");

    // 3. every region is made of arcs: no straight piece, and no more than a dozen curves
    for (const r of arr.regions) {
      assert.equal(r.path.els.filter((e) => e.t === "L").length, 0, "a region of circles has no straight side");
      const n = r.path.els.filter((e) => e.t === "C").length;
      assert.ok(n >= 3 && n <= 12, `curves in a region: ${n}`);
    }

    // 4. click the middle: it becomes a shape of its own, a triangle of three arcs
    const mid = buildShapes(["a", "b", "c"], { points: [{ x: 130, y: 118 }] }, true)!;
    near(area(mid.created!), triple, 0.5, "the middle");
    assert.ok(curves(mid.created!) >= 3 && curves(mid.created!) <= 6, `curves: ${curves(mid.created!)}`);
    assert.equal(lines(mid.created!), 0);
    assert.equal(L()[mid.created!].properties["svg.fill"], "#0000ff", "styled like the top-most circle over it");

    // 5. each circle lost the middle and nothing else
    assert.equal(mid.changed.length, 3);
    for (const id of mid.changed) near(area(id), DISC - triple, 2, `what is left of ${id}`);

    // 6. undo gives the three circles back, redo the four shapes
    historyCommands.undo();
    assert.equal(L().a.archetype, "ellipse");
    near(area("a"), DISC, 0.5, "A after undo");
    historyCommands.redo();
    assert.ok(L()[mid.created!], "redo brings the middle back");

    // 7. drag across two regions (only A, and A with B) and they merge into one shape
    const now = [...mid.changed, mid.created!];
    useSelectionStore.getState().selectMultiple(now, "element");
    const arr2 = arrangement(now);
    const onlyA = regionAt(arr2, { x: 62, y: 90 })!;
    const ab = regionAt(arr2, { x: 130, y: 72 })!;
    assert.notEqual(onlyA, ab);
    const want = Math.abs(arr2.regions[onlyA].path.area()) + Math.abs(arr2.regions[ab].path.area());
    const merged = buildShapes(now, { points: [{ x: 62, y: 90 }, { x: 96, y: 80 }, { x: 130, y: 72 }] }, true)!;
    near(area(merged.created!), want, 2, "the merged shape");
    assert.equal(lines(merged.created!), 0);
    assert.ok(curves(merged.created!) <= 12, `curves: ${curves(merged.created!)}`);

    // 8. Alt-drag over what is left of B alone removes it
    const sel3 = useSelectionStore.getState().selectedIds;
    const arr3 = arrangement(sel3);
    const onlyB = regionAt(arr3, { x: 198, y: 90 })!;
    const gone = Math.abs(arr3.regions[onlyB].path.area());
    const before = sel3.reduce((s, id) => s + area(id), 0);
    const removed = buildShapes(sel3, { points: [{ x: 198, y: 90 }] }, false)!;
    assert.equal(removed.created, null);

    // 9. the drawing lost exactly that region's area, once for every layer that covered it
    const sel4 = useSelectionStore.getState().selectedIds;
    const after = sel4.reduce((s, id) => s + area(id), 0);
    near(before - after, gone * arr3.regions[onlyB].sources.length, 2, "area removed");

    // 10. merge everything that is left into one shape
    const arr4 = arrangement(sel4);
    const rest = arr4.regions.reduce((s, r) => s + Math.abs(r.path.area()), 0);
    const all = buildShapes(sel4, { regions: arr4.regions.map((_, i) => i) }, true)!;
    near(area(all.created!), rest, 2, "everything merged");
    near(rest, total - gone, 4, "the union less the removed region");

    // 11. one shape is left, selected, and its outline is a few arcs
    assert.deepEqual(useSelectionStore.getState().selectedIds, [all.created]);
    assert.equal(L().pg.children.length, 1);
    assert.equal(lines(all.created!), 0);
    assert.ok(curves(all.created!) <= 20, `curves in the final outline: ${curves(all.created!)}`);

    // 12. four undo steps bring the three circles back, untouched
    for (let k = 0; k < 4; k++) historyCommands.undo();
    assert.deepEqual(L().pg.children, ["a", "b", "c"]);
    for (const id of ["a", "b", "c"]) {
      assert.equal(L()[id].archetype, "ellipse");
      near(area(id), DISC, 0.5, `${id} at the end`);
    }
  });
});
