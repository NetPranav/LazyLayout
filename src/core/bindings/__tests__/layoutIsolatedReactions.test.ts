import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertIsolatedReactionAllowed,
  computeExternalCls,
  evaluateDockMagnification,
  evaluateLetterSpacingWave,
  evaluateVariableFontProximity,
} from "../layoutIsolatedReactions";

describe("Stage 4 Phase 145: layout-isolated reactions inside fixed boxes", () => {
  it("requires fixed-size contain:layout size isolation before allowing continuous layout reactions", () => {
    const layers = {
      box: { id: "box", parentId: null, properties: { "layout.contain": "layout size" } },
      title: { id: "title", parentId: "box", properties: {} },
      loose: { id: "loose", parentId: null, properties: {} },
    };
    assert.deepEqual(assertIsolatedReactionAllowed("title", layers), {
      allowed: true,
      containCss: "layout size",
    });
    assert.deepEqual(assertIsolatedReactionAllowed("loose", layers), {
      allowed: false,
      containCss: null,
    });
  });

  it("evaluates variable font proximity, dock magnification, and waves with 0 outer CLS", () => {
    const letters = Array.from({ length: 10 }, (_, i) => ({
      id: `ch_${i}`,
      centerX: 100 + i * 24,
      centerY: 200,
    }));
    const varFont = evaluateVariableFontProximity(letters, 148, 200, {
      radiusPx: 80,
      minWeight: 300,
      maxWeight: 900,
    });
    assert.equal(varFont[2]!.fontWeight, 900);
    assert.equal(varFont[9]!.fontWeight, 300);

    const dock = evaluateDockMagnification(letters.slice(0, 5), 148, { baseSizePx: 44, maxSizePx: 84 });
    assert.ok(dock[2]!.sizePx > dock[0]!.sizePx);

    const wave = evaluateLetterSpacingWave(8, 0.5, 0.25, 0.1);
    assert.equal(wave.length, 8);
    assert.ok(wave.every((w) => w >= 0 && w <= 0.1));

    const outer = { x: 40, y: 80, width: 640, height: 120 };
    assert.equal(computeExternalCls(outer, { ...outer }), 0);
  });

  it("evaluates 60 reactive letters within 60fps budget", () => {
    const letters = Array.from({ length: 60 }, (_, i) => ({
      id: `c_${i}`,
      centerX: i * 16,
      centerY: 100,
    }));
    const start = performance.now();
    for (let f = 0; f < 60; f++) {
      evaluateVariableFontProximity(letters, 200 + f * 4, 100);
    }
    const perFrameMs = (performance.now() - start) / 60;
    assert.ok(perFrameMs < 5, `60-letter eval took ${perFrameMs.toFixed(3)}ms/frame`);
  });
});
