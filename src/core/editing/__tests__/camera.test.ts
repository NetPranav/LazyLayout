/**
 * ROADMAP Phase 129: the depth camera. A space's camera moves the world the other way after its view (so layers
 * further away move less); the projection formula; depth of field blurs each layer by its distance from the focus, on
 * the stage's path and the export's alike.
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
import { depthBlur } from "../../render/geometry";
import { cameraProject, makeSpace, setCamera, setDepth } from "../spaceOps";

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["s"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "s", archetype: "container", parentId: "pg", name: "Scene", children: ["near", "far"], properties: { positioning: "absolute", "frame.width": 400, "frame.height": 300 } }) as Layer,
      createLayer({ id: "near", archetype: "rectangle", parentId: "s", name: "Near", properties: { positioning: "absolute", "frame.width": 50, "frame.height": 50 } }) as Layer,
      createLayer({ id: "far", archetype: "rectangle", parentId: "s", name: "Far", properties: { positioning: "absolute", "frame.width": 50, "frame.height": 50 } }) as Layer,
    ]),
  ),
);
const draw = (id: string) => renderToStaticMarkup(createElement(RenderLayer, { layerId: id, layers: getDocument().layers }));

describe("Phase 129: the depth camera", () => {
  it("the camera moves the world the other way, after the view", () => {
    makeSpace(["s"], 800);
    assert.ok(setCamera("s", { x: 40, y: -20, z: 100 }));
    assert.match(draw("s"), /transform:perspective\(800px\) translate3d\(-40px, 20px, 100px\)/);
    assert.equal(setCamera("near", { x: 5 }), false, "only a space has a camera");
  });

  it("the projection formula: further back moves less; a dolly brings everything closer", () => {
    const vp = { x: 200, y: 150 };
    const at = (z: number, cam: { x: number; y: number; z: number }) => cameraProject({ x: 300, y: 150 }, z, vp, 800, cam);
    const pan = { x: 80, y: 0, z: 0 };
    const nearMove = at(200, { x: 0, y: 0, z: 0 }).x - at(200, pan).x;
    const farMove = at(-600, { x: 0, y: 0, z: 0 }).x - at(-600, pan).x;
    assert.ok(nearMove > 80 && farMove < 80 && farMove > 0, `${nearMove} near, ${farMove} far`);
    assert.ok(at(0, { x: 0, y: 0, z: 200 }).x > at(0, { x: 0, y: 0, z: 0 }).x, "closer is bigger: further from the vanishing point");
  });

  it("depth of field: each layer blurs by its distance from the focus, times the aperture per 100 px", () => {
    makeSpace(["s"]);
    setDepth(["near"], { z: 150 });
    setDepth(["far"], { z: -350 });
    setCamera("s", { focus: 150, aperture: 2 });
    assert.equal(depthBlur(-350, { focus: 150, aperture: 2 }), 10);
    const html = draw("s");
    assert.match(html, /data-element-id="far"[^>]*filter:blur\(10px\)/);
    assert.doesNotMatch(html, /data-element-id="near"[^>]*filter:blur/, "in focus: sharp");
    setCamera("s", { aperture: 0 });
    assert.doesNotMatch(draw("s"), /filter:blur/, "no aperture: everything sharp");
  });
});
