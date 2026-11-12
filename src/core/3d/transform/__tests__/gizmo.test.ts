/**
 * ============================================================================
 * UNIT TESTS: 3D TRANSFORM GIZMOS
 * ============================================================================
 * Phase 3D-016: gizmo.ts verification
 * Handle geometry generation, constant on-screen scaling, ray hit tests,
 * and direct-manipulation dragging.
 * ============================================================================
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { identity, vec3 } from "../../math";
import { dragGizmo, gizmoHandles, hitGizmo } from "../gizmo";
import type { ViewCameraInfo } from "../session";

const SQRT1_2 = Math.SQRT1_2;

function assertFloatsClose(actual: number, expected: number, eps = 1e-9) {
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    assert.fail(`actual=${actual} expected=${expected} diff=${diff} > ${eps}`);
  }
}

function assertVectorsClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  eps = 1e-9
) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > eps) {
      assert.fail(`at index [${i}]: actual=${actual[i]} expected=${expected[i]} diff=${diff} > ${eps}`);
    }
  }
}

function makeCamera(depth = 5): ViewCameraInfo {
  const viewMat = identity();
  viewMat[14] = -depth;

  const projMat = identity();
  projMat[0] = 1;
  projMat[5] = 1;
  projMat[15] = 0; // perspective

  return {
    viewMatrix: viewMat,
    projectionMatrix: projMat,
    viewport: { width: 800, height: 600 },
  };
}

describe("Gizmo: Geometry, Hit Testing, and Dragging", () => {
  it("generates correct handles for translate mode", () => {
    const handles = gizmoHandles("translate", identity(), makeCamera());
    assert.equal(handles.length, 6);
    const ids = handles.map((h) => h.id);
    assert.ok(ids.includes("translate-x"));
    assert.ok(ids.includes("translate-y"));
    assert.ok(ids.includes("translate-z"));
    assert.ok(ids.includes("translate-yz"));
    assert.ok(ids.includes("translate-xz"));
    assert.ok(ids.includes("translate-xy"));
  });

  it("generates 3 rotation rings for rotate mode", () => {
    const handles = gizmoHandles("rotate", identity(), makeCamera());
    assert.equal(handles.length, 3);
    const ids = handles.map((h) => h.id);
    assert.ok(ids.includes("rotate-x"));
    assert.ok(ids.includes("rotate-y"));
    assert.ok(ids.includes("rotate-z"));
  });

  it("generates scale boxes and uniform handle for scale mode", () => {
    const handles = gizmoHandles("scale", identity(), makeCamera());
    assert.equal(handles.length, 4);
    const ids = handles.map((h) => h.id);
    assert.ok(ids.includes("scale-x"));
    assert.ok(ids.includes("scale-y"));
    assert.ok(ids.includes("scale-z"));
    assert.ok(ids.includes("scale-uniform"));
  });

  it("maintains constant on-screen size: world length doubles when depth doubles", () => {
    const hNear = gizmoHandles("translate", identity(), makeCamera(5), 100);
    const hFar = gizmoHandles("translate", identity(), makeCamera(10), 100);

    const lenNear = hNear[0].length;
    const lenFar = hFar[0].length;
    assertFloatsClose(lenFar / lenNear, 2.0);
  });

  it("hitGizmo: ray directly intersecting X axis arrow hits 'translate-x'", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("translate", identity(), camera, 100);
    const xHandle = handles.find((h) => h.id === "translate-x")!;

    // Ray shooting along +Z through midpoint of X arrow
    const ray = {
      origin: vec3(xHandle.length * 0.5, 0, -5),
      direction: vec3(0, 0, 1),
    };

    const hit = hitGizmo(ray, handles);
    assert.equal(hit, "translate-x");
  });

  it("hitGizmo: ray directly intersecting Z axis arrow hits 'translate-z'", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("translate", identity(), camera, 100);
    const zHandle = handles.find((h) => h.id === "translate-z")!;

    // Ray shooting along +Y through midpoint of Z arrow
    const ray = {
      origin: vec3(0, -5, zHandle.length * 0.5),
      direction: vec3(0, 1, 0),
    };

    const hit = hitGizmo(ray, handles);
    assert.equal(hit, "translate-z");
  });

  it("hitGizmo: ray directed away from gizmo returns null", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("translate", identity(), camera, 100);

    const ray = {
      origin: vec3(100, 100, 0),
      direction: vec3(0, 1, 0),
    };

    const hit = hitGizmo(ray, handles);
    assert.equal(hit, null);
  });

  it("dragGizmo: axis-constrained dragging produces pure 1D translation", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("translate", identity(), camera, 100);
    const xHandle = handles.find((h) => h.id === "translate-x")!;

    const rayStart = {
      origin: vec3(1, 0, -5),
      direction: vec3(0, 0, 1),
    };
    const rayNow = {
      origin: vec3(3.5, 0, -5),
      direction: vec3(0, 0, 1),
    };

    const delta = dragGizmo(xHandle, rayStart, rayNow, identity());
    assert.equal(delta.mode, "translate");
    assertVectorsClose(delta.translation, [2.5, 0, 0]);
  });

  it("dragGizmo: plane-constrained dragging produces pure in-plane translation", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("translate", identity(), camera, 100);
    const xyHandle = handles.find((h) => h.id === "translate-xy")!;

    const rayStart = {
      origin: vec3(1, 1, -5),
      direction: vec3(0, 0, 1),
    };
    const rayNow = {
      origin: vec3(2, 4, -5),
      direction: vec3(0, 0, 1),
    };

    const delta = dragGizmo(xyHandle, rayStart, rayNow, identity());
    assert.equal(delta.mode, "translate");
    assertVectorsClose(delta.translation, [1, 3, 0]);
  });

  it("dragGizmo: rotation ring dragging produces angle rotation quaternion", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("rotate", identity(), camera, 100);
    const zRing = handles.find((h) => h.id === "rotate-z")!;

    // Ray start on +X axis on ring plane
    const rayStart = {
      origin: vec3(zRing.radius!, 0, -5),
      direction: vec3(0, 0, 1),
    };
    // Ray now on +Y axis on ring plane (quarter turn = 90 deg around Z)
    const rayNow = {
      origin: vec3(0, zRing.radius!, -5),
      direction: vec3(0, 0, 1),
    };

    const delta = dragGizmo(zRing, rayStart, rayNow, identity());
    assert.equal(delta.mode, "rotate");
    // Quaternion for 90 deg rotation around Z
    assertVectorsClose(delta.rotationQuat, [0, 0, SQRT1_2, SQRT1_2]);
  });

  it("dragGizmo: scale box dragging produces axis-aligned scale factor", () => {
    const camera = makeCamera(5);
    const handles = gizmoHandles("scale", identity(), camera, 100);
    const xScale = handles.find((h) => h.id === "scale-x")!;

    const rayStart = {
      origin: vec3(0, 0, -5),
      direction: vec3(0, 0, 1),
    };
    const rayNow = {
      origin: vec3(xScale.length, 0, -5),
      direction: vec3(0, 0, 1),
    };

    const delta = dragGizmo(xScale, rayStart, rayNow, identity());
    assert.equal(delta.mode, "scale");
    assertFloatsClose(delta.scale[0], 2.0); // 1 + length/length = 2.0
    assertFloatsClose(delta.scale[1], 1.0);
    assertFloatsClose(delta.scale[2], 1.0);
  });
});
