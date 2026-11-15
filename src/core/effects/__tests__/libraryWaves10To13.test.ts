import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runEffectDefinitionTape, validateEffectDefinition } from "../effectSdk";
import { FULL_EFFECT_LIBRARY, LIBRARY_WAVES_10_TO_13 } from "../libraryWaves10To13";

describe("Phase 194: Library — micro-interactions, glass, light, deformation & sound packs", () => {
  it("contains >= 45 validated open entries across Waves 10–13 and >= 98 total combined library entries", () => {
    const w10 = LIBRARY_WAVES_10_TO_13.filter((e) => e.wave === 10);
    const w11 = LIBRARY_WAVES_10_TO_13.filter((e) => e.wave === 11);
    const w12 = LIBRARY_WAVES_10_TO_13.filter((e) => e.wave === 12);
    const w13 = LIBRARY_WAVES_10_TO_13.filter((e) => e.wave === 13);

    assert.ok(w10.length >= 20);
    assert.ok(w11.length >= 12);
    assert.ok(w12.length >= 8);
    assert.ok(w13.length >= 5);
    assert.ok(LIBRARY_WAVES_10_TO_13.length >= 45);
    assert.ok(FULL_EFFECT_LIBRARY.length >= 98);

    const unique = new Set(FULL_EFFECT_LIBRARY.map((e) => e.id));
    assert.equal(unique.size, FULL_EFFECT_LIBRARY.length);

    for (const def of LIBRARY_WAVES_10_TO_13) {
      assert.equal(validateEffectDefinition(def).valid, true);
      assert.equal(runEffectDefinitionTape(def).passed, true);
      assert.equal(def.openRecipe, true);
      assert.equal(def.provenance.gate02Verified, true);
    }
  });
});
