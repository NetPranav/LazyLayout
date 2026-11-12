/**
 * ============================================================================
 * 3D VIEWPORT SHADING MODES (Phase 3D-018)
 * ============================================================================
 * Implements the four canonical viewport shading modes + X-ray toggle:
 *   1. Wireframe: WireframeGeometry / wireframe material.
 *   2. Solid: Studio lighting (3 fixed directional lights + ambient) with
 *             optional curvature cavity shader from viewport/shaders.ts.
 *   3. Material preview: RoomEnvironment via PMREMGenerator as the HDRI.
 *   4. Rendered: High-fidelity preview with clear hook `renderedHook` for
 *                the later path tracer (Phase 3D-056).
 *   5. X-Ray toggle: transparent + depthWrite off on scene meshes.
 * ============================================================================
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ViewportSettings, ShadingMode } from "../../3d/viewport/settings";
import { SOLID_VERTEX_SHADER, SOLID_FRAGMENT_SHADER } from "../../3d/viewport/shaders";

export type RenderedHook = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer?: THREE.WebGLRenderer
) => void;

/**
 * Hook called when the viewport is in "rendered" mode.
 * Later stages (Phase 3D-056) install the progressive path tracer here.
 */
export let renderedHook: RenderedHook | null = null;

export function setRenderedHook(hook: RenderedHook | null): void {
  renderedHook = hook;
}

const STUDIO_LIGHTS_GROUP_NAME = "__ll_studio_lights__";
const ENV_TEXTURE_CACHE = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * Creates 3-point studio lighting for solid mode:
 * Key: [0.577, 0.816, 0.408], Fill: [-0.707, -0.354, -0.612], Rim: [0, -0.707, 0.707]
 */
export function createStudioLights(): THREE.Group {
  const group = new THREE.Group();
  group.name = STUDIO_LIGHTS_GROUP_NAME;

  // Key light
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(0.577, 0.816, 0.408).normalize().multiplyScalar(10);
  group.add(key);

  // Fill light
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-0.707, -0.354, -0.612).normalize().multiplyScalar(10);
  group.add(fill);

  // Rim light
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(0.0, -0.707, 0.707).normalize().multiplyScalar(10);
  group.add(rim);

  // Studio ambient
  const amb = new THREE.AmbientLight(0xffffff, 0.2);
  group.add(amb);

  return group;
}

/**
 * Generates an HDRI environment texture from RoomEnvironment through PMREMGenerator.
 * Caches by renderer instance.
 */
export function getOrCreateRoomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let env = ENV_TEXTURE_CACHE.get(renderer);
  if (!env) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const room = new RoomEnvironment();
    const envScene = pmrem.fromScene(room);
    env = envScene.texture;
    ENV_TEXTURE_CACHE.set(renderer, env);
    room.dispose();
    pmrem.dispose();
  }
  return env;
}

/**
 * Creates a wireframe material.
 */
export function createWireframeMaterial(color: number | string = 0x222222): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    wireframe: true,
  });
}

/**
 * Creates a solid cavity shader material using the GLSL sources from shaders.ts.
 */
export function createSolidCavityMaterial(options?: {
  baseColor?: [number, number, number];
  roughness?: number;
  cavityStrength?: number;
}): THREE.ShaderMaterial {
  const baseColor = options?.baseColor ?? [0.8, 0.8, 0.8];
  const roughness = options?.roughness ?? 0.5;
  const cavityStrength = options?.cavityStrength ?? 0.35;

  return new THREE.ShaderMaterial({
    vertexShader: SOLID_VERTEX_SHADER,
    fragmentShader: SOLID_FRAGMENT_SHADER,
    uniforms: {
      uModelMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      uNormalMatrix: { value: new THREE.Matrix3() },
      uBaseColor: { value: new THREE.Vector3(...baseColor) },
      uRoughness: { value: roughness },
      uCavityStrength: { value: cavityStrength },
    },
  });
}

/**
 * Applies shading mode and X-ray configuration to a Three.js scene.
 */
export function applyShading(
  scene: THREE.Scene,
  settings: ViewportSettings,
  renderer?: THREE.WebGLRenderer,
  camera?: THREE.Camera
): void {
  const { shading, xray, solidOptions } = settings;

  // 1. Studio lighting toggle
  let studioLights = scene.getObjectByName(STUDIO_LIGHTS_GROUP_NAME) as THREE.Group | undefined;
  if (shading === "solid" || shading === "wireframe") {
    if (!studioLights) {
      studioLights = createStudioLights();
      scene.add(studioLights);
    }
    studioLights.visible = true;
  } else if (studioLights) {
    studioLights.visible = false;
  }

  // 2. Environment (HDRI) for Material preview and Rendered
  if (shading === "material" || shading === "rendered") {
    if (renderer) {
      try {
        scene.environment = getOrCreateRoomEnvironment(renderer);
      } catch {
        // In environments without WebGL framebuffers (e.g. headless tests)
        scene.environment = null;
      }
    }
  } else {
    scene.environment = null;
  }

  // 3. Rendered mode hook
  if (shading === "rendered" && renderedHook && camera) {
    renderedHook(scene, camera, renderer);
  }

  // 4. Mesh materials update (wireframe, solid, xray)
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => configureMaterial(m, shading, xray, solidOptions.cavity));
      } else if (mat instanceof THREE.Material) {
        configureMaterial(mat, shading, xray, solidOptions.cavity);
      }
    }
  });
}

function configureMaterial(
  mat: THREE.Material,
  shading: ShadingMode,
  xray: boolean,
  _cavity: boolean
): void {
  // Store original settings if not already stored
  const userData = mat.userData as {
    _origWireframe?: boolean;
    _origTransparent?: boolean;
    _origOpacity?: number;
    _origDepthWrite?: boolean;
  };

  if (userData._origWireframe === undefined && "wireframe" in mat) {
    userData._origWireframe = (mat as THREE.MeshStandardMaterial).wireframe;
  }
  if (userData._origTransparent === undefined) {
    userData._origTransparent = mat.transparent;
  }
  if (userData._origOpacity === undefined) {
    userData._origOpacity = mat.opacity;
  }
  if (userData._origDepthWrite === undefined) {
    userData._origDepthWrite = mat.depthWrite;
  }

  // Shading mode wireframe
  if ("wireframe" in mat) {
    (mat as THREE.MeshStandardMaterial).wireframe =
      shading === "wireframe" || (userData._origWireframe ?? false);
  }

  // X-ray toggle (transparent + depthWrite off)
  if (xray) {
    mat.transparent = true;
    mat.opacity = 0.5;
    mat.depthWrite = false;
  } else {
    mat.transparent = userData._origTransparent ?? false;
    mat.opacity = userData._origOpacity ?? 1;
    mat.depthWrite = userData._origDepthWrite ?? true;
  }

  mat.needsUpdate = true;
}
