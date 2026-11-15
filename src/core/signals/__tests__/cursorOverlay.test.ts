import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCursorOverlayController,
  type CursorPresetKind,
  type CursorTargetBox,
} from "../cursorOverlay";

const BTN: CursorTargetBox = {
  id: "cta-buy",
  role: "cta_button",
  x: 200,
  y: 120,
  width: 140,
  height: 44,
};

const INPUT: CursorTargetBox = {
  id: "email-input",
  role: "text_input",
  x: 100,
  y: 300,
  width: 220,
  height: 40,
};

describe("Phase 191: Cursor & overlay layer", () => {
  it("runs all 8 cursor presets across mouse and pen, snapping brackets and deflecting swarm around hovered buttons", () => {
    const presets: CursorPresetKind[] = [
      "follower",
      "blob",
      "trail",
      "splash",
      "target_brackets",
      "crosshair_measure",
      "image_trail",
      "button_swarm",
    ];

    for (const preset of presets) {
      const ctrl = createCursorOverlayController({
        preset,
        surfaceMode: "preview",
        hideNativeCursorOptIn: true,
        reducedMotion: false,
      });

      const f1 = ctrl.step(1 / 60, {
        x: 240,
        y: 138,
        vx: 600,
        vy: 150,
        pointerType: "mouse",
        tapped: true,
        hoveredTarget: BTN,
      });

      assert.equal(f1.active, true);
      assert.equal(f1.focusRingsVisible, true);
      assert.equal(f1.ariaHidden, true);
      assert.equal(f1.pointerEventsNone, true);
      assert.equal(f1.hideNativeCursorApplied, true);

      if (preset === "target_brackets") {
        assert.deepEqual(f1.snappedBox, { x: 200, y: 120, width: 140, height: 44 });
      }
      if (preset === "crosshair_measure") {
        assert.equal(f1.measuredDimensions?.width, 140);
        assert.equal(f1.measuredDimensions?.height, 44);
      }
      if (preset === "button_swarm") {
        assert.ok(f1.swarmPoints.length >= 4);
      }

      // Pen input also activates overlay cleanly
      const pen = ctrl.step(1 / 60, {
        x: 245,
        y: 142,
        vx: 100,
        vy: 0,
        pointerType: "pen",
        hoveredTarget: BTN,
      });
      assert.equal(pen.active, true);
    }
  });

  it("never hides native cursor on editor_canvas, touch input, reducedMotion, or over text inputs", () => {
    const ctrl = createCursorOverlayController({
      preset: "blob",
      surfaceMode: "playground",
      hideNativeCursorOptIn: true,
      reducedMotion: false,
    });

    const onText = ctrl.step(1 / 60, {
      x: 150,
      y: 315,
      vx: 0,
      vy: 0,
      pointerType: "mouse",
      hoveredTarget: INPUT,
    });
    assert.equal(onText.hideNativeCursorApplied, false);

    const onTouch = ctrl.step(1 / 60, {
      x: 150,
      y: 100,
      vx: 0,
      vy: 0,
      pointerType: "touch",
      hoveredTarget: BTN,
    });
    assert.equal(onTouch.active, false);
    assert.equal(onTouch.hideNativeCursorApplied, false);

    const onReducedMotion = createCursorOverlayController({
      preset: "follower",
      surfaceMode: "preview",
      hideNativeCursorOptIn: true,
      reducedMotion: true,
    }).step(1 / 60, {
      x: 220,
      y: 130,
      vx: 400,
      vy: 0,
      pointerType: "mouse",
      hoveredTarget: BTN,
    });
    assert.equal(onReducedMotion.hideNativeCursorApplied, false);
    assert.equal(onReducedMotion.focusRingsVisible, true);

    const onEditor = createCursorOverlayController({
      preset: "follower",
      surfaceMode: "editor_canvas",
      hideNativeCursorOptIn: true,
      reducedMotion: false,
    }).step(1 / 60, {
      x: 220,
      y: 130,
      vx: 0,
      vy: 0,
      pointerType: "mouse",
      hoveredTarget: BTN,
    });
    assert.equal(onEditor.active, false);
  });
});
