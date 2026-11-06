/**
 * Phase 69 Milestone 6: Temporal-Spatial Synchronization & Speed Graph Coupling Unit Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MotionDocument } from "@/core/document/schema";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import {
  evaluate,
  getSpatialTrajectory,
  computeSpatialSpeedGraph,
} from "@/core/kernel/evaluate";
import {
  documentCommands,
  historyCommands,
  getDocument,
} from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { useHistoryStore } from "@/core/store/useHistoryStore";

function createLinearSpatialDoc(): { doc: MotionDocument; layerId: string; clipId: string } {
  const b = new DocBuilder();
  const layerId = b.layer("container", "LinearBox", null, {
    "transform.x": 0,
    "transform.y": 0,
  });

  // (0, 0) to (300, 400) in 2 seconds -> Euclidean distance = 500 px, theoretical speed = 250 px/s
  const clipId = b.clip(layerId, {
    name: "LinearTrajectoryClip",
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
          { id: "k1", time: 2, value: 300 },
        ],
      },
      {
        id: "ty",
        property: "transform.y",
        keyframes: [
          { id: "ky0", time: 0, value: 0 },
          { id: "ky1", time: 2, value: 400 },
        ],
      },
    ],
    spatialTrajectories: {
      transform: {
        id: "st-linear",
        propertyGroup: "transform",
        enabled: true,
        waypoints: [
          { id: "k0", time: 0, mode: "linear" },
          { id: "k1", time: 2, mode: "linear" },
        ],
      },
    },
  });

  const doc = b.build();
  return { doc, layerId, clipId };
}

function createEasedSpatialDoc(): { doc: MotionDocument; layerId: string; clipId: string } {
  const b = new DocBuilder();
  const layerId = b.layer("container", "EasedBox", null, {
    "transform.x": 0,
    "transform.y": 0,
  });

  // 3-waypoint path with ease-in-out on first segment and hold on second
  const clipId = b.clip(layerId, {
    name: "EasedTrajectoryClip",
    type: "entrance",
    trigger: "mount",
    duration: 4,
    easing: "linear",
    tracks: [
      {
        id: "tx",
        property: "transform.x",
        keyframes: [
          { id: "k0", time: 0, value: 0 },
          { id: "k1", time: 2, value: 200 },
          { id: "k2", time: 4, value: 200 },
        ],
      },
      {
        id: "ty",
        property: "transform.y",
        keyframes: [
          { id: "ky0", time: 0, value: 0 },
          { id: "ky1", time: 2, value: 100 },
          { id: "ky2", time: 4, value: 100 },
        ],
      },
    ],
    spatialTrajectories: {
      transform: {
        id: "st-eased",
        propertyGroup: "transform",
        enabled: true,
        waypoints: [
          { id: "k0", time: 0, mode: "bezier", ease: "power2.inOut", spatialOut: { x: 50, y: 0 } },
          { id: "k1", time: 2, mode: "linear", hold: true },
          { id: "k2", time: 4, mode: "linear" },
        ],
      },
    },
  });

  const doc = b.build();
  return { doc, layerId, clipId };
}

describe("Phase 69 Milestone 6: Temporal-Spatial Synchronization & Speed Graph Coupling", () => {
  it("returns null for scalar-only clips without spatial trajectories", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "ScalarBox", null, { "transform.x": 0 });
    const clipId = b.clip(layerId, {
      name: "ScalarClip",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 1, value: 100 },
          ],
        },
      ],
    });
    const doc = b.build();
    const clip = doc.clips[clipId];

    const speedGraph = computeSpatialSpeedGraph(clip);
    assert.equal(speedGraph, null, "Scalar-only clip must return null for spatial speed graph");
  });

  it("computes exact constant velocity and arc-length for linear spatial motion", () => {
    const { doc, clipId } = createLinearSpatialDoc();
    const clip = doc.clips[clipId];

    const samples = computeSpatialSpeedGraph(clip, undefined, 51)!;
    assert.ok(samples, "Speed graph samples must be computed");
    assert.equal(samples.length, 51);

    // Initial sample at t=0
    assert.equal(samples[0].time, 0);
    assert.equal(samples[0].distance, 0);
    assert.equal(samples[0].normalizedProgress, 0);

    // Final sample at t=2
    const last = samples[samples.length - 1];
    assert.equal(last.time, 2);
    assert.ok(Math.abs(last.distance - 500) < 0.5, `Final arc distance ${last.distance} must be ~500px`);
    assert.ok(Math.abs(last.normalizedProgress - 1.0) < 1e-4);

    // Theoretical speed: distance / time = 500 / 2 = 250 px/s
    // Check speed across interior samples:
    for (let i = 1; i < samples.length - 1; i++) {
      const s = samples[i];
      assert.ok(
        Math.abs(s.speed - 250) < 0.5,
        `Speed at t=${s.time.toFixed(2)} (${s.speed.toFixed(2)}) must match theoretical 250 px/s`
      );
    }
  });

  it("speed curve accurately reflects acceleration, peak velocity, and hold segment deceleration", () => {
    const { doc, clipId } = createEasedSpatialDoc();
    const clip = doc.clips[clipId];

    const samples = computeSpatialSpeedGraph(clip, undefined, 41)!;
    assert.ok(samples);

    // Segment 1 (t in [0, 2]): eased motion with power2.inOut
    // Endpoints of eased segment should have low/zero velocity
    const sampleAtStart = samples.find((s) => Math.abs(s.time - 0) < 1e-3)!;
    const sampleAtMid1 = samples.find((s) => Math.abs(s.time - 1.0) < 0.05)!;
    const sampleAtEnd1 = samples.find((s) => Math.abs(s.time - 2.0) < 0.05)!;

    assert.ok(sampleAtStart.speed < 20, "Speed at start of ease-in must be near 0");
    assert.ok(sampleAtMid1.speed > 80, "Speed at midpoint must be at peak");
    assert.ok(sampleAtEnd1.speed < 20, "Speed at end of ease-out must decelerate toward 0");

    // Segment 2 (t in [2, 4]): hold: true -> speed must be strictly 0
    const holdSamples = samples.filter((s) => s.time >= 2.1 && s.time <= 3.9);
    for (const hs of holdSamples) {
      assert.equal(hs.speed, 0, `Hold segment at t=${hs.time} must have exactly 0 speed`);
    }
  });

  it("speed graph sample coordinates identically match canonical evaluate() output", () => {
    const { doc, layerId, clipId } = createLinearSpatialDoc();
    const clip = doc.clips[clipId];

    const samples = computeSpatialSpeedGraph(clip, undefined, 21)!;

    for (const sample of samples) {
      const evaluated = evaluate(doc, MAIN_COMPOSITION_ID, layerId, sample.time);
      const evalX = evaluated["transform.x"] as number;
      const evalY = evaluated["transform.y"] as number;

      assert.ok(
        Math.abs(sample.point.x - evalX) < 0.05,
        `Sample X ${sample.point.x} at t=${sample.time} must match evaluate() X ${evalX}`
      );
      assert.ok(
        Math.abs(sample.point.y - evalY) < 0.05,
        `Sample Y ${sample.point.y} at t=${sample.time} must match evaluate() Y ${evalY}`
      );
    }
  });

  it("frame tick spacing directly matches integrated velocity along the curve", () => {
    const { doc, clipId } = createLinearSpatialDoc();
    const clip = doc.clips[clipId];
    const geom = getSpatialTrajectory(clip)!;

    const fps = 60;
    const ticks = geom.sampleFrameTicks(fps);
    assert.ok(ticks.length > 0);

    // Distance between consecutive frames should be speed * dt = 250 * (1/60) ≈ 4.167 px
    const expectedTickSpacing = 250 / fps;

    for (let i = 1; i < ticks.length; i++) {
      const dist = Math.hypot(ticks[i].point.x - ticks[i - 1].point.x, ticks[i].point.y - ticks[i - 1].point.y);
      assert.ok(
        Math.abs(dist - expectedTickSpacing) < 0.05,
        `Frame tick distance ${dist} must match theoretical spacing ${expectedTickSpacing}`
      );
    }
  });

  it("retimes spatial waypoint and tracks atomically in time without drift via documentCommands.retimeWaypoint", () => {
    useHistoryStore.getState().clearHistory();
    const { doc, clipId } = createLinearSpatialDoc();
    setDocument(doc);

    // Retime endpoint waypoint k1 from t=2.0s to t=4.0s
    documentCommands.retimeWaypoint(clipId, "k1", 4.0);

    const updated = getDocument();
    const updatedClip = updated.clips[clipId];
    const trackX = updatedClip.tracks.find((t) => t.property === "transform.x")!;
    const trackY = updatedClip.tracks.find((t) => t.property === "transform.y")!;
    const waypoints = updatedClip.spatialTrajectories?.transform?.waypoints;
    assert.ok(waypoints);
    const stWp = waypoints.find((w) => w.id === "k1");
    assert.ok(stWp);

    // Track keyframe timestamps and spatial waypoint timestamp must all be exactly 4.0
    assert.equal(trackX.keyframes.find((k) => k.id === "k1")!.time, 4.0);
    assert.equal(trackY.keyframes.find((k) => k.id === "ky1")!.time, 4.0);
    assert.equal(stWp.time, 4.0);

    // Clip duration must expand to cover new keyframe time
    assert.equal(updatedClip.duration, 4.0);

    // Speed should now be 500 / 4 = 125 px/s
    const updatedSpeedGraph = computeSpatialSpeedGraph(updatedClip, undefined, 21)!;
    const midSample = updatedSpeedGraph[10];
    assert.ok(
      Math.abs(midSample.speed - 125) < 0.5,
      `Retimed speed ${midSample.speed} must reflect new duration (125 px/s)`
    );

    // History atomicity: undo reverts all timestamps together in 1 step
    assert.equal(useHistoryStore.getState().past.length, 1);
    historyCommands.undo();

    const undone = getDocument().clips[clipId];
    assert.equal(undone.tracks.find((t) => t.property === "transform.x")!.keyframes.find((k) => k.id === "k1")!.time, 2.0);
    assert.equal(undone.spatialTrajectories?.transform?.waypoints.find((w) => w.id === "k1")!.time, 2.0);
    assert.equal(undone.duration, 2.0);

    // Redo restores retimed 4.0s
    historyCommands.redo();
    const redone = getDocument().clips[clipId];
    assert.equal(redone.tracks.find((t) => t.property === "transform.x")!.keyframes.find((k) => k.id === "k1")!.time, 4.0);
    assert.equal(redone.spatialTrajectories?.transform?.waypoints.find((w) => w.id === "k1")!.time, 4.0);
  });

  it("evaluates velocity at temporal boundaries using exact forward/backward finite differences", () => {
    const { doc, clipId } = createLinearSpatialDoc();
    const clip = doc.clips[clipId];
    const geom = getSpatialTrajectory(clip)!;

    // At t = 0 (t_start): forward difference over dt = 1e-4 -> exact analytical speed 250 px/s
    const velStart = geom.evaluateVelocityAtTime(0);
    assert.ok(Math.abs(velStart.speed - 250) < 0.1, `Start speed ${velStart.speed} must match 250 px/s`);
    assert.ok(Math.abs(velStart.vx - 150) < 0.1, `Start vx ${velStart.vx} must match 150 px/s`);
    assert.ok(Math.abs(velStart.vy - 200) < 0.1, `Start vy ${velStart.vy} must match 200 px/s`);

    // At t = 2.0 (t_end): backward difference over dt = 1e-4 -> exact analytical speed 250 px/s
    const velEnd = geom.evaluateVelocityAtTime(2.0);
    assert.ok(Math.abs(velEnd.speed - 250) < 0.1, `End speed ${velEnd.speed} must match 250 px/s`);
    assert.ok(Math.abs(velEnd.vx - 150) < 0.1, `End vx ${velEnd.vx} must match 150 px/s`);
    assert.ok(Math.abs(velEnd.vy - 200) < 0.1, `End vy ${velEnd.vy} must match 200 px/s`);

    // Outside range (t < 0 or t > duration): velocity is strictly 0
    assert.equal(geom.evaluateVelocityAtTime(-0.5).speed, 0);
    assert.equal(geom.evaluateVelocityAtTime(2.5).speed, 0);
  });

  it("calculates multi-segment cumulative arc-length incorporating segment base offset: s_global(t) = s_k + s_local(t)", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "MultiSegBox", null, {
      "transform.x": 0,
      "transform.y": 0,
    });

    // Segment 1 (t in [0, 1]): (0, 0) to (300, 0) -> length = 300 px
    // Segment 2 (t in [1, 2]): (300, 0) to (300, 400) -> length = 400 px
    // Total length = 700 px
    const clipId = b.clip(layerId, {
      name: "MultiSegClip",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "tx",
          property: "transform.x",
          keyframes: [
            { id: "m0", time: 0, value: 0 },
            { id: "m1", time: 1, value: 300 },
            { id: "m2", time: 2, value: 300 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "my0", time: 0, value: 0 },
            { id: "my1", time: 1, value: 0 },
            { id: "my2", time: 2, value: 400 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-multiseg",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "m0", time: 0, mode: "linear" },
            { id: "m1", time: 1, mode: "linear" },
            { id: "m2", time: 2, mode: "linear" },
          ],
        },
      },
    });

    const doc = b.build();
    const clip = doc.clips[clipId];
    const geom = getSpatialTrajectory(clip)!;

    assert.equal(geom.totalLength, 700, "Total length must be 300 + 400 = 700 px");

    // At t = 0: distance = 0
    assert.equal(geom.evaluateDistanceAtTime(0), 0);

    // At t = 0.5s: inside segment 1 -> s = 150 px
    assert.equal(geom.evaluateDistanceAtTime(0.5), 150);

    // At t = 1.0s: boundary between segment 1 and 2 -> s_1 = 300 px
    assert.equal(geom.evaluateDistanceAtTime(1.0), 300);

    // At t = 1.5s: inside segment 2 -> s = s_1 + s_local = 300 + 200 = 500 px
    assert.equal(geom.evaluateDistanceAtTime(1.5), 500);

    // At t = 2.0s: end of segment 2 -> s = 700 px
    assert.equal(geom.evaluateDistanceAtTime(2.0), 700);

    // Normalized progress in computeSpeedGraph:
    const speedGraph = geom.computeSpeedGraph(21);
    const mid1 = speedGraph.find((s) => Math.abs(s.time - 1.0) < 1e-4)!;
    assert.ok(Math.abs(mid1.normalizedProgress - 300 / 700) < 1e-4);
    assert.equal(mid1.distance, 300);
  });

  it("guards against timestamp collisions when retiming waypoints", () => {
    const { doc, clipId } = createLinearSpatialDoc();
    setDocument(doc);

    // Clip has keyframes at t=0 and t=2.
    // Retime k1 to t=0 (colliding with k0):
    documentCommands.retimeWaypoint(clipId, "k1", 0);

    const updated = getDocument();
    const trackX = updated.clips[clipId].tracks.find((t) => t.property === "transform.x")!;

    // Collision guard must ensure timestamps remain distinct
    const times = trackX.keyframes.map((k) => k.time);
    assert.equal(times.length, 2, "Must preserve both keyframes without overwriting");
    assert.notEqual(times[0], times[1], "Timestamps must remain distinct to avoid collision");
    assert.ok(Math.abs(times[1] - times[0]) <= 1e-3, "Colliding keyframe is offset by microsecond delta");
  });

  it("re-sorting preserves outgoing segment metadata and hold flags after retiming", () => {
    const { doc, clipId } = createEasedSpatialDoc();
    setDocument(doc);

    // k1 had hold: true at t=2. Retime k1 to t=1.0s (retimed earlier):
    documentCommands.retimeWaypoint(clipId, "k1", 1.0);

    const updated = getDocument();
    const updatedClip = updated.clips[clipId];
    const waypoints = updatedClip.spatialTrajectories?.transform?.waypoints;
    assert.ok(waypoints);

    const wp1 = waypoints.find((w) => w.id === "k1")!;
    assert.equal(wp1.time, 1.0);
    assert.equal(wp1.hold, true, "Outgoing hold metadata must be preserved on retimed waypoint");

    const wp0 = waypoints.find((w) => w.id === "k0")!;
    assert.equal(wp0.ease, "power2.inOut", "First waypoint ease must remain intact");

    // Geometry compiled with new timestamps:
    const geom = getSpatialTrajectory(updatedClip)!;
    assert.equal(geom.segments[0].timeEnd, 1.0);
    assert.equal(geom.segments[1].timeStart, 1.0);
    assert.equal(geom.segments[1].hold, true);
  });
});
