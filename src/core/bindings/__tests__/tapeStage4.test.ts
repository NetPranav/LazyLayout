import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding } from "../../document/signals";
import { compileExpr } from "../evaluate";
import {
  authorScriptedTape,
  createTapeRecorder,
  deserializeInputTape,
  replayTapeExpressions,
  serializeInputTape,
  tapeFrame,
} from "../tape";

describe("Phase 136 — Input Tapes: Record, Author & Deterministic Replay", () => {
  it("records multimodal pointer, scroll, key, audio, and device inputs into a schema-valid tape and round-trips JSON", () => {
    const rec = createTapeRecorder("tape-demo", "Multimodal demo", 60, 42);
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      rec.record(t, [
        { signal: { kind: "pointerIn", channel: "uv", space: "frame" }, value: [t, t * 0.5] },
        { signal: { kind: "scroll", channel: "progress" }, value: t },
        { signal: { kind: "keyDown", code: "Space" }, value: i >= 20 && i <= 40 },
        { signal: { kind: "device", channel: "tiltX" }, value: Math.sin(t * Math.PI) },
      ]);
    }
    const tape = rec.finish();
    const json = serializeInputTape(tape);
    const restored = deserializeInputTape(json);
    assert.equal(restored.id, "tape-demo");
    assert.equal(restored.channels.length, 4);

    const midFrame = tapeFrame(restored, 0.5, 1 / 60);
    assert.equal(midFrame.read({ kind: "keyDown", code: "Space" }), true);
    assert.ok(Math.abs((midFrame.read({ kind: "scroll", channel: "progress" }) as number) - 0.5) < 1e-6);
  });

  it("produces byte-identical snapshots across 3 independent deterministic replay runs", () => {
    const scripted = authorScriptedTape({
      id: "scripted-1",
      name: "Pointer & key spring curve",
      duration: 1,
      fps: 60,
      seed: 7,
      channels: [
        {
          signal: { kind: "pointer", channel: "x" },
          samples: [
            { t: 0, v: 0 },
            { t: 0.5, v: 400 },
            { t: 1, v: 200 },
          ],
        },
        {
          signal: { kind: "keyHeld", code: "KeyW" },
          samples: [
            { t: 0, v: 0 },
            { t: 1, v: 1 },
          ],
        },
      ],
    });

    const b1 = parseBinding("pointer.x |> spring(bounce: 0.25, time: 0.4) -> card.transform.x").expr;
    const b2 = parseBinding("key.held(KeyW) |> smooth(0.1) -> card.transform.y").expr;

    const run1 = JSON.stringify(replayTapeExpressions(scripted, { x: () => compileExpr(b1), y: () => compileExpr(b2) }));
    const run2 = JSON.stringify(replayTapeExpressions(scripted, { x: () => compileExpr(b1), y: () => compileExpr(b2) }));
    const run3 = JSON.stringify(replayTapeExpressions(scripted, { x: () => compileExpr(b1), y: () => compileExpr(b2) }));

    assert.equal(run1, run2);
    assert.equal(run2, run3);
  });
});
