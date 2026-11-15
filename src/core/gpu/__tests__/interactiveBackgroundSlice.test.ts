/**
 * @file interactiveBackgroundSlice.test.ts
 * @description Phase 176 tests: focused-frame surface liveness vs breakpoint copy
 * freeze, selectable background role, reduced-motion static freeze, and deterministic
 * tape checkpoints for the cursor-reactive background shader vertical slice.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PHASE_176_BACKGROUND_FRAGMENT_GLSL,
  evaluateCursorReactiveBackgroundSlice,
  resolveEditorSurfaceScheduling,
} from "../interactiveBackgroundSlice";

describe("Phase 176: Editor surfaces & first interactive background", () => {
  it("runs only focused primary frame live and keeps background selectable behind siblings", () => {
    const scheduled = resolveEditorSurfaceScheduling(
      [
        { frameId: "hero_desktop", surfaceId: "bg_main", role: "background", isBreakpointCopy: false },
        { frameId: "hero_desktop", surfaceId: "bg_mobile_copy", role: "background", isBreakpointCopy: true },
        { frameId: "about_desktop", surfaceId: "bg_about", role: "background", isBreakpointCopy: false },
      ],
      "hero_desktop"
    );

    assert.equal(scheduled[0]!.mode, "live");
    assert.equal(scheduled[0]!.behindSiblings, true);
    assert.equal(scheduled[0]!.selectableInDesignMode, true);
    assert.equal(scheduled[1]!.mode, "frozen_last_frame");
    assert.equal(scheduled[2]!.mode, "frozen_last_frame");
  });

  it("matches deterministic tape checkpoints and freezes under reduced motion", () => {
    assert.ok(PHASE_176_BACKGROUND_FRAGMENT_GLSL.includes("#version 300 es"));
    const checkpoints = [
      { t: 0.2, pu: 0.25, pv: 0.3 },
      { t: 0.8, pu: 0.75, pv: 0.65 },
    ];
    const snapA = checkpoints.map((c) =>
      evaluateCursorReactiveBackgroundSlice(24, 16, {
        uTime: c.t,
        uPointerU: c.pu,
        uPointerV: c.pv,
        bendStrength: 1,
        reducedMotion: false,
        inputDevice: "mouse",
      })
    );
    const snapB = checkpoints.map((c) =>
      evaluateCursorReactiveBackgroundSlice(24, 16, {
        uTime: c.t,
        uPointerU: c.pu,
        uPointerV: c.pv,
        bendStrength: 1,
        reducedMotion: false,
        inputDevice: "mouse",
      })
    );
    assert.deepEqual(snapA, snapB);
    assert.notDeepEqual(snapA[0], snapA[1]);

    const rm0 = evaluateCursorReactiveBackgroundSlice(16, 16, {
      uTime: 0.2,
      uPointerU: 0.5,
      uPointerV: 0.5,
      bendStrength: 1,
      reducedMotion: true,
      inputDevice: "mouse",
    });
    const rmLater = evaluateCursorReactiveBackgroundSlice(16, 16, {
      uTime: 3.4,
      uPointerU: 0.5,
      uPointerV: 0.5,
      bendStrength: 1,
      reducedMotion: true,
      inputDevice: "mouse",
    });
    assert.deepEqual(rm0, rmLater);
  });
});
