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

describe("Phase 162 · the physics is right, not only repeatable (audit 2026-11-16)", () => {
  const ball = (over: Partial<PhysicsBodyState> = {}): PhysicsBodyState => ({
    id: "ball",
    kind: "dynamic",
    shape: { kind: "circle", radius: 10 },
    x: 100,
    y: 0,
    vx: 0,
    vy: 0,
    angleRad: 0,
    angularVel: 0,
    mass: 1,
    restitution: 0,
    friction: 0,
    linearDamping: 0,
    angularDamping: 0,
    ...over,
  });

  it("a body in free fall drops ½·g·t² (980 px/s², 0.5 s → 122.5 px)", () => {
    const world = createPhysicsWorld2D([ball()], { seed: 1 });
    for (let f = 0; f < 30; f++) world.step(1 / 60);
    const y = world.getBody("ball")!.y;
    // Semi-implicit Euler at a fixed step lands within g·dt·t/2 of the exact value.
    assert.ok(Math.abs(y - 122.5) < 3, `fell ${y} px`);
    assert.ok(Math.abs(world.getBody("ball")!.vy - 490) < 1, `vy ${world.getBody("ball")!.vy}`);
  });

  it("gravity follows the config, and a sideways throw keeps its horizontal speed", () => {
    const world = createPhysicsWorld2D([ball({ vx: 200 })], { seed: 1, gravityY: 0 });
    for (let f = 0; f < 30; f++) world.step(1 / 60);
    const b = world.getBody("ball")!;
    assert.ok(Math.abs(b.y) < 1e-9, `y ${b.y}`);
    assert.ok(Math.abs(b.x - 200) < 1, `x ${b.x}`);
  });

  it("a ball dropped on the floor comes to rest on it, not through it", () => {
    const floor: PhysicsBodyState = { ...ball({ id: "floor", kind: "static", mass: 0 }), shape: { kind: "box", halfWidth: 400, halfHeight: 20 }, x: 100, y: 300 };
    const world = createPhysicsWorld2D([floor, ball({ y: 100 })], { seed: 1 });
    for (let f = 0; f < 180; f++) world.step(1 / 60);
    const b = world.getBody("ball")!;
    // Resting: the ball's bottom (y + 10) sits on the floor's top (300 - 20), give or take the solver's slop.
    assert.ok(Math.abs(b.y + 10 - 280) < 3, `ball at ${b.y}`);
    assert.ok(Math.abs(b.vy) < 20, `still moving ${b.vy}`);
  });
});

describe("Phase 162 · stepping and replay bookkeeping (review 2026-11-17)", () => {
  const body = (id: string, x: number, y: number, vy: number, kind: "dynamic" | "static" = "dynamic"): PhysicsBodyState => ({
    id,
    kind,
    shape: { kind: "circle", radius: 10 },
    x,
    y,
    vx: 0,
    vy,
    angleRad: 0,
    angularVel: 0,
    mass: kind === "static" ? 0 : 1,
    restitution: 0,
    friction: 0,
    linearDamping: 0,
    angularDamping: 0,
  } as PhysicsBodyState);

  it("a frame that takes several substeps returns the contacts of all of them", () => {
    // Two balls colliding head-on; a 1/30 s frame is 4 substeps at 1/120 s.
    const world = createPhysicsWorld2D([body("a", 0, 0, 0), body("b", 0, 25, -600)], { seed: 1, gravityY: 0 });
    const contacts = world.step(1 / 30);
    assert.ok(contacts.length >= 1, "the collision isn't lost because it happened before the last substep");
  });

  it("a long stall does not leave a backlog that speeds up later frames", () => {
    const world = createPhysicsWorld2D([body("a", 0, 0, 0)], { seed: 1 });
    world.step(0.25); // more time than the substep cap covers
    const before = world.getStepIndex();
    world.step(1 / 60);
    assert.ok(world.getStepIndex() - before <= 3, `next frame ran ${world.getStepIndex() - before} substeps`);
  });

  it("seeking back drops the snapshots of the timeline it left, and snapshots stay bounded", () => {
    const world = createPhysicsWorld2D([body("a", 0, 0, 0)], { seed: 1, snapshotIntervalSteps: 1 });
    for (let i = 0; i < 2000; i++) world.stepFixedSubstep();
    assert.ok(world.getSavedSnapshots().length <= 240);
    world.seekToTime(0.1);
    const stepAfterSeek = world.getStepIndex();
    assert.ok(world.getSavedSnapshots().every((s) => s.stepIndex <= stepAfterSeek));
  });
});
