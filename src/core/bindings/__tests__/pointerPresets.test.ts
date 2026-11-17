import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingDraftSchema } from "../../document/signals";
import { KERNEL_GAPS } from "../../kernel/evaluate";
import {
  buildPointerPresetDrafts,
  createPointerPresetState,
  stepPointerPreset,
  stepPointerPresetsBatch,
  type PointerPresetId,
} from "../pointerPresets";

const ALL_PRESETS: readonly PointerPresetId[] = [
  "magnet",
  "tilt",
  "followLag",
  "proximity",
  "spotlight",
  "inertia",
  "noise",
  "wander",
];

describe("Stage 4 Phase 143: 8 pointer behaviours as presets", () => {
  it("generates schema-valid BindingDrafts for all 8 pointer presets (the kernel behaviours gap stays open)", () => {
    // Presets are bindings; evaluate() still runs only `loop` behaviours, so the gap stays listed.
    assert.equal(KERNEL_GAPS.some((g) => g.area === "behaviours"), true);
    for (const preset of ALL_PRESETS) {
      const drafts = buildPointerPresetDrafts("btn", preset, 1);
      assert.ok(drafts.length >= 1, `Missing drafts for preset ${preset}`);
      for (const d of drafts) {
        assert.equal(BindingDraftSchema.safeParse(d).success, true);
      }
    }
  });

  it("evaluates all 8 behaviours deterministically over scripted pointer checkpoints", () => {
    const layer = { id: "card", centerX: 200, centerY: 200, width: 100, height: 100 };

    // Magnet pulls toward pointer when close, releases outside radius
    const mag = createPointerPresetState();
    for (let i = 0; i < 60; i++) {
      stepPointerPreset(
        { layer, preset: "magnet", radiusPx: 150, strength: 0.5, lagSec: 0.05 },
        { time: i / 60, dt: 1 / 60, pointerX: 260, pointerY: 200, pointerDown: false },
        mag
      );
    }
    assert.ok(mag.x > 10 && mag.x < 30);

    // 3D Tilt maps local right-bottom edge to positive rotateY and negative rotateX
    const tilt = createPointerPresetState();
    for (let i = 0; i < 60; i++) {
      stepPointerPreset(
        { layer, preset: "tilt", maxTiltDeg: 20, lagSec: 0.02 },
        { time: i / 60, dt: 1 / 60, pointerX: 250, pointerY: 150, pointerDown: false },
        tilt
      );
    }
    assert.ok(tilt.rotateY > 15 && tilt.rotateX > 15);

    // Spotlight records exact local pixel position
    const spot = createPointerPresetState();
    stepPointerPreset(
      { layer, preset: "spotlight" },
      { time: 0, dt: 1 / 60, pointerX: 210, pointerY: 180, pointerDown: false },
      spot
    );
    assert.equal(spot.spotlightX, 60);
    assert.equal(spot.spotlightY, 30);

    // Inertia glides with momentum after pointer release
    const inertia = createPointerPresetState();
    stepPointerPreset({ layer, preset: "inertia" }, { time: 0, dt: 1 / 60, pointerX: 200, pointerY: 200, pointerDown: true }, inertia);
    stepPointerPreset({ layer, preset: "inertia" }, { time: 1 / 60, dt: 1 / 60, pointerX: 220, pointerY: 200, pointerDown: true }, inertia);
    const xAtRelease = inertia.x;
    stepPointerPreset({ layer, preset: "inertia" }, { time: 2 / 60, dt: 1 / 60, pointerX: 220, pointerY: 200, pointerDown: false }, inertia);
    assert.ok(inertia.x > xAtRelease);

    // Remaining presets stay finite and bounded
    for (const preset of ["followLag", "proximity", "noise", "wander"] as const) {
      const st = createPointerPresetState();
      stepPointerPreset({ layer, preset }, { time: 1.5, dt: 1 / 60, pointerX: 240, pointerY: 220, pointerDown: false }, st);
      assert.ok(Number.isFinite(st.x) && Number.isFinite(st.y) && Number.isFinite(st.scale));
    }
  });

  it("evaluates 50 reactive layers well within 16ms 60fps frame budget", () => {
    const entries = Array.from({ length: 50 }, (_, idx) => ({
      config: {
        layer: { id: `l_${idx}`, centerX: 100 + idx * 10, centerY: 200, width: 80, height: 80 },
        preset: ALL_PRESETS[idx % ALL_PRESETS.length]!,
      },
      state: createPointerPresetState(),
    }));
    const start = performance.now();
    for (let f = 0; f < 60; f++) {
      stepPointerPresetsBatch(entries, {
        time: f / 60,
        dt: 1 / 60,
        pointerX: 300 + Math.sin(f * 0.1) * 100,
        pointerY: 200,
        pointerDown: f < 20,
      });
    }
    const perFrameMs = (performance.now() - start) / 60;
    assert.ok(perFrameMs < 5, `50-layer frame took ${perFrameMs.toFixed(3)}ms`);
  });
});

describe("Phase 143 preset drafts behave as named (review 2026-11-17)", () => {
  // Runs a draft's expression for `frames` frames with the given signal readings.
  const run = async (draft: { expr: unknown }, read: (s: { kind: string; channel?: string }) => unknown, frames = 120) => {
    const { compileExpr, toNumber } = await import("../evaluate");
    const rt = compileExpr(draft.expr as Parameters<typeof compileExpr>[0]);
    let v = 0;
    for (let i = 0; i < frames; i++) {
      v = toNumber(rt.step({ time: i / 60, dt: 1 / 60, seed: 1, read: read as never }));
    }
    return v;
  };

  it("magnet pulls toward the cursor on both axes", async () => {
    const [x, y] = buildPointerPresetDrafts("btn", "magnet", 1);
    const upLeft = (s: { kind: string }) => (s.kind === "pointerIn" ? [-0.5, -0.5] : 0);
    assert.ok((await run(x!, upLeft)) < -1, "cursor to the left pulls left");
    assert.ok((await run(y!, upLeft)) < -1, "cursor above pulls up");
    const downRight = (s: { kind: string }) => (s.kind === "pointerIn" ? [0.5, 0.5] : 0);
    assert.ok((await run(x!, downRight)) > 1, "cursor to the right pulls right");
  });

  it("inertia ignores pointer movement while the button is up", async () => {
    const [x] = buildPointerPresetDrafts("btn", "inertia", 1);
    const hoverMoving = (s: { kind: string; channel?: string }) =>
      s.kind === "pointer" && s.channel === "down" ? 0 : s.kind === "pointer" && s.channel === "velocity" ? [800, 0] : 0;
    assert.equal(await run(x!, hoverMoving), 0);
    const dragging = (s: { kind: string; channel?: string }) =>
      s.kind === "pointer" && s.channel === "down" ? 1 : s.kind === "pointer" && s.channel === "velocity" ? [800, 0] : 0;
    assert.ok((await run(x!, dragging)) > 1);
  });

  it("noise and wander drive both axes", () => {
    for (const p of ["noise", "wander"] as const) {
      const paths = buildPointerPresetDrafts("btn", p, 1).map((d) => (d.target.kind === "property" ? d.target.path : ""));
      assert.deepEqual(paths.sort(), ["transform.x", "transform.y"]);
    }
  });
});
