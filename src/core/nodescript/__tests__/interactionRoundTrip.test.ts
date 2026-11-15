import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GraphGenerator } from "../GraphGenerator.js";
import {
  INTERACTION_NODE_CATALOG,
} from "../interactionLibrary.js";
import {
  compileSimpleRuleToGraphFragment,
  normalizeGraphStructure,
  resolveInteractionNodeSpec,
  roundTripGraphViaNodeScript,
  toInteractionCanonicalName,
  validateUnifiedGraph,
} from "../interactionBridge.js";

describe("Phase 160 · NodeScript text form & one model with the grammar", () => {
  it("maps all interaction nodes 1:1 with Interaction.* names and shares one model for Simple rules", () => {
    for (const spec of INTERACTION_NODE_CATALOG) {
      const canonical = toInteractionCanonicalName(spec.type);
      assert.ok(canonical.startsWith("Interaction."));
      assert.equal(resolveInteractionNodeSpec(canonical)?.type, spec.type);
    }

    const ruleGraph = compileSimpleRuleToGraphFragment({
      id: "hover-lift",
      trigger: "hover",
      sourceLayerId: "cta",
      targetLayerId: "cta",
      propertyPath: "transform.y",
      value: -6,
      springBounce: 0.25,
      springTimeSec: 0.2,
    });
    const validation = validateUnifiedGraph(ruleGraph);
    assert.equal(validation.isValid, true);

    const { nlsSource, reparsed } = roundTripGraphViaNodeScript(ruleGraph);
    assert.ok(nlsSource.includes("interaction/onHover"));
    assert.ok(nlsSource.includes("interaction/springProperty"));
    assert.deepEqual(normalizeGraphStructure(reparsed), normalizeGraphStructure(ruleGraph));
  });

  it("round-trips 500 random Blueprint graphs via graph -> .nls -> graph unchanged", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const original = GraphGenerator.generateRandomGraph(seed);
      const { reparsed } = roundTripGraphViaNodeScript(original);
      assert.deepEqual(
        normalizeGraphStructure(reparsed),
        normalizeGraphStructure(original),
        `Round-trip mismatch on random graph seed ${seed}`,
      );
    }
  });
});
