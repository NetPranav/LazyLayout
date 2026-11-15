/**
 * @file surfaceStrategy.test.ts
 * @description Phase 173 tests: Law 13 surface budgets across 20-surface page
 * on desktop (<= 8) and mobile (<= 4), offscreen/tab pause, poster fallback,
 * and < 1 s forced context-loss recovery.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSurfaceBudgetController } from "../surfaceStrategy";

describe("Phase 173: GPU surface strategy & budget law", () => {
  it("caps a 20-surface page at desktop <= 8 and mobile <= 4 with poster fallbacks", () => {
    for (const [profile, cap] of [["desktop", 8], ["mobile", 4]] as const) {
      const ctrl = createSurfaceBudgetController(profile);
      for (let i = 0; i < 20; i++) {
        ctrl.registerSurface(
          {
            id: `surf_${i}`,
            role: i % 2 === 0 ? "surface" : "scene",
            tier: "T2",
            visible: true,
            priority: 20 - i,
          },
          i * 10
        );
      }

      const tel = ctrl.getTelemetry();
      assert.ok(tel.activeLiveCount <= cap, `${profile} active count exceeded ${cap}`);
      assert.equal(tel.posterFallbackCount, 20 - cap);
      assert.ok(tel.totalWebglContexts <= cap);
    }
  });

  it("pauses offscreen and hidden-tab surfaces and recovers from context loss within 1s", () => {
    const ctrl = createSurfaceBudgetController("desktop");
    ctrl.registerSurface({ id: "bg", role: "surface", tier: "T2", visible: true, priority: 10 }, 10);
    ctrl.setSurfaceVisibility("bg", false, 20);
    assert.equal(ctrl.getTelemetry().pausedCount, 1);

    ctrl.setSurfaceVisibility("bg", true, 30);
    ctrl.setTabHidden(true);
    assert.equal(ctrl.getTelemetry().activeLiveCount, 0);
    ctrl.setTabHidden(false);
    assert.equal(ctrl.getTelemetry().activeLiveCount, 1);

    ctrl.simulateContextLoss(100);
    assert.equal(ctrl.getTelemetry().contextLost, true);
    ctrl.recoverContext(280);
    assert.equal(ctrl.getTelemetry().contextLost, false);
    assert.ok(ctrl.getTelemetry().lastRecoveryDurationMs < 1000);
    assert.equal(ctrl.getSlots()[0]!.contextGeneration, 2);
  });
});
