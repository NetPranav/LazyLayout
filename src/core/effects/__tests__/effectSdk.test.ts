import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forkEffectDefinition,
  instantiateEffect,
  migrateEffectDefinition,
  resolveEffectProps,
  runEffectDefinitionTape,
  validateEffectDefinition,
  type LegacyEffectDefinitionV0,
} from "../effectSdk";

describe("Phase 192: Effect SDK (effects as data)", () => {
  it("validates, stores sparse overrides, forks cleanly, and passes tape test", () => {
    const base = migrateEffectDefinition({
      version: 0,
      id: "magnetic_button",
      name: "Magnetic Button",
      family: "interaction",
      wave: 2,
      paramDefaults: { pullStrength: 0.45, radiusPx: 120, damp: true },
      reduceMotion: "calm",
      tierCostMs: 0.8,
    });

    assert.equal(validateEffectDefinition(base).valid, true);
    assert.equal(runEffectDefinitionTape(base).passed, true);

    const inst = instantiateEffect(base, "inst_1", { pullStrength: 0.7, radiusPx: 120 });
    assert.deepEqual(inst.overrides, { pullStrength: 0.7 });
    const resolved = resolveEffectProps(base, inst);
    assert.equal(resolved.pullStrength, 0.7);
    assert.equal(resolved.radiusPx, 120);

    const forked = forkEffectDefinition(base, "my-site", {
      name: "Soft Magnetic CTA",
      reducedMotionPolicy: "freeze",
    });
    assert.equal(forked.id, "my-site/magnetic_button");
    assert.equal(forked.reducedMotionPolicy, "freeze");
    assert.equal(validateEffectDefinition(forked).valid, true);
  });

  it("round-trips 100 legacy effect fixtures cleanly through v0 -> v1 migration", () => {
    for (let i = 0; i < 100; i += 1) {
      const legacy: LegacyEffectDefinitionV0 = {
        version: 0,
        id: `legacy_fx_${i}`,
        name: `Effect Fixture ${i}`,
        family: i % 2 === 0 ? "interactive_background" : "micro_interaction",
        wave: 7,
        paramDefaults: { intensity: 0.5 + (i % 5) * 0.1, scale: 1 + i * 0.01 },
        reduceMotion: i % 3 === 0 ? "freeze" : "calm",
        tierCostMs: 1.2 + (i % 4) * 0.5,
      };
      const migrated = migrateEffectDefinition(legacy);
      const idempotent = migrateEffectDefinition(migrated);
      assert.deepEqual(migrated, idempotent);
      assert.equal(validateEffectDefinition(migrated).valid, true);
    }
  });
});
