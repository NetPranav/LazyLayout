import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TransformSession } from "@/core/3d/transform/session";
import { vec3, quat, identity, compose } from "@/core/3d/math";

function assertClose(a: number, b: number, eps = 1e-4) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} to be close to ${b} (diff ${Math.abs(a - b)} > ${eps})`
  );
}

describe("Phase 3D-016: Modal G / R / S Transform Session", () => {
  it("translates an object by typed numeric value along locked axis", () => {
    const session = new TransformSession({
      mode: "translate",
      objects: [
        {
          id: "cube_1",
          worldMatrix: identity(),
          local: {
            location: vec3(0, 0, 0),
            rotationQuat: [0, 0, 0, 1],
            scale: vec3(1, 1, 1),
          },
        },
      ],
      viewCamera: {
        viewMatrix: identity(),
        projectionMatrix: identity(),
        viewport: { width: 800, height: 600 },
      },
      pivot: vec3(0, 0, 0),
      orientation: "global",
    });

    // Press X to lock X axis
    session.setAxis("X");
    assert.equal(session.currentAxis, "X");

    // Type "2"
    session.typeChar("2");
    assert.equal(session.value(), 2);

    // Commit
    const committed = session.commit();
    assert.equal(committed.length, 1);
    assert.equal(committed[0].id, "cube_1");
    assertClose(committed[0].location[0], 2);
    assertClose(committed[0].location[1], 0);
    assertClose(committed[0].location[2], 0);
  });

  it("handles negative values, decimal numbers, and backspace", () => {
    const session = new TransformSession({
      mode: "translate",
      objects: [
        {
          id: "obj_1",
          worldMatrix: compose(vec3(1, 1, 1), quat(0, 0, 0, 1), vec3(1, 1, 1)), // where the object really is
          local: {
            location: vec3(1, 1, 1),
            rotationQuat: [0, 0, 0, 1],
            scale: vec3(1, 1, 1),
          },
        },
      ],
      viewCamera: {
        viewMatrix: identity(),
        projectionMatrix: identity(),
        viewport: { width: 800, height: 600 },
      },
      pivot: vec3(1, 1, 1),
      orientation: "global",
    });

    session.setAxis("Y");
    session.typeChar("5");
    session.typeChar(".");
    session.typeChar("2");
    session.negate();
    assertClose(session.value(), -5.2);

    session.backspace(); // deletes '2' -> -5.
    session.typeChar("5"); // -> -5.5
    assertClose(session.value(), -5.5);

    const committed = session.commit();
    assertClose(committed[0].location[0], 1);
    assertClose(committed[0].location[1], 1 - 5.5); // -4.5
    assertClose(committed[0].location[2], 1);
  });

  it("cancel restores original local transforms exactly", () => {
    const session = new TransformSession({
      mode: "translate",
      objects: [
        {
          id: "obj_restore",
          worldMatrix: identity(),
          local: {
            location: vec3(10, 20, 30),
            rotationQuat: [0, 0, 0, 1],
            scale: vec3(1, 1, 1),
          },
        },
      ],
      viewCamera: {
        viewMatrix: identity(),
        projectionMatrix: identity(),
        viewport: { width: 800, height: 600 },
      },
      pivot: vec3(10, 20, 30),
    });

    session.setAxis("Z");
    session.typeChar("9");

    const cancelled = session.cancel();
    assertClose(cancelled[0].location[0], 10);
    assertClose(cancelled[0].location[1], 20);
    assertClose(cancelled[0].location[2], 30);
  });
});
