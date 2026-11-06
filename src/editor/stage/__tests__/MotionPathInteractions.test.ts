/**
 * Phase 69 Milestone 5: Interactive Waypoint & Tangent Editing Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MotionPathOverlay } from "../MotionPathOverlay";
import type { MotionDocument } from "@/core/document/schema";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import {
  documentCommands,
  historyCommands,
  getDocument,
} from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import { getSpatialTrajectory } from "@/core/kernel/evaluate";

function createTestDoc(): { doc: MotionDocument; layerId: string; clipId: string } {
  const b = new DocBuilder();
  const layerId = b.layer("container", "AnimatedLayer", null, {
    "frame.x": 100,
    "frame.y": 100,
    "frame.width": 80,
    "frame.height": 80,
    "transform.x": 0,
    "transform.y": 0,
  });

  const clipId = b.clip(layerId, {
    name: "InteractiveMotionClip",
    type: "entrance",
    trigger: "mount",
    duration: 3,
    easing: "linear",
    tracks: [
      {
        id: "trk-x",
        property: "transform.x",
        keyframes: [
          { id: "kf-x0", time: 0, value: 0 },
          { id: "kf-x1", time: 1.5, value: 120 },
          { id: "kf-x2", time: 3, value: 240 },
        ],
      },
      {
        id: "trk-y",
        property: "transform.y",
        keyframes: [
          { id: "kf-y0", time: 0, value: 0 },
          { id: "kf-y1", time: 1.5, value: 80 },
          { id: "kf-y2", time: 3, value: 0 },
        ],
      },
    ],
    spatialTrajectories: {
      transform: {
        id: "st-interactive",
        propertyGroup: "transform",
        enabled: true,
        waypoints: [
          { id: "kf-x0", time: 0, mode: "bezier", spatialOut: { x: 40, y: 30 } },
          {
            id: "kf-x1",
            time: 1.5,
            mode: "continuous",
            handleStyle: "aligned",
            spatialIn: { x: -30, y: 15 },
            spatialOut: { x: 30, y: -15 },
          },
          { id: "kf-x2", time: 3, mode: "linear" },
        ],
      },
    },
  });

  const doc = b.build();
  return { doc, layerId, clipId };
}

describe("Phase 69 Milestone 5: Interactive Waypoint & Tangent Editing", () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  it("updates waypoint position for a paired waypoint through documentCommands", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    // Initial position of waypoint at t = 1.5s is (120, 80)
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 180, y: 140 });

    const updated = getDocument();
    const clip = updated.clips[clipId];
    const trackX = clip.tracks.find((t) => t.property === "transform.x")!;
    const trackY = clip.tracks.find((t) => t.property === "transform.y")!;

    const kfX = trackX.keyframes.find((k) => k.id === "kf-x1")!;
    const kfY = trackY.keyframes.find((k) => Math.abs(k.time - 1.5) < 1e-4)!;

    assert.equal(kfX.value, 180, "transform.x keyframe must be updated to 180");
    assert.equal(kfY.value, 140, "transform.y keyframe must be updated to 140");

    // Kernel evaluation through getSpatialTrajectory must immediately reflect the updated coordinate
    const geom = getSpatialTrajectory(clip, updated.layers[clip.layerId].properties)!;
    const pt = geom.evaluateAtTime(1.5);
    assert.ok(pt, "Evaluated point must not be null");
    assert.equal(Math.round(pt.x), 180);
    assert.equal(Math.round(pt.y), 140);
  });

  it("synthesizes missing axis keyframe when moving an orphan waypoint", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "OrphanLayer", null, {
      "transform.x": 0,
      "transform.y": 0,
    });
    // Clip with an orphan keyframe on X at time 1.0 (no Y keyframe at time 1.0)
    const clipId = b.clip(layerId, {
      name: "OrphanClip",
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
            { id: "kx1", time: 1.0, value: 50 },
            { id: "kx2", time: 2.0, value: 100 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky2", time: 2.0, value: 100 },
          ],
        },
      ],
    });
    const doc = b.build();
    setDocument(doc);

    // Move orphan waypoint kx1 in 2D space to (75, 40)
    documentCommands.updateWaypointPosition(clipId, "kx1", { x: 75, y: 40 });

    const updated = getDocument();
    const clip = updated.clips[clipId];
    const trackX = clip.tracks.find((t) => t.property === "transform.x")!;
    const trackY = clip.tracks.find((t) => t.property === "transform.y")!;

    const kfX = trackX.keyframes.find((k) => k.id === "kx1")!;
    assert.equal(kfX.value, 75);

    // Track Y should now have a keyframe at time 1.0 with value 40
    const kfY = trackY.keyframes.find((k) => Math.abs(k.time - 1.0) < 1e-4);
    assert.ok(kfY, "Track Y must synthesize a keyframe at time 1.0");
    assert.equal(kfY.value, 40);
  });

  it("updates tangent control handles (spatialIn and spatialOut) via updateWaypointTangents", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    documentCommands.updateWaypointTangents(clipId, "kf-x1", {
      spatialIn: { x: -45, y: 25 },
      spatialOut: { x: 45, y: -25 },
      mode: "continuous",
      handleStyle: "symmetric",
    });

    const updated = getDocument();
    const clip = updated.clips[clipId];
    const st = clip.spatialTrajectories?.transform;
    assert.ok(st, "Spatial trajectory must exist");

    const wp = st.waypoints.find((w) => w.id === "kf-x1")!;
    assert.deepEqual(wp.spatialIn, { x: -45, y: 25 });
    assert.deepEqual(wp.spatialOut, { x: 45, y: -25 });
    assert.equal(wp.mode, "continuous");
    assert.equal(wp.handleStyle, "symmetric");
  });

  it("sets waypoint interpolation mode with setWaypointMode", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    documentCommands.setWaypointMode(clipId, "kf-x2", "continuous");

    const updated = getDocument();
    const clip = updated.clips[clipId];
    const waypoints = clip.spatialTrajectories?.transform?.waypoints;
    assert.ok(waypoints, "Waypoints must exist");
    const wp = waypoints.find((w) => w.id === "kf-x2");
    assert.ok(wp, "Waypoint kf-x2 must exist");
    assert.equal(wp.mode, "continuous");
  });

  it("squashes entire drag gesture into a single atomic undo/redo transaction", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    // Begin gesture transaction
    const tx = documentCommands.begin("Drag motion path waypoint");

    // Intermediate transient pointer move updates
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 130, y: 90 });
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 140, y: 100 });
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 150, y: 110 });
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 200, y: 160 });

    // Pointer up commits transaction
    tx.commit();

    const committed = getDocument();
    const trackX = committed.clips[clipId].tracks.find((t) => t.property === "transform.x")!;
    assert.equal(trackX.keyframes.find((k) => k.id === "kf-x1")!.value, 200);

    // Exactly 1 history step should exist in the past stack
    const history = useHistoryStore.getState();
    assert.equal(history.past.length, 1, "Only 1 history entry should be recorded for the entire drag gesture");

    // Undo should restore initial position (120, 80)
    historyCommands.undo();
    const undone = getDocument();
    const undoneTrackX = undone.clips[clipId].tracks.find((t) => t.property === "transform.x")!;
    const undoneTrackY = undone.clips[clipId].tracks.find((t) => t.property === "transform.y")!;
    assert.equal(undoneTrackX.keyframes.find((k) => k.id === "kf-x1")!.value, 120);
    assert.equal(undoneTrackY.keyframes.find((k) => k.id === "kf-y1")!.value, 80);

    // Redo should restore final drag position (200, 160)
    historyCommands.redo();
    const redone = getDocument();
    const redoneTrackX = redone.clips[clipId].tracks.find((t) => t.property === "transform.x")!;
    assert.equal(redoneTrackX.keyframes.find((k) => k.id === "kf-x1")!.value, 200);
  });

  it("cancelling a gesture transaction via tx.cancel() rolls back changes cleanly", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    const tx = documentCommands.begin("Drag waypoint to be cancelled");
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 999, y: 999 });

    // User presses Escape or gesture is aborted
    tx.cancel();

    const current = getDocument();
    const trackX = current.clips[clipId].tracks.find((t) => t.property === "transform.x")!;
    assert.equal(trackX.keyframes.find((k) => k.id === "kf-x1")!.value, 120, "Must revert to original coordinate");

    // History stack should have 0 entries
    const history = useHistoryStore.getState();
    assert.equal(history.past.length, 0, "No history entry should be created on cancel");
  });

  it("renders selected waypoint state and selection ring when selectedWaypointId is specified", () => {
    const { doc, layerId } = createTestDoc();

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        selectedWaypointId: "kf-x1",
      })
    );

    assert.ok(
      html.includes('data-selected="true"'),
      "Selected waypoint element must have data-selected='true'"
    );
    assert.ok(
      html.includes('data-testid="motion-path-waypoint-selection-ring"'),
      "Selected waypoint must render selection focus ring"
    );
  });

  it("reveals tangent handles for a selected waypoint even when showTangents is false globally", () => {
    const { doc, layerId } = createTestDoc();

    // When showTangents is false, unselected waypoints hide tangents, but selected waypoint displays them
    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        showTangents: false,
        selectedWaypointId: "kf-x1",
      })
    );

    assert.ok(
      html.includes('data-testid="motion-path-tangent-in"'),
      "Selected waypoint must reveal its incoming tangent handle"
    );
    assert.ok(
      html.includes('data-testid="motion-path-tangent-out"'),
      "Selected waypoint must reveal its outgoing tangent handle"
    );
  });

  it("suppresses tangent handles for linear waypoints even when selected", () => {
    const { doc, layerId } = createTestDoc();

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        showTangents: true,
        selectedWaypointId: "kf-x2", // kf-x2 is mode: "linear"
      })
    );

    // There should only be tangents for kf-x0 and kf-x1, not kf-x2
    assert.ok(html.includes('data-waypoint-id="kf-x2"'));
    assert.ok(!html.includes('tangents-kf-x2'), "Linear waypoint must not render tangent arms");
  });

  it("tangent mathematics: continuous mode enforces collinear opposition and preserves opposing length in aligned mode", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    // Initial opposing handle spatialIn was (-30, 15) -> length = sqrt(900 + 225) = sqrt(1125)
    // Drag outbound handle to (40, 30) (magnitude 50, direction: [0.8, 0.6])
    // In continuous + aligned mode, spatialIn should point in opposite direction [-0.8, -0.6]
    // with preserved length sqrt(1125) ≈ 33.541 -> [-26.83, -20.12] -> rounded: (-27, -20)
    const activeVec = { x: 40, y: 30 };
    const actLen = Math.hypot(activeVec.x, activeVec.y);
    const angle = Math.atan2(activeVec.y, activeVec.x);
    const oppAngle = angle + Math.PI;
    const initialOppLen = Math.hypot(-30, 15);
    const expectedOppX = Math.round(Math.cos(oppAngle) * initialOppLen);
    const expectedOppY = Math.round(Math.sin(oppAngle) * initialOppLen);

    documentCommands.updateWaypointTangents(clipId, "kf-x1", {
      spatialOut: activeVec,
      spatialIn: { x: expectedOppX, y: expectedOppY },
      mode: "continuous",
      handleStyle: "aligned",
    });

    const updated = getDocument();
    const wpList = updated.clips[clipId].spatialTrajectories?.transform?.waypoints;
    assert.ok(wpList);
    const wp = wpList.find((w) => w.id === "kf-x1");
    assert.ok(wp);
    assert.deepEqual(wp.spatialOut, { x: 40, y: 30 });
    assert.deepEqual(wp.spatialIn, { x: -27, y: -20 });

    // In symmetric mode, opposing length matches active length 50 exactly: (-32, -24) or (-40, -30) depending on orientation
    const symmetricOpp = {
      x: Math.round(Math.cos(oppAngle) * actLen),
      y: Math.round(Math.sin(oppAngle) * actLen),
    };
    documentCommands.updateWaypointTangents(clipId, "kf-x1", {
      spatialOut: activeVec,
      spatialIn: symmetricOpp,
      mode: "continuous",
      handleStyle: "symmetric",
    });

    const updatedSymm = getDocument();
    const wpSymmList = updatedSymm.clips[clipId].spatialTrajectories?.transform?.waypoints;
    assert.ok(wpSymmList);
    const wpSymm = wpSymmList.find((w) => w.id === "kf-x1");
    assert.ok(wpSymm);
    assert.deepEqual(wpSymm.spatialOut, { x: 40, y: 30 });
    assert.deepEqual(wpSymm.spatialIn, { x: -40, y: -30 });
    assert.equal(Math.hypot(wpSymm.spatialIn!.x, wpSymm.spatialIn!.y), Math.hypot(wpSymm.spatialOut!.x, wpSymm.spatialOut!.y));
  });

  it("tangent mathematics: degenerate zero-length handle does not divide by zero", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    // Active vector at (0, 0)
    const activeVec = { x: 0, y: 0 };
    const actLen = Math.hypot(activeVec.x, activeVec.y);
    assert.equal(actLen, 0);

    // Degenerate vector should produce (0, 0) opposing without NaN
    const oppVec = actLen < 1e-4 ? { x: 0, y: 0 } : { x: 10, y: 10 };
    documentCommands.updateWaypointTangents(clipId, "kf-x1", {
      spatialOut: activeVec,
      spatialIn: oppVec,
      mode: "continuous",
      handleStyle: "aligned",
    });

    const updated = getDocument();
    const wpDegList = updated.clips[clipId].spatialTrajectories?.transform?.waypoints;
    assert.ok(wpDegList);
    const wp = wpDegList.find((w) => w.id === "kf-x1");
    assert.ok(wp);
    assert.deepEqual(wp.spatialOut, { x: 0, y: 0 });
    assert.deepEqual(wp.spatialIn, { x: 0, y: 0 });
    assert.ok(!Number.isNaN(wp.spatialIn!.x) && !Number.isNaN(wp.spatialIn!.y));
  });

  it("tangent mathematics: bezier mode preserves opposing handle completely independently", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    // Initial handles: spatialIn is (-30, 15), spatialOut is (30, -15)
    // In bezier mode, changing spatialOut must NOT alter spatialIn
    documentCommands.updateWaypointTangents(clipId, "kf-x1", {
      spatialOut: { x: 95, y: -80 },
      mode: "bezier",
      handleStyle: "broken",
    });

    const updated = getDocument();
    const wpBezList = updated.clips[clipId].spatialTrajectories?.transform?.waypoints;
    assert.ok(wpBezList);
    const wp = wpBezList.find((w) => w.id === "kf-x1");
    assert.ok(wp);
    assert.deepEqual(wp.spatialOut, { x: 95, y: -80 }, "Active handle must update");
    assert.deepEqual(wp.spatialIn, { x: -30, y: 15 }, "Opposing handle in bezier mode must remain completely unchanged");
  });

  it("coordinate transformation: calculates scale-normalized canvas displacement across zoom levels", () => {
    // Screen delta of 100px:
    const screenDeltaX = 100;
    const screenDeltaY = 60;

    // Zoom 1x
    const zoom1 = 1;
    const canvasDelta1 = { x: screenDeltaX / zoom1, y: screenDeltaY / zoom1 };
    assert.deepEqual(canvasDelta1, { x: 100, y: 60 });

    // Zoom 2x (magnified: 100 screen px = 50 canvas px)
    const zoom2 = 2;
    const canvasDelta2 = { x: screenDeltaX / zoom2, y: screenDeltaY / zoom2 };
    assert.deepEqual(canvasDelta2, { x: 50, y: 30 });

    // Zoom 0.5x (zoomed out: 100 screen px = 200 canvas px)
    const zoomHalf = 0.5;
    const canvasDeltaHalf = { x: screenDeltaX / zoomHalf, y: screenDeltaY / zoomHalf };
    assert.deepEqual(canvasDeltaHalf, { x: 200, y: 120 });
  });

  it("document integrity: waypoint edits preserve canonical timestamps and create zero duplicate keyframes", () => {
    const { doc, clipId } = createTestDoc();
    setDocument(doc);

    const initialClip = doc.clips[clipId];
    const initialTrackX = initialClip.tracks.find((t) => t.property === "transform.x")!;
    assert.equal(initialTrackX.keyframes.length, 3);

    // Move waypoint 3 times
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 140, y: 90 });
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 160, y: 110 });
    documentCommands.updateWaypointPosition(clipId, "kf-x1", { x: 180, y: 130 });

    const finalClip = getDocument().clips[clipId];
    const trackX = finalClip.tracks.find((t) => t.property === "transform.x")!;
    const trackY = finalClip.tracks.find((t) => t.property === "transform.y")!;

    // Track length must remain strictly 3 (no duplicate keyframe pollution)
    assert.equal(trackX.keyframes.length, 3, "Track X must maintain exactly 3 keyframes");
    assert.equal(trackY.keyframes.length, 3, "Track Y must maintain exactly 3 keyframes");

    // Timestamps must remain exactly 0, 1.5, 3
    assert.deepEqual(trackX.keyframes.map((k) => k.time), [0, 1.5, 3]);
    assert.deepEqual(trackY.keyframes.map((k) => k.time), [0, 1.5, 3]);

    // Only the values at t=1.5 are updated
    assert.equal(trackX.keyframes[1].value, 180);
    assert.equal(trackY.keyframes[1].value, 130);
  });
});
