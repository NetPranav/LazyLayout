import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runStage5CharacterGate } from "../stage5CharacterGate";

describe("Phase 217 · Stage 5 Gate: the character journey", () => {
  it("completes the full import -> auto-rig -> weights -> IK -> jiggle -> cursor -> walk/run -> lip-sync -> webcam/fallback -> Next/Vite/Lottie export journey", () => {
    const report = runStage5CharacterGate();
    assert.equal(report.passed, true);
    assert.ok(report.boneCount >= 6);
    assert.ok(report.weightsSumErrorMax < 1e-5);
    assert.ok(report.jigglePeakAngleDeg > 0.05);
    assert.ok(Math.abs(report.headFollowYawDeg) > 1);
    assert.deepEqual(report.locomotionStatesVisited, ["idle", "walk", "run"]);
    assert.equal(report.webcamFallbackSource, "cursor-fallback");
    assert.ok(report.maxExportParityDiffPx < 0.01);
    assert.equal(report.libraryRecipesPassed, 8);
  });
});
