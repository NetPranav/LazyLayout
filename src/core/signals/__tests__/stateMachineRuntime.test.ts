import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createStateMachineRuntime,
  evaluateBlend1D,
  type StateMachineSpec,
} from "../stateMachineRuntime.js";

describe("Phase 151 · State machines", () => {
  it("evaluates 1D blend states continuously by numeric input", () => {
    const stops = [
      { value: 0, properties: { "transform.scale": 1, "appearance.opacity": 0.6 } },
      { value: 1, properties: { "transform.scale": 1.2, "appearance.opacity": 1.0 } },
    ] as const;

    const mid = evaluateBlend1D(stops, 0.5);
    assert.ok(Math.abs(mid["transform.scale"]! - 1.1) < 1e-6);
    assert.ok(Math.abs(mid["appearance.opacity"]! - 0.8) < 1e-6);

    const clampedHigh = evaluateBlend1D(stops, 2.5);
    assert.equal(clampedHigh["transform.scale"], 1.2);
  });

  it("drives a 4-state machine with boolean, number, trigger, and 1D blend along a scripted tape", () => {
    const spec: StateMachineSpec = {
      id: "sm-card",
      name: "Interactive Card",
      initialStateId: "idle",
      inputs: [
        { name: "hovered", kind: "boolean", initial: false },
        { name: "proximity", kind: "number", initial: 0, min: 0, max: 1 },
        { name: "press", kind: "trigger" },
        { name: "locked", kind: "boolean", initial: false },
      ],
      states: [
        {
          id: "idle",
          label: "Idle",
          kind: "pose",
          properties: { "transform.scale": 1.0, "transform.y": 0, "appearance.opacity": 0.75 },
          x: 80,
          y: 45,
        },
        {
          id: "hoverBlend",
          label: "Hover Proximity",
          kind: "blend1d",
          inputName: "proximity",
          stops: [
            { value: 0, properties: { "transform.scale": 1.0, "transform.y": 0, "appearance.opacity": 0.8 } },
            { value: 1, properties: { "transform.scale": 1.16, "transform.y": -8, "appearance.opacity": 1.0 } },
          ],
          x: 250,
          y: 45,
        },
        {
          id: "pressed",
          label: "Pressed",
          kind: "pose",
          properties: { "transform.scale": 0.94, "transform.y": 2, "appearance.opacity": 1.0 },
          x: 420,
          y: 45,
        },
        {
          id: "disabled",
          label: "Disabled",
          kind: "pose",
          properties: { "transform.scale": 0.98, "transform.y": 0, "appearance.opacity": 0.35 },
          x: 250,
          y: 135,
        },
      ],
      transitions: [
        {
          id: "t-any-disable",
          from: "*",
          to: "disabled",
          durationSec: 0,
          priority: 10,
          conditions: [{ input: "locked", op: "==", value: true }],
        },
        {
          id: "t-idle-hover",
          from: "idle",
          to: "hoverBlend",
          durationSec: 0.2,
          priority: 2,
          conditions: [{ input: "hovered", op: "==", value: true }],
        },
        {
          id: "t-hover-press",
          from: "hoverBlend",
          to: "pressed",
          durationSec: 0.1,
          priority: 3,
          conditions: [{ input: "press", op: "fired" }],
        },
        {
          id: "t-hover-idle",
          from: "hoverBlend",
          to: "idle",
          durationSec: 0.2,
          priority: 1,
          conditions: [
            { input: "hovered", op: "==", value: false },
            { input: "proximity", op: "<=", value: 0.05 },
          ],
        },
      ],
    };

    const sm = createStateMachineRuntime(spec);
    let snap = sm.step(0);
    assert.equal(snap.currentStateId, "idle");
    assert.equal(snap.properties["transform.scale"], 1);

    // 1) Hover begins with proximity 0.5 -> transitions into hoverBlend over 0.2s
    sm.setBoolean("hovered", true);
    sm.setNumber("proximity", 0.5);
    snap = sm.step(0); // selects transition
    assert.equal(snap.activeTransition?.toStateId, "hoverBlend");
    snap = sm.step(0.1); // halfway (progress = 0.5 between idle scale 1.0 and hoverBlend@0.5 scale 1.08)
    assert.ok(Math.abs(snap.properties["transform.scale"]! - 1.04) < 1e-6);
    snap = sm.step(0.1); // arrives at hoverBlend
    assert.equal(snap.currentStateId, "hoverBlend");
    assert.ok(Math.abs(snap.properties["transform.scale"]! - 1.08) < 1e-6);

    // 2) Proximity increases to 1.0 while inside 1D blend state
    sm.setNumber("proximity", 1.0);
    snap = sm.step(0.016);
    assert.ok(Math.abs(snap.properties["transform.scale"]! - 1.16) < 1e-6);
    assert.ok(Math.abs(snap.properties["transform.y"]! - -8) < 1e-6);

    // 3) Fire trigger "press" -> transitions to pressed and consumes trigger
    sm.fireTrigger("press");
    snap = sm.step(0);
    assert.equal(snap.pendingTriggers.length, 0);
    assert.equal(snap.activeTransition?.toStateId, "pressed");
    snap = sm.step(0.1);
    assert.equal(snap.currentStateId, "pressed");
    assert.equal(snap.properties["transform.scale"], 0.94);

    // 4) Any-state high-priority transition when "locked" becomes true
    sm.setBoolean("locked", true);
    snap = sm.step(0);
    assert.equal(snap.currentStateId, "disabled");
    assert.equal(snap.properties["appearance.opacity"], 0.35);
    assert.deepEqual(snap.transitionHistory, ["idle", "hoverBlend", "pressed", "disabled"]);
  });
});

describe("Phase 151 · interrupts and triggers (review 2026-11-17)", () => {
  const spec: StateMachineSpec = {
    id: "sm-btn",
    name: "Button",
    initialStateId: "idle",
    inputs: [
      { name: "hovered", kind: "boolean", initial: false },
      { name: "press", kind: "trigger" },
    ],
    states: [
      { id: "idle", label: "Idle", kind: "pose", properties: { "transform.scale": 1 }, x: 0, y: 0 },
      { id: "hover", label: "Hover", kind: "pose", properties: { "transform.scale": 2 }, x: 0, y: 0 },
      { id: "pressed", label: "Pressed", kind: "pose", properties: { "transform.scale": 0.5 }, x: 0, y: 0 },
    ],
    transitions: [
      { id: "in", from: "idle", to: "hover", durationSec: 1, conditions: [{ input: "hovered", op: "==", value: true }] },
      { id: "out", from: "hover", to: "idle", durationSec: 1, conditions: [{ input: "hovered", op: "==", value: false }] },
      { id: "tap", from: "hover", to: "pressed", durationSec: 0, conditions: [{ input: "press", op: "fired" }] },
    ],
  } as StateMachineSpec;

  it("hover-out interrupts a running hover-in and reverses from where it was", () => {
    const sm = createStateMachineRuntime(spec);
    sm.setBoolean("hovered", true);
    sm.step(0); // starts idle -> hover
    sm.step(0.25); // one step is capped at 0.25 s
    sm.step(0.25);
    const mid = sm.snapshot().properties["transform.scale"]!;
    assert.ok(mid > 1.4 && mid < 1.6, `half way (${mid})`);
    sm.setBoolean("hovered", false);
    const after = sm.step(0);
    assert.equal(after.activeTransition?.toStateId, "idle", "reversing without waiting for hover-in to end");
    assert.ok(Math.abs(after.properties["transform.scale"]! - mid) < 1e-6, "no jump at the interruption");
  });

  it("a trigger nothing uses is dropped, not kept to fire later", () => {
    const sm = createStateMachineRuntime(spec);
    sm.fireTrigger("press"); // in idle, where nothing listens for it
    sm.step(0.016);
    sm.setBoolean("hovered", true);
    for (let i = 0; i < 80; i++) sm.step(0.016);
    assert.equal(sm.snapshot().currentStateId, "hover", "the old press did not fire the tap later");
  });
});
