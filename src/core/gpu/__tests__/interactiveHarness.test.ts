import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorScriptedTape } from "../../bindings/tape";
import { toNumber } from "../../bindings/evaluate";
import { GpuLedger } from "../ledger";
import { solidRgba, verifyInteractiveTapeScene } from "../interactiveHarness";

describe("Phase 137 — GPU & Interactive Verification Harness", () => {
  const makeTape = () =>
    authorScriptedTape({
      id: "harness-tape",
      name: "Pointer sweep",
      duration: 0.1,
      fps: 60,
      seed: 1,
      channels: [
        {
          signal: { kind: "pointerIn", channel: "uv", space: "frame" },
          samples: [
            { t: 0, v: [0, 0] },
            { t: 0.1, v: [1, 1] },
          ],
        },
      ],
    });

  it("passes matching visual frames, particle distributions, and clean GPU ledger teardown across tiers", () => {
    const ledger = new GpuLedger();
    const texHandle = {};
    ledger.track(texHandle, "layer:fx1", "texture", 4096, "rt-main");

    const golden = solidRgba(16, 16, [40, 120, 220, 255]);
    const report = verifyInteractiveTapeScene({
      tape: makeTape(),
      tier: "real-gpu",
      ledger,
      ownerPrefix: "layer:fx1",
      checkpoints: [{ frameIndex: 3, golden, expectedParticles: { count: 2, centroidX: 15, centroidY: 20, tolerancePx: 1 } }],
      stepAndCapture: (_frame, _idx, capture) => {
        if (!capture) return {};
        return {
          image: solidRgba(16, 16, [41, 120, 220, 255]), // slight GPU rounding within real-gpu tolerance
          particles: [
            { x: 10, y: 15 },
            { x: 20, y: 25 },
          ],
        };
      },
      teardown: () => ledger.release(texHandle),
    });

    assert.equal(report.pass, true);
    assert.equal(report.leakedBytes, 0);
    assert.equal(report.checkpoints[0].particlesOk, true);
  });

  it("fails deliberately broken falsifier fixtures (wrong color, shifted particles, or GPU leak)", () => {
    const ledger = new GpuLedger();
    const leaked = {};
    ledger.track(leaked, "layer:fx2", "buffer", 1024);

    const golden = solidRgba(16, 16, [40, 120, 220, 255]);
    const broken = verifyInteractiveTapeScene({
      tape: makeTape(),
      tier: "strict",
      ledger,
      ownerPrefix: "layer:fx2",
      checkpoints: [{ frameIndex: 2, golden, expectedParticles: { count: 2, centroidX: 50, centroidY: 50, tolerancePx: 2 } }],
      stepAndCapture: (frame, _idx, capture) => {
        if (!capture) return {};
        const shift = Math.round(toNumber(frame.read({ kind: "pointerIn", channel: "uv", space: "frame" })) * 10);
        return {
          image: solidRgba(16, 16, [255, 0, 0, 255]), // falsifier wrong color
          particles: [{ x: shift, y: 0 }], // wrong count + wrong centroid
        };
      },
      teardown: () => undefined, // deliberate leak
    });

    assert.equal(broken.pass, false);
    assert.ok(broken.failures.length >= 3);
  });
});

describe("Phase 137 harness can fail on what it didn't check (review 2026-11-17)", () => {
  const tape = () =>
    authorScriptedTape({
      id: "short",
      name: "Short",
      duration: 0.05,
      fps: 60,
      channels: [{ signal: { kind: "time" }, samples: [{ t: 0, v: 0 }, { t: 0.05, v: 0.05 }] }],
    });

  it("fails when a checkpoint lies past the end of the tape", () => {
    const report = verifyInteractiveTapeScene({
      tape: tape(),
      ledger: new GpuLedger(),
      checkpoints: [{ frameIndex: 999, golden: solidRgba(2, 2, [0, 0, 0, 255]) }],
      stepAndCapture: () => ({ image: solidRgba(2, 2, [0, 0, 0, 255]) }),
      teardown: () => undefined,
    });
    assert.equal(report.pass, false);
    assert.ok(report.failures.some((f) => f.includes("never reached")));
  });

  it("still tears down and reports when a frame throws", () => {
    let tornDown = false;
    const report = verifyInteractiveTapeScene({
      tape: tape(),
      ledger: new GpuLedger(),
      checkpoints: [{ frameIndex: 0, golden: solidRgba(2, 2, [0, 0, 0, 255]) }],
      stepAndCapture: () => {
        throw new Error("boom");
      },
      teardown: () => {
        tornDown = true;
      },
    });
    assert.equal(tornDown, true);
    assert.equal(report.pass, false);
  });
});
