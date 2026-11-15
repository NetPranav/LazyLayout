/**
 * @file contactEvents.test.ts
 * @description Phase 164 tests: fixed-step OverlapBegin/Stay/End, Hit, FieldEnter/Exit events,
 * and "Show collision" debug overlay primitives.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPhysicsWorld2D } from "../physicsCore";
import { createBodyFromLayer } from "../collidersAndBodies";
import {
  buildCollisionDebugView,
  createContactEventTracker,
  type PhysicsContactEvent,
} from "../contactEvents";

describe("Phase 164: Contact events & collision view", () => {
  it("fires Hit, OverlapBegin/Stay/End, and FieldEnter/Exit at deterministic tape steps", () => {
    const ball = createBodyFromLayer(
      { id: "ball", kind: "ellipse", x: 100, y: 0, width: 40, height: 40 },
      { weight: 50, bounce: 80, grip: 10, returnHome: 0, gravityStrength: 0 },
      { vx: 0, vy: 320 }
    );
    const pad = createBodyFromLayer(
      { id: "pad", kind: "rectangle", x: 60, y: 120, width: 120, height: 24, bodyKind: "static" },
      { weight: 100, bounce: 80, grip: 10, returnHome: 0 }
    );
    const goalZone = createBodyFromLayer(
      {
        id: "zone",
        kind: "ellipse",
        x: 100,
        y: 60,
        width: 40,
        height: 40,
        bodyKind: "static",
        isTrigger: true,
      },
      { weight: 0, bounce: 0, grip: 0, returnHome: 0 }
    );

    const runTape = () => {
      const world = createPhysicsWorld2D([ball, pad, goalZone], {
        gravityX: 0,
        gravityY: 400,
        seed: 164,
      });
      const tracker = createContactEventTracker();
      const log: PhysicsContactEvent[] = [];

      for (let i = 0; i < 120; i++) {
        const manifolds = world.stepFixedSubstep();
        const events = tracker.processFixedStep({
          stepIndex: world.getStepIndex(),
          timeSec: world.getTimeSec(),
          bodies: world.getBodies(),
          manifolds,
          fields: [{ id: "magnet_zone", x: 120, y: 80, radius: 30 }],
          hitImpulseThreshold: 1,
        });
        log.push(...events);
      }
      return log;
    };

    const runA = runTape();
    const runB = runTape();
    assert.deepEqual(runA, runB);

    const kinds = new Set(runA.map((e) => e.kind));
    assert.ok(kinds.has("OverlapBegin"), "expected OverlapBegin");
    assert.ok(kinds.has("Hit"), "expected Hit on impact");
    assert.ok(kinds.has("OverlapEnd"), "expected OverlapEnd after rebound/exit");
    assert.ok(kinds.has("FieldEnter"), "expected FieldEnter");
    assert.ok(kinds.has("FieldExit"), "expected FieldExit");
  });

  it("builds collision debug view with colliders, contacts, normals, and velocities", () => {
    const ball = createBodyFromLayer(
      { id: "ball", kind: "ellipse", x: 100, y: 98, width: 40, height: 40 },
      { weight: 50, bounce: 50, grip: 20, returnHome: 0 },
      { vx: 40, vy: 200 }
    );
    const floor = createBodyFromLayer(
      { id: "floor", kind: "rectangle", x: 0, y: 120, width: 300, height: 40, bodyKind: "static" },
      { weight: 100, bounce: 50, grip: 20, returnHome: 0 }
    );
    const world = createPhysicsWorld2D([ball, floor], { gravityY: 980, seed: 164 });
    const manifolds = world.stepFixedSubstep();
    const debug = buildCollisionDebugView({
      stepIndex: world.getStepIndex(),
      timeSec: world.getTimeSec(),
      bodies: world.getBodies(),
      manifolds,
    });

    assert.equal(debug.colliders.length, 2);
    assert.ok(debug.contacts.length >= 1, "expected contact manifold in debug view");
    assert.equal(debug.velocities.length, 1, "expected 1 dynamic body velocity vector");
    assert.ok(debug.contacts[0]!.normalEndY !== debug.contacts[0]!.y);
  });
});
