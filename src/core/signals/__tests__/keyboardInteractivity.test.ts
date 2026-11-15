import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema } from "../../document/signals";
import {
  applyKeyTrigger,
  buildScopedKeyboardExportSource,
  checkKeyboardFocusParity,
  createRovingFocusGroup,
  shouldHandleScopedExportKeyEvent,
} from "../keyboardInteractivity";

describe("Stage 4 Phase 146: keyboard & focus interactivity + grammar 6.11 parity", () => {
  it("steps cards via ArrowRight trigger and navigates roving focus groups", () => {
    const rule = {
      id: "r_slide",
      keyCode: "ArrowRight",
      ownerLayerId: "deck",
      action: "stepState" as const,
      states: ["card-1", "card-2", "card-3"],
    };
    let state = applyKeyTrigger(rule, "ArrowRight", {
      activeStateIndex: 0,
      activeState: "card-1",
      triggeredCompositions: [],
    });
    assert.equal(state.activeState, "card-2");
    state = applyKeyTrigger(rule, "ArrowRight", state);
    assert.equal(state.activeState, "card-3");

    const roving = createRovingFocusGroup(["card-1", "card-2", "card-3"], { orientation: "horizontal" });
    assert.equal(roving.tabIndexOf("card-1"), 0);
    assert.equal(roving.tabIndexOf("card-2"), -1);
    assert.equal(roving.onKeyDown("ArrowRight"), "card-2");
    assert.equal(roving.tabIndexOf("card-2"), 0);
    assert.equal(roving.onKeyDown("End"), "card-3");
    assert.equal(roving.onKeyDown("ArrowRight"), "card-1");
  });

  it("flags pointer-only reactions under grammar 6.11 and passes once keyboard/focus parity exists", () => {
    const pointerOnly = BindingSchema.parse({
      id: "hover-lift",
      ownerLayerId: "card",
      enabled: true,
      expr: { signal: { kind: "layerState", channel: "hover", layer: "card" }, operators: [{ op: "mul", x: -8 }] },
      target: { kind: "property", on: { kind: "layer", ref: "card" }, path: "transform.y" },
    });

    const violations = checkKeyboardFocusParity({ bindings: [pointerOnly] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.code, "A11Y_KEY_PARITY");

    const focusPair = BindingSchema.parse({
      id: "focus-lift",
      ownerLayerId: "card",
      enabled: true,
      expr: { signal: { kind: "focusVisible", layer: "card" }, operators: [{ op: "mul", x: -8 }] },
      target: { kind: "property", on: { kind: "layer", ref: "card" }, path: "transform.y" },
    });
    assert.deepEqual(checkKeyboardFocusParity({ bindings: [pointerOnly, focusPair] }), []);
  });

  it("scopes export keyboard listeners so inputs and host shortcuts are never stolen", () => {
    assert.equal(shouldHandleScopedExportKeyEvent({ insideRoot: false, tagName: "DIV" }), false);
    assert.equal(shouldHandleScopedExportKeyEvent({ insideRoot: true, tagName: "INPUT" }), false);
    assert.equal(shouldHandleScopedExportKeyEvent({ insideRoot: true, isContentEditable: true }), false);
    assert.equal(shouldHandleScopedExportKeyEvent({ insideRoot: true, tagName: "BUTTON" }), true);
    assert.ok(buildScopedKeyboardExportSource().includes("attachScopedKeyboardHandlers"));
  });
});
