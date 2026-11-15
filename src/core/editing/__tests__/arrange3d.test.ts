/**
 * ROADMAP Phase 128: 3D arrangements. Every placement, drawn the way a layer draws its transform (turn, then depth along
 * the turned face, about its centre), puts the item's centre exactly where the arrangement says; rings keep items
 * upright and turned to face out, in or at the viewer; spheres and domes sit on their radius; arranging a group makes
 * it a 3D space and leaves each child its own layer.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { ARRANGEMENTS, arrange3d, arrangement, placementProps } from "../arrange3d";
import { isSpace } from "../spaceOps";

const DEG = Math.PI / 180;
/** Where the item's centre ends up: its frame centre, plus its depth along the face `rotateX(a) rotateY(b)` turns to. */
function centreOf(props: Record<string, number>, w: number, h: number, centre: { x: number; y: number }) {
  const a = props["transform.rotateX"] * DEG;
  const b = props["transform.rotateY"] * DEG;
  const t = props["transform.translateZ"];
  const n = { x: Math.sin(b), y: -Math.sin(a) * Math.cos(b), z: Math.cos(a) * Math.cos(b) };
  return { x: props["frame.x"] + w / 2 - centre.x + t * n.x, y: props["frame.y"] + h / 2 - centre.y + t * n.y, z: t * n.z };
}

describe("Phase 128: 3D arrangements", () => {
  it("every arrangement, facing every way, puts each item's centre where it says", () => {
    const c = { x: 300, y: 250 };
    for (const kind of ARRANGEMENTS)
      for (const facing of ["outward", "centre", "viewer"] as const) {
        const places = arrangement(kind, 12, { radius: 200, spacing: 50, facing });
        assert.equal(places.length, 12);
        for (const pl of places) {
          const got = centreOf(placementProps(pl, c, 80, 60), 80, 60, c);
          for (const k of ["x", "y", "z"] as const) assert.ok(Math.abs(got[k] - pl.p[k]) < 0.01, `${kind}/${facing} ${k}: ${got[k]} vs ${pl.p[k]}`);
        }
      }
  });

  it("a ring of 6 facing out: upright, turned every 60°, on its radius; facing in, turned round; at the viewer, straight on", () => {
    const out = arrangement("ring", 6, { radius: 300 }).map((p) => placementProps(p, { x: 0, y: 0 }, 100, 100));
    assert.deepEqual(out.map((p) => Math.round(((p["transform.rotateY"] % 360) + 360) % 360)), [0, 60, 120, 180, 240, 300]);
    assert.ok(out.every((p) => p["transform.rotateX"] === 0 && p["transform.translateZ"] === 300));
    const inward = placementProps(arrangement("ring", 4, { radius: 300, facing: "centre" })[0], { x: 0, y: 0 }, 100, 100);
    assert.equal(Math.abs(inward["transform.rotateY"]), 180);
    assert.equal(inward["transform.translateZ"], -300);
    const viewer = placementProps(arrangement("ring", 4, { radius: 300, facing: "viewer" })[1], { x: 0, y: 0 }, 100, 100);
    assert.deepEqual([viewer["transform.rotateX"], viewer["transform.rotateY"], viewer["frame.x"], viewer["transform.translateZ"]], [0, 0, 250, 0]);
  });

  it("a sphere's items are on its radius, a dome's on its top half; a wall is a flat grid; a stack goes back", () => {
    for (const pl of arrangement("sphere", 20, { radius: 150 })) assert.ok(Math.abs(Math.hypot(pl.p.x, pl.p.y, pl.p.z) - 150) < 1e-9);
    assert.ok(arrangement("dome", 20, { radius: 150 }).every((pl) => pl.p.y <= 1e-9));
    const wall = arrangement("wall", 9, { spacing: 100 });
    assert.deepEqual(wall.map((p) => [p.p.x, p.p.y, p.p.z]).slice(0, 4), [[-100, -100, 0], [0, -100, 0], [100, -100, 0], [-100, 0, 0]]);
    assert.ok(arrangement("stack", 5, { spacing: 40 }).every((p, i) => p.p.z === -i * 40 || (i === 0 && p.p.z === 0)));
  });
});

describe("Phase 128: in the document", () => {
  beforeEach(() =>
    setDocument(
      createDocumentFromLayers([
        createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["g"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
        createLayer({ id: "g", archetype: "container", parentId: "pg", name: "Carousel", children: ["a", "b", "c", "d"], properties: { positioning: "absolute", "frame.width": 600, "frame.height": 400 } }) as Layer,
        ...["a", "b", "c", "d"].map((id) => createLayer({ id, archetype: "rectangle", parentId: "g", name: id, properties: { "frame.width": 100, "frame.height": 140 } }) as Layer),
      ]),
    ),
  );

  it("arranging a group makes it a space; each child is placed, still its own layer", () => {
    assert.equal(arrange3d("g", "ring", { radius: 250 }), 4);
    assert.ok(isSpace(getDocument().layers.g));
    const a = getDocument().layers.a.properties;
    assert.deepEqual([a.positioning, a["frame.x"], a["frame.y"], a["transform.translateZ"]], ["absolute", 250, 130, 250]);
    assert.deepEqual(getDocument().layers.g.children, ["a", "b", "c", "d"]);
    assert.equal(arrange3d("a", "ring"), 0, "a rectangle has no children to arrange");
  });
});
