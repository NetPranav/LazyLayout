import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding, formatBinding } from "../../document/signals";
import { busFrame, newBusState, unservedSignals, type InputSource } from "../../bindings/inputBus";
import {
  SIGNAL_CATALOGUE,
  findCatalogueEntry,
  formatSignalValue,
  listSignalsByCategory,
} from "../catalogue";

describe("Phase 133 — Signal Catalogue & Keyboard Signals", () => {
  it("declares unit, range, defaultValue, and touchBehaviour on every catalogue entry", () => {
    assert.ok(SIGNAL_CATALOGUE.length >= 25);
    for (const entry of SIGNAL_CATALOGUE) {
      assert.ok(entry.unit.length > 0, entry.id);
      assert.equal(entry.range.length, 2, entry.id);
      assert.ok(entry.range[0] <= entry.range[1], entry.id);
      assert.notEqual(entry.defaultValue, undefined, entry.id);
      assert.ok(entry.touchBehaviour.length > 0, entry.id);
      const sig = entry.createSignal("card", "Space");
      const found = findCatalogueEntry(sig);
      assert.ok(found, `catalogue lookup failed for ${entry.id}`);
    }
    assert.ok(listSignalsByCategory("keyboard").length >= 5);
  });

  it("round-trips key.down, key.held, key.axis, key.lastPressed, and focusVisible in binding syntax", () => {
    const cases = [
      "key.down(Space) -> hero.appearance.opacity",
      "key.held(KeyW) |> clamp(0, 1) -> hero.transform.scaleX",
      "key.axis(wasd) |> component(x) -> hero.transform.x",
      "key.axis(arrows, y) -> hero.transform.y",
      "key.lastPressed -> hero.appearance.opacity",
      "focusVisible(btn) -> btn.transform.scale",
    ];
    for (const src of cases) {
      const parsed = parseBinding(src);
      assert.deepEqual(unservedSignals(parsed.expr), [], src);
      const text = formatBinding(parsed);
      assert.deepEqual(parseBinding(text), parsed, text);
    }
  });

  it("evaluates keyboard press, hold duration accumulation, 2D axis, lastPressed, and focusVisible", () => {
    const down = new Set<string>(["KeyW", "KeyD"]);
    let focused: string | null = "cta";
    let visible = true;
    const source: InputSource = {
      pointer: () => null,
      pageSize: () => ({ width: 800, height: 600 }),
      scroll: () => ({ y: 0, max: 0 }),
      keysDown: () => down,
      lastPressedKey: () => "KeyD",
      focusedLayerId: () => focused,
      focusVisible: () => visible,
    };

    const st = newBusState();
    let frame = busFrame(source, st, 0, 1 / 60);
    for (let i = 1; i <= 30; i++) frame = busFrame(source, st, i / 60, 1 / 60);

    assert.equal(frame.read({ kind: "keyDown", code: "KeyW" }), true);
    assert.equal(frame.read({ kind: "keyDown", code: "Space" }), false);
    assert.ok(Math.abs((frame.read({ kind: "keyHeld", code: "KeyW" }) as number) - 0.5) < 0.05);
    assert.deepEqual(frame.read({ kind: "keyAxis", preset: "wasd" }), [1, -1]);
    assert.equal(frame.read({ kind: "keyLastPressed" }) !== 0, true);
    assert.equal(frame.read({ kind: "focusVisible", layer: "cta" }), true);
    assert.equal(frame.read({ kind: "layerState", channel: "focus", layer: "cta" }), true);

    // Releasing key resets hold duration; losing focus clears focusVisible
    down.delete("KeyW");
    focused = null;
    visible = false;
    frame = busFrame(source, st, 31 / 60, 1 / 60);
    assert.equal(frame.read({ kind: "keyHeld", code: "KeyW" }), 0);
    assert.deepEqual(frame.read({ kind: "keyAxis", preset: "wasd" }), [1, 0]);
    assert.equal(frame.read({ kind: "focusVisible", layer: "cta" }), false);

    assert.equal(formatSignalValue([1, -1], "-1..1"), "[1.00, -1.00]");
  });
});
