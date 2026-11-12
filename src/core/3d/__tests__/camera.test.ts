/**
 * ============================================================================
 * UNIT TESTS: 3D VIEWPORT CAMERA & NAVIGATION (Phase 3D-014)
 * ============================================================================
 * Tests:
 *   - ViewCamera creation & defaults
 *   - Orbit, pan, dolly, flyStep, zoomToPoint
 *   - Exact orbit invertibility: orbit(+d) then orbit(-d) returns to start within 1e-12
 *   - View and projection matrices (perspective and orthographic)
 *   - Blender numpad standard views ("front", "back", "left", "right", "top", "bottom")
 *   - toggleOrtho scale continuity
 *   - frameBounds & frameAll
 *   - viewFromObjectCamera
 *   - Input gesture mapping (mouse, wheel, trackpad, touch)
 *   - 15-step navigation tape landing on hand-computed golden view matrix
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cameraBasis,
  cameraPosition,
  createViewCamera,
  dolly,
  flyStep,
  frameAll,
  frameBounds,
  orbit,
  pan,
  projectionMatrix,
  setStandardView,
  toggleOrtho,
  viewFromObjectCamera,
  viewMatrix,
  zoomToPoint,
} from "../camera/viewCamera";
import { navigationFromGesture } from "../camera/gestures";
import { type TapeStep, runTape } from "../camera/tape";
import { degToRad } from "../units";
import { vec3 } from "../math";
import type { MotionDocument, Object3d } from "../../document/schema";

function assertNear(
  actual: number,
  expected: number,
  epsilon = 1e-6,
  msg = "Values differ"
): void {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    assert.fail(`${msg}: actual=${actual} expected=${expected} diff=${diff} > ${epsilon}`);
  }
}

function assertVec3Near(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-6,
  msg = "Vectors differ"
): void {
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > epsilon) {
      assert.fail(`${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`);
    }
  }
}

function assertMat4Near(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-6,
  msg = "Matrices differ"
): void {
  for (let i = 0; i < 16; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > epsilon) {
      assert.fail(`${msg} at [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${epsilon}`);
    }
  }
}

describe("3D Camera: ViewCamera Model & Core Operations", () => {
  it("creates default camera with glTF conventions", () => {
    const cam = createViewCamera();
    assertNear(cam.distance, 5.0);
    assertNear(cam.yaw, 0.0);
    assertNear(cam.pitch, 0.0);
    assert.equal(cam.ortho, false);

    // Eye position at (0, 0, 5) looking along -Z at target (0, 0, 0)
    const eye = cameraPosition(cam);
    assertVec3Near(eye, [0, 0, 5], 1e-12);

    const basis = cameraBasis(cam);
    assertVec3Near(basis.forward, [0, 0, -1], 1e-12); // Looking -Z
    assertVec3Near(basis.right, [1, 0, 0], 1e-12); // Right +X
    assertVec3Near(basis.up, [0, 1, 0], 1e-12); // Up +Y
  });

  it("orbit(+d) then orbit(-d) returns to the start within 1e-12", () => {
    const cam0 = createViewCamera({ yaw: 0.25, pitch: 0.1 });
    const dYaw = 0.432198765;
    const dPitch = 0.246813579;

    const orbited = orbit(cam0, dYaw, dPitch);
    const returned = orbit(orbited, -dYaw, -dPitch);

    assertNear(returned.yaw, cam0.yaw, 1e-12, "Yaw did not return within 1e-12");
    assertNear(returned.pitch, cam0.pitch, 1e-12, "Pitch did not return within 1e-12");
    assertVec3Near(returned.target, cam0.target, 1e-12);
    assertNear(returned.distance, cam0.distance, 1e-12);
  });

  it("clamps pitch to prevent gimbal flip", () => {
    const cam0 = createViewCamera({ pitch: 0 });
    const clampedUp = orbit(cam0, 0, Math.PI);
    assert.ok(clampedUp.pitch < Math.PI / 2);
    assertNear(clampedUp.pitch, Math.PI / 2 - 1e-4, 1e-6);

    const clampedDown = orbit(cam0, 0, -Math.PI);
    assert.ok(clampedDown.pitch > -Math.PI / 2);
    assertNear(clampedDown.pitch, -(Math.PI / 2 - 1e-4), 1e-6);
  });

  it("pan moves target in view plane synchronously with cursor", () => {
    // In front view (yaw=0, pitch=0), right is +X, up is +Y
    // Distance = 10, fovY = 60 deg (tan(30 deg) = 1/sqrt(3))
    const cam = createViewCamera({
      target: vec3(0, 0, 0),
      distance: 10,
      fovY: degToRad(60),
    });

    const viewportH = 1000;
    // Moving cursor right (+100 px) moves target left along X so world moves right
    const panned = pan(cam, 100, 50, viewportH);

    const tanHalf = Math.tan(degToRad(30));
    const scale = (2 * 10 * tanHalf) / viewportH;

    // deltaTarget = -dx * scale * right + dy * scale * up
    assertNear(panned.target[0], -100 * scale, 1e-6);
    assertNear(panned.target[1], 50 * scale, 1e-6);
    assertNear(panned.target[2], 0, 1e-6);
  });

  it("dolly scales distance exponentially and clamps", () => {
    const cam = createViewCamera({ distance: 10 });
    const zoomedIn = dolly(cam, -Math.log(2));
    assertNear(zoomedIn.distance, 5, 1e-12);

    const zoomedOut = dolly(cam, Math.log(2));
    assertNear(zoomedOut.distance, 20, 1e-12);
  });

  it("zoomToPoint keeps center point stationary when zooming center", () => {
    const cam = createViewCamera({ target: vec3(0, 0, 0), distance: 10 });
    const zoomed = zoomToPoint(cam, 0.5, 500, 500, 1000, 1000);
    // Center point (500, 500) corresponds to NDC (0, 0)
    assertVec3Near(zoomed.target, [0, 0, 0], 1e-12);
    assertNear(zoomed.distance, 5, 1e-12);
  });

  it("flyStep moves camera along local forward, right, up directions", () => {
    const cam = createViewCamera({ target: vec3(0, 0, 0), yaw: 0, pitch: 0 });
    // In front view: forward is -Z, right is +X, up is +Y
    const step = flyStep(cam, { forward: 1, right: 2, up: 3 }, 0.1, 10);
    // step size = 1.0; dx = 2, dy = 3, dz = -1
    assertNear(step.target[0], 2, 1e-6);
    assertNear(step.target[1], 3, 1e-6);
    assertNear(step.target[2], -1, 1e-6);
  });
});

describe("3D Camera: Matrices & Standard Views", () => {
  it("viewMatrix produces exact glTF look-at transform", () => {
    const cam = createViewCamera({
      target: vec3(0, 0, 0),
      distance: 5,
      yaw: 0,
      pitch: 0,
    });
    const vm = viewMatrix(cam);

    // Eye is at (0, 0, 5). Camera space: right=+X, up=+Y, forward=-Z (z_cam = -5 at target)
    assertMat4Near(
      vm,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1],
      1e-12
    );
  });

  it("projectionMatrix perspective and orthographic forms", () => {
    const camPersp = createViewCamera({
      fovY: degToRad(90),
      near: 1,
      far: 10,
      ortho: false,
    });
    // aspect = 1.0, f = 1/tan(45 deg) = 1.0
    const pmP = projectionMatrix(camPersp, 1.0);
    assertNear(pmP[0], 1.0, 1e-6); // f / aspect
    assertNear(pmP[5], 1.0, 1e-6); // f
    assertNear(pmP[10], -(10 + 1) / (10 - 1), 1e-6); // -(far+near)/(far-near) = -11/9
    assertNear(pmP[11], -1.0, 1e-6);
    assertNear(pmP[14], -(2 * 10 * 1) / (10 - 1), 1e-6); // -20/9

    const camOrtho = createViewCamera({
      ortho: true,
      orthoSize: 4,
      near: 1,
      far: 10,
    });
    // aspect = 2.0; top = 2, right = 4
    const pmO = projectionMatrix(camOrtho, 2.0);
    assertNear(pmO[0], 1 / 4, 1e-6); // 1 / right
    assertNear(pmO[5], 1 / 2, 1e-6); // 1 / top
    assertNear(pmO[10], -2 / 9, 1e-6); // -2 / (far-near)
    assertNear(pmO[14], -11 / 9, 1e-6); // -(far+near)/(far-near)
    assertNear(pmO[15], 1.0, 1e-6);
  });

  it("setStandardView aligns with Blender numpad semantics converted to glTF", () => {
    const cam = createViewCamera();

    const front = setStandardView(cam, "front");
    assertNear(front.yaw, 0, 1e-12);
    assertNear(front.pitch, 0, 1e-12);

    const back = setStandardView(cam, "back");
    assertNear(back.yaw, Math.PI, 1e-12);
    assertNear(back.pitch, 0, 1e-12);

    const right = setStandardView(cam, "right");
    assertNear(right.yaw, Math.PI / 2, 1e-12);
    assertNear(right.pitch, 0, 1e-12);

    const left = setStandardView(cam, "left");
    assertNear(left.yaw, -Math.PI / 2, 1e-12);
    assertNear(left.pitch, 0, 1e-12);

    const top = setStandardView(cam, "top");
    assertNear(top.yaw, 0, 1e-12);
    assert.ok(top.pitch > 1.5);

    const bottom = setStandardView(cam, "bottom");
    assertNear(bottom.yaw, 0, 1e-12);
    assert.ok(bottom.pitch < -1.5);
  });

  it("toggleOrtho preserves scene scale at target point", () => {
    const cam0 = createViewCamera({
      distance: 10,
      fovY: degToRad(60),
      ortho: false,
    });
    const orthoCam = toggleOrtho(cam0);
    assert.equal(orthoCam.ortho, true);

    const expectedOrthoSize = 2 * 10 * Math.tan(degToRad(30));
    assertNear(orthoCam.orthoSize, expectedOrthoSize, 1e-12);

    const backToPersp = toggleOrtho(orthoCam);
    assert.equal(backToPersp.ortho, false);
    assertNear(backToPersp.distance, 10, 1e-12);
  });

  it("frameBounds and frameAll cleanly enclose bounding boxes", () => {
    const cam = createViewCamera({ fovY: degToRad(60) });
    const aabb = { min: [-2, -3, -4], max: [2, 3, 4] };
    const framed = frameBounds(cam, aabb, 1.0);

    assertVec3Near(framed.target, [0, 0, 0], 1e-12);
    // Extents: 4, 6, 8. Radius = sqrt(16+36+64)/2 = sqrt(116)/2 ≈ 5.385
    assert.ok(framed.distance > 8);

    const allFramed = frameAll(
      cam,
      [
        { min: [0, 0, 0], max: [1, 1, 1] },
        { min: [10, 10, 10], max: [12, 12, 12] },
      ],
      1.0
    );
    assertNear(allFramed.target[0], 6.0, 1e-6);
    assertNear(allFramed.target[1], 6.0, 1e-6);
    assertNear(allFramed.target[2], 6.0, 1e-6);
  });

  it("viewFromObjectCamera extracts camera view from document", () => {
    const doc: MotionDocument = {
      schemaVersion: 7,
      layers: {},
      clips: {},
      states: {},
      behaviours: {},
      sequences: {},
      transitions: {},
      bindings: {},
      surfaces: {},
      inputTapes: {},
      graphs: {},
      effects: {},
      components: {},
      generators: {},
      compositions: {},
      tokens: { colors: {}, spacing: {}, radii: {} },
      exportSettings: {
        framework: "react",
        styling: "tailwind",
        animation: "gsap",
        language: "typescript",
      },
      objects: {
        cam_obj: {
          id: "cam_obj",
          name: "Main Camera",
          type: "camera",
          transform: {
            location: [0, 2, 10],
            rotationQuat: [0, 0, 0, 1], // Facing -Z
            scale: [1, 1, 1],
          },
          dataId: "cam_data",
        },
      },
      cameras: {
        cam_data: {
          id: "cam_data",
          type: "perspective",
          fov: 45,
          near: 0.2,
          far: 500,
        },
      },
    };

    const camObj = doc.objects!.cam_obj as Object3d;
    const vCam = viewFromObjectCamera(camObj, doc);

    assertNear(vCam.target[0], 0, 1e-6);
    assertNear(vCam.target[1], 2, 1e-6);
    assert.ok(vCam.target[2] < 10); // In front of eye at [0, 2, 10]
    assertNear(vCam.fovY, degToRad(45), 1e-6);
    assertNear(vCam.near, 0.2, 1e-6);
    assertNear(vCam.far, 500, 1e-6);
  });
});

describe("3D Camera: Gestures Mapping", () => {
  it("maps mouse middle drag to orbit, shift+middle to pan, ctrl+middle to dolly", () => {
    const orbitAction = navigationFromGesture({
      device: "mouse",
      button: 1,
      dx: 10,
      dy: 20,
    });
    assert.equal(orbitAction.action, "orbit");
    assertNear(orbitAction.dx, 10 * 0.005, 1e-6);
    assertNear(orbitAction.dy, 20 * 0.005, 1e-6);

    const panAction = navigationFromGesture({
      device: "mouse",
      button: 1,
      dx: 15,
      dy: -25,
      shiftKey: true,
    });
    assert.equal(panAction.action, "pan");
    assertNear(panAction.dx, 15, 1e-6);
    assertNear(panAction.dy, -25, 1e-6);

    const dollyAction = navigationFromGesture({
      device: "mouse",
      button: 1,
      dx: 0,
      dy: 30,
      ctrlKey: true,
    });
    assert.equal(dollyAction.action, "dolly");
    assertNear(dollyAction.dollyDelta, 30 * 0.005, 1e-6);

    const leftClick = navigationFromGesture({
      device: "mouse",
      button: 0,
      dx: 10,
      dy: 10,
    });
    assert.equal(leftClick.action, "none");
  });

  it("maps wheel, trackpad, and touch gestures correctly", () => {
    const wheelDolly = navigationFromGesture({
      device: "wheel",
      deltaY: 100,
    });
    assert.equal(wheelDolly.action, "dolly");
    assertNear(wheelDolly.dollyDelta, 100 * 0.0015, 1e-6);

    const trackpadOrbit = navigationFromGesture({
      device: "trackpad",
      deltaX: 40,
      deltaY: -20,
    });
    assert.equal(trackpadOrbit.action, "orbit");

    const touch1 = navigationFromGesture({
      device: "touch",
      touches: [{ id: 0, x: 100, y: 150 }],
      prevTouches: [{ id: 0, x: 90, y: 140 }],
    });
    assert.equal(touch1.action, "orbit");
    assertNear(touch1.dx, 10 * 0.005, 1e-6);

    const touch2 = navigationFromGesture({
      device: "touch",
      touches: [
        { id: 0, x: 100, y: 200 },
        { id: 1, x: 300, y: 200 },
      ],
      prevTouches: [
        { id: 0, x: 120, y: 200 },
        { id: 1, x: 280, y: 200 },
      ],
    });
    assert.ok(touch2.action === "dolly" || touch2.action === "pan_pinch");
  });
});

describe("3D Camera: 15-Step Navigation Tape & Analytical Golden Test", () => {
  it("executes 15-step tape and lands on exact hand-computed view matrix", () => {
    // Starting camera at (0, 0, 10) looking along -Z at (0, 0, 0)
    const cam0 = createViewCamera({
      target: vec3(0, 0, 0),
      distance: 10.0,
      yaw: 0.0,
      pitch: 0.0,
      fovY: degToRad(60.0),
      ortho: false,
    });

    // 15 distinct navigation steps whose net transformation returns to known analytical state:
    // Final camera state by exact mathematics:
    // target = [0, 0, 0], distance = 10.0, yaw = 0.0, pitch = 0.0, ortho = false
    const tape: TapeStep[] = [
      { kind: "orbit", dx: 0.5, dy: 0.2 }, // 1
      { kind: "dolly", delta: Math.log(1.5) }, // 2 (dist = 15)
      { kind: "orbit", dx: -0.2, dy: 0.1 }, // 3
      { kind: "dolly", delta: -Math.log(1.5) }, // 4 (dist = 10)
      { kind: "orbit", dx: -0.3, dy: -0.3 }, // 5 (yaw = 0, pitch = 0)
      { kind: "view", view: "front" }, // 6
      { kind: "pan", dx: 100, dy: 0, viewportH: 1000 }, // 7
      { kind: "pan", dx: -100, dy: 0, viewportH: 1000 }, // 8 (target = [0, 0, 0])
      { kind: "orbit", dx: Math.PI / 2, dy: 0 }, // 9 (yaw = PI/2)
      { kind: "dolly", delta: Math.log(2.0) }, // 10 (dist = 20)
      { kind: "view", view: "right" }, // 11 (yaw = PI/2)
      { kind: "ortho", ortho: true }, // 12 (toggle to ortho)
      { kind: "ortho", ortho: false }, // 13 (toggle to persp, dist = 20)
      { kind: "view", view: "front" }, // 14 (yaw = 0, pitch = 0)
      { kind: "dolly", delta: -Math.log(2.0) }, // 15 (dist = 10)
    ];

    assert.equal(tape.length, 15, "Tape must contain exactly 15 steps");

    const finalCam = runTape(cam0, tape);

    // Verify analytical final camera parameters
    assertVec3Near(finalCam.target, [0, 0, 0], 1e-12);
    assertNear(finalCam.distance, 10.0, 1e-12);
    assertNear(finalCam.yaw, 0.0, 1e-12);
    assertNear(finalCam.pitch, 0.0, 1e-12);
    assert.equal(finalCam.ortho, false);

    // Analytical hand-computed 4x4 column-major view matrix:
    // Eye is at (0, 0, 10). Camera looks towards (0, 0, 0) along -Z.
    // Right = +X, Up = +Y, Forward = -Z.
    // Matrix maps (x, y, z) to (x, y, z - 10):
    // [ 1,  0,  0, 0,
    //   0,  1,  0, 0,
    //   0,  0,  1, 0,
    //   0,  0, -10, 1 ]
    const expectedHandComputedViewMatrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -10, 1,
    ];

    const actualViewMatrix = viewMatrix(finalCam);
    assertMat4Near(
      actualViewMatrix,
      expectedHandComputedViewMatrix,
      1e-12,
      "15-step tape view matrix did not land on expected analytical matrix"
    );
  });
});
