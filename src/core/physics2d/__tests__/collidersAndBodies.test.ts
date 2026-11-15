/**
 * @file collidersAndBodies.test.ts
 * @description Phase 163 tests: collider derivation, collision layer masks,
 * Simple face mapping, drag-and-throw lifecycle, and falling-letters 5-checkpoint snapshot fixture.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPhysicsWorld2D, type PhysicsBodyState } from "../physicsCore";
import {
  COLLISION_LAYER_BITS,
  canLayersCollide,
  createBodyFromLayer,
  createDraggableBodyController,
  deriveColliderFromLayer,
  mapSimplePhysicsFace,
} from "../collidersAndBodies";

function buildFallingLettersFixture(): readonly PhysicsBodyState[] {
  const letters = ["L", "A", "Z", "Y"];
  const bodies: PhysicsBodyState[] = letters.map((char, idx) =>
    createBodyFromLayer(
      {
        id: `letter_${char}`,
        kind: "text",
        x: 120 + idx * 72,
        y: 60 + idx * 14,
        width: 48,
        height: 54,
        bodyKind: "dynamic",
        collisionLayer: COLLISION_LAYER_BITS.props,
        collisionMask: COLLISION_LAYER_BITS.props | COLLISION_LAYER_BITS.bounds,
      },
      {
        weight: 45 + idx * 5,
        bounce: 55,
        grip: 25,
        returnHome: 0,
        gravityStrength: 980,
        gravityDirectionDeg: 90,
      }
    )
  );

  // Static floor
  bodies.push(
    createBodyFromLayer(
      {
        id: "floor",
        kind: "rectangle",
        x: 0,
        y: 420,
        width: 800,
        height: 40,
        bodyKind: "static",
        collisionLayer: COLLISION_LAYER_BITS.bounds,
        collisionMask: COLLISION_LAYER_BITS.props,
      },
      { weight: 100, bounce: 40, grip: 60, returnHome: 0 }
    )
  );

  return bodies;
}

describe("Phase 163: Colliders & bodies", () => {
  it("derives circle from ellipse and box from rectangle/text layers", () => {
    const circle = deriveColliderFromLayer({
      id: "orb",
      kind: "ellipse",
      x: 0,
      y: 0,
      width: 60,
      height: 60,
    });
    assert.deepEqual(circle, { kind: "circle", radius: 30 });

    const box = deriveColliderFromLayer({
      id: "card",
      kind: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 80,
    });
    assert.deepEqual(box, { kind: "box", halfWidth: 60, halfHeight: 40 });
  });

  it("filters collisions using symmetric layer and mask bitfields", () => {
    assert.equal(
      canLayersCollide(
        COLLISION_LAYER_BITS.props,
        COLLISION_LAYER_BITS.bounds,
        COLLISION_LAYER_BITS.bounds,
        COLLISION_LAYER_BITS.props
      ),
      true
    );
    assert.equal(
      canLayersCollide(
        COLLISION_LAYER_BITS.ui,
        COLLISION_LAYER_BITS.ui,
        COLLISION_LAYER_BITS.particles,
        COLLISION_LAYER_BITS.bounds
      ),
      false
    );
  });

  it("maps Simple physics face controls and gravity arrow direction", () => {
    const heavyRight = mapSimplePhysicsFace({
      weight: 100,
      bounce: 50,
      grip: 80,
      returnHome: 60,
      gravityStrength: 1000,
      gravityDirectionDeg: 0,
    });
    assert.ok(heavyRight.mass > 10);
    assert.ok(heavyRight.homeStiffness > 0);
    assert.ok(Math.abs(heavyRight.gravityX - 1000) < 1e-6);
    assert.equal(heavyRight.gravityY, 0);
  });

  it("transitions draggable bodies to kinematic during drag and throws on release", () => {
    const dragger = createDraggableBodyController({ maxThrowSpeedPxPerSec: 1800 });
    let letter = createBodyFromLayer(
      { id: "drag_L", kind: "text", x: 100, y: 100, width: 40, height: 40 },
      { weight: 50, bounce: 50, grip: 20, returnHome: 0 }
    );
    assert.equal(letter.kind, "dynamic");

    letter = dragger.beginDrag(letter, 120, 120, 0);
    assert.equal(letter.kind, "kinematic");
    assert.equal(dragger.isDragging("drag_L"), true);

    letter = dragger.moveDrag(letter, 160, 120, 0.02);
    letter = dragger.moveDrag(letter, 220, 100, 0.04);
    assert.equal(letter.kind, "kinematic");

    letter = dragger.endDrag(letter, 0.04);
    assert.equal(letter.kind, "dynamic");
    assert.equal(dragger.isDragging("drag_L"), false);
    assert.ok(letter.vx > 1000, `expected strong throw vx, got ${letter.vx}`);
    assert.ok(letter.vy < 0, `expected upward throw vy, got ${letter.vy}`);
  });

  it("matches falling-letters fixture snapshots bit-identically across 5 checkpoints", () => {
    const checkpointsSec = [0.25, 0.5, 0.75, 1.0, 1.25];
    const run = () => {
      const world = createPhysicsWorld2D(buildFallingLettersFixture(), {
        gravityX: 0,
        gravityY: 980,
        seed: 163,
        snapshotIntervalSteps: 30,
      });
      return checkpointsSec.map((t) => {
        while (world.getTimeSec() + 1e-9 < t) {
          world.step(1 / 60);
        }
        return world.getBodies().map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          vx: b.vx,
          vy: b.vy,
        }));
      });
    };

    const first = run();
    const second = run();
    assert.deepEqual(first, second);
    // Letters start at y ~ 87..129 and fall toward the floor at y=440 (center)
    const firstCheckpointY = first[0]!.find((b) => b.id === "letter_L")!.y;
    const fourthCheckpointY = first[3]!.find((b) => b.id === "letter_L")!.y;
    assert.ok(fourthCheckpointY > firstCheckpointY, "letter should descend under gravity");
  });
});
