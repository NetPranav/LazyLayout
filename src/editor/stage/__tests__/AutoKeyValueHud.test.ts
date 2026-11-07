/**
 * Phase 70: Auto-key on the stage & Value HUD Tests
 *
 * Verification Gate:
 * "Done when: a drag at 3 playhead times creates 3 keyframes."
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ValueHud } from "../ValueHud";
import type { StageElement } from "../types";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import {
  documentCommands,
  historyCommands,
  getDocument,
} from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { transport, getTransport } from "@/core/time/transport";
import { useTimelineUiStore } from "@/core/store/useTimelineUiStore";
import { installAutoKey } from "@/core/timeline/keyframeOps";
import { evaluate } from "@/core/kernel/evaluate";
import { motionActions } from "@/editor/motion-model";

function createTestDoc(): { layerId: string } {
  const b = new DocBuilder();
  const layerId = b.layer("container", "HeroBox", null, {
    "frame.x": 0,
    "frame.y": 0,
    "frame.width": 120,
    "frame.height": 80,
    "frame.rotation": 0,
    "appearance.opacity": 1,
    "transform.x": 0,
    "transform.y": 0,
  });

  const doc = b.build();
  setDocument(doc);

  transport.setComposition({
    id: MAIN_COMPOSITION_ID,
    fps: 60,
    duration: 5,
    workArea: { start: 0, end: 5 },
  });
  transport.seek(0);

  return { layerId };
}

function getLayerKeyframes(layerId: string, property: string): Array<{ id: string; time: number; value: unknown }> {
  const doc = getDocument();
  return Object.values(doc.clips).flatMap((c) =>
    c.layerId === layerId
      ? c.tracks
          .filter((t) => t.property === property)
          .flatMap((t) => t.keyframes)
      : []
  );
}

describe("Phase 70 · Auto-key on the stage & value HUD", () => {
  let removeAutoKey: () => void;

  beforeEach(() => {
    removeAutoKey = installAutoKey();
    useTimelineUiStore.setState({
      recordMode: false,
      isScrubbing: false,
      selectedKeys: new Set(),
      trail: [],
      openPrecomps: [],
    });
  });

  afterEach(() => {
    removeAutoKey();
  });

  describe("Auto-key on the canvas", () => {
    it("with record mode OFF, dragging on stage modifies layer props but creates NO keyframes", () => {
      const { layerId } = createTestDoc();

      transport.seek(0);
      const tx = documentCommands.begin("Move layer");
      documentCommands.updateProps(layerId, { "frame.x": 150, "frame.y": 120 });
      tx.commit();

      assert.equal(getDocument().layers[layerId].properties["frame.x"], 150);
      assert.equal(getDocument().layers[layerId].properties["frame.y"], 120);
      assert.equal(getLayerKeyframes(layerId, "frame.x").length, 0);
      assert.equal(getLayerKeyframes(layerId, "frame.y").length, 0);
    });

    it("Done when: a drag at 3 playhead times creates 3 keyframes", () => {
      const { layerId } = createTestDoc();
      useTimelineUiStore.getState().setRecordMode(true);

      const dragSteps = [
        { time: 0, x: 150, y: 120 },
        { time: 1, x: 220, y: 180 },
        { time: 2, x: 300, y: 260 },
      ] as const;

      for (const step of dragSteps) {
        // Scrub playhead to target time
        transport.seek(step.time);
        assert.equal(getTransport().time, step.time);

        // Simulate canvas drag transaction
        const tx = documentCommands.begin("Move layer");
        // Intermediate pointermove events update coordinates
        documentCommands.updateProps(layerId, {
          "frame.x": step.x - 10,
          "frame.y": step.y - 10,
        });
        documentCommands.updateProps(layerId, {
          "frame.x": step.x,
          "frame.y": step.y,
        });
        tx.commit();
      }

      // Check keyframes created for frame.x
      const xKeys = getLayerKeyframes(layerId, "frame.x");
      assert.equal(xKeys.length, 3, "Exactly 3 keyframes created for frame.x at 3 playhead times");
      assert.deepEqual(
        xKeys.map((k) => k.time),
        [0, 1, 2],
        "Keyframe times must be [0, 1, 2]"
      );
      assert.deepEqual(
        xKeys.map((k) => k.value),
        [150, 220, 300],
        "Keyframe values for frame.x must match dragged positions"
      );

      // Check keyframes created for frame.y
      const yKeys = getLayerKeyframes(layerId, "frame.y");
      assert.equal(yKeys.length, 3, "Exactly 3 keyframes created for frame.y at 3 playhead times");
      assert.deepEqual(
        yKeys.map((k) => k.time),
        [0, 1, 2],
        "Keyframe times must be [0, 1, 2]"
      );
      assert.deepEqual(
        yKeys.map((k) => k.value),
        [120, 180, 260],
        "Keyframe values for frame.y must match dragged positions"
      );

      // Verify evaluate() matches the recorded trajectory over time
      const evalAt0 = evaluate(getDocument(), MAIN_COMPOSITION_ID, layerId, 0);
      assert.equal(evalAt0["frame.x"], 150);
      assert.equal(evalAt0["frame.y"], 120);

      const evalAt1 = evaluate(getDocument(), MAIN_COMPOSITION_ID, layerId, 1);
      assert.equal(evalAt1["frame.x"], 220);
      assert.equal(evalAt1["frame.y"], 180);

      const evalAt2 = evaluate(getDocument(), MAIN_COMPOSITION_ID, layerId, 2);
      assert.equal(evalAt2["frame.x"], 300);
      assert.equal(evalAt2["frame.y"], 260);

      // Linear interpolation between keyframes
      const evalAt05 = evaluate(getDocument(), MAIN_COMPOSITION_ID, layerId, 0.5);
      assert.equal(evalAt05["frame.x"], 185); // (150 + 220) / 2
      assert.equal(evalAt05["frame.y"], 150); // (120 + 180) / 2

      // Undo removes the last drag and its keyframe
      historyCommands.undo();
      assert.equal(getLayerKeyframes(layerId, "frame.x").length, 2, "Undo removes 3rd keyframe");
      assert.equal(getLayerKeyframes(layerId, "frame.y").length, 2);

      historyCommands.undo();
      assert.equal(getLayerKeyframes(layerId, "frame.x").length, 1, "Undo removes 2nd keyframe");

      historyCommands.undo();
      assert.equal(getLayerKeyframes(layerId, "frame.x").length, 0, "Undo removes 1st keyframe");
    });

    it("syncs motionActions.setPlayhead with transport.seek", () => {
      createTestDoc();
      motionActions.setPlayhead(60); // 60 frames = 1.0 second at 60fps
      assert.equal(getTransport().time, 1.0);

      motionActions.setPlayhead(120); // 120 frames = 2.0 seconds
      assert.equal(getTransport().time, 2.0);
    });
  });

  describe("Value HUD", () => {
    it("is hidden when neither scrubbing nor gesturing (forceVisible = false)", () => {
      const { layerId } = createTestDoc();
      const elements: Record<string, StageElement> = {
        [layerId]: {
          id: layerId,
          name: "HeroBox",
          type: "container",
          x: 100,
          y: 100,
          ox: 0,
          oy: 0,
          width: 120,
          height: 80,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(ValueHud, {
          selectedIds: [layerId],
          elements,
          isGesturing: false,
          forceVisible: false,
        })
      );

      assert.equal(html, "", "HUD should render null when idle");
    });

    it("displays live values when forceVisible = true", () => {
      const { layerId } = createTestDoc();
      const elements: Record<string, StageElement> = {
        [layerId]: {
          id: layerId,
          name: "HeroBox",
          type: "container",
          x: 140,
          y: 200,
          ox: 0,
          oy: 0,
          width: 120,
          height: 80,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(ValueHud, {
          selectedIds: [layerId],
          elements,
          forceVisible: true,
        })
      );

      assert.ok(html.includes('data-testid="stage-value-hud"'), "Renders stage-value-hud");
      assert.ok(html.includes('data-testid="value-hud-x"'), "Renders value-hud-x");
      assert.ok(html.includes('data-testid="value-hud-y"'), "Renders value-hud-y");
      assert.ok(html.includes('data-testid="value-hud-rotation"'), "Renders value-hud-rotation");
      assert.ok(html.includes('data-testid="value-hud-opacity"'), "Renders value-hud-opacity");
      assert.ok(html.includes("0°"), "Shows rotation 0°");
      assert.ok(html.includes("100%"), "Shows opacity 100%");
      assert.ok(html.includes("ll:pointer-events-none"), "Adheres to UI rules: non-blocking pointer events");
    });

    it("displays live coordinates during canvas gesturing (isGesturing = true)", () => {
      const { layerId } = createTestDoc();
      const elements: Record<string, StageElement> = {
        [layerId]: {
          id: layerId,
          name: "HeroBox",
          type: "container",
          x: 245,
          y: 310,
          ox: 0,
          oy: 0,
          width: 120,
          height: 80,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(ValueHud, {
          selectedIds: [layerId],
          elements,
          isGesturing: true,
        })
      );

      assert.ok(html.includes('data-x="245"'), "Reflects gestured X position");
      assert.ok(html.includes('data-y="310"'), "Reflects gestured Y position");
      assert.ok(html.includes(">245<"), "Shows live text 245");
      assert.ok(html.includes(">310<"), "Shows live text 310");
    });

    it("displays live evaluated values while scrubbing on the timeline (isScrubbing = true)", () => {
      const { layerId } = createTestDoc();
      useTimelineUiStore.getState().setRecordMode(true);

      // Create keyframes at t=0 and t=2 by changing properties at those playhead times
      transport.seek(0);
      documentCommands.updateProps(layerId, {
        "frame.x": 100,
        "frame.y": 100,
        "frame.rotation": 10,
        "appearance.opacity": 0.5,
      });

      transport.seek(2);
      documentCommands.updateProps(layerId, {
        "frame.x": 300,
        "frame.y": 200,
        "frame.rotation": 90,
        "appearance.opacity": 1.0,
      });

      // Scrub to mid-point t = 1.0
      transport.seek(1.0);
      useTimelineUiStore.setState({ isScrubbing: true });

      const elements: Record<string, StageElement> = {
        [layerId]: {
          id: layerId,
          name: "HeroBox",
          type: "container",
          x: 100,
          y: 100,
          ox: 0,
          oy: 0,
          width: 120,
          height: 80,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(ValueHud, {
          selectedIds: [layerId],
          elements,
          isGesturing: false,
        })
      );

      assert.ok(html.includes('data-x="200"'), "Evaluated X at t=1 is 200");
      assert.ok(html.includes('data-y="150"'), "Evaluated Y at t=1 is 150");
      assert.ok(html.includes('data-rotation="50"'), "Evaluated rotation at t=1 is 50°");
      assert.ok(html.includes('data-opacity="75"'), "Evaluated opacity at t=1 is 75%");
    });
  });
});
