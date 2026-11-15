import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runEffectDefinitionTape, validateEffectDefinition } from "../effectSdk";
import {
  LIBRARY_WAVES_2_TO_9,
  quickBindInteractiveBackground,
} from "../libraryWaves2To9";

describe("Phase 193: Library — interaction, backgrounds, cursors & distortion (closes AUD-54)", () => {
  it("contains >= 53 validated original EffectDefinitionV1 entries across Waves 2, 5, 7, 8, and 9", () => {
    const wave2 = LIBRARY_WAVES_2_TO_9.filter((e) => e.wave === 2);
    const wave5 = LIBRARY_WAVES_2_TO_9.filter((e) => e.wave === 5);
    const wave7 = LIBRARY_WAVES_2_TO_9.filter((e) => e.wave === 7);
    const wave7Pointer = wave7.filter((e) => e.bindings.some((b) => b.signal === "pointer.uv"));
    const wave7Scroll = wave7.filter((e) => e.bindings.some((b) => b.signal === "scroll.progress"));
    const wave8 = LIBRARY_WAVES_2_TO_9.filter((e) => e.wave === 8);
    const wave9 = LIBRARY_WAVES_2_TO_9.filter((e) => e.wave === 9);

    assert.ok(wave2.length >= 8);
    assert.ok(wave5.length >= 7);
    assert.ok(wave7.length >= 20);
    assert.ok(wave7Pointer.length >= 15);
    assert.ok(wave7Scroll.length >= 5);
    assert.ok(wave8.length >= 10);
    assert.ok(wave9.length >= 8);
    assert.ok(LIBRARY_WAVES_2_TO_9.length >= 53);

    const uniqueIds = new Set(LIBRARY_WAVES_2_TO_9.map((e) => e.id));
    assert.equal(uniqueIds.size, LIBRARY_WAVES_2_TO_9.length);

    for (const def of LIBRARY_WAVES_2_TO_9) {
      const check = validateEffectDefinition(def);
      assert.equal(check.valid, true, `${def.id} failed validation: ${check.errors.join(", ")}`);
      assert.equal(runEffectDefinitionTape(def).passed, true);
      assert.equal(def.openRecipe, true);
    }
  });

  it("supports instant 1-step cursor-reactive background binding", () => {
    const bound = quickBindInteractiveBackground("hero-section", "w7_cursor_nebula");
    assert.equal(bound.boundSignal, "pointer.uv");
    assert.equal(bound.definition.id, "w7_cursor_nebula");
  });
});
