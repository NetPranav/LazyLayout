import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  applyShading,
  createStudioLights,
  createWireframeMaterial,
  createSolidCavityMaterial,
  setRenderedHook,
} from "../shading";
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from "../../../3d/viewport/settings";

function assertApprox(actual: number, expected: number, tol = 1e-4, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ?? "approx error"}: expected ${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`
  );
}

describe("Phase 3D-018: Viewport Shading Modes & X-Ray", () => {
  beforeEach(() => {
    setRenderedHook(null);
  });

  it("createStudioLights returns Key, Fill, Rim, and Ambient lights", () => {
    const rig = createStudioLights();
    assert.equal(rig.children.length, 4);

    const dirLights = rig.children.filter((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight[];
    const ambLights = rig.children.filter((c) => c instanceof THREE.AmbientLight) as THREE.AmbientLight[];

    assert.equal(dirLights.length, 3);
    assert.equal(ambLights.length, 1);

    // Key light intensity 0.8
    const key = dirLights.find((l) => Math.abs(l.intensity - 0.8) < 1e-4);
    assert.ok(key, "Key light with intensity 0.8 exists");

    // Fill light intensity 0.35
    const fill = dirLights.find((l) => Math.abs(l.intensity - 0.35) < 1e-4);
    assert.ok(fill, "Fill light with intensity 0.35 exists");

    // Rim light intensity 0.25
    const rim = dirLights.find((l) => Math.abs(l.intensity - 0.25) < 1e-4);
    assert.ok(rim, "Rim light with intensity 0.25 exists");

    assertApprox(ambLights[0].intensity, 0.2);
  });

  it("createWireframeMaterial creates basic wireframe material", () => {
    const mat = createWireframeMaterial(0x334455);
    assert.equal(mat.wireframe, true);
    assert.equal(mat.color.getHexString(), "334455");
  });

  it("createSolidCavityMaterial attaches uniforms and vertex/fragment shaders", () => {
    const mat = createSolidCavityMaterial({
      baseColor: [0.7, 0.8, 0.9],
      roughness: 0.4,
      cavityStrength: 0.5,
    });

    assert.ok(mat instanceof THREE.ShaderMaterial);
    assert.ok(mat.vertexShader.includes("vWorldNormal"));
    assert.ok(mat.fragmentShader.includes("uCavityStrength"));
    assertApprox(mat.uniforms.uCavityStrength.value, 0.5);
    assertApprox(mat.uniforms.uRoughness.value, 0.4);
  });

  it("applyShading configures studio lights and wireframe in wireframe mode", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ wireframe: false, opacity: 1, transparent: false })
    );
    scene.add(mesh);

    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      shading: "wireframe",
      xray: false,
    };

    applyShading(scene, settings);

    const studioLights = scene.getObjectByName("__ll_studio_lights__");
    assert.ok(studioLights, "Studio lights added");
    assert.equal(studioLights.visible, true);
    assert.equal((mesh.material as THREE.MeshStandardMaterial).wireframe, true);
  });

  it("applyShading configures X-ray mode by setting transparent and disabling depthWrite", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: false,
        opacity: 1.0,
        depthWrite: true,
      })
    );
    scene.add(mesh);

    // 1. Enable X-ray
    const settingsXrayOn: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      shading: "solid",
      xray: true,
    };
    applyShading(scene, settingsXrayOn);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    assert.equal(mat.transparent, true);
    assertApprox(mat.opacity, 0.5);
    assert.equal(mat.depthWrite, false);

    // 2. Disable X-ray -> restores original properties
    const settingsXrayOff: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      shading: "solid",
      xray: false,
    };
    applyShading(scene, settingsXrayOff);

    assert.equal(mat.transparent, false);
    assertApprox(mat.opacity, 1.0);
    assert.equal(mat.depthWrite, true);
  });

  it("applyShading triggers renderedHook in rendered mode", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    let hookCalled = false;
    setRenderedHook((s, c) => {
      hookCalled = true;
      assert.equal(s, scene);
      assert.equal(c, camera);
    });

    const settings: ViewportSettings = {
      ...DEFAULT_VIEWPORT_SETTINGS,
      shading: "rendered",
    };

    applyShading(scene, settings, undefined, camera);
    assert.equal(hookCalled, true);
  });
});
