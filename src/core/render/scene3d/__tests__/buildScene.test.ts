import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT } from "../../../store/documentState";
import * as THREE from "three";
import { buildScene, applyEvaluated } from "../buildScene";
import type { MotionDocument, Scene3d, Object3d, Mesh3d, Material3d, Light3d, Camera3d, World3d } from "../../../document/schema";
import type { Evaluated3DState } from "../../../3d/diff";

function assertApprox(actual: number, expected: number, tol = 1e-4, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ?? "approx error"}: expected ${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`
  );
}

function makeTestDoc(): {
  doc: MotionDocument;
  sceneId: string;
  meshObjId: string;
  camObjId: string;
  lightObjId: string;
} {
  const sceneId = "scn_test";
  const meshDataId = "msh_cube";
  const matId = "mat_pbr";
  const meshObjId = "obj_mesh";
  const camDataId = "cam_main";
  const camObjId = "obj_cam";
  const lightDataId = "lit_point";
  const lightObjId = "obj_light";
  const worldId = "wld_space";

  const world: World3d = {
    id: worldId,
    color: "#0a0a14",
    ambientColor: "#222233",
    ambientIntensity: 0.3,
  };

  const meshData: Mesh3d = {
    id: meshDataId,
    positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
    indices: [0, 1, 2],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 0.5, 1],
  };

  const material: Material3d = {
    id: matId,
    name: "Material",
    baseColor: "#ff0000",
    metallic: 0.2,
    roughness: 0.6,
    emissive: "#110000",
    emissiveIntensity: 0.5,
    opacity: 0.8,
  };

  const meshObj: Object3d = {
    id: meshObjId,
    name: "Triangle",
    type: "mesh",
    dataId: meshDataId,
    materials: [matId],
    transform: {
      location: [1, 2, 3],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const cameraData: Camera3d = {
    id: camDataId,
    name: "Camera",
    type: "perspective",
    fov: 60,
    near: 0.2,
    far: 500,
  };

  const camObj: Object3d = {
    id: camObjId,
    name: "CameraObj",
    type: "camera",
    dataId: camDataId,
    transform: {
      location: [0, -6, 4],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const lightData: Light3d = {
    id: lightDataId,
    name: "PointLight",
    type: "point",
    color: "#ffffaa",
    intensity: 15,
    distance: 20,
    decay: 2,
    castShadow: true,
  };

  const lightObj: Object3d = {
    id: lightObjId,
    name: "LightObj",
    type: "light",
    dataId: lightDataId,
    transform: {
      location: [2, -2, 5],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
  };

  const scene: Scene3d = {
    id: sceneId,
    name: "TestScene",
    world: worldId,
    activeCamera: camObjId,
    objects: [meshObjId, camObjId, lightObjId],
  };

  const doc: MotionDocument = {
    ...DEFAULT_DOCUMENT,
    schemaVersion: 7,
    layers: {},
    scenes: { [sceneId]: scene },
    objects: {
      [meshObjId]: meshObj,
      [camObjId]: camObj,
      [lightObjId]: lightObj,
    },
    meshes: { [meshDataId]: meshData },
    materials: { [matId]: material },
    lights: { [lightDataId]: lightData },
    cameras: { [camDataId]: cameraData },
    armatures: {},
    actions: {},
    worlds: { [worldId]: world },
    images3d: {},
  };

  return { doc, sceneId, meshObjId, camObjId, lightObjId };
}

describe("Phase 3D-012: buildScene & applyEvaluated", () => {
  it("buildScene converts document scene data blocks into Three.js objects", () => {
    const { doc, sceneId, meshObjId, camObjId, lightObjId } = makeTestDoc();
    const built = buildScene(doc, sceneId);

    // World background
    assert.ok(built.threeScene.background instanceof THREE.Color);
    assert.equal(built.threeScene.background.getHexString(), "0a0a14");

    // Ambient light
    assert.ok(built.ambientLight instanceof THREE.AmbientLight);
    assertApprox(built.ambientLight.intensity, 0.3);

    // Camera
    assert.ok(built.camera instanceof THREE.PerspectiveCamera);
    assertApprox(built.camera.fov, 60);
    assertApprox(built.camera.near, 0.2);
    assertApprox(built.camera.far, 500);
    assertApprox(built.camera.position.x, 0);
    assertApprox(built.camera.position.y, -6);
    assertApprox(built.camera.position.z, 4);

    // Mesh
    const meshObj = built.objectsById.get(meshObjId);
    assert.ok(meshObj instanceof THREE.Mesh);
    assertApprox(meshObj.position.x, 1);
    assertApprox(meshObj.position.y, 2);
    assertApprox(meshObj.position.z, 3);
    assert.ok(meshObj.material instanceof THREE.MeshStandardMaterial);
    assertApprox(meshObj.material.roughness, 0.6);
    assertApprox(meshObj.material.metalness, 0.2);
    assert.equal(meshObj.material.transparent, true);
    assertApprox(meshObj.material.opacity, 0.8);

    // Light
    const lightObj = built.objectsById.get(lightObjId);
    assert.ok(lightObj instanceof THREE.PointLight);
    assertApprox(lightObj.intensity, 15);
    assert.equal(lightObj.castShadow, true);

    built.dispose();
  });

  it("buildScene attaches parent-child object hierarchy", () => {
    const { doc, sceneId, meshObjId } = makeTestDoc();
    const childId = "obj_child";
    const childMeshId = "msh_child";

    doc.meshes![childMeshId] = {
      id: childMeshId,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    };

    doc.objects![childId] = {
      id: childId,
      name: "Child",
      type: "mesh",
      dataId: childMeshId,
      parentId: meshObjId,
      transform: {
        location: [0, 1, 0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      visible: true,
    };

    doc.scenes![sceneId].objects.push(childId);

    const built = buildScene(doc, sceneId);
    const parentThree = built.objectsById.get(meshObjId);
    const childThree = built.objectsById.get(childId);

    assert.ok(parentThree);
    assert.ok(childThree);
    assert.equal(childThree.parent, parentThree);

    built.dispose();
  });

  it("applyEvaluated updates transforms, material properties, and lights without recreating objects", () => {
    const { doc, sceneId, meshObjId, lightObjId, camObjId } = makeTestDoc();
    const built = buildScene(doc, sceneId);

    const meshBefore = built.objectsById.get(meshObjId) as THREE.Mesh;
    const matBefore = meshBefore.material as THREE.MeshStandardMaterial;

    // Evaluated state updates
    const evaluated: Evaluated3DState = {
      ...doc,
      objects: {
        ...doc.objects,
        [meshObjId]: {
          ...doc.objects![meshObjId],
          transform: {
            location: [10, 20, 30],
            rotationQuat: [0, 0.7071, 0, 0.7071],
            scale: [2, 2, 2],
          },
          visible: false,
        },
      },
      materials: {
        ...doc.materials,
        mat_pbr: {
          ...doc.materials!.mat_pbr,
          baseColor: "#00ff00",
          roughness: 0.1,
          metallic: 0.9,
          wireframe: true,
        },
      },
      lights: {
        ...doc.lights,
        lit_point: {
          ...doc.lights!.lit_point,
          intensity: 42,
          color: "#0000ff",
        },
      },
      cameras: {
        ...doc.cameras,
        cam_main: {
          ...doc.cameras!.cam_main,
          fov: 75,
        },
      },
    };

    applyEvaluated(built, evaluated);

    // Objects are mutated in place (no identity recreation)
    assert.equal(built.objectsById.get(meshObjId), meshBefore);
    assert.equal(meshBefore.material, matBefore);

    // Transform updated
    assertApprox(meshBefore.position.x, 10);
    assertApprox(meshBefore.position.y, 20);
    assertApprox(meshBefore.position.z, 30);
    assertApprox(meshBefore.scale.x, 2);
    assertApprox(meshBefore.scale.y, 2);
    assertApprox(meshBefore.scale.z, 2);
    assert.equal(meshBefore.visible, false);

    // Material updated
    assert.equal(matBefore.color.getHexString(), "00ff00");
    assertApprox(matBefore.roughness, 0.1);
    assertApprox(matBefore.metalness, 0.9);
    assert.equal(matBefore.wireframe, true);

    // Light updated
    const lightThree = built.objectsById.get(lightObjId) as THREE.PointLight;
    assertApprox(lightThree.intensity, 42);
    assert.equal(lightThree.color.getHexString(), "0000ff");

    // Camera updated
    const camThree = built.objectsById.get(camObjId) as THREE.PerspectiveCamera;
    assertApprox(camThree.fov, 75);

    built.dispose();
  });

  it("applyEvaluated cleans up removed objects", () => {
    const { doc, sceneId, meshObjId } = makeTestDoc();
    const built = buildScene(doc, sceneId);

    assert.ok(built.objectsById.has(meshObjId));

    // Remove mesh from evaluated objects
    const evaluated: Evaluated3DState = {
      ...doc,
      objects: {
        obj_cam: doc.objects!.obj_cam,
        obj_light: doc.objects!.obj_light,
      },
    };

    applyEvaluated(built, evaluated);

    assert.equal(built.objectsById.has(meshObjId), false);
    assert.equal(built.threeScene.getObjectByName(meshObjId), undefined);

    built.dispose();
  });
});
