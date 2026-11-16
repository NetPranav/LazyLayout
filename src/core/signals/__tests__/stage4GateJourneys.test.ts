import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runStage4JourneyA,
  runStage4JourneyB,
  runStage4JourneyC,
  runStage4JourneyD,
  runStage4JourneyE,
} from "../stage4GateJourneys";

describe("Phase 202: Stage 4 Gate — The Interactive Journey (Journeys A–E)", () => {
  it("Journey A (React): hero cursor bg, magnetic CTA, cursor overlay, hover/click rule, tape & Next export", () => {
    const res = runStage4JourneyA();
    assert.equal(res.backgroundEffectId, "w7_cursor_nebula");
    assert.equal(res.ctaEffectId, "w2_magnetic_pull");
    assert.equal(res.cursorActive, true);
    assert.equal(res.graphNodeCount, 4);
    assert.equal(res.graphWireCount, 3);
    assert.equal(res.zeroLazyLayoutImports, true);
    assert.equal(res.passedParity, true);
    assert.ok(res.vendoredModuleCount >= 2);
  });

  it("Journey B (Compose): primitive build < 5 min flow, bottom-pin helper, Split, keepOut, graph & a11y", () => {
    const res = runStage4JourneyB();
    assert.ok(res.primitiveStepCount <= 6);
    assert.equal(res.helperFilteredOnExport, true);
    assert.equal(res.splitLetterCount, 7);
    assert.equal(res.singlePassA11yLabel, "KINETIC");
    assert.ok(res.keepOutMinDistancePx >= 23.99);
    assert.equal(res.a11yIssueCount, 0);
    assert.equal(res.passed, true);
  });

  it("Journey C (Keyboard): ArrowRight/ArrowLeft/Home/End carousel identical in editor and export", () => {
    const res = runStage4JourneyC();
    assert.equal(res.initialActiveCard, "card_0");
    assert.deepEqual(res.editorCardSequence, ["card_1", "card_2", "card_1", "card_3", "card_0"]);
    assert.equal(res.activeTabIndexMatches, true);
    assert.equal(res.identicalInExport, true);
  });

  it("Journey D (Bring your own): TSX component cursor binding, export & opaque-origin sandbox isolation", () => {
    const res = runStage4JourneyD();
    assert.equal(res.componentName, "MagneticBadge");
    assert.equal(res.boundPropCount, 1);
    assert.equal(res.hasCursorSignalBinding, true);
    assert.equal(res.sandboxCookie, "unreadable");
    assert.equal(res.sandboxLocalStorageBlocked, true);
    assert.equal(res.sandboxParentDomBlocked, true);
    assert.ok(res.flaggedDangerousApis.length >= 2);
    assert.equal(res.zeroLazyLayoutImportsInExport, true);
    assert.equal(res.passedIsolation, true);
  });

  it("Journey E (v4.1 Feel): 5-plane parallax, liquid-glass nav, sound+haptics, exact-tiling fracture & reassembly", () => {
    const res = runStage4JourneyE();
    assert.equal(res.parallaxPlaneCount, 5);
    assert.ok(res.glassCoveredPixels > 0);
    assert.equal(res.soundEventFired, true);
    assert.equal(res.hapticsDispatched, true);
    assert.equal(res.fracturePieceCount, 9);
    assert.equal(res.fractureExactTiling, true);
    assert.ok(res.reassemblyMaxErrorPx < 1.0);
    assert.ok(res.exportBundleBytes > 0);
    assert.equal(res.passedParity, true);
  });
});
