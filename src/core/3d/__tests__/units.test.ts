/**
 * ============================================================================
 * UNIT TESTS: 3D UNITS, CONVENTIONS & CAMERA PROJECTION
 * ============================================================================
 * Phase 3D-009: units.ts verification
 *   - Document conventions (Y-up, right-handed, metres, radians).
 *   - PX_PER_METRE default 100, stored per scene as scene.settings.pxPerMetre.
 *   - pxToMetres and metresToPx conversions and round-trips.
 *   - degToRad and radToDeg conversions and formatAngle UI formatting.
 *   - 454x320 frame turned 3D projects to 454x320 px within 0.5 px (all four
 *     corners and center) across several FOVs, frame sizes, and densities.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COORDINATE_SYSTEM,
  DEFAULT_PX_PER_METRE,
  PX_PER_METRE,
  defaultCameraFor,
  degToRad,
  formatAngle,
  frameTo3D,
  getPxPerMetre,
  metresToPx,
  projectToScreen,
  pxToMetres,
  radToDeg,
} from "../units";
import type { Scene3d } from "../../document/scene3d";

describe("3D Units & Conventions", () => {
  it("defines standard glTF 2.0 document conventions", () => {
    assert.equal(COORDINATE_SYSTEM.up, "+Y");
    assert.equal(COORDINATE_SYSTEM.forward, "-Z");
    assert.equal(COORDINATE_SYSTEM.right, "+X");
    assert.equal(COORDINATE_SYSTEM.handedness, "right");
    assert.equal(COORDINATE_SYSTEM.unit, "metres");
    assert.equal(COORDINATE_SYSTEM.angleUnit, "radians");
    assert.equal(PX_PER_METRE, 100);
    assert.equal(DEFAULT_PX_PER_METRE, 100);
  });

  it("resolves pxPerMetre from default, scene settings, or number overrides", () => {
    assert.equal(getPxPerMetre(), 100);
    assert.equal(getPxPerMetre(null), 100);
    assert.equal(getPxPerMetre(undefined), 100);
    assert.equal(getPxPerMetre(50), 50);

    const sceneWithoutSettings: Scene3d = {
      id: "scene_1",
      objects: [],
    };
    assert.equal(getPxPerMetre(sceneWithoutSettings), 100);

    const sceneWithCustomPpm: Scene3d = {
      id: "scene_2",
      objects: [],
      settings: {
        pxPerMetre: 250,
      },
    };
    assert.equal(getPxPerMetre(sceneWithCustomPpm), 250);
  });

  it("converts pixels to metres and metres to pixels accurately", () => {
    // Default 100 px = 1 m
    assert.equal(pxToMetres(100), 1.0);
    assert.equal(pxToMetres(454), 4.54);
    assert.equal(pxToMetres(0), 0.0);
    assert.equal(pxToMetres(-200), -2.0);

    assert.equal(metresToPx(1.0), 100);
    assert.equal(metresToPx(4.54), 454);
    assert.equal(metresToPx(0), 0);
    assert.equal(metresToPx(-2.0), -200);

    // Custom density
    const scene: Scene3d = {
      id: "scene_cust",
      objects: [],
      settings: { pxPerMetre: 50 },
    };
    assert.equal(pxToMetres(100, scene), 2.0);
    assert.equal(metresToPx(2.0, scene), 100);
    assert.equal(pxToMetres(100, 200), 0.5);
    assert.equal(metresToPx(0.5, 200), 100);

    // Round-trip check
    const testValues = [1, 10, 454, 1920, 0.001, 888.88];
    for (const val of testValues) {
      assert.ok(Math.abs(metresToPx(pxToMetres(val)) - val) < 1e-12);
    }
  });

  it("converts between degrees and radians and round-trips", () => {
    assert.equal(degToRad(0), 0);
    assert.equal(degToRad(180), Math.PI);
    assert.equal(degToRad(90), Math.PI / 2);
    assert.equal(degToRad(45), Math.PI / 4);
    assert.equal(degToRad(360), 2 * Math.PI);
    assert.equal(degToRad(-90), -Math.PI / 2);

    assert.equal(radToDeg(0), 0);
    assert.equal(radToDeg(Math.PI), 180);
    assert.equal(radToDeg(Math.PI / 2), 90);
    assert.equal(radToDeg(Math.PI / 4), 45);
    assert.equal(radToDeg(2 * Math.PI), 360);

    const testAngles = [-360, -180, -45, 0, 30, 45, 60, 90, 120, 180, 270, 360];
    for (const deg of testAngles) {
      assert.ok(Math.abs(radToDeg(degToRad(deg)) - deg) < 1e-12);
    }
  });

  it("formats angles cleanly for UI display in degrees", () => {
    assert.equal(formatAngle(0), "0°");
    assert.equal(formatAngle(Math.PI), "180°");
    assert.equal(formatAngle(Math.PI / 2), "90°");
    assert.equal(formatAngle(Math.PI / 4), "45°");
    assert.equal(formatAngle(-Math.PI / 2), "-90°");

    // Decimals option
    assert.equal(formatAngle(Math.PI / 3, 1), "60.0°");
    assert.equal(formatAngle(Math.PI / 3, 2), "60.00°");
    assert.equal(formatAngle(degToRad(45.678), 2), "45.68°");

    // Options object with unit toggle
    assert.equal(formatAngle(Math.PI, { decimals: 0 }), "180°");
    assert.equal(formatAngle(Math.PI, { unit: false }), "180");
    assert.equal(formatAngle(Math.PI / 4, { decimals: 2, unit: false }), "45.00");
  });

  it("computes 3D plane dimensions from 2D frame pixels", () => {
    const plane = frameTo3D(454, 320);
    assert.equal(plane.width, 4.54);
    assert.equal(plane.height, 3.20);

    // Iterable destructuring support: const [w, h] = frameTo3D(...)
    const [w, h] = frameTo3D(800, 600, 200);
    assert.equal(w, 4.0);
    assert.equal(h, 3.0);
  });
});

describe("2D-to-3D Projection Accuracy (The 0.5px Contract)", () => {
  it("projects a 454x320 frame at z=0 to 454x320 px within 0.5 px across all corners", () => {
    const width = 454;
    const height = 320;
    const pxPerMetre = 100;
    const fovY = 50; // 50 degrees

    const cam = defaultCameraFor(width, height, pxPerMetre, fovY);

    assert.equal(cam.type, "perspective");
    assert.equal(cam.position[0], 0);
    assert.equal(cam.position[1], 0);
    assert.ok(cam.position[2] > 0, "Camera sits on +Z");
    assert.equal(cam.rotationQuat[0], 0);
    assert.equal(cam.rotationQuat[1], 0);
    assert.equal(cam.rotationQuat[2], 0);
    assert.equal(cam.rotationQuat[3], 1);

    const planeW = width / pxPerMetre; // 4.54 m
    const planeH = height / pxPerMetre; // 3.20 m

    const halfW = planeW / 2;
    const halfH = planeH / 2;

    // Check all four corners and center:
    // 1. Top-Left: (-halfW, +halfH, 0)
    const tl = projectToScreen(cam, width, height, [-halfW, halfH, 0]);
    assert.ok(Math.abs(tl.x - 0) < 0.5, `TL x expected 0, got ${tl.x}`);
    assert.ok(Math.abs(tl.y - 0) < 0.5, `TL y expected 0, got ${tl.y}`);

    // 2. Top-Right: (+halfW, +halfH, 0)
    const tr = projectToScreen(cam, width, height, [halfW, halfH, 0]);
    assert.ok(Math.abs(tr.x - width) < 0.5, `TR x expected ${width}, got ${tr.x}`);
    assert.ok(Math.abs(tr.y - 0) < 0.5, `TR y expected 0, got ${tr.y}`);

    // 3. Bottom-Left: (-halfW, -halfH, 0)
    const bl = projectToScreen(cam, width, height, [-halfW, -halfH, 0]);
    assert.ok(Math.abs(bl.x - 0) < 0.5, `BL x expected 0, got ${bl.x}`);
    assert.ok(Math.abs(bl.y - height) < 0.5, `BL y expected ${height}, got ${bl.y}`);

    // 4. Bottom-Right: (+halfW, -halfH, 0)
    const br = projectToScreen(cam, width, height, [halfW, -halfH, 0]);
    assert.ok(Math.abs(br.x - width) < 0.5, `BR x expected ${width}, got ${br.x}`);
    assert.ok(Math.abs(br.y - height) < 0.5, `BR y expected ${height}, got ${br.y}`);

    // 5. Center: (0, 0, 0)
    const center = projectToScreen(cam, width, height, [0, 0, 0]);
    assert.ok(Math.abs(center.x - width / 2) < 0.5, `Center x expected ${width / 2}, got ${center.x}`);
    assert.ok(Math.abs(center.y - height / 2) < 0.5, `Center y expected ${height / 2}, got ${center.y}`);

    // Destructuring support: const [x, y] = projectToScreen(...)
    const [tlX, tlY] = tl;
    assert.ok(Math.abs(tlX - 0) < 0.5);
    assert.ok(Math.abs(tlY - 0) < 0.5);
  });

  it("maintains < 0.5 px accuracy for multiple FOVs (30°, 45°, 60°, 75°, 90°, and radians)", () => {
    const width = 454;
    const height = 320;
    const pxPerMetre = 100;

    const testFovs = [
      30, // degrees
      45,
      50,
      60,
      75,
      90,
      Math.PI / 4, // radians (45°)
      Math.PI / 3, // radians (60°)
    ];

    for (const fov of testFovs) {
      const cam = defaultCameraFor(width, height, pxPerMetre, fov);
      const halfW = (width / pxPerMetre) / 2;
      const halfH = (height / pxPerMetre) / 2;

      const tl = projectToScreen(cam, width, height, [-halfW, halfH, 0]);
      const tr = projectToScreen(cam, width, height, [halfW, halfH, 0]);
      const bl = projectToScreen(cam, width, height, [-halfW, -halfH, 0]);
      const br = projectToScreen(cam, width, height, [halfW, -halfH, 0]);

      assert.ok(Math.abs(tl.x - 0) < 0.5, `FOV ${fov}: TL.x error too large: ${tl.x}`);
      assert.ok(Math.abs(tl.y - 0) < 0.5, `FOV ${fov}: TL.y error too large: ${tl.y}`);
      assert.ok(Math.abs(tr.x - width) < 0.5, `FOV ${fov}: TR.x error too large: ${tr.x}`);
      assert.ok(Math.abs(tr.y - 0) < 0.5, `FOV ${fov}: TR.y error too large: ${tr.y}`);
      assert.ok(Math.abs(bl.x - 0) < 0.5, `FOV ${fov}: BL.x error too large: ${bl.x}`);
      assert.ok(Math.abs(bl.y - height) < 0.5, `FOV ${fov}: BL.y error too large: ${bl.y}`);
      assert.ok(Math.abs(br.x - width) < 0.5, `FOV ${fov}: BR.x error too large: ${br.x}`);
      assert.ok(Math.abs(br.y - height) < 0.5, `FOV ${fov}: BR.y error too large: ${br.y}`);
    }
  });

  it("maintains < 0.5 px accuracy for multiple frame sizes and pixel densities", () => {
    const testCases = [
      { w: 100, h: 100, ppm: 100, fov: 50 },
      { w: 320, h: 454, ppm: 100, fov: 60 },
      { w: 800, h: 600, ppm: 100, fov: 50 },
      { w: 1920, h: 1080, ppm: 100, fov: 55 },
      { w: 1920, h: 1080, ppm: 50, fov: 45 },
      { w: 454, h: 320, ppm: 250, fov: 70 },
    ];

    for (const { w, h, ppm, fov } of testCases) {
      const cam = defaultCameraFor(w, h, ppm, fov);
      const halfW = (w / ppm) / 2;
      const halfH = (h / ppm) / 2;

      const tl = projectToScreen(cam, w, h, [-halfW, halfH, 0]);
      const br = projectToScreen(cam, w, h, [halfW, -halfH, 0]);

      assert.ok(Math.abs(tl.x - 0) < 0.5, `Case ${w}x${h} ppm=${ppm}: TL.x = ${tl.x}`);
      assert.ok(Math.abs(tl.y - 0) < 0.5, `Case ${w}x${h} ppm=${ppm}: TL.y = ${tl.y}`);
      assert.ok(Math.abs(br.x - w) < 0.5, `Case ${w}x${h} ppm=${ppm}: BR.x = ${br.x}`);
      assert.ok(Math.abs(br.y - h) < 0.5, `Case ${w}x${h} ppm=${ppm}: BR.y = ${br.y}`);
    }
  });
});
