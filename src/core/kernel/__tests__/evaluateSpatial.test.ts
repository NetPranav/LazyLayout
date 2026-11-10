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
import {
  evaluate,
  sampleClip,
  getSpatialTrajectory,
  getSpatialTrajectoryCacheSize,
  MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP,
} from "../evaluate";
import type { SpatialDiagnostic } from "../../geometry/spatialPath";
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

  describe("Cache Invalidation & DiagnosticBus Purity Boundary", () => {
    it("evaluates the same clip reference with two different fallback coordinate sets without stale geometry", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      // Clip with ONLY transform.x track; Y coordinates must be resolved from fallbackProps
      b.clip(id, {
        name: "OrphanFallbackClip",
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
        ],
        spatialTrajectories: {
          transform: {
            id: "st-cache-1",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];

      // Evaluate with fallback Y = 50:
      const sample1 = sampleClip(clip, 2, { "transform.x": 0, "transform.y": 50 });
      assert.equal(sample1["transform.x"], 200);
      assert.equal(sample1["transform.y"], 50, "Waypoint at t=2 must adopt fallback Y=50");

      // Evaluate the EXACT same clip reference with fallback Y = 250:
      const sample2 = sampleClip(clip, 2, { "transform.x": 0, "transform.y": 250 });
      assert.equal(sample2["transform.x"], 200);
      assert.equal(sample2["transform.y"], 250, "Waypoint at t=2 must adopt updated fallback Y=250 rather than returning stale geometry");

      // Re-evaluate with fallback Y = 50:
      const sample3 = sampleClip(clip, 2, { "transform.x": 0, "transform.y": 50 });
      assert.equal(sample3["transform.y"], 50, "Re-evaluation with Y=50 must return correct geometry");
    });

    it("invalidates cache when fallback properties change with an unchanged clip reference", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      // Clip with ONLY transform.x track; Y coordinates depend on fallbackProps
      b.clip(id, {
        name: "FallbackInvalidationClip",
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
              { id: "kx1", time: 2, value: 100 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-cache-2",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];

      const geomA = getSpatialTrajectory(clip, { "transform.x": 10, "transform.y": 20 });
      const geomB = getSpatialTrajectory(clip, { "transform.x": 10, "transform.y": 99 });

      assert.ok(geomA !== null);
      assert.ok(geomB !== null);
      assert.notStrictEqual(geomA, geomB, "Different fallback properties must compile separate geometries");
      assert.equal(geomA.segments[0].bezier.p3.y, 20);
      assert.equal(geomB.segments[0].bezier.p3.y, 99);
    });

    it("reuses cached geometry with strict reference equality when inputs are unchanged", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      b.clip(id, {
        name: "CacheReuseClip",
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
              { id: "kx1", time: 2, value: 100 },
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
            id: "st-cache-3",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];
      const fallback = { "transform.x": 0, "transform.y": 0 };

      const geom1 = getSpatialTrajectory(clip, fallback);
      const geom2 = getSpatialTrajectory(clip, fallback);
      const geom3 = getSpatialTrajectory(clip, fallback);

      assert.ok(geom1 !== null);
      assert.strictEqual(geom1, geom2, "Second retrieval must return the identical cached instance");
      assert.strictEqual(geom2, geom3, "Third retrieval must return the identical cached instance");
    });

    it("enforces DiagnosticBus purity: kernel evaluation never emits side-effects to the global bus", () => {
      DiagnosticBus.clearHistory();

      const b = new DocBuilder();
      const id = b.layer("container", "Box", null, { "transform.x": 0, "transform.y": 0 });

      b.clip(id, {
        name: "PurityTestClip",
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
        ],
        spatialTrajectories: {
          transform: {
            id: "st-purity",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 1 },
              { id: "kx2", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();

      // Sample 100 frames through the deterministic evaluation kernel:
      for (let f = 0; f <= 100; f++) {
        const t = (f / 100) * 2;
        evaluate(doc, MAIN_COMPOSITION_ID, id, t);
      }

      // Assert zero side-effects to DiagnosticBus:
      const busEvents = DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN");
      assert.equal(busEvents.length, 0, "Deterministic evaluate() must produce zero side-effects on DiagnosticBus");
    });

    it("distinguishes numeric 1 from string '1' in fallback cache without collision", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      b.clip(id, {
        name: "TypeCollisionClip",
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
              { id: "kx1", time: 2, value: 100 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-type-col",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];

      const geomNum = getSpatialTrajectory(clip, { "transform.x": 0, "transform.y": 1 });
      const geomStr = getSpatialTrajectory(clip, { "transform.x": 0, "transform.y": "1" });

      assert.ok(geomNum !== null);
      assert.ok(geomStr !== null);
      assert.notStrictEqual(geomNum, geomStr, "Numeric 1 and string '1' must not collide in the fallback cache");
    });

    it("distinguishes missing coordinates from literal 'none' in fallback cache without collision", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      b.clip(id, {
        name: "NoneCollisionClip",
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
              { id: "kx1", time: 2, value: 100 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-none-col",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];

      const geomAbsent = getSpatialTrajectory(clip, { "transform.x": 0 }); // transform.y is absent
      const geomLiteralNone = getSpatialTrajectory(clip, { "transform.x": 0, "transform.y": "none" });

      assert.ok(geomAbsent !== null);
      assert.ok(geomLiteralNone !== null);
      assert.notStrictEqual(geomAbsent, geomLiteralNone, "Absent coordinate and literal string 'none' must not collide in the cache");
    });

    it("bounds fallback cache growth to MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP under continually changing coordinates", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null);

      b.clip(id, {
        name: "CacheGrowthClip",
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
              { id: "kx1", time: 2, value: 100 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-growth",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      const doc = b.build();
      const clip = Object.values(doc.clips)[0];

      // Request 50 distinct fallback coordinate variations:
      for (let i = 0; i < 50; i++) {
        getSpatialTrajectory(clip, { "transform.x": 0, "transform.y": i * 10 });
      }

      const cacheSize = getSpatialTrajectoryCacheSize(clip);
      assert.ok(
        cacheSize <= MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP,
        `Cache size (${cacheSize}) must not exceed ceiling (${MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP})`
      );
      assert.equal(cacheSize, MAX_FALLBACK_CACHE_ENTRIES_PER_CLIP);
    });

    it("forwards spatial diagnostics to an explicit sink without touching DiagnosticBus", () => {
      DiagnosticBus.clearHistory();

      const b = new DocBuilder();
      const normalId = b.layer("container", "Box", null, { "transform.x": 0, "transform.y": 0 });

      // 1. Normal successful clip: must NOT generate false unresolved diagnostics:
      b.clip(normalId, {
        name: "NormalClip",
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
              { id: "kx1", time: 2, value: 100 },
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
            id: "st-normal",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 2 },
            ],
          },
        },
      });

      // 2. Pathological clip with extreme curvature that triggers subdivision limits:
      const pathId = b.layer("container", "Box", null, { "transform.x": 0, "transform.y": 0 });
      b.clip(pathId, {
        name: "PathologicalClip",
        type: "entrance",
        trigger: "mount",
        duration: 2,
        easing: "linear",
        tracks: [
          {
            id: "ptx",
            property: "transform.x",
            keyframes: [
              { id: "pk0", time: 0, value: 0 },
              { id: "pk1", time: 2, value: 1 },
            ],
          },
          {
            id: "pty",
            property: "transform.y",
            keyframes: [
              { id: "pky0", time: 0, value: 0 },
              { id: "pky1", time: 2, value: 0 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-unresolved-1",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              {
                id: "pk0",
                time: 0,
                mode: "bezier",
                spatialOut: { x: 1e6, y: 1e6 },
              },
              {
                id: "pk1",
                time: 2,
                mode: "bezier",
                spatialIn: { x: -1e6, y: 1e6 },
              },
            ],
          },
        },
      });

      const doc = b.build();
      const pathClip = Object.values(doc.clips).find((c) => c.layerId === pathId)!;

      // Evaluation of normal clip with sink generates zero false unresolved diagnostics:
      const normalSink: SpatialDiagnostic[] = [];
      evaluate(doc, MAIN_COMPOSITION_ID, normalId, 0.5, { diagnosticsSink: normalSink });
      assert.equal(normalSink.length, 0, "Successful evaluation must not generate false diagnostics in sink");

      // Evaluation of pathological clip with explicit sink and strict tolerance receives the unresolved diagnostic:
      const sink: SpatialDiagnostic[] = [];
      evaluate(doc, MAIN_COMPOSITION_ID, pathId, 0.5, { diagnosticsSink: sink, spatialTolerance: 1e-15 });

      // Diagnostic assertions:
      assert.ok(sink.length > 0, "Sink must receive diagnostic from unresolved spatial inversion/subdivision");
      assert.ok(
        sink.some((d) => d.unresolvedReason === "uncertainty_exceeds_tolerance"),
        "Diagnostic must record unresolvedReason: 'uncertainty_exceeds_tolerance'"
      );
      assert.ok(
        sink.some((d) => d.code === "UNCERTAINTY_EXCEEDS_TOLERANCE"),
        "Diagnostic must record code: 'UNCERTAINTY_EXCEEDS_TOLERANCE'"
      );
      assert.ok(
        sink.every((d) => d.clipId === pathClip.id && d.trajectoryId === "st-unresolved-1"),
        "Diagnostic must strictly correspond to the correct clipId and trajectoryId"
      );

      // Global DiagnosticBus remains completely untouched:
      assert.equal(
        DiagnosticBus.getHistoryByChannel("SPATIAL_TRAJECTORY_WARN").length,
        0,
        "DiagnosticBus must remain strictly unmodified during kernel evaluation"
      );
    });

    it("benchmarks continuous frame evaluation throughput", () => {
      const b = new DocBuilder();
      const id = b.layer("container", "Box", null, { "transform.x": 0, "transform.y": 0 });

      b.clip(id, {
        name: "BenchmarkClip",
        type: "entrance",
        trigger: "mount",
        duration: 5,
        easing: "linear",
        tracks: [
          {
            id: "tx",
            property: "transform.x",
            keyframes: [
              { id: "kx0", time: 0, value: 0 },
              { id: "kx1", time: 1, value: 100 },
              { id: "kx2", time: 2, value: 250 },
              { id: "kx3", time: 3, value: 400 },
              { id: "kx4", time: 5, value: 600 },
            ],
          },
          {
            id: "ty",
            property: "transform.y",
            keyframes: [
              { id: "ky0", time: 0, value: 0 },
              { id: "ky1", time: 1, value: 150 },
              { id: "ky2", time: 2, value: 50 },
              { id: "ky3", time: 3, value: 200 },
              { id: "ky4", time: 5, value: 0 },
            ],
          },
        ],
        spatialTrajectories: {
          transform: {
            id: "st-bench",
            propertyGroup: "transform",
            enabled: true,
            waypoints: [
              { id: "kx0", time: 0 },
              { id: "kx1", time: 1 },
              { id: "kx2", time: 2 },
              { id: "kx3", time: 3 },
              { id: "kx4", time: 5 },
            ],
          },
        },
      });

      const doc = b.build();

      // Warmup:
      for (let i = 0; i < 50; i++) {
        evaluate(doc, MAIN_COMPOSITION_ID, id, (i / 50) * 5);
      }

      // Benchmark 1,000 continuous frame evaluations:
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        evaluate(doc, MAIN_COMPOSITION_ID, id, (i / 1000) * 5);
      }
      const elapsedMs = performance.now() - startTime;
      const perFrameUs = (elapsedMs / 1000) * 1000; // in microseconds

      // 1,000 frames must comfortably evaluate in under 250ms (< 250 µs/frame, well within 16.6ms frame budget even under CI CPU contention)
      assert.ok(
        elapsedMs < 250,
        `1,000 frame evaluations took ${elapsedMs.toFixed(2)}ms (${perFrameUs.toFixed(2)} µs/frame), exceeding budget`
      );
    });
  });
});
