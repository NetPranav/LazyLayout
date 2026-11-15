import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PBR_MATERIAL_PRESETS,
  TEN_SAMPLE_GLTF_FIXTURES,
  buildArcLengthCameraPath,
  evaluateLightingRig,
  evaluatePbrSurfaceResponse,
  importGltfAsset,
  sampleCameraPathAtTime,
} from "../index";

describe("Stage 6 Phases 224–227 · GLTF Import, PBR Materials, Lighting & Camera Paths", () => {
  it("Phase 224: imports 10 valid sample GLTF models and rejects malformed/unsafe fixtures with explicit reason", () => {
    assert.equal(TEN_SAMPLE_GLTF_FIXTURES.length, 10);
    for (const fixture of TEN_SAMPLE_GLTF_FIXTURES) {
      const res = importGltfAsset(fixture);
      assert.equal(res.ok, true);
      assert.ok(res.thumbnailId.includes(fixture.id));
      assert.ok(res.tierVariants.T0.triangleBudget <= res.tierVariants.T3.triangleBudget);
    }

    const malformed = importGltfAsset({
      id: "bad_magic",
      filename: "corrupt.glb",
      magic: "invalid",
      version: 1,
      vertexCount: 10,
      triangleCount: 5,
      byteLength: 100,
    });
    assert.equal(malformed.ok, false);
    assert.ok((malformed.reason ?? "").includes("malformed"));

    const evilUri = importGltfAsset({
      ...TEN_SAMPLE_GLTF_FIXTURES[0],
      id: "evil_uri",
      uris: ["javascript:alert(1)"],
    });
    assert.equal(evilUri.ok, false);
    assert.ok((evilUri.reason ?? "").includes("Disallowed"));
  });

  it("Phase 225: evaluates PBR presets cleanly (glass transmittance, metal F0, diffuse plastic)", () => {
    const glass = evaluatePbrSurfaceResponse(PBR_MATERIAL_PRESETS.glass, 0.9);
    const metal = evaluatePbrSurfaceResponse(PBR_MATERIAL_PRESETS.metal, 0.9);
    const matte = evaluatePbrSurfaceResponse(PBR_MATERIAL_PRESETS.matte, 0.9);
    assert.ok(glass.transmittance > 0.85);
    assert.ok(metal.f0 > 0.7 && metal.diffuseAlbedo < 0.01);
    assert.ok(matte.diffuseAlbedo > metal.diffuseAlbedo);
  });

  it("Phase 226: evaluates multi-light rig + HDRI + ACESFilmic/AgX tone mapping within T0–T3 budgets", () => {
    const lights = [
      { id: "amb", kind: "ambient" as const, position: { x: 0, y: 0, z: 0 }, color: [1, 1, 1] as const, intensity: 0.4, castShadow: false, shadowMapSize: 512 },
      { id: "dir", kind: "directional" as const, position: { x: 5, y: 8, z: 5 }, color: [1, 0.96, 0.9] as const, intensity: 2.0, castShadow: true, shadowMapSize: 2048 },
      { id: "rim", kind: "spot" as const, position: { x: -4, y: 5, z: -4 }, color: [0.6, 0.8, 1] as const, intensity: 1.5, castShadow: true, shadowMapSize: 2048, spotAngleDeg: 35 },
    ];
    for (const tier of ["T0", "T1", "T2", "T3"] as const) {
      const res = evaluateLightingRig(
        lights,
        { hdriPreset: "studio-softbox", exposure: 1.1, backgroundBlur: 0.2, toneMapping: "ACESFilmic", ambientIntensity: 0.5 },
        tier,
      );
      assert.equal(res.withinTierBudget, true, `Tier ${tier} exceeded budget (${res.estimatedGpuMs}ms)`);
      assert.ok(res.toneMappedPeak > 0 && res.toneMappedPeak <= 1);
    }
  });

  it("Phase 227: samples arc-length parameterized Catmull-Rom 3D camera path at strictly uniform speed", () => {
    const path = buildArcLengthCameraPath(
      "flythrough",
      [
        { x: -4, y: 1, z: 6 },
        { x: 0, y: 2.5, z: 4 },
        { x: 4, y: 1.5, z: 5 },
      ],
      { x: 0, y: 0.5, z: 0 },
    );
    const s0 = sampleCameraPathAtTime(path, 0.0);
    const s25 = sampleCameraPathAtTime(path, 0.25);
    const s50 = sampleCameraPathAtTime(path, 0.5);
    const s75 = sampleCameraPathAtTime(path, 0.75);
    assert.ok(Math.abs(s25.arcLength - path.totalLength * 0.25) < 1e-6);
    assert.ok(Math.abs(s50.arcLength - path.totalLength * 0.5) < 1e-6);
    assert.ok(Math.abs(s75.arcLength - path.totalLength * 0.75) < 1e-6);
    assert.notDeepEqual(s0.position, s50.position);
  });
});
