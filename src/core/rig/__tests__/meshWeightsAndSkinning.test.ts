import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRigDefinition,
  evaluateRigWorldTransforms,
  computeBindMatrices,
  evaluateSkinnedPoint,
} from "../rigModel";
import {
  triangulateLayerMesh,
  computeAutomaticBoneWeights,
  paintVertexWeightsWithBrush,
  smoothVertexWeights,
  deformMeshLBS,
  deformVectorPathLBS,
} from "../meshWeightsAndSkinning";

const assertClose = (a: number, b: number, eps = 1e-5) => {
  assert.ok(Math.abs(a - b) < eps, `Expected ${a} ≈ ${b}`);
};

describe("Phase 206 · Mesh deformation & weights", () => {
  it("keeps weights summing to 1.0 across auto-weights, brush paint, and Laplacian smooth", () => {
    const rig = createRigDefinition("spine_rig", "Body", "layer_body", [
      { id: "spine_bot", name: "SpineBot", parentId: null, length: 60, restX: 50, restY: 20, restRotationDeg: 90 },
      { id: "spine_top", name: "SpineTop", parentId: "spine_bot", length: 60, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const restWorld = evaluateRigWorldTransforms(rig, {});
    const mesh = triangulateLayerMesh({ x: 30, y: 20, width: 40, height: 120 }, 4);
    assert.equal(mesh.vertices.length, 25);
    assert.equal(mesh.triangles.length, 32);

    const autoW = computeAutomaticBoneWeights(mesh.vertices, rig, restWorld, 4);
    for (const vw of autoW) {
      assertClose(vw.reduce((s, i) => s + i.weight, 0), 1);
    }

    const painted = paintVertexWeightsWithBrush(mesh.vertices, autoW, {
      x: 50,
      y: 30,
      radius: 25,
      boneId: "spine_bot",
      strength: 0.9,
    });
    for (const vw of painted) {
      assertClose(vw.reduce((s, i) => s + i.weight, 0), 1);
    }

    const smoothed = smoothVertexWeights(mesh, painted, 3, 0.5);
    for (const vw of smoothed) {
      assertClose(vw.reduce((s, i) => s + i.weight, 0), 1);
    }

    const bind = computeBindMatrices(rig);
    const posedWorld = evaluateRigWorldTransforms(rig, { spine_top: { rotationDeg: 45 } });
    const deformed = deformMeshLBS(mesh, smoothed, bind, posedWorld);
    for (let i = 0; i < mesh.vertices.length; i++) {
      const ref = evaluateSkinnedPoint(mesh.vertices[i], smoothed[i], bind, posedWorld);
      assert.ok(Math.hypot(deformed[i].x - ref.x, deformed[i].y - ref.y) < 0.5);
    }
  });

  it("deforms crisp SVG vector paths via LBS", () => {
    const rig = createRigDefinition("v_rig", "Vec", "layer_vec", [
      { id: "b0", name: "B0", parentId: null, length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
      { id: "b1", name: "B1", parentId: "b0", length: 50, restX: 0, restY: 0, restRotationDeg: 0 },
    ]);
    const restW = evaluateRigWorldTransforms(rig, {});
    const bind = computeBindMatrices(rig);
    const posedW = evaluateRigWorldTransforms(rig, { b1: { rotationDeg: 90 } });
    const d = deformVectorPathLBS(
      [
        { cmd: "M", points: [{ x: 0, y: 0 }] },
        { cmd: "C", points: [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 100, y: 0 }] },
        { cmd: "Z", points: [] },
      ],
      rig,
      restW,
      bind,
      posedW,
    );
    assert.ok(d.startsWith("M "));
    assert.ok(d.endsWith(" Z"));
    assert.ok(d.includes("C "));
  });
});
