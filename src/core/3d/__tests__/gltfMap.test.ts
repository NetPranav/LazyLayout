/**
 * ============================================================================
 * UNIT TESTS: glTF 2.0 MAPPING & SERIALIZATION
 * ============================================================================
 * Phase 3D-009: gltfMap.ts verification
 *   - Node transform <-> Object transform mapping.
 *   - Node matrix decomposition.
 *   - glTF round-trip keeps hierarchy, TRS (1e-9) and mesh data exactly.
 *   - Self-contained single-file glTF JSON with base64 data URI (no external files).
 *   - Stringified JSON round-trip.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fromGltfJson,
  gltfNodeToTransform,
  nodeTransformToObjectTransform,
  objectTransformToNodeTransform,
  toGltfJson,
  transformToGltfNode,
} from "../gltfMap";
import { compose, quatFromEuler } from "../math";
import { createEmptyDocument, type MotionDocument } from "../../document/schema";
import type { Mesh3d, Object3d, Scene3d, Transform3d } from "../../document/scene3d";

function assertVecNear(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-9,
  msg = "Vectors differ"
) {
  assert.equal(actual.length, expected.length, `${msg}: length mismatch`);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    assert.ok(
      diff <= epsilon,
      `${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`
    );
  }
}

describe("glTF Transform Mapping", () => {
  it("converts between glTF node TRS and Object3d Transform3d", () => {
    const originalTransform: Transform3d = {
      location: [10.5, -20.25, 30.75],
      rotationQuat: [0.1, 0.2, 0.3, 0.9273618495495704],
      scale: [1.5, 2.0, 0.5],
    };

    const nodeTransform = objectTransformToNodeTransform(originalTransform);
    assert.deepEqual(nodeTransform.translation, [10.5, -20.25, 30.75]);
    assert.deepEqual(nodeTransform.rotation, [0.1, 0.2, 0.3, 0.9273618495495704]);
    assert.deepEqual(nodeTransform.scale, [1.5, 2.0, 0.5]);

    const restoredTransform = nodeTransformToObjectTransform(nodeTransform);
    assertVecNear(restoredTransform.location, originalTransform.location);
    assertVecNear(restoredTransform.rotationQuat, originalTransform.rotationQuat);
    assertVecNear(restoredTransform.scale, originalTransform.scale);

    // Aliases
    assert.deepEqual(transformToGltfNode(originalTransform), nodeTransform);
    assert.deepEqual(gltfNodeToTransform(nodeTransform), restoredTransform);
  });

  it("decomposes 4x4 matrix from glTF node when matrix is used instead of TRS", () => {
    const loc: [number, number, number] = [5, -10, 15];
    const q = quatFromEuler("XYZ", Math.PI / 4, 0, 0);
    const rot: [number, number, number, number] = [q[0], q[1], q[2], q[3]];
    const scl: [number, number, number] = [2, 2, 2];

    const matrix = compose(loc, rot, scl);
    const transform = nodeTransformToObjectTransform({
      matrix: Array.from(matrix),
    });

    assertVecNear(transform.location, loc, 1e-9);
    assertVecNear(transform.rotationQuat, rot, 1e-9);
    assertVecNear(transform.scale, scl, 1e-9);
  });
});

describe("glTF 2.0 Round-Trip: Hierarchy, TRS (1e-9) & Mesh Data", () => {
  it("preserves 3-level hierarchy, exact TRS within 1e-9, and exact mesh geometry", () => {
    const doc = createEmptyDocument();

    const sceneId = "scene_main";
    const meshCubeId = "mesh_cube";
    const meshPlaneId = "mesh_plane";

    // 1. Meshes
    const cubeMesh: Mesh3d = {
      id: meshCubeId,
      name: "BoxMesh",
      positions: [
        -1, -1, -1,   1, -1, -1,   1,  1, -1,  -1,  1, -1,
        -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,
      ],
      indices: [
        0, 1, 2,  0, 2, 3,
        4, 5, 6,  4, 6, 7,
      ],
      normals: [
        0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
        0, 0,  1,  0, 0,  1,  0, 0,  1,  0, 0,  1,
      ],
      uvs: [
        0, 0,  1, 0,  1, 1,  0, 1,
        0, 0,  1, 0,  1, 1,  0, 1,
      ],
    };

    const planeMesh: Mesh3d = {
      id: meshPlaneId,
      name: "PlaneMesh",
      positions: [
        -2, 0, -2,   2, 0, -2,   2, 0, 2,  -2, 0, 2,
      ],
      indices: [0, 1, 2, 0, 2, 3],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    };

    // 2. Objects with 3-level hierarchy:
    //    root -> child1 -> grandchild
    //    root -> child2
    const rotChild1 = quatFromEuler("XYZ", 0, Math.PI / 4, 0);
    const rotGrandchild = quatFromEuler("XYZ", Math.PI / 6, 0, 0);

    const rootObj: Object3d = {
      id: "obj_root",
      name: "RootObject",
      type: "mesh",
      transform: {
        location: [1.0, 2.0, 3.0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1.0, 1.0, 1.0],
      },
      parentId: null,
      dataId: meshCubeId,
    };

    const child1Obj: Object3d = {
      id: "obj_child1",
      name: "Child1",
      type: "empty",
      transform: {
        location: [0.0, 5.0, 0.0],
        rotationQuat: [rotChild1[0], rotChild1[1], rotChild1[2], rotChild1[3]],
        scale: [2.0, 2.0, 2.0],
      },
      parentId: "obj_root",
      dataId: null,
    };

    const grandchildObj: Object3d = {
      id: "obj_grandchild",
      name: "Grandchild",
      type: "empty",
      transform: {
        location: [2.5, -1.0, 0.5],
        rotationQuat: [rotGrandchild[0], rotGrandchild[1], rotGrandchild[2], rotGrandchild[3]],
        scale: [0.5, 0.5, 0.5],
      },
      parentId: "obj_child1",
      dataId: null,
    };

    const child2Obj: Object3d = {
      id: "obj_child2",
      name: "Child2",
      type: "mesh",
      transform: {
        location: [-4.0, 0.0, 2.0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1.5, 1.0, 1.5],
      },
      parentId: "obj_root",
      dataId: meshPlaneId,
    };

    // 3. Scene
    const scene: Scene3d = {
      id: sceneId,
      name: "TestScene",
      objects: ["obj_root", "obj_child1", "obj_grandchild", "obj_child2"],
      settings: {
        pxPerMetre: 150,
      },
    };

    doc.scenes = { [sceneId]: scene };
    doc.meshes = { [meshCubeId]: cubeMesh, [meshPlaneId]: planeMesh };
    doc.objects = {
      obj_root: rootObj,
      obj_child1: child1Obj,
      obj_grandchild: grandchildObj,
      obj_child2: child2Obj,
    };

    // 4. Export to glTF JSON
    const gltf = toGltfJson(doc, sceneId);

    // Verify glTF structure conforms to glTF 2.0 without external files
    assert.equal(gltf.asset.version, "2.0");
    assert.ok(gltf.buffers && gltf.buffers.length === 1);
    assert.ok(gltf.buffers[0].uri?.startsWith("data:application/octet-stream;base64,"));
    assert.equal(gltf.scenes?.[0].nodes.length, 1, "Only root node is in scene root list");
    assert.equal(gltf.nodes?.length, 4, "Four total nodes exported");

    // 5. Reimport from glTF JSON
    const importedDoc = fromGltfJson(gltf);

    // Check Scene
    const importedScene = importedDoc.scenes?.[sceneId] ?? importedDoc.scene;
    assert.ok(importedScene);
    assert.equal(importedScene.settings?.pxPerMetre, 150);

    // Check Hierarchy:
    // obj_root has no parent
    const impRoot = importedDoc.objects.obj_root;
    assert.ok(impRoot);
    assert.equal(impRoot.parentId, null);

    // obj_child1 has obj_root as parent
    const impChild1 = importedDoc.objects.obj_child1;
    assert.ok(impChild1);
    assert.equal(impChild1.parentId, "obj_root");

    // obj_grandchild has obj_child1 as parent
    const impGrandchild = importedDoc.objects.obj_grandchild;
    assert.ok(impGrandchild);
    assert.equal(impGrandchild.parentId, "obj_child1");

    // obj_child2 has obj_root as parent
    const impChild2 = importedDoc.objects.obj_child2;
    assert.ok(impChild2);
    assert.equal(impChild2.parentId, "obj_root");

    // Check TRS within 1e-9 for all objects:
    const objectsToTest = [
      { orig: rootObj, imp: impRoot },
      { orig: child1Obj, imp: impChild1 },
      { orig: grandchildObj, imp: impGrandchild },
      { orig: child2Obj, imp: impChild2 },
    ];

    for (const { orig, imp } of objectsToTest) {
      assertVecNear(imp.transform.location, orig.transform.location, 1e-9, `${orig.id} location`);
      assertVecNear(imp.transform.rotationQuat, orig.transform.rotationQuat, 1e-9, `${orig.id} rotation`);
      assertVecNear(imp.transform.scale, orig.transform.scale, 1e-9, `${orig.id} scale`);
    }

    // Check Mesh Data exactly:
    const impCube = importedDoc.meshes[meshCubeId];
    assert.ok(impCube);
    assert.deepEqual(impCube.positions, cubeMesh.positions);
    assert.deepEqual(impCube.indices, cubeMesh.indices);
    assert.deepEqual(impCube.normals, cubeMesh.normals);
    assert.deepEqual(impCube.uvs, cubeMesh.uvs);

    const impPlane = importedDoc.meshes[meshPlaneId];
    assert.ok(impPlane);
    assert.deepEqual(impPlane.positions, planeMesh.positions);
    assert.deepEqual(impPlane.indices, planeMesh.indices);
    assert.deepEqual(impPlane.normals, planeMesh.normals);
    assert.deepEqual(impPlane.uvs, planeMesh.uvs);

    // 6. Test serialized string round-trip
    const gltfString = JSON.stringify(gltf);
    const importedFromString = fromGltfJson(gltfString);
    assert.ok(importedFromString.objects.obj_root);
    assert.equal(importedFromString.objects.obj_grandchild.parentId, "obj_child1");
    assert.deepEqual(importedFromString.meshes[meshCubeId].positions, cubeMesh.positions);
  });
});
