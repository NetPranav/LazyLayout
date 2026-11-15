import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITION_SUITE_SPECS,
  countTechnicalSimpleFaceLabels,
  runFullCompositionSuite,
} from "../compositionSuite";

describe("Phase 201: Primitive-only Composition Test Suite (closes AUD-57)", () => {
  it("contains all 15 builds (10 v3 91.7 + 5 v4.1) built strictly from primitives with Law 17 clean Simple faces", () => {
    assert.equal(COMPOSITION_SUITE_SPECS.length, 15);
    const v3Count = COMPOSITION_SUITE_SPECS.filter((s) => s.waveGroup === "v3_91_7").length;
    const v41Count = COMPOSITION_SUITE_SPECS.filter((s) => s.waveGroup === "v4_1").length;
    assert.equal(v3Count, 10);
    assert.equal(v41Count, 5);

    for (const spec of COMPOSITION_SUITE_SPECS) {
      assert.equal(spec.builtFromPrimitivesOnly, true, spec.id);
      assert.equal(spec.usesCustomCode, false, spec.id);
      assert.equal(spec.usesMonolithicPreset, false, spec.id);
      assert.equal(spec.simpleFaceTechnicalParamCount, 0, spec.id);
      assert.equal(countTechnicalSimpleFaceLabels(spec.simpleFaceLabels), 0, spec.id);
    }
  });

  it("passes deterministic execution and export parity across Chromium, WebKit, Firefox, and mid-tier phone", () => {
    const summary = runFullCompositionSuite();
    assert.equal(summary.totalCompositions, 15);
    assert.equal(summary.profileRuns, 60); // 15 builds x 4 profiles
    assert.equal(summary.law17Clean, true);
    assert.equal(summary.allPassedParity, true);
    for (const run of summary.results) {
      assert.equal(run.passedParity, true);
      assert.equal(run.maxDrift, 0);
      assert.ok(run.exportBundleBytes > 0);
    }
  });
});
