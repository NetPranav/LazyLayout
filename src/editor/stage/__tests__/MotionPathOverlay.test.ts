/**
 * Phase 69 Milestone 4: Read-Only Canvas Overlay & Path Rendering Unit Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MotionPathOverlay } from "../MotionPathOverlay";
import type { Clip, Layer } from "@/core/document/schema";
import type { StageElement } from "../types";
import { getSpatialTrajectory, evaluate } from "@/core/kernel/evaluate";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";

function createTestSpatialClip(layerId: string, overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip-spatial-1",
    layerId,
    name: "MotionPathClip",
    type: "entrance",
    trigger: "mount",
    duration: 2,
    easing: "linear",
    enabled: true,
    tracks: [
      {
        id: "tx",
        property: "transform.x",
        keyframes: [
          { id: "kx0", time: 0, value: 0 },
          { id: "kx1", time: 1, value: 150 },
          { id: "kx2", time: 2, value: 300 },
        ],
      },
      {
        id: "ty",
        property: "transform.y",
        keyframes: [
          { id: "ky0", time: 0, value: 0 },
          { id: "ky1", time: 1, value: 100 },
          { id: "ky2", time: 2, value: 0 },
        ],
      },
    ],
    spatialTrajectories: {
      transform: {
        id: "st-test-1",
        propertyGroup: "transform",
        enabled: true,
        waypoints: [
          { id: "kx0", time: 0, mode: "bezier", spatialOut: { x: 50, y: 50 } },
          { id: "kx1", time: 1, mode: "continuous", spatialIn: { x: -30, y: 20 }, spatialOut: { x: 30, y: -20 } },
          { id: "kx2", time: 2, mode: "linear" },
        ],
      },
    },
    ...overrides,
  };
}

function createTestLayer(id: string, x = 100, y = 200, width = 80, height = 40): Layer {
  return {
    id,
    name: "TestBox",
    archetype: "rectangle",
    parentId: null,
    children: [],
    properties: {
      "frame.x": x,
      "frame.y": y,
      "frame.width": width,
      "frame.height": height,
      "transform.x": 0,
      "transform.y": 0,
    },
  };
}

describe("Phase 69 Milestone 4: MotionPathOverlay (Canvas Overlay & Path Rendering)", () => {
  it("renders null when selectedIds is empty", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
      })
    );

    assert.equal(html, "");
  });

  it("renders null when selected layer has no clips with spatial trajectories", () => {
    const layer = createTestLayer("box-1");
    const scalarClip: Clip = {
      id: "clip-scalar",
      layerId: "box-1",
      name: "ScalarClip",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      enabled: true,
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
    };

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [scalarClip.id]: scalarClip },
      })
    );

    assert.equal(html, "");
  });

  it("renders null when spatial trajectory is disabled or has fewer than 2 waypoints", () => {
    const layer = createTestLayer("box-1");
    const disabledClip = createTestSpatialClip("box-1", {
      spatialTrajectories: {
        transform: {
          id: "st-disabled",
          propertyGroup: "transform",
          enabled: false,
          waypoints: [{ id: "k0", time: 0 }, { id: "k1", time: 1 }],
        },
      },
    });

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [disabledClip.id]: disabledClip },
      })
    );

    assert.equal(html, "");
  });

  it("renders the SVG trajectory ribbon with correct geometry path data", () => {
    const layer = createTestLayer("box-1", 100, 200, 80, 40);
    const clip = createTestSpatialClip("box-1");
    const geom = getSpatialTrajectory(clip, layer.properties)!;
    const expectedSvgPath = geom.toSvgPath();

    const elements: Record<string, StageElement> = {
      "box-1": { id: "box-1", x: 100, y: 200, width: 80, height: 40 },
    };

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        elements,
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
      })
    );

    assert.ok(html.includes('data-testid="motion-path-overlay"'), "Must render root overlay SVG");
    assert.ok(html.includes('data-testid="motion-path-ribbon"'), "Must render trajectory ribbon");
    assert.ok(html.includes(`d="${expectedSvgPath}"`), "Ribbon path data must match compiled geometry toSvgPath()");
    // Translated to element center (100 + 40, 200 + 20) = (140, 220)
    assert.ok(html.includes('transform="translate(140, 220)"'), "Must translate group to element center anchor");
  });

  it("supports top-left anchor mode positioning", () => {
    const layer = createTestLayer("box-1", 50, 80, 100, 60);
    const clip = createTestSpatialClip("box-1");

    const elements: Record<string, StageElement> = {
      "box-1": { id: "box-1", x: 50, y: 80, width: 100, height: 60 },
    };

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        elements,
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        anchorMode: "top-left",
      })
    );

    assert.ok(html.includes('transform="translate(50, 80)"'), "Must translate group to top-left when anchorMode='top-left'");
  });

  it("falls back to layer frame.x and frame.y when elements map is not provided", () => {
    const layer = createTestLayer("box-1", 120, 240, 60, 40);
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
      })
    );

    // Center: 120 + 30 = 150, 240 + 20 = 260
    assert.ok(html.includes('transform="translate(150, 260)"'), "Must fallback cleanly to layer.properties frame dimensions");
  });

  it("renders distinct waypoint shapes: square for linear and circle for curved", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
      })
    );

    // Waypoint kx0 (bezier) -> circle
    assert.ok(html.includes('data-waypoint-id="kx0"'), "Must render waypoint kx0");
    assert.ok(html.includes('data-waypoint-mode="bezier"'), "Must mark mode bezier");

    // Waypoint kx2 (linear) -> rect
    assert.ok(html.includes('data-waypoint-id="kx2"'), "Must render waypoint kx2");
    assert.ok(html.includes('data-waypoint-mode="linear"'), "Must mark mode linear");
    assert.ok(html.includes("<rect"), "Linear waypoint must render as rectangle/square");
  });

  it("renders tangent handles and dashed control arms when spatialIn / spatialOut exist", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        showTangents: true,
      })
    );

    assert.ok(html.includes('data-testid="motion-path-tangent-out"'), "Must render outgoing tangent handle");
    assert.ok(html.includes('data-testid="motion-path-tangent-in"'), "Must render incoming tangent handle");
    assert.ok(html.includes("stroke-dasharray="), "Tangent arms must have dashed style");
  });

  it("hides tangent handles when showTangents is false", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        showTangents: false,
      })
    );

    assert.ok(!html.includes('data-testid="motion-path-tangent-out"'), "Must not render tangent handles when disabled");
    assert.ok(!html.includes('data-testid="motion-path-tangent-in"'), "Must not render tangent handles when disabled");
  });

  it("renders per-frame velocity ticks corresponding to composition FPS", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");
    const geom = getSpatialTrajectory(clip, layer.properties)!;
    const expectedTickCount = geom.sampleFrameTicks(30).length;

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        fps: 30,
        showTicks: true,
      })
    );

    const tickMatches = html.match(/data-testid="motion-path-tick"/g) ?? [];
    assert.equal(tickMatches.length, expectedTickCount, `Must render exactly ${expectedTickCount} velocity ticks at 30 FPS`);
    assert.ok(expectedTickCount > 50, "2-second clip at 30 FPS must produce over 50 ticks");
  });

  it("hides velocity ticks when showTicks is false", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        showTicks: false,
      })
    );

    assert.ok(!html.includes('data-testid="motion-path-tick"'), "Must not render velocity ticks when showTicks is false");
  });

  it("renders playhead indicator at evaluated spatial coordinate for currentTime", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");
    const geom = getSpatialTrajectory(clip, layer.properties)!;

    // At t = 1.0 s:
    const ptAt1 = geom.evaluateAtTime(1.0)!;

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        currentTime: 1.0,
        showPlayhead: true,
      })
    );

    assert.ok(html.includes('data-testid="motion-path-playhead"'), "Must render playhead indicator");
    assert.ok(
      html.includes(`transform="translate(${ptAt1.x}, ${ptAt1.y})"`),
      `Playhead must be translated to evaluated point (${ptAt1.x}, ${ptAt1.y})`
    );
  });

  it("adjusts stroke widths and radii scale-invariantly when zoomed", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");

    const htmlZoom1 = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        zoom: 1,
      })
    );

    const htmlZoom2 = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: ["box-1"],
        layers: { "box-1": layer },
        clips: { [clip.id]: clip },
        zoom: 2,
      })
    );

    // At zoom 1: waypointRadius = 4 / 1 = 4. At zoom 2: waypointRadius = 4 / 2 = 2.
    assert.ok(htmlZoom1.includes('r="4"'), "Zoom 1 must have r=4 waypoint circle");
    assert.ok(htmlZoom2.includes('r="2"'), "Zoom 2 must have r=2 waypoint circle");
  });

  it("strictly preserves document and clip immutability during rendering", () => {
    const layer = createTestLayer("box-1");
    const clip = createTestSpatialClip("box-1");
    const frozenLayer = Object.freeze(JSON.parse(JSON.stringify(layer)));
    const frozenClip = Object.freeze(JSON.parse(JSON.stringify(clip)));

    assert.doesNotThrow(() => {
      renderToStaticMarkup(
        React.createElement(MotionPathOverlay, {
          selectedIds: ["box-1"],
          layers: { "box-1": frozenLayer },
          clips: { [frozenClip.id]: frozenClip },
        })
      );
    }, "Rendering must never mutate layer or clip objects");
  });

  it("converts composition playhead time to clip-local time for a clip with nonzero start offset and matches evaluate()", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "AnimatedBox", null, {
      "frame.x": 100,
      "frame.y": 200,
      "frame.width": 80,
      "frame.height": 40,
      "transform.x": 0,
      "transform.y": 0,
    });

    const clipId = b.clip(layerId, {
      name: "OffsetSpatialClip",
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
            { id: "kx1", time: 1, value: 150 },
            { id: "kx2", time: 2, value: 300 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky1", time: 1, value: 100 },
            { id: "ky2", time: 2, value: 0 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-offset",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "kx0", time: 0, mode: "bezier", spatialOut: { x: 50, y: 50 } },
            { id: "kx1", time: 1, mode: "continuous", spatialIn: { x: -30, y: 20 }, spatialOut: { x: 30, y: -20 } },
            { id: "kx2", time: 2, mode: "linear" },
          ],
        },
      },
    });

    const doc = b.build();
    const comp = doc.compositions[MAIN_COMPOSITION_ID];
    // Offset clip placement by 5.0 seconds in composition:
    const placement = comp.clips.find((p) => p.clipId === clipId)!;
    placement.offset = 5.0;
    comp.layers[layerId] = { in: 0, out: 15, start: 0, stretch: 1 };

    // Composition playhead at 6.5s (clip-local time: 1.5s)
    const compTime = 6.5;

    // Canonical evaluate() oracle from deterministic kernel:
    const evaluated = evaluate(doc, MAIN_COMPOSITION_ID, layerId, compTime);
    const evalX = evaluated["transform.x"] as number;
    const evalY = evaluated["transform.y"] as number;

    const html = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        currentTime: compTime,
        showPlayhead: true,
      })
    );

    assert.ok(
      html.includes('data-testid="motion-path-playhead"'),
      "Playhead marker must be rendered when composition playhead is inside clip"
    );
    assert.ok(
      html.includes(`transform="translate(${evalX}, ${evalY})"`),
      `Playhead marker coordinate (${evalX}, ${evalY}) must identically match canonical evaluate() kernel output`
    );
  });

  it("does not render playhead marker when composition playhead is outside the clip active time range", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "AnimatedBox", null, {
      "frame.x": 100,
      "frame.y": 200,
      "frame.width": 80,
      "frame.height": 40,
      "transform.x": 0,
      "transform.y": 0,
    });

    const clipId = b.clip(layerId, {
      name: "OffsetSpatialClip2",
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
            { id: "kx1", time: 1, value: 150 },
            { id: "kx2", time: 2, value: 300 },
          ],
        },
        {
          id: "ty",
          property: "transform.y",
          keyframes: [
            { id: "ky0", time: 0, value: 0 },
            { id: "ky1", time: 1, value: 100 },
            { id: "ky2", time: 2, value: 0 },
          ],
        },
      ],
      spatialTrajectories: {
        transform: {
          id: "st-offset2",
          propertyGroup: "transform",
          enabled: true,
          waypoints: [
            { id: "kx0", time: 0, mode: "bezier", spatialOut: { x: 50, y: 50 } },
            { id: "kx1", time: 1, mode: "continuous", spatialIn: { x: -30, y: 20 }, spatialOut: { x: 30, y: -20 } },
            { id: "kx2", time: 2, mode: "linear" },
          ],
        },
      },
    });

    const doc = b.build();
    const comp = doc.compositions[MAIN_COMPOSITION_ID];
    // Offset clip placement by 5.0 seconds in composition (active from 5.0s to 7.0s):
    const placement = comp.clips.find((p) => p.clipId === clipId)!;
    placement.offset = 5.0;
    comp.layers[layerId] = { in: 0, out: 15, start: 0, stretch: 1 };

    // 1. At compTime = 3.0s (before clip starts at 5.0s):
    const htmlBefore = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        currentTime: 3.0,
        showPlayhead: true,
      })
    );
    assert.ok(
      !htmlBefore.includes('data-testid="motion-path-playhead"'),
      "Playhead marker must NOT be rendered when composition time is before clip starts"
    );
    assert.ok(
      htmlBefore.includes('data-testid="motion-path-ribbon"'),
      "Trajectory ribbon must remain visible for spatial editing context"
    );

    // 2. At compTime = 8.0s (after clip ends at 5.0 + 2.0 = 7.0s):
    const htmlAfter = renderToStaticMarkup(
      React.createElement(MotionPathOverlay, {
        selectedIds: [layerId],
        layers: doc.layers,
        clips: doc.clips,
        compositions: doc.compositions,
        compositionId: MAIN_COMPOSITION_ID,
        currentTime: 8.0,
        showPlayhead: true,
      })
    );
    assert.ok(
      !htmlAfter.includes('data-testid="motion-path-playhead"'),
      "Playhead marker must NOT be rendered when composition time is after clip finishes"
    );
    assert.ok(
      htmlAfter.includes('data-testid="motion-path-ribbon"'),
      "Trajectory ribbon must remain visible for spatial editing context"
    );
  });
});
