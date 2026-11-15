/**
 * @file simpleRulesEditor.test.ts
 * @description Phase 167 tests: <= 7 controls plain-language rules, companion
 * auto-provisioning & removal, editable companion params, and Blueprint compilation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SIMPLE_RULE_CONTROLS,
  SIMPLE_RULE_CONTROL_LABELS,
  addOrUpdateSimpleRule,
  compileSimpleRuleToBlueprint,
  describeSimpleRuleInPlainLanguage,
  removeSimpleRule,
  updateRuleCompanionParam,
  type SimpleRulesState,
} from "../simpleRulesEditor";

describe("Phase 167: Simple rules editor", () => {
  it("keeps rule controls at or below 7 and phrases rules in plain language", () => {
    assert.ok(SIMPLE_RULE_CONTROL_LABELS.length <= MAX_SIMPLE_RULE_CONTROLS);

    let state: SimpleRulesState = { rules: [], companions: [] };
    state = addOrUpdateSimpleRule(state, {
      id: "hover_glow",
      event: "hovered",
      subjectLayerId: "cta_btn",
      actions: [{ kind: "glow", targetLayerId: "cta_bg" }],
      feel: "snappy",
      intensity: "medium",
      enabled: true,
    });
    assert.equal(
      describeSimpleRuleInPlainLanguage(state.rules[0]!),
      "When cta_btn is hovered → cta_bg glows"
    );
  });

  it("auto-provisions colliders, fields, and home springs and removes them with the rule", () => {
    let state: SimpleRulesState = { rules: [], companions: [] };
    state = addOrUpdateSimpleRule(state, {
      id: "overlap_rule",
      event: "overlaps",
      subjectLayerId: "coin",
      partnerLayerId: "player",
      actions: [{ kind: "spring_home", targetLayerId: "coin" }],
      feel: "bouncy",
      intensity: "strong",
      enabled: true,
    });
    assert.equal(state.companions.length, 3);

    const colliderCmp = state.companions.find((c) => c.kind === "collider")!;
    state = updateRuleCompanionParam(state, colliderCmp.id, "bounce", 90);
    assert.equal(
      state.companions.find((c) => c.id === colliderCmp.id)!.editableParams.bounce,
      90
    );

    state = removeSimpleRule(state, "overlap_rule");
    assert.equal(state.rules.length, 0);
    assert.equal(state.companions.length, 0);
  });

  it("compiles click -> confetti + flip into canonical BlueprintGraph", () => {
    const graph = compileSimpleRuleToBlueprint({
      id: "click_celebrate",
      event: "clicked",
      subjectLayerId: "cta_btn",
      actions: [
        { kind: "confetti", targetLayerId: "cta_btn" },
        { kind: "flip", targetLayerId: "card_1" },
      ],
      feel: "snappy",
      intensity: "medium",
      enabled: true,
    });
    assert.equal(Object.keys(graph.nodes).length, 3);
    assert.equal(graph.wires.length, 2);
  });
});
