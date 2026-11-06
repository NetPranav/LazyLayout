/**
 * Phase 69 Milestone 3: Kernel Integration & Spatial Trajectory Evaluation
 *
 * Verifies single evaluation authority in `evaluate()` and `sampleClip()`:
 * - 2D Spatial motion path evaluation with arc-length parameterization.
 * - 100% scalar backward compatibility for clips without spatial metadata.
 * - Mixed compositions with both spatial and scalar clips.
 * - Exact waypoint timestamps and continuous-time evaluation without frame snapping.
 * - Outgoing segment ownership (modes: catmull-rom, linear, bezier, hold).
 * - Muted track behavior and orphan coordinate fallbacks.
 * - Functional purity, determinism, and WeakMap geometry caching.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { evaluate, sampleClip, getSpatialTrajectory } from "../evaluate";
import type { Clip, MotionDocument } from "../../document/schema";
import { DiagnosticBus } from "../../engine/DiagnosticBus";

describe("Phase 69 Milestone 3: Kernel Integration (sampleClip & evaluate)", () => {
  it("evaluates a clip with spatial trajectory and overrides transform.x and transform.y", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null, { "transform.x": 0, "transform.y": 0 });

    b.clip(id, {
      name: "MotionPath",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "kx0", time: 0, value: 0 },
            { id: "kx1", time: 1, value: 100 },
            { id: "kx2", time: 2, value: 200 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky1", time: 1, value: 50 },
            { id: "ky2", time: 2, value: 0 },
          ],
        },
        {
          id: "topacity",
          property: "appearance.opacity",
          keyframes: [
            { id: "ko0", time: 0, value: 0 },
            { id: "ko1", time: 2, value: 1 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-1",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "kx0", time: 0, mode: "auto" },
            { id: "kx1", time: 1, mode: "auto" },
            { id: "kx2", time: 2, mode: "auto" },
          ],
        },
      },
    });

    const doc = b.build();

    // 1. Start waypoint t = 0
    const start = evaluate(doc, MAIN_COMPOSITION_ID, id, 0);
    assert.equal(start["transform.x"], 0);
    assert.equal(start["transform.y"], 0);
    assert.equal(start["appearance.opacity"], 0);

    // 2. Middle waypoint t = 1
    const mid = evaluate(doc, MAIN_COMPOSITION_ID, id, 1);
    assert.equal(mid["transform.x"], 100);
    assert.equal(mid["transform.y"], 50);
    assert.equal(mid["appearance.opacity"], 0.5);

    // 3. End waypoint t = 2
    const end = evaluate(doc, MAIN_COMPOSITION_ID, id, 2);
    assert.equal(end["transform.x"], 200);
    assert.equal(end["transform.y"], 0);
    assert.equal(end["appearance.opacity"], 1);

    // 4. Fractional continuous time t = 0.5 (evaluated along arc-length parameterized curve)
    const frac = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5);
    assert.ok(typeof frac["transform.x"] === "number");
    assert.ok(typeof frac["transform.y"] === "number");
    // Midpoint x should be between 0 and 100, y between 0 and 50
    assert.ok((frac["transform.x"] as number) > 0 && (frac["transform.x"] as number) < 100);
    assert.ok((frac["transform.y"] as number) > 0 && (frac["transform.y"] as number) < 50);

    // Single Transform Authority matrix/translate is properly synthesized
    assert.ok(typeof frac.transform === "string");
    assert.ok((frac.transform as string).includes("translate3d(") || (frac.transform as string).startsWith("matrix("));
  });

  it("strictly preserves scalar behavior for clips without spatial metadata", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    // Standard scalar clip with completely independent tracks and easings:
    b.clip(id, {
      name: "ScalarOnly",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "kx0", time: 0, value: 0 },
            { id: "kx1", time: 1, value: 100, ease: "linear" },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky1", time: 1, value: 100, ease: "power1.in" }, // quad ease on y
          ],
        },
      ],
    });

    const doc = b.build();
    const mid = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5);

    // x is linear: at 0.5s -> 50
    assert.equal(mid["transform.x"], 50);
    // y is power1.in: at 0.5s -> 0.25 * 100 = 25
    assert.equal(mid["transform.y"], 25);
  });

  it("evaluates spatial and scalar clips in the same composition without interference", () => {
    const b = new DocBuilder();
    const spatialLayerId = b.layer("container", "SpatialBox", null);
    const scalarLayerId = b.layer("container", "ScalarBox", null);

    // Spatial clip on spatialLayerId:
    b.clip(spatialLayerId, {
      name: "SpatialClip",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "kx0", time: 0, value: 0 },
            { id: "kx1", time: 2, value: 200 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky1", time: 2, value: 100 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-2",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "kx0", time: 0, mode: "linear" },
            { id: "kx1", time: 2, mode: "linear" },
          ],
        },
      },
    });

    // Scalar clip on scalarLayerId:
    b.clip(scalarLayerId, {
      name: "ScalarClip",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx2",
          property: "transform.x",
          keyframes: [
            { id: "k2x0", time: 0, value: 0 },
            { id: "k2x1", time: 2, value: 200, ease: "linear" },
          ],
        },
        {
          id: "ty2",
          property: "transform.y",
          keyframes: [
            { id: "k2y0", time: 0, value: 0 },
            { id: "k2y1", time: 2, value: 100, ease: "power1.in" },
          ],
        },
      ],
    });

    const doc = b.build();

    const spatialMid = evaluate(doc, MAIN_COMPOSITION_ID, spatialLayerId, 1);
    const scalarMid = evaluate(doc, MAIN_COMPOSITION_ID, scalarLayerId, 1);

    // Spatial trajectory with linear chord: at t=1 (50% progress), (x=100, y=50)
    assert.equal(spatialMid["transform.x"], 100);
    assert.equal(spatialMid["transform.y"], 50);

    // Scalar clip at t=1 (50% progress): x is 100, y is power1.in(0.5) * 100 = 25
    assert.equal(scalarMid["transform.x"], 100);
    assert.equal(scalarMid["transform.y"], 25);
  });

  it("handles exact waypoint boundary timestamps and transitions cleanly without snapping", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    b.clip(id, {
      name: "BoundaryTest",
      type: "entrance",
      trigger: "mount",
      duration: 3,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 10 },
            { id: "k1", time: 1, value: 50 },
            { id: "k2", time: 2, value: 120 },
            { id: "k3", time: 3, value: 200 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 10 },
            { id: "k1y", time: 1, value: 50 },
            { id: "k2y", time: 2, value: 80 },
            { id: "k3y", time: 3, value: 10 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-3",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0, mode: "auto" },
            { id: "k1", time: 1, mode: "auto" },
            { id: "k2", time: 2, mode: "auto" },
            { id: "k3", time: 3, mode: "auto" },
          ],
        },
      },
    });

    const doc = b.build();

    // Exactly at waypoint 1 (t = 1.0)
    const atW1 = evaluate(doc, MAIN_COMPOSITION_ID, id, 1.0);
    assert.equal(atW1["transform.x"], 50);
    assert.equal(atW1["transform.y"], 50);

    // Immediately before waypoint 1 (t = 0.999)
    const beforeW1 = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.999);
    assert.ok(Math.abs((beforeW1["transform.x"] as number) - 50) < 0.2);
    assert.ok(Math.abs((beforeW1["transform.y"] as number) - 50) < 0.2);

    // Immediately after waypoint 1 (t = 1.001)
    const afterW1 = evaluate(doc, MAIN_COMPOSITION_ID, id, 1.001);
    assert.ok(Math.abs((afterW1["transform.x"] as number) - 50) < 0.2);
    assert.ok(Math.abs((afterW1["transform.y"] as number) - 50) < 0.2);

    // Exactly at waypoint 2 (t = 2.0)
    const atW2 = evaluate(doc, MAIN_COMPOSITION_ID, id, 2.0);
    assert.equal(atW2["transform.x"], 120);
    assert.equal(atW2["transform.y"], 80);
  });

  it("respects outgoing waypoint hold: holds point until next waypoint", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    b.clip(id, {
      name: "HoldTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0, hold: true },
            { id: "k1", time: 1, value: 100 },
            { id: "k2", time: 2, value: 200 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0, hold: true },
            { id: "k1y", time: 1, value: 100 },
            { id: "k2y", time: 2, value: 200 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-4",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0, hold: true },
            { id: "k1", time: 1 },
            { id: "k2", time: 2 },
          ],
        },
      },
    });

    const doc = b.build();

    // Segment 0 [0, 1] has hold = true:
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, id, 0.0)["transform.x"], 0);
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5)["transform.x"], 0);
    assert.equal(evaluate(doc, MAIN_COMPOSITION_ID, id, 0.999)["transform.x"], 0);

    // Segment 1 [1, 2] is not hold:
    const midSeg1 = evaluate(doc, MAIN_COMPOSITION_ID, id, 1.5);
    assert.ok((midSeg1["transform.x"] as number) > 100 && (midSeg1["transform.x"] as number) < 200);
  });

  it("does not override transform coordinates when track is muted", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null, { "transform.x": 999, "transform.y": 888 });

    b.clip(id, {
      name: "MutedTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          muted: true, // X is muted!
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 200 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0 },
            { id: "k1y", time: 2, value: 200 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-5",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0 },
            { id: "k1", time: 2 },
          ],
        },
      },
    });

    const doc = b.build();
    const res = evaluate(doc, MAIN_COMPOSITION_ID, id, 1);

    // transform.x is muted on clip, so it retains layer base value 999:
    assert.equal(res["transform.x"], 999);
    // transform.y is active, so it is evaluated by spatial trajectory:
    assert.ok(typeof res["transform.y"] === "number");
    assert.ok((res["transform.y"] as number) > 0);
  });

  it("falls back cleanly to scalar tracks when spatial metadata has fewer than 2 waypoints", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    b.clip(id, {
      name: "SingleWaypointTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 100 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0 },
            { id: "k1y", time: 2, value: 50 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-6",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0 }, // only 1 waypoint!
          ],
        },
      },
    });

    const doc = b.build();
    const mid = evaluate(doc, MAIN_COMPOSITION_ID, id, 1);

    // Falls back to scalar interpolation:
    assert.equal(mid["transform.x"], 50);
    assert.equal(mid["transform.y"], 25);
  });

  it("handles stationary points and cusps smoothly without division by zero or NaN", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    // Curve with stationary tangent at midpoint:
    b.clip(id, {
      name: "StationaryTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 100 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0 },
            { id: "k1y", time: 2, value: 0 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-7",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            {
              id: "k0",
              time: 0,
              mode: "bezier",
              spatialOut: { x: 100, y: 0 },
            },
            {
              id: "k1",
              time: 2,
              mode: "bezier",
              spatialIn: { x: -100, y: 0 },
            },
          ],
        },
      },
    });

    const doc = b.build();
    const mid = evaluate(doc, MAIN_COMPOSITION_ID, id, 1);

    assert.ok(Number.isFinite(mid["transform.x"]));
    assert.ok(Number.isFinite(mid["transform.y"]));
  });

  it("caches compiled geometry in WeakMap and maintains functional determinism", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    b.clip(id, {
      name: "CacheTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 100 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0 },
            { id: "k1y", time: 2, value: 100 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-5",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0 },
            { id: "k1", time: 2 },
          ],
        },
      },
    });

    const doc = b.build();
    const clip = Object.values(doc.clips)[0];

    // First call builds and caches:
    const geom1 = getSpatialTrajectory(clip);
    // Second call retrieves from WeakMap:
    const geom2 = getSpatialTrajectory(clip);

    assert.ok(geom1 !== null);
    assert.strictEqual(geom1, geom2);

    // 100 consecutive evaluations produce bit-for-bit identical results:
    const firstResult = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.732);
    for (let i = 0; i < 100; i++) {
      const result = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.732);
      assert.deepEqual(result, firstResult);
    }
  });

  it("strictly preserves document and clip immutability during evaluation", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Box", null);

    b.clip(id, {
      name: "ImmutableTest",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 100 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "k0y", time: 0, value: 0 },
            { id: "k1y", time: 2, value: 100 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-5",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "k0", time: 0 },
            { id: "k1", time: 2 },
          ],
        },
      },
    });

    const doc = b.build();
    const beforeSnap = JSON.stringify(doc);

    evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5);
    evaluate(doc, MAIN_COMPOSITION_ID, id, 1.5);

    const afterSnap = JSON.stringify(doc);
    assert.equal(afterSnap, beforeSnap);
  });
});
