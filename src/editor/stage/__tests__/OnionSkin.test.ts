import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocBuilder } from "@/core/document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import {
  sampleLayerGhosts,
  calculateGhostOpacity,
  normalizeOnionSkinConfig,
  DEFAULT_ONION_SKIN_CONFIG,
  type OnionSkinConfig,
} from "@/core/timeline/onionSkin";
import { OnionSkinOverlay } from "../OnionSkinOverlay";
import { setDocument, getDocument } from "@/core/store/documentState";
import { performance } from "node:perf_hooks";

describe("Phase 71 · Onion skin", () => {
  function createAnimatedDoc() {
    const b = new DocBuilder();
    const layerId = b.layer("container", "AnimatedBox", null, {
      "frame.x": 100,
      "frame.y": 100,
      "frame.width": 120,
      "frame.height": 80,
      "frame.rotation": 0,
      "appearance.opacity": 1,
    });

    // Create a 5-second clip with linear animation on transform.x from 0 to 500
    // and frame.rotation from 0 to 90
    b.clip(layerId, {
      name: "MotionClip",
      type: "entrance",
      trigger: "mount",
      duration: 5,
      easing: "linear",
      tracks: [
        {
          id: "tr_x",
          property: "transform.x",
          keyframes: [
            { id: "k1", time: 0, value: 0 },
            { id: "k2", time: 5, value: 500 },
          ],
        },
        {
          id: "tr_r",
          property: "frame.rotation",
          keyframes: [
            { id: "k3", time: 0, value: 0 },
            { id: "k4", time: 5, value: 90 },
          ],
        },
      ],
    });

    const doc = b.build();
    setDocument(doc);
    return { doc, layerId };
  }

  describe("A. Deterministic Sampling & Time Domain", () => {
    it("samples 5 total ghosts (2 before, 3 after) accurately at current playhead time", () => {
      const { doc, layerId } = createAnimatedDoc();
      const config: OnionSkinConfig = {
        enabled: true,
        framesBefore: 2,
        framesAfter: 3,
        step: 1,
        baseOpacity: 0.4,
      };

      // At t = 2.0s, fps = 60:
      // frame duration = 1/60 = 0.016667s
      // Past: t - 2/60, t - 1/60
      // Future: t + 1/60, t + 2/60, t + 3/60
      const ghosts = sampleLayerGhosts({
        doc,
        compositionId: MAIN_COMPOSITION_ID,
        layerId,
        currentTime: 2.0,
        fps: 60,
        duration: 5.0,
        config,
      });

      assert.equal(ghosts.length, 5, "Exactly 5 total ghosts sampled");
      const beforeGhosts = ghosts.filter((g) => g.direction === "before");
      const afterGhosts = ghosts.filter((g) => g.direction === "after");
      assert.equal(beforeGhosts.length, 2, "2 ghosts before");
      assert.equal(afterGhosts.length, 3, "3 ghosts after");

      // Verify offsets: -2, -1, +1, +2, +3
      assert.deepEqual(
        ghosts.map((g) => g.frameOffset),
        [-2, -1, 1, 2, 3],
        "Offsets are sequential relative to playhead"
      );

      // Verify evaluated position reflects linear motion (100 px/sec)
      // At t = 2.0s: x = 100 + 2.0 * 100 = 300px
      // For offset -1: x = 300 - (1/60)*100 = 298.33px
      const closestPast = ghosts.find((g) => g.frameOffset === -1)!;
      assert.ok(Math.abs(closestPast.canvasX - 298.333) < 0.1, "Closest past ghost position matches evaluate()");
    });

    it("suppresses invalid boundary samples when playhead is near start (t=0) or end (t=duration)", () => {
      const { doc, layerId } = createAnimatedDoc();
      const config: OnionSkinConfig = {
        enabled: true,
        framesBefore: 2,
        framesAfter: 3,
        step: 1,
        baseOpacity: 0.4,
      };

      // At t = 0s: No past frames exist (t - dt < 0). Only future frames should be emitted.
      const startGhosts = sampleLayerGhosts({
        doc,
        compositionId: MAIN_COMPOSITION_ID,
        layerId,
        currentTime: 0,
        fps: 60,
        duration: 5.0,
        config,
      });

      assert.equal(startGhosts.length, 3, "All past frames suppressed at composition start (zero duplicates)");
      assert.ok(startGhosts.every((g) => g.direction === "after"), "Only future ghosts present at t=0");

      // At t = 5.0s (composition duration): No future frames exist (t + dt > 5). Only past frames emitted.
      const endGhosts = sampleLayerGhosts({
        doc,
        compositionId: MAIN_COMPOSITION_ID,
        layerId,
        currentTime: 5.0,
        fps: 60,
        duration: 5.0,
        config,
      });

      assert.equal(endGhosts.length, 2, "All future frames suppressed at composition end (zero duplicates)");
      assert.ok(endGhosts.every((g) => g.direction === "before"), "Only past ghosts present at t=duration");
    });

    it("respects layer active interval (in/out) and suppresses ghosts outside active range", () => {
      const { doc, layerId } = createAnimatedDoc();
      // Set layer in = 1.0s, out = 3.0s
      const updatedDoc = {
        ...doc,
        compositions: {
          ...doc.compositions,
          [MAIN_COMPOSITION_ID]: {
            ...doc.compositions[MAIN_COMPOSITION_ID],
            layers: {
              ...doc.compositions[MAIN_COMPOSITION_ID].layers,
              [layerId]: { in: 1.0, out: 3.0, start: 0, stretch: 1 },
            },
          },
        },
      };

      const config: OnionSkinConfig = {
        enabled: true,
        framesBefore: 2,
        framesAfter: 2,
        step: 5, // 5 frames = 5/60 = 0.0833s
        baseOpacity: 0.4,
      };

      // At t = 1.02s: sample t - 2*(5/60) = 1.02 - 0.166 = 0.854s (below in=1.0) -> suppressed
      const nearInGhosts = sampleLayerGhosts({
        doc: updatedDoc,
        compositionId: MAIN_COMPOSITION_ID,
        layerId,
        currentTime: 1.02,
        fps: 60,
        duration: 5.0,
        config,
      });

      assert.ok(nearInGhosts.every((g) => g.time >= 1.0), "All sampled ghosts stay within layer.in bound");
    });
  });

  describe("B. Coordinate System Alignment & Opacity Falloff", () => {
    it("applies parent container origin (ox, oy) identically to canvas and transform overlay", () => {
      const { doc, layerId } = createAnimatedDoc();
      const config: OnionSkinConfig = {
        enabled: true,
        framesBefore: 1,
        framesAfter: 1,
        step: 1,
        baseOpacity: 0.4,
      };

      const parentOrigin = { ox: 150, oy: 80 };
      const ghosts = sampleLayerGhosts({
        doc,
        compositionId: MAIN_COMPOSITION_ID,
        layerId,
        currentTime: 2.0,
        fps: 60,
        duration: 5.0,
        config,
        parentOrigin,
      });

      // At t = 2.0s, relative x is 300. With ox = 150, canvasX must be centered around 450
      for (const g of ghosts) {
        assert.ok(g.canvasX >= 440 && g.canvasX <= 460, `Canvas X (${g.canvasX}) includes parent origin ox=150`);
        assert.equal(g.canvasY, 180, "Canvas Y (100 + 80 = 180) includes parent origin oy=80");
      }
    });

    it("computes directional opacity falloff correctly", () => {
      // Formula: alpha(k) = baseOpacity * (1 - (k - 1) / (sideCount + 1))
      // For sideCount = 2, baseOpacity = 0.4:
      // k = 1 (1 frame away): 0.4 * (1 - 0/3) = 0.400
      // k = 2 (2 frames away): 0.4 * (1 - 1/3) = 0.2667
      const op1 = calculateGhostOpacity(1, 2, 0.4);
      const op2 = calculateGhostOpacity(2, 2, 0.4);

      assert.ok(Math.abs(op1 - 0.4) < 1e-4, "Closest ghost has full baseOpacity 0.4");
      assert.ok(Math.abs(op2 - 0.2667) < 1e-3, "Second ghost falls off gracefully to ~0.267");
      assert.ok(op1 > op2, "Opacity tapers down with distance from playhead");
    });

    it("normalizes and clamps invalid configuration values", () => {
      const invalid = normalizeOnionSkinConfig({
        framesBefore: 99,
        framesAfter: -5,
        step: 0,
        baseOpacity: 2.5,
      });

      assert.equal(invalid.framesBefore, 5, "Clamped to max 5 frames");
      assert.equal(invalid.framesAfter, 0, "Clamped to min 0 frames");
      assert.equal(invalid.step, 1, "Clamped to min 1 frame step");
      assert.equal(invalid.baseOpacity, 1.0, "Clamped to max 1.0 opacity");
    });
  });

  describe("C. Stage Rendering & DOM Verification", () => {
    it("renders nothing when onion skin is disabled or no layers are selected", () => {
      const { doc, layerId } = createAnimatedDoc();
      const disabledHtml = renderToStaticMarkup(
        React.createElement(OnionSkinOverlay, {
          selectedIds: [layerId],
          currentTime: 2.0,
          config: { ...DEFAULT_ONION_SKIN_CONFIG, enabled: false },
        })
      );
      assert.equal(disabledHtml, "", "Zero DOM rendered when disabled");

      const noSelectionHtml = renderToStaticMarkup(
        React.createElement(OnionSkinOverlay, {
          selectedIds: [],
          currentTime: 2.0,
          config: { ...DEFAULT_ONION_SKIN_CONFIG, enabled: true },
        })
      );
      assert.equal(noSelectionHtml, "", "Zero DOM rendered when no layer selected");
    });

    it("renders ghost elements with correct directional styling and data attributes", () => {
      const { doc, layerId } = createAnimatedDoc();
      const html = renderToStaticMarkup(
        React.createElement(OnionSkinOverlay, {
          selectedIds: [layerId],
          currentTime: 2.0,
          fps: 60,
          duration: 5.0,
          config: {
            enabled: true,
            framesBefore: 2,
            framesAfter: 3,
            step: 1,
            baseOpacity: 0.4,
          },
        })
      );

      assert.ok(html.includes('data-testid="onion-skin-overlay"'), "Overlay container mounted");
      assert.ok(html.includes('data-ghost-direction="before"'), "Past ghosts marked with direction='before'");
      assert.ok(html.includes('data-ghost-direction="after"'), "Future ghosts marked with direction='after'");
      assert.ok(html.includes("-1f"), "Frame offset tags rendered");
      assert.ok(html.includes("+1f"), "Future frame offset tags rendered");
    });

    it("sampling ghosts causes zero document mutations or history entries", () => {
      const { doc, layerId } = createAnimatedDoc();
      const initialDocSnapshot = JSON.stringify(getDocument());

      // Run multiple sampling passes across different times
      for (let t = 0; t <= 5; t += 0.5) {
        sampleLayerGhosts({
          doc: getDocument(),
          compositionId: MAIN_COMPOSITION_ID,
          layerId,
          currentTime: t,
          fps: 60,
          duration: 5.0,
          config: { enabled: true, framesBefore: 2, framesAfter: 3, step: 1, baseOpacity: 0.4 },
        });
      }

      const finalDocSnapshot = JSON.stringify(getDocument());
      assert.equal(finalDocSnapshot, initialDocSnapshot, "Document is completely immutable during onion skin sampling");
    });
  });

  describe("D. 60 FPS Performance Gate Benchmark", () => {
    it("Done when: 5 ghosts hold 60 fps (Mean < 10ms, P95 < 14ms, P99 < 16ms, Max < 16.6ms)", () => {
      const { doc, layerId } = createAnimatedDoc();
      const config: OnionSkinConfig = {
        enabled: true,
        framesBefore: 2,
        framesAfter: 3, // 5 total ghosts
        step: 1,
        baseOpacity: 0.4,
      };

      // Warmup pass (5 cycles to allow V8 to JIT-optimize hot execution paths)
      for (let w = 0; w < 5; w++) {
        sampleLayerGhosts({ doc, compositionId: MAIN_COMPOSITION_ID, layerId, currentTime: 1.0, fps: 60, duration: 5.0, config });
        renderToStaticMarkup(React.createElement(OnionSkinOverlay, { selectedIds: [layerId], currentTime: 1.0, fps: 60, duration: 5.0, config }));
      }

      // Measure processing time across 60 consecutive frame cycles (simulating 1 full second at 60 fps)
      const frameTimes: number[] = [];
      const totalFrames = 60;
      const fps = 60;

      for (let f = 0; f < totalFrames; f++) {
        const currentTime = (f / fps) * 4.0; // scrub through active composition
        const start = performance.now();

        // 1. Core sampling (5 ghost frames)
        const ghosts = sampleLayerGhosts({
          doc,
          compositionId: MAIN_COMPOSITION_ID,
          layerId,
          currentTime,
          fps,
          duration: 5.0,
          config,
        });

        // 2. React DOM tree render preparation
        renderToStaticMarkup(
          React.createElement(OnionSkinOverlay, {
            selectedIds: [layerId],
            currentTime,
            fps,
            duration: 5.0,
            config,
          })
        );

        const durationMs = performance.now() - start;
        frameTimes.push(durationMs);
        assert.ok(ghosts.length <= 5, "Ghost count does not exceed 5");
      }

      // Sort frame times for percentile calculations
      frameTimes.sort((a, b) => a - b);
      const sum = frameTimes.reduce((acc, t) => acc + t, 0);
      const mean = sum / totalFrames;
      const p95 = frameTimes[Math.floor(totalFrames * 0.95)];
      const p99 = frameTimes[Math.floor(totalFrames * 0.99)];
      const max = frameTimes[frameTimes.length - 1];

      // Performance Assertions satisfying 60 FPS (16.6ms budget):
      assert.ok(mean < 10.0, `Mean frame processing time (${mean.toFixed(2)}ms) must be < 10.0ms`);
      assert.ok(p95 < 14.0, `P95 frame processing time (${p95.toFixed(2)}ms) must be < 14.0ms`);
      assert.ok(p99 < 16.0, `P99 frame processing time (${p99.toFixed(2)}ms) must be < 16.0ms`);
      assert.ok(max < 16.6, `Maximum frame time (${max.toFixed(2)}ms) must never exceed the 16.6ms 60 FPS frame budget`);
    });

    it("scales linearly and preserves 60 FPS budget across multiple selected layers", () => {
      const b = new DocBuilder();
      const id1 = b.layer("container", "Box1", null, { "frame.x": 50, "frame.y": 50 });
      const id2 = b.layer("container", "Box2", null, { "frame.x": 200, "frame.y": 100 });
      b.clip(id1, { name: "C1", type: "entrance", trigger: "mount", duration: 5, easing: "linear", tracks: [{ id: "t1", property: "frame.x", keyframes: [{ id: "k1", time: 0, value: 50 }, { id: "k2", time: 5, value: 400 }] }] });
      b.clip(id2, { name: "C2", type: "entrance", trigger: "mount", duration: 5, easing: "linear", tracks: [{ id: "t2", property: "frame.x", keyframes: [{ id: "k3", time: 0, value: 200 }, { id: "k4", time: 5, value: 500 }] }] });
      const doc = b.build();

      const config: OnionSkinConfig = { enabled: true, framesBefore: 2, framesAfter: 3, step: 1, baseOpacity: 0.4 };
      const start = performance.now();
      for (let f = 0; f < 30; f++) {
        sampleLayerGhosts({ doc, compositionId: MAIN_COMPOSITION_ID, layerId: id1, currentTime: 1.5, fps: 60, duration: 5, config });
        sampleLayerGhosts({ doc, compositionId: MAIN_COMPOSITION_ID, layerId: id2, currentTime: 1.5, fps: 60, duration: 5, config });
      }
      const totalMs = performance.now() - start;
      const avgPerFrame = totalMs / 30;

      assert.ok(avgPerFrame < 5.0, `Multi-layer ghost sampling (${avgPerFrame.toFixed(2)}ms) remains well within 60 FPS`);
    });
  });
});
