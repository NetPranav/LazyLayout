/**
 * ============================================================================
 * UNIT TESTS: 3D TRANSFORM APPLY & ORIGIN OPERATIONS
 * ============================================================================
 * Phase 3D-008: apply.ts verification
 *   - applyTransform: location, rotation, scale, and all three combined.
 *   - setOriginToGeometry: bounding box center.
 *   - setOriginToPoint: arbitrary world and local points.
 *   - setOriginToCenterOfMass: signed tetrahedra for closed meshes, fallback to
 *     vertex mean for open meshes.
 *   - Invariant: applyTransform and origin changes keep world-space vertices
 *     within 1e-9.
 *   - Shared mesh single-user copy on mutation.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyDocument,
  type MotionDocument,
  type Object3d,
  type Mesh3d,
} from "../../document/schema";
import {
  applyTransform,
  setOriginToCenterOfMass,
  setOriginToGeometry,
  setOriginToPoint,
} from "../apply";
import { worldMatrix } from "../hierarchy";
import { quatFromEuler, transformPoint, vec3 } from "../math";

function assertVerticesNear(
  v1: number[],
  v2: number[],
  epsilon = 1e-9,
  msg = "Vertices differ"
) {
  assert.equal(v1.length, v2.length, `${msg}: length mismatch`);
  for (let i = 0; i < v1.length; i++) {
    const diff = Math.abs(v1[i] - v2[i]);
    if (diff > epsilon) {
      assert.fail(
        `${msg} at coordinate [${i}]: actual=${v1[i]} expected=${v2[i]} diff=${diff} > ${epsilon}`
      );
    }
  }
}

function getWorldVertices(doc: MotionDocument, objectId: string): number[] {
  const obj = doc.objects![objectId];
  const mesh = doc.meshes![obj.dataId!];
  const w = worldMatrix(doc, objectId);
  const out: number[] = [];
  const p = vec3();

  for (let i = 0; i < mesh.positions!.length; i += 3) {
    p[0] = mesh.positions![i];
    p[1] = mesh.positions![i + 1];
    p[2] = mesh.positions![i + 2];
    const wp = transformPoint(w, p);
    out.push(wp[0], wp[1], wp[2]);
  }
  return out;
}

function createSampleCubeMesh(id = "msh_cube"): Mesh3d {
  // A unit cube [-1, 1]^3 with 8 vertices and 12 triangles (closed 2-manifold)
  return {
    id,
    positions: [
      -1, -1, -1, // 0
       1, -1, -1, // 1
       1,  1, -1, // 2
      -1,  1, -1, // 3
      -1, -1,  1, // 4
       1, -1,  1, // 5
       1,  1,  1, // 6
      -1,  1,  1, // 7
    ],
    indices: [
      // Front (+Z)
      4, 5, 6,  4, 6, 7,
      // Back (-Z)
      1, 0, 3,  1, 3, 2,
      // Top (+Y)
      3, 6, 2,  3, 7, 6,
      // Bottom (-Y)
      0, 1, 5,  0, 5, 4,
      // Right (+X)
      1, 2, 6,  1, 6, 5,
      // Left (-X)
      0, 4, 7,  0, 7, 3,
    ],
    normals: [
      -0.577, -0.577, -0.577,
       0.577, -0.577, -0.577,
       0.577,  0.577, -0.577,
      -0.577,  0.577, -0.577,
      -0.577, -0.577,  0.577,
       0.577, -0.577,  0.577,
       0.577,  0.577,  0.577,
      -0.577,  0.577,  0.577,
    ],
  };
}

describe("3D Apply: applyTransform keeps world-space vertices within 1e-9", () => {
  it("applyTransform location bakes translation into vertices and resets location", () => {
    const doc = createEmptyDocument();
    const mesh = createSampleCubeMesh("msh_1");
    const obj: Object3d = {
      id: "obj_1",
      type: "mesh",
      parentId: null,
      dataId: mesh.id,
      transform: {
        location: [10, 20, -5],
        rotationQuat: Array.from(quatFromEuler("XYZ", 0.3, -0.4, 0.5)) as [number, number, number, number],
        scale: [1.5, 2.0, 0.8],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [mesh.id]: mesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_1");

    applyTransform(doc, "obj_1", { location: true });

    // Location is reset to 0
    assert.deepEqual(doc.objects["obj_1"].transform.location, [0, 0, 0]);
    // Rotation and scale remain untouched
    assert.ok(doc.objects["obj_1"].transform.scale[0] === 1.5);

    // World positions of vertices must stay identical within 1e-9
    const afterWorldVerts = getWorldVertices(doc, "obj_1");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "apply location");
  });

  it("applyTransform rotation bakes rotation into vertices/normals and resets rotation", () => {
    const doc = createEmptyDocument();
    const mesh = createSampleCubeMesh("msh_2");
    const obj: Object3d = {
      id: "obj_2",
      type: "mesh",
      parentId: null,
      dataId: mesh.id,
      transform: {
        location: [3, -4, 5],
        rotationQuat: Array.from(quatFromEuler("XYZ", 0.7, 0.8, -0.2)) as [number, number, number, number],
        scale: [1.2, 0.9, 1.8],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [mesh.id]: mesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_2");

    applyTransform(doc, "obj_2", { rotation: true });

    // Rotation is reset to identity
    assert.deepEqual(doc.objects["obj_2"].transform.rotationQuat, [0, 0, 0, 1]);
    assert.deepEqual(doc.objects["obj_2"].transform.location, [3, -4, 5]);

    // World vertices identical within 1e-9
    const afterWorldVerts = getWorldVertices(doc, "obj_2");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "apply rotation");
  });

  it("applyTransform scale bakes scale into vertices and resets scale to 1", () => {
    const doc = createEmptyDocument();
    const mesh = createSampleCubeMesh("msh_3");
    const obj: Object3d = {
      id: "obj_3",
      type: "mesh",
      parentId: null,
      dataId: mesh.id,
      transform: {
        location: [2, 4, 6],
        rotationQuat: Array.from(quatFromEuler("XYZ", -0.2, 0.3, 0.1)) as [number, number, number, number],
        scale: [3, 0.5, 2],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [mesh.id]: mesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_3");

    applyTransform(doc, "obj_3", { scale: true });

    // Scale is reset to [1, 1, 1]
    assert.deepEqual(doc.objects["obj_3"].transform.scale, [1, 1, 1]);

    const afterWorldVerts = getWorldVertices(doc, "obj_3");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "apply scale");
  });

  it("applyTransform with all three bakes entire transform and leaves identity", () => {
    const doc = createEmptyDocument();
    const mesh = createSampleCubeMesh("msh_all");
    const obj: Object3d = {
      id: "obj_all",
      type: "mesh",
      parentId: null,
      dataId: mesh.id,
      transform: {
        location: [15, -25, 35],
        rotationQuat: Array.from(quatFromEuler("YXZ", 0.5, -0.6, 0.7)) as [number, number, number, number],
        scale: [2.5, 1.5, 0.75],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [mesh.id]: mesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_all");

    applyTransform(doc, "obj_all", { location: true, rotation: true, scale: true });

    assert.deepEqual(doc.objects["obj_all"].transform.location, [0, 0, 0]);
    assert.deepEqual(doc.objects["obj_all"].transform.rotationQuat, [0, 0, 0, 1]);
    assert.deepEqual(doc.objects["obj_all"].transform.scale, [1, 1, 1]);

    const afterWorldVerts = getWorldVertices(doc, "obj_all");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "apply all");
  });
});

describe("3D Apply: Origin changes keep world-space vertices within 1e-9", () => {
  it("setOriginToGeometry centers origin on bounding box without moving visual mesh", () => {
    const doc = createEmptyDocument();
    // Offset cube where vertices are [10, 12] on X, [0, 2] on Y, [0, 2] on Z
    const offsetMesh: Mesh3d = {
      id: "msh_off",
      positions: [
        10, 0, 0,
        12, 0, 0,
        12, 2, 0,
        10, 2, 0,
        10, 0, 2,
        12, 0, 2,
        12, 2, 2,
        10, 2, 2,
      ],
      indices: [0, 1, 2, 2, 3, 0],
    };
    const obj: Object3d = {
      id: "obj_geom",
      type: "mesh",
      parentId: null,
      dataId: offsetMesh.id,
      transform: {
        location: [1, 2, 3],
        rotationQuat: Array.from(quatFromEuler("XYZ", 0.2, -0.3, 0.4)) as [number, number, number, number],
        scale: [1.5, 1.2, 0.8],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [offsetMesh.id]: offsetMesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_geom");

    setOriginToGeometry(doc, "obj_geom");

    // The new mesh vertices should now be centered around [0, 0, 0] (range [-1, 1])
    const newMesh = doc.meshes[doc.objects["obj_geom"].dataId!];
    assert.ok(Math.abs(newMesh.positions![0] - -1) < 1e-9);
    assert.ok(Math.abs(newMesh.positions![3] - 1) < 1e-9);

    // World positions remain identical within 1e-9
    const afterWorldVerts = getWorldVertices(doc, "obj_geom");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "origin to geometry");
  });

  it("setOriginToPoint relocates origin to world point and local point without moving visual mesh", () => {
    const doc = createEmptyDocument();
    const mesh = createSampleCubeMesh("msh_pt");
    const obj: Object3d = {
      id: "obj_pt",
      type: "mesh",
      parentId: null,
      dataId: mesh.id,
      transform: {
        location: [5, 5, 5],
        rotationQuat: Array.from(quatFromEuler("XYZ", 0.1, 0.2, 0.3)) as [number, number, number, number],
        scale: [1, 1, 1],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [mesh.id]: mesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_pt");

    // 1. Move origin to World Point [0, 0, 0]
    setOriginToPoint(doc, "obj_pt", [0, 0, 0], { space: "world" });
    const afterWorld1 = getWorldVertices(doc, "obj_pt");
    assertVerticesNear(afterWorld1, initialWorldVerts, 1e-9, "origin to world [0,0,0]");

    // The object's origin (world transform of [0,0,0]) should now be at [0, 0, 0]
    assert.ok(Math.abs(doc.objects["obj_pt"].transform.location[0] - 0) < 1e-9);
    assert.ok(Math.abs(doc.objects["obj_pt"].transform.location[1] - 0) < 1e-9);
    assert.ok(Math.abs(doc.objects["obj_pt"].transform.location[2] - 0) < 1e-9);

    // 2. Move origin to Local Point [1, 1, 1] (corner of cube)
    setOriginToPoint(doc, "obj_pt", [1, 1, 1], { space: "local" });
    const afterWorld2 = getWorldVertices(doc, "obj_pt");
    assertVerticesNear(afterWorld2, initialWorldVerts, 1e-9, "origin to local [1,1,1]");
  });

  it("setOriginToCenterOfMass on closed cube finds volume center via signed tetrahedra", () => {
    const doc = createEmptyDocument();
    // Offset closed cube: original cube shifted by [5, -3, 2]
    const baseCube = createSampleCubeMesh("msh_closed");
    const offsetPositions = baseCube.positions!.map((coord, i) => {
      if (i % 3 === 0) return coord + 5;
      if (i % 3 === 1) return coord - 3;
      return coord + 2;
    });

    const closedMesh: Mesh3d = {
      ...baseCube,
      id: "msh_closed_offset",
      positions: offsetPositions,
    };

    const obj: Object3d = {
      id: "obj_com",
      type: "mesh",
      parentId: null,
      dataId: closedMesh.id,
      transform: {
        location: [10, 0, 0],
        rotationQuat: Array.from(quatFromEuler("XYZ", -0.4, 0.2, 0.6)) as [number, number, number, number],
        scale: [2, 1.5, 3],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [closedMesh.id]: closedMesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_com");

    setOriginToCenterOfMass(doc, "obj_com");

    // The center of mass of the offset cube was at [5, -3, 2], so the new positions
    // should have their center at (0, 0, 0).
    const newMesh = doc.meshes[doc.objects["obj_com"].dataId!];
    // Check that opposite vertices are symmetric around 0: [-1, -1, -1] and [1, 1, 1]
    assert.ok(Math.abs(newMesh.positions![0] - -1) < 1e-9);
    assert.ok(Math.abs(newMesh.positions![18] - 1) < 1e-9);

    const afterWorldVerts = getWorldVertices(doc, "obj_com");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "center of mass closed");
  });

  it("setOriginToCenterOfMass falls back to vertex mean for open meshes", () => {
    const doc = createEmptyDocument();
    // Open quad plane: 4 vertices, 2 triangles, 5 edges (boundary edges with count 1)
    const openMesh: Mesh3d = {
      id: "msh_open",
      positions: [
        0, 0, 0, // v0
        4, 0, 0, // v1
        4, 6, 0, // v2
        0, 6, 0, // v3
      ],
      indices: [0, 1, 2,  0, 2, 3],
    };

    const obj: Object3d = {
      id: "obj_open",
      type: "mesh",
      parentId: null,
      dataId: openMesh.id,
      transform: {
        location: [-10, 20, 5],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    };
    doc.objects = { [obj.id]: obj };
    doc.meshes = { [openMesh.id]: openMesh };

    const initialWorldVerts = getWorldVertices(doc, "obj_open");

    // Vertex mean of the quad is [(0+4+4+0)/4, (0+0+6+6)/4, 0] = [2, 3, 0]
    setOriginToCenterOfMass(doc, "obj_open");

    const newMesh = doc.meshes[doc.objects["obj_open"].dataId!];
    // v0 [0, 0, 0] shifted by -[2, 3, 0] becomes [-2, -3, 0]
    assert.ok(Math.abs(newMesh.positions![0] - -2) < 1e-9);
    assert.ok(Math.abs(newMesh.positions![1] - -3) < 1e-9);
    // Object location shifted by [2, 3, 0]: [-10 + 2, 20 + 3, 5] = [-8, 23, 5]
    assert.ok(Math.abs(doc.objects["obj_open"].transform.location[0] - -8) < 1e-9);
    assert.ok(Math.abs(doc.objects["obj_open"].transform.location[1] - 23) < 1e-9);

    const afterWorldVerts = getWorldVertices(doc, "obj_open");
    assertVerticesNear(afterWorldVerts, initialWorldVerts, 1e-9, "open mesh fallback");
  });

  it("shared mesh is cloned on applyTransform so other objects remain unaffected", () => {
    const doc = createEmptyDocument();
    const sharedMesh = createSampleCubeMesh("msh_shared");

    const obj1: Object3d = {
      id: "obj_user1",
      type: "mesh",
      parentId: null,
      dataId: "msh_shared",
      transform: { location: [10, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [2, 2, 2] },
    };
    const obj2: Object3d = {
      id: "obj_user2",
      type: "mesh",
      parentId: null,
      dataId: "msh_shared",
      transform: { location: [0, 5, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] },
    };

    doc.objects = { [obj1.id]: obj1, [obj2.id]: obj2 };
    doc.meshes = { [sharedMesh.id]: sharedMesh };

    // Apply scale on obj1 only
    applyTransform(doc, "obj_user1", { scale: true });

    // obj1 should have a fresh mesh ID
    assert.notEqual(doc.objects["obj_user1"].dataId, "msh_shared");
    // obj2 still references msh_shared and is completely untouched
    assert.equal(doc.objects["obj_user2"].dataId, "msh_shared");
    assert.deepEqual(doc.meshes["msh_shared"].positions, sharedMesh.positions);
  });
});
