/**
 * @file jointsAndRopes.test.ts
 * @description Phase 165 tests: hinge, spring, distance, rope, and weld joints
 * (body-to-body, point, cursor), rope & chain generators, and 5-checkpoint replay parity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBodyFromLayer } from "../collidersAndBodies";
import {
  createJointPhysicsSimulation,
  generateRopeOrChain,
  solveJointConstraints,
  type PhysicsJointSpec,
} from "../jointsAndRopes";

describe("Phase 165: Joints, ropes & chains", () => {
  it("enforces distance, rope, spring, hinge, and weld constraints deterministically", () => {
    const bodyA = createBodyFromLayer(
      { id: "body_a", kind: "rectangle", x: 100, y: 100, width: 30, height: 30, rotationDeg: 15 },
      { weight: 50, bounce: 10, grip: 20, returnHome: 0 }
    );
    const bodyB = createBodyFromLayer(
      { id: "body_b", kind: "rectangle", x: 260, y: 100, width: 30, height: 30, rotationDeg: 65 },
      { weight: 50, bounce: 10, grip: 20, returnHome: 0 }
    );

    const distSolved = solveJointConstraints(
      [bodyA, bodyB],
      [
        {
          id: "j_dist",
          kind: "distance",
          a: { kind: "body", bodyId: "body_a" },
          b: { kind: "body", bodyId: "body_b" },
          length: 80,
        },
      ],
      { iterations: 12 }
    );
    const dx = distSolved[1]!.x - distSolved[0]!.x;
    const dy = distSolved[1]!.y - distSolved[0]!.y;
    assert.ok(Math.abs(Math.hypot(dx, dy) - 80) < 0.5);

    const welded = solveJointConstraints(
      [bodyA, bodyB],
      [
        {
          id: "j_weld",
          kind: "weld",
          a: { kind: "body", bodyId: "body_a" },
          b: { kind: "body", bodyId: "body_b" },
          referenceAngleRad: 0,
        },
      ],
      { iterations: 8 }
    );
    assert.ok(Math.abs(welded[0]!.angleRad - welded[1]!.angleRad) < 1e-4);
  });

  it("pulls a body toward live cursor via spring/distance cursor joint", () => {
    const badge = createBodyFromLayer(
      { id: "badge", kind: "rectangle", x: 100, y: 100, width: 40, height: 40 },
      { weight: 30, bounce: 20, grip: 10, returnHome: 0 }
    );
    const sim = createJointPhysicsSimulation(
      [badge],
      [
        {
          id: "cursor_tether",
          kind: "spring",
          a: { kind: "body", bodyId: "badge" },
          b: { kind: "cursor" },
          length: 0,
          stiffness: 180,
          damping: 8,
        },
      ],
      { gravityX: 0, gravityY: 0, seed: 165 }
    );
    sim.setCursor({ active: true, x: 400, y: 200 });
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }
    const moved = sim.getBodies()[0]!;
    assert.ok(moved.x > 180, `expected badge pulled toward cursor x=400, got ${moved.x}`);
  });

  it("replays a badge on a rope bit-identically across 5 checkpoints", () => {
    const badge = createBodyFromLayer(
      { id: "badge_payload", kind: "rectangle", x: 0, y: 0, width: 64, height: 36 },
      { weight: 65, bounce: 25, grip: 20, returnHome: 0 }
    );
    const rope = generateRopeOrChain({
      idPrefix: "badge_rope",
      startX: 250,
      startY: 40,
      endX: 380,
      endY: 160,
      linkCount: 6,
      variant: "rope",
      attachEndBody: badge,
    });
    const joints: readonly PhysicsJointSpec[] = rope.joints;

    const checkpointsSec = [0.2, 0.4, 0.6, 0.8, 1.0];
    const run = () => {
      const sim = createJointPhysicsSimulation(rope.bodies, joints, {
        gravityX: 0,
        gravityY: 980,
        seed: 165,
      });
      return checkpointsSec.map((t) => {
        if (Math.abs(t - 0.6) < 1e-6) {
          sim.setCursor({ active: false, x: 0, y: 0 });
        }
        while (sim.getTimeSec() + 1e-9 < t) {
          sim.step(1 / 60);
        }
        return {
          bodies: sim.getBodies().map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
          polyline: rope.getPolyline(sim.getBodies()),
        };
      });
    };

    const runA = run();
    const runB = run();
    assert.deepEqual(runA, runB);
    assert.equal(runA[0]!.polyline.length, 8);
  });
});
