/**
 * ROADMAP Phase 127: 2.5D spaces. A frame made a space draws `perspective()` and its viewing angle around its
 * vanishing point and keeps its children's depth (`preserve-3d`); a child's depth and tilt are its own transform; the
 * space flattens again; depth projects towards the vanishing point as the formula says.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { RenderLayer } from "../../render/RenderLayer";
import { isSpace, makeSpace, projectAtDepth, releaseSpace, setDepth, setSpace, spaceOf, vanishingPoint } from "../spaceOps";

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["s"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "s", archetype: "container", parentId: "pg", name: "Space", children: ["a", "b"], properties: { positioning: "absolute", "frame.width": 400, "frame.height": 300 } }) as Layer,
      createLayer({ id: "a", archetype: "rectangle", parentId: "s", name: "A", properties: { positioning: "absolute", "frame.width": 100, "frame.height": 80 } }) as Layer,
      createLayer({ id: "b", archetype: "rectangle", parentId: "s", name: "B", properties: { positioning: "absolute", "frame.x": 200, "frame.width": 100, "frame.height": 80 } }) as Layer,
    ]),
  ),
);
const draw = (id: string) => renderToStaticMarkup(createElement(RenderLayer, { layerId: id, layers: getDocument().layers }));

describe("Phase 127: 2.5D spaces", () => {
  it("a frame made a space: perspective and its viewing angle around the vanishing point, children kept in depth", () => {
    assert.equal(makeSpace(["s", "a"]), 1, "only frames and groups");
    assert.ok(isSpace(getDocument().layers.s));
    assert.equal(spaceOf("a"), "s");
    assert.ok(setSpace("s", { perspective: 700, vanishX: 25, vanishY: 60, viewX: 15, viewY: -20 }));
    assert.deepEqual(vanishingPoint(getDocument().layers.s), { x: 25, y: 60 });
    const html = draw("s");
    assert.match(html, /transform:perspective\(700px\) rotateX\(15deg\) rotateY\(-20deg\)/);
    assert.match(html, /transform-style:preserve-3d/);
    assert.match(html, /transform-origin:25% 60%/);
  });

  it("a child's depth and tilt are its own transform; outside a space, depth does nothing", () => {
    makeSpace(["s"]);
    assert.equal(setDepth(["a"], { z: 150, tiltX: 10 }), 1);
    assert.match(draw("a"), /transform:rotateX\(10deg\) translateZ\(150px\)/);
    assert.equal(setDepth(["s"], { z: 50 }), 0, "the space itself isn't in a space");
  });

  it("flattened again, the space's settings go and its children keep theirs", () => {
    makeSpace(["s"]);
    setSpace("s", { viewX: 10 });
    setDepth(["b"], { z: -80 });
    assert.equal(releaseSpace(["s"]), 1);
    assert.equal(isSpace(getDocument().layers.s), false);
    for (const k of ["transform.perspective", "transform.style3d", "transform.origin", "transform.rotateX"]) assert.equal(getDocument().layers.s.properties[k], undefined, k);
    assert.equal(getDocument().layers.b.properties["transform.translateZ"], -80);
  });

  it("depth projects towards the vanishing point: closer is further out, further back is pulled in", () => {
    const vp = { x: 200, y: 150 };
    assert.deepEqual(projectAtDepth({ x: 300, y: 150 }, 0, vp, 900), { x: 300, y: 150 });
    assert.deepEqual(projectAtDepth({ x: 300, y: 150 }, 450, vp, 900), { x: 400, y: 150 });
    assert.deepEqual(projectAtDepth({ x: 300, y: 250 }, -900, vp, 900), { x: 250, y: 200 });
  });
});
