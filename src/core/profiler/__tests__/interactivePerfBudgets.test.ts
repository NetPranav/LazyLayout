import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FULL_EFFECT_LIBRARY } from "../../effects/libraryWaves10To13";
import {
  auditFullLibraryTierBudgets,
  deriveEffectTierBadges,
  evaluateEffectTierBudget,
  runSimulatedTierSoak,
} from "../interactivePerfBudgets";

describe("Phase 200: Interactive performance budgets & simulated tier soaks", () => {
  it("audits all 98 FULL_EFFECT_LIBRARY effects across T0-T3 budgets and 10-minute soaks", () => {
    const audit = auditFullLibraryTierBudgets(FULL_EFFECT_LIBRARY);

    assert.equal(audit.totalEffects, 98);
    assert.equal(audit.passingAllTiers, 98);
    assert.deepEqual(audit.failedEffectIds, []);
    assert.equal(audit.lowTierSoakPassed, 98);
    assert.equal(audit.midTierSoakPassed, 98);

    for (const def of FULL_EFFECT_LIBRARY) {
      const badges = audit.badgesByEffect[def.id];
      assert.ok(badges, `Expected tier badges for ${def.id}`);
      assert.equal(badges.low, true);
      assert.equal(badges.mid, true);
      assert.equal(badges.high, true);
    }
  });

  it("verifies zero memory growth and zero leaked surfaces over 10-minute simulated low & mid soaks", () => {
    const sample = FULL_EFFECT_LIBRARY[0];
    assert.ok(sample);

    const lowSoak = runSimulatedTierSoak(sample, "T0", 10);
    const midSoak = runSimulatedTierSoak(sample, "T2", 10);

    assert.equal(lowSoak.simulatedTicks, 600);
    assert.equal(lowSoak.memoryDeltaMb, 0);
    assert.equal(lowSoak.leakedSurfaces, 0);
    assert.equal(lowSoak.tapePassed, true);
    assert.equal(lowSoak.passed, true);

    assert.equal(midSoak.simulatedTicks, 600);
    assert.equal(midSoak.memoryDeltaMb, 0);
    assert.equal(midSoak.leakedSurfaces, 0);
    assert.equal(midSoak.passed, true);
  });

  it("flags budget violations and strips low badge when an effect exceeds T0 thresholds", () => {
    const base = FULL_EFFECT_LIBRARY[0];
    assert.ok(base);

    const heavyEffect = {
      ...base,
      id: "heavy_synthetic_shader",
      tierCosts: {
        ...base.tierCosts,
        T0: { frameTimeMs: 7.5, memoryMb: 42, liveSurfaces: 4, runtimeKb: 36 },
      },
    };

    const t0Eval = evaluateEffectTierBudget(heavyEffect, "T0");
    assert.equal(t0Eval.passed, false);
    assert.equal(t0Eval.violations.length, 4);

    const badges = deriveEffectTierBadges(heavyEffect);
    assert.equal(badges.low, false);
    assert.equal(badges.mid, true);
    assert.equal(badges.high, true);

    const soak = runSimulatedTierSoak(heavyEffect, "T0", 10);
    assert.equal(soak.passed, false);
  });
});
