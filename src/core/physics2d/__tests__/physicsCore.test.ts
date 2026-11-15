import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPhysicsWorld2D, type PhysicsBodyState } from "../physicsCore.js";

function buildDropScene(): PhysicsBodyState[] {
  const bodies: PhysicsBodyState[] = [
    {
      id: "floor",
      kind: "static",
      shape: { kind: "box", halfWidth: 800, halfHeight: 40 },
      x: 400,
      y: 620,
      vx: 0,
      vy: 0,
      angleRad: 0,
      angularVel: 0,
      mass: 0,
      restitution: 0.4,
      friction: 0.5,
      linearDamping: 0,
      angularDamping: 0,
    },
  ];
  for (let i = 0; i < 200; i++) {
    bodies.push({
      id: `ball_${String(i).padStart(3, "0")}`,
      kind: "dynamic",
      shape: i % 2 === 0 ? { kind: "circle", radius: 12 } : { kind: "box", halfWidth: 11, halfHeight: 11 },
      x: 80 + (i % 16) * 40,
      y: 20 + Math.floor(i / 16) * 32,
      vx: 0,
      vy: 0,
      angleRad: 0,
      angularVel: 0,
      mass: 1,
      restitution: 0.45,
      friction: 0.3,
      linearDamping: 0.05,
      angularDamping: 0.05,
    });
  }
  return bodies;
}

describe("Phase 162 · 2D physics core (Decision 0006 determinism)", () => {
  it("replays a 200-body drop scene bit-identically across runs and frame rates (60 vs 120 Hz)", () => {
    const worldA = createPhysicsWorld2D(buildDropScene(), { seed: 42 });
    const worldB = createPhysicsWorld2D(buildDropScene(), { seed: 42 });

    // Run A at 60 Hz for 0.5s (30 ticks)
    for (let f = 0; f < 30; f++) {
      worldA.step(1 / 60);
    }

    // Run B at 120 Hz for 0.5s (60 ticks)
    for (let f = 0; f < 60; f++) {
      worldB.step(1 / 120);
    }

    assert.equal(worldA.getStepIndex(), 60);
    assert.equal(worldB.getStepIndex(), 60);
    assert.deepEqual(worldA.getBodies(), worldB.getBodies());
  });

  it("supports snapshot timeline seeking with bit-identical state restoration", () => {
    const world = createPhysicsWorld2D(buildDropScene(), { seed: 9, snapshotIntervalSteps: 20 });
    for (let f = 0; f < 60; f++) {
      world.step(1 / 120);
    }
    const at60 = world.createSnapshot();

    for (let f = 0; f < 40; f++) {
      world.step(1 / 120);
    }
    const seekedBack = world.seekToTime(60 / 120);
    assert.deepEqual(seekedBack, at60);
  });
});
