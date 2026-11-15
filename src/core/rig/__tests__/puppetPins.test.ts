import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { triangulateLayerMesh } from "../meshWeightsAndSkinning";
import {
  deformMeshWithPuppetPins,
  orderTrianglesByPuppetOverlap,
  evaluatePuppetPinsAtTime,
  type PuppetPin,
} from "../puppetPins";

const assertClose = (a: number, b: number, eps = 0.2) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b} (±${eps})`);
};

describe("Phase 209 · Puppet pins (waving flag + stiff area + overlap Z)", () => {
  it("deforms a flag cleanly with 3 pins, preserves stiff anchor, sorts overlap Z, and samples keys", () => {
    const mesh = triangulateLayerMesh({ x: 0, y: 0, width: 200, height: 100 }, 4);
    const restPins: PuppetPin[] = [
      { id: "p_anchor", name: "Pole", restX: 0, restY: 50, x: 0, y: 50, stiffness: 8, overlapZ: 0 },
      { id: "p_mid", name: "Mid", restX: 100, restY: 50, x: 100, y: 50, stiffness: 1, overlapZ: 5 },
      { id: "p_tip", name: "Tip", restX: 200, restY: 50, x: 200, y: 50, stiffness: 1, overlapZ: 10 },
    ];

    const animated = evaluatePuppetPinsAtTime(
      restPins,
      [
        {
          pinId: "p_tip",
          keyframes: [
            { timeSec: 0, x: 200, y: 50 },
            { timeSec: 1, x: 200, y: 10 },
          ],
        },
        {
          pinId: "p_mid",
          keyframes: [
            { timeSec: 0, x: 100, y: 50 },
            { timeSec: 1, x: 100, y: 70 },
          ],
        },
      ],
      0.5,
    );
    assertClose(animated[2].x, 200);
    assertClose(animated[2].y, 30);
    assertClose(animated[1].y, 60);

    const deformed = deformMeshWithPuppetPins(mesh, animated);
    // Find vertex at (0, 50) -> stays anchored due to high stiffness + pin proximity
    const anchorIdx = mesh.vertices.findIndex((v) => v.x === 0 && v.y === 50);
    const tipIdx = mesh.vertices.findIndex((v) => v.x === 200 && v.y === 50);
    assertClose(deformed[anchorIdx].y, 50, 0.05);
    assertClose(deformed[tipIdx].y, 30, 0.25);

    const ordered = orderTrianglesByPuppetOverlap(mesh, animated);
    assert.equal(ordered.length, mesh.triangles.length);
  });
});
