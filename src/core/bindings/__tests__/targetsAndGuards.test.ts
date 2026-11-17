import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema, type Binding } from "../../document/signals";
import { createBindingRuntime, type BindingHost } from "../runtime";
import { detectSignalAndLinkCycles, isLayerLayoutIsolated } from "../cycleAndLayoutGuard";
import { evaluate, KERNEL_GAPS } from "../../kernel/evaluate";
import { createDocumentFromLayers, createLayer } from "../../document/factories";

function binding(partial: Omit<Binding, "enabled" | "ownerLayerId"> & { ownerLayerId?: string; enabled?: boolean }): Binding {
  return BindingSchema.parse({
    enabled: true,
    ownerLayerId: partial.ownerLayerId ?? "btn",
    ...partial,
  });
}

function makeHost(overrides: Partial<BindingHost> = {}): BindingHost {
  return {
    layersOf: (on) => (on.kind === "layer" ? [on.ref] : ["btn"]),
    base: (_id, path) => (path === "transform.x" ? 10 : path === "transform.rotate" ? 0 : path === "appearance.opacity" ? 1 : 0),
    env: { pointerCoarse: false, reducedMotion: false, breakpoint: "desktop", states: new Set() },
    ...overrides,
  };
}

describe("Stage 4 Phase 139: targets, blending, layout carve-out & unified cycles", () => {
  it("blends float + magnet + tilt additive/multiply/max channels cleanly and feeds kernel STA synthesis", () => {
    const floatY = binding({
      id: "b-float",
      expr: { signal: { kind: "constant", value: 4 }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.y" },
      blend: "add",
    });
    const magnetX = binding({
      id: "b-magnet",
      expr: { signal: { kind: "constant", value: 12 }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.x" },
      blend: "add",
    });
    const tiltRot = binding({
      id: "b-tilt",
      expr: { signal: { kind: "constant", value: 7 }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.rotate" },
      blend: "add",
    });

    const rt = createBindingRuntime([floatY, magnetX, tiltRot], makeHost());
    assert.equal(rt.diagnostics.length, 0);
    const bound = rt.step({ time: 0.5, dt: 1 / 60, seed: 1, read: () => 0 });
    assert.equal(bound.get("btn")?.get("transform.x"), 22);
    assert.equal(bound.get("btn")?.get("transform.y"), 4);
    assert.equal(bound.get("btn")?.get("transform.rotate"), 7);

    const doc = createDocumentFromLayers([
      createLayer({
        id: "btn",
        name: "Button",
        archetype: "button",
        properties: { "transform.x": 10, "transform.y": 0, "transform.rotate": 0 },
      }),
    ]);
    const compId = Object.keys(doc.compositions)[0]!;
    const resolved = evaluate(doc, compId, "btn", 0.5, { bound });
    assert.equal(resolved["transform.x"], 22);
    assert.ok(String(resolved.transform).includes("22"));
    assert.ok(!KERNEL_GAPS.some((g) => g.area === "signal bindings"));
  });

  it("supports state-machine input and event targets alongside cssvar", () => {
    const smInput = binding({
      id: "b-sm",
      expr: { signal: { kind: "constant", value: 0.85 }, operators: [] },
      target: { kind: "input", on: { kind: "layer", ref: "btn" }, name: "hoverIntensity" },
    });
    const evtTrigger = binding({
      id: "b-evt",
      expr: { signal: { kind: "constant", value: 1 }, operators: [] },
      target: { kind: "event", name: "dockPeak" },
    });

    const rt = createBindingRuntime([smInput, evtTrigger], makeHost());
    assert.equal(rt.diagnostics.length, 0);
    rt.step({ time: 0.1, dt: 1 / 60, seed: 1, read: () => 0 });
    assert.equal(rt.inputs.get("btn")?.get("hoverIntensity"), 0.85);
    assert.equal(rt.events.has("dockPeak"), true);
    // Held high: the event fired once, not on every frame (review 2026-11-17).
    rt.step({ time: 0.2, dt: 1 / 60, seed: 1, read: () => 0 });
    assert.equal(rt.events.has("dockPeak"), false);
  });

  it("fires an event again only after the value drops below 0.5 and rises again", () => {
    let level = 0;
    const evt = binding({
      id: "b-press",
      expr: { signal: { kind: "pointer", channel: "down" }, operators: [] },
      target: { kind: "event", name: "pressed" },
    });
    const rt = createBindingRuntime([evt], makeHost());
    const step = () => {
      rt.step({ time: 0, dt: 1 / 60, seed: 1, read: () => level });
      return rt.events.has("pressed");
    };
    assert.equal(step(), false);
    level = 1;
    assert.equal(step(), true, "rising edge");
    assert.equal(step(), false, "still held");
    level = 0;
    assert.equal(step(), false);
    level = 1;
    assert.equal(step(), true, "second press");
  });

  it("enforces SIG_LAYOUT normally and permits layout paths inside layout-isolated boxes", () => {
    const gapBinding = binding({
      id: "b-gap",
      ownerLayerId: "dock",
      expr: { signal: { kind: "constant", value: 12 }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "dock" }, path: "layout.gap" },
    });

    const denied = createBindingRuntime([gapBinding], makeHost({ isLayoutIsolated: () => false }));
    assert.equal(denied.diagnostics[0]?.code, "SIG_LAYOUT");
    assert.equal(denied.idle, true);

    const layers = {
      box: { id: "box", parentId: null, properties: { "layout.contain": "layout size" } },
      dock: { id: "dock", parentId: "box", properties: {} },
    };
    assert.equal(isLayerLayoutIsolated("dock", layers), true);

    const allowed = createBindingRuntime(
      [gapBinding],
      makeHost({ layersOf: () => ["dock"], isLayoutIsolated: (id) => isLayerLayoutIsolated(id, layers) })
    );
    assert.equal(allowed.diagnostics.length, 0);
    const out = allowed.step({ time: 0, dt: 1 / 60, seed: 1, read: () => 0 });
    assert.equal(out.get("dock")?.get("layout.gap"), 12);
  });

  it("detects and refuses cycles across links + bindings with SIGNAL_CYCLE and the exact chain", () => {
    const b1 = binding({
      id: "b-var-write",
      expr: { signal: { kind: "prop", name: "posX" }, operators: [] },
      target: { kind: "input", on: { kind: "layer", ref: "btn" }, name: "speed" },
    });
    const b2 = binding({
      id: "b-prop-write",
      expr: { signal: { kind: "sm", input: "speed" }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.y" },
    });

    const report = detectSignalAndLinkCycles({
      bindings: [b1, b2],
      links: [
        { sourceLayerId: "btn", sourcePath: "transform.y", targetLayerId: "btn", targetPath: "posX" },
      ],
    });
    assert.equal(report.ok, false);
    assert.equal(report.diagnostics[0]?.code, "SIGNAL_CYCLE");
    assert.ok(report.diagnostics[0]?.message.includes("->"));

    const rt = createBindingRuntime([b1, b2], {
      ...makeHost(),
      links: [{ sourceLayerId: "btn", sourcePath: "transform.y", targetLayerId: "btn", targetPath: "posX" }],
    });
    assert.equal(rt.diagnostics[0]?.code, "SIGNAL_CYCLE");
    assert.equal(rt.idle, true);
  });

  it("guards NaN outputs cleanly with SIGNAL_NAN_GUARD fallback", () => {
    const nanBinding = binding({
      id: "b-nan",
      expr: { signal: { kind: "time" }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.x" },
      blend: "replace",
    });
    const rt = createBindingRuntime([nanBinding], makeHost());
    const out = rt.step({ time: Number.NaN, dt: 1 / 60, seed: 1, read: () => Number.NaN });
    assert.equal(out.get("btn")?.get("transform.x"), 0);
    assert.equal(rt.diagnostics[0]?.code, "SIGNAL_NAN_GUARD");
  });
});
