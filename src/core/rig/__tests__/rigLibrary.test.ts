import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RIG_LIBRARY_RECIPES,
  instantiateLibraryRigWithCursorFollow,
  verifyLibraryRigParityAndBudget,
} from "../rigLibrary";

describe("Phase 216 · Rig library & recipes", () => {
  it("exposes 8 original MIT recipes with 1-click cursor follow, parity, and budgets", () => {
    assert.equal(RIG_LIBRARY_RECIPES.length, 8);
    for (const recipe of RIG_LIBRARY_RECIPES) {
      assert.equal(recipe.provenance.original, true);
      assert.equal(recipe.provenance.license, "MIT");

      const instance = instantiateLibraryRigWithCursorFollow(recipe.id, { x: 340, y: 120 });
      assert.ok(instance !== null);
      assert.ok(
        instance!.initialState.pose.eye_l?.rotationDeg !== undefined,
        `${recipe.id} should respond to cursor look-at`,
      );

      const check = verifyLibraryRigParityAndBudget(recipe.id);
      assert.equal(check.passed, true, `${recipe.id} parity/budget failed`);
    }
  });
});
