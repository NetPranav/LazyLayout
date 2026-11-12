/**
 * ============================================================================
 * THREE.JS SCENE BUILDER & EVALUATED STATE SYNC (Phase 3D-012)
 * ============================================================================
 * Converts a document scene into a Three.js scene graph:
 *   - Meshes (inline positions, indices, normals, uvs)
 *   - PBR materials (MeshStandardMaterial from Material3d)
 *   - Lights (point, sun/directional, spot)
 *   - Perspective camera from the scene's active camera
 *   - World background colour & ambient lighting
 *
 * `applyEvaluated(builtScene, evaluated3D)` updates ONLY transforms, material,
 * light, and camera values evaluated by `evaluate3D(doc, time)`.
 * Caches Three objects by id, and disposes geometries and materials on removal.
 * ============================================================================
 */

import * as THREE from "three";
import type {
  MotionDocument,
  Scene3d,
  Object3d,
  Mesh3d,
  Material3d,
  Light3d,
  Camera3d,
  World3d,
} from "../../document/schema";
import type { Evaluated3DState } from "../../3d/diff";

export interface BuiltScene {
  threeScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ambientLight: THREE.AmbientLight;
  objectsById: Map<string, THREE.Object3D>;
  materialsById: Map<string, THREE.MeshStandardMaterial>;
  geometriesById: Map<string, THREE.BufferGeometry>;
  dispose: () => void;
}

export function disposeThreeObject(obj: THREE.Object3D): void {
  if ("geometry" in obj) {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      mesh.geometry.dispose();
    }
  }
  if ("material" in obj) {
    const mesh = obj as THREE.Mesh;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose();
    }
  }
}

/**
 * Creates or updates a Three.js BufferGeometry from MDM Mesh3d data.
 */
export function createBufferGeometry(meshData: Mesh3d): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  if (meshData.positions && meshData.positions.length > 0) {
    geom.setAttribute("position", new THREE.Float32BufferAttribute(meshData.positions, 3));
  }
  if (meshData.indices && meshData.indices.length > 0) {
    geom.setIndex(meshData.indices);
  }
  if (meshData.normals && meshData.normals.length > 0) {
    geom.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.normals, 3));
  } else if (meshData.positions && meshData.positions.length > 0) {
    geom.computeVertexNormals();
  }
  if (meshData.uvs && meshData.uvs.length > 0) {
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(meshData.uvs, 2));
  }

  return geom;
}

/**
 * Creates a Three.js MeshStandardMaterial from MDM Material3d data.
 */
export function createStandardMaterial(matData?: Material3d | null): THREE.MeshStandardMaterial {
  const hasOpacity = matData?.opacity !== undefined;
  const opacity = hasOpacity ? (matData.opacity as number) : 1;
  const transparent = hasOpacity && opacity < 1;

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(matData?.baseColor ?? "#ffffff"),
    roughness: matData?.roughness ?? 0.5,
    metalness: matData?.metallic ?? 0,
    emissive: new THREE.Color(matData?.emissive ?? "#000000"),
    emissiveIntensity: matData?.emissiveIntensity ?? 1,
    wireframe: matData?.wireframe ?? false,
    transparent,
    opacity,
    side: matData?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/**
 * Updates an existing MeshStandardMaterial from Material3d data.
 */
export function updateStandardMaterial(
  mat: THREE.MeshStandardMaterial,
  matData: Material3d
): void {
  mat.color.set(matData.baseColor ?? "#ffffff");
  mat.roughness = matData.roughness ?? 0.5;
  mat.metalness = matData.metallic ?? 0;
  mat.emissive.set(matData.emissive ?? "#000000");
  if (matData.emissiveIntensity !== undefined) {
    mat.emissiveIntensity = matData.emissiveIntensity;
  }
  if (matData.opacity !== undefined) {
    mat.opacity = matData.opacity;
    mat.transparent = matData.opacity < 1;
  }
  if (matData.wireframe !== undefined) {
    mat.wireframe = matData.wireframe;
  }
  if (matData.doubleSided !== undefined) {
    mat.side = matData.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  }
  mat.needsUpdate = true;
}

/**
 * Converts a document scene and its referenced data blocks into a Three.js scene graph.
 */
export function buildScene(
  doc: MotionDocument | Evaluated3DState,
  sceneId: string
): BuiltScene {
  const threeScene = new THREE.Scene();
  const objectsById = new Map<string, THREE.Object3D>();
  const materialsById = new Map<string, THREE.MeshStandardMaterial>();
  const geometriesById = new Map<string, THREE.BufferGeometry>();

  const scenes = (doc.scenes ?? {}) as Record<string, Scene3d>;
  const objects = (doc.objects ?? {}) as Record<string, Object3d>;
  const meshes = (doc.meshes ?? {}) as Record<string, Mesh3d>;
  const materials = (doc.materials ?? {}) as Record<string, Material3d>;
  const lights = (doc.lights ?? {}) as Record<string, Light3d>;
  const cameras = (doc.cameras ?? {}) as Record<string, Camera3d>;
  const worlds = (doc.worlds ?? {}) as Record<string, World3d>;

  const sceneData = scenes[sceneId] ?? {
    id: sceneId,
    objects: [],
  };

  // 1. World background & ambient lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  threeScene.add(ambientLight);

  if (sceneData.world && worlds[sceneData.world]) {
    const world = worlds[sceneData.world];
    threeScene.background = new THREE.Color(world.color ?? "#000000");
    if (world.ambientColor) {
      ambientLight.color.set(world.ambientColor);
    }
    if (world.ambientIntensity !== undefined) {
      ambientLight.intensity = world.ambientIntensity;
    }
  }

  // 2. Active perspective camera
  let activeCamObj: Object3d | undefined;
  let activeCamData: Camera3d | undefined;

  if (sceneData.activeCamera) {
    const candidateObj = objects[sceneData.activeCamera];
    if (candidateObj && candidateObj.type === "camera") {
      activeCamObj = candidateObj;
      if (activeCamObj.dataId && cameras[activeCamObj.dataId]) {
        activeCamData = cameras[activeCamObj.dataId];
      }
    } else if (cameras[sceneData.activeCamera]) {
      activeCamData = cameras[sceneData.activeCamera];
    }
  }

  const camera = new THREE.PerspectiveCamera(
    activeCamData?.fov ?? 50,
    1,
    activeCamData?.near ?? 0.1,
    activeCamData?.far ?? 1000
  );

  if (activeCamObj) {
    const t = activeCamObj.transform;
    camera.position.set(t.location[0], t.location[1], t.location[2]);
    camera.quaternion.set(t.rotationQuat[0], t.rotationQuat[1], t.rotationQuat[2], t.rotationQuat[3]);
    camera.scale.set(t.scale[0], t.scale[1], t.scale[2]);
  } else {
    // Default camera position looking at center
    camera.position.set(0, -5, 3);
    camera.lookAt(0, 0, 0);
  }

  // 3. Build objects
  const sceneObjectIds = sceneData.objects ?? [];

  for (const objId of sceneObjectIds) {
    const obj = objects[objId];
    if (!obj) continue;

    let threeObj: THREE.Object3D;

    switch (obj.type) {
      case "mesh": {
        let geom: THREE.BufferGeometry;
        const meshData = obj.dataId ? meshes[obj.dataId] : null;
        if (meshData) {
          geom = createBufferGeometry(meshData);
          geometriesById.set(meshData.id, geom);
        } else {
          geom = new THREE.BufferGeometry();
        }

        const matId = obj.materials?.[0] ?? obj.materialSlots?.[0];
        const matData = matId ? materials[matId] : null;
        let mat = matId ? materialsById.get(matId) : undefined;
        if (!mat) {
          mat = createStandardMaterial(matData);
          if (matId) materialsById.set(matId, mat);
        }

        threeObj = new THREE.Mesh(geom, mat);
        break;
      }

      case "light": {
        const lightData = obj.dataId ? lights[obj.dataId] : null;
        const color = new THREE.Color(lightData?.color ?? "#ffffff");
        const intensity = lightData?.intensity ?? 1;

        if (lightData?.type === "sun" || lightData?.type === "directional") {
          const dirLight = new THREE.DirectionalLight(color, intensity);
          dirLight.castShadow = !!lightData.castShadow;
          threeObj = dirLight;
        } else if (lightData?.type === "spot") {
          const spotLight = new THREE.SpotLight(
            color,
            intensity,
            lightData.distance ?? 0,
            lightData.spotAngle ?? Math.PI / 3,
            lightData.spotBlend ?? 0,
            lightData.decay ?? 2
          );
          spotLight.castShadow = !!lightData.castShadow;
          threeObj = spotLight;
        } else {
          // point light
          const pointLight = new THREE.PointLight(
            color,
            intensity,
            lightData?.distance ?? 0,
            lightData?.decay ?? 2
          );
          pointLight.castShadow = !!lightData?.castShadow;
          threeObj = pointLight;
        }
        break;
      }

      case "camera": {
        const camData = obj.dataId ? cameras[obj.dataId] : null;
        const cam = new THREE.PerspectiveCamera(
          camData?.fov ?? 50,
          1,
          camData?.near ?? 0.1,
          camData?.far ?? 1000
        );
        threeObj = cam;
        break;
      }

      case "armature":
      case "empty":
      default: {
        threeObj = new THREE.Group();
        break;
      }
    }

    threeObj.name = obj.id;
    threeObj.visible = obj.visible !== false;

    // Set initial transform
    const t = obj.transform;
    threeObj.position.set(t.location[0], t.location[1], t.location[2]);
    threeObj.quaternion.set(t.rotationQuat[0], t.rotationQuat[1], t.rotationQuat[2], t.rotationQuat[3]);
    threeObj.scale.set(t.scale[0], t.scale[1], t.scale[2]);

    objectsById.set(obj.id, threeObj);
  }

  // 4. Attach hierarchy
  for (const objId of sceneObjectIds) {
    const obj = objects[objId];
    const threeObj = objectsById.get(objId);
    if (!obj || !threeObj) continue;

    if (obj.parentId && objectsById.has(obj.parentId)) {
      const parent = objectsById.get(obj.parentId)!;
      parent.add(threeObj);
    } else {
      threeScene.add(threeObj);
    }
  }

  const dispose = () => {
    for (const obj of objectsById.values()) {
      disposeThreeObject(obj);
    }
    for (const geom of geometriesById.values()) {
      geom.dispose();
    }
    for (const mat of materialsById.values()) {
      mat.dispose();
    }
    objectsById.clear();
    materialsById.clear();
    geometriesById.clear();
    while (threeScene.children.length > 0) {
      threeScene.remove(threeScene.children[0]);
    }
  };

  return {
    threeScene,
    camera,
    ambientLight,
    objectsById,
    materialsById,
    geometriesById,
    dispose,
  };
}

/**
 * Updates ONLY transforms, material properties, lights, and cameras from evaluated state.
 * The renderer applies what the kernel evaluated and nothing else.
 */
export function applyEvaluated(
  builtOrScene: BuiltScene | THREE.Scene,
  evaluated3D: Evaluated3DState
): void {
  const threeScene = "threeScene" in builtOrScene ? builtOrScene.threeScene : builtOrScene;
  const objectsById = "objectsById" in builtOrScene ? builtOrScene.objectsById : null;

  const objects = (evaluated3D.objects ?? {}) as Record<string, Object3d>;
  const materials = (evaluated3D.materials ?? {}) as Record<string, Material3d>;
  const lights = (evaluated3D.lights ?? {}) as Record<string, Light3d>;
  const cameras = (evaluated3D.cameras ?? {}) as Record<string, Camera3d>;
  const worlds = (evaluated3D.worlds ?? {}) as Record<string, World3d>;
  const scenes = (evaluated3D.scenes ?? {}) as Record<string, Scene3d>;

  // 1. World background
  const firstScene = Object.values(scenes)[0];
  if (firstScene?.world && worlds[firstScene.world]) {
    const w = worlds[firstScene.world];
    if (threeScene.background instanceof THREE.Color) {
      threeScene.background.set(w.color ?? "#000000");
    } else {
      threeScene.background = new THREE.Color(w.color ?? "#000000");
    }
  }

  // 2. Objects
  for (const [objId, obj] of Object.entries(objects)) {
    const threeObj = objectsById ? objectsById.get(objId) : threeScene.getObjectByName(objId);
    if (!threeObj) continue;

    // Transform
    const t = obj.transform;
    threeObj.position.set(t.location[0], t.location[1], t.location[2]);
    threeObj.quaternion.set(t.rotationQuat[0], t.rotationQuat[1], t.rotationQuat[2], t.rotationQuat[3]);
    threeObj.scale.set(t.scale[0], t.scale[1], t.scale[2]);

    // Visibility
    threeObj.visible = obj.visible !== false;

    // Mesh material update
    if (threeObj instanceof THREE.Mesh) {
      const matId = obj.materials?.[0] ?? obj.materialSlots?.[0];
      const matData = matId ? materials[matId] : null;
      if (matData && threeObj.material instanceof THREE.MeshStandardMaterial) {
        updateStandardMaterial(threeObj.material, matData);
      }
    }

    // Light update
    if (threeObj instanceof THREE.Light && obj.dataId && lights[obj.dataId]) {
      const litData = lights[obj.dataId];
      threeObj.color.set(litData.color ?? "#ffffff");
      threeObj.intensity = litData.intensity ?? 1;
      threeObj.castShadow = !!litData.castShadow;
    }

    // Camera update
    if (threeObj instanceof THREE.PerspectiveCamera && obj.dataId && cameras[obj.dataId]) {
      const camData = cameras[obj.dataId];
      threeObj.fov = camData.fov ?? 50;
      threeObj.near = camData.near ?? 0.1;
      threeObj.far = camData.far ?? 1000;
      threeObj.updateProjectionMatrix();
    }
  }

  // 3. Remove objects that were deleted from evaluated state
  if (objectsById) {
    for (const [id, threeObj] of objectsById.entries()) {
      if (!objects[id]) {
        disposeThreeObject(threeObj);
        threeObj.removeFromParent();
        objectsById.delete(id);
      }
    }
  }
}
