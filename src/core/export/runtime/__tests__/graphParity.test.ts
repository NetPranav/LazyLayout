import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer } from "../../../document/schema";
import { MAIN_COMPOSITION_ID } from "../../../document/compositions";
import { BindingSchema, parseBinding, resolveLayerRefs, type Binding } from "../../../document/signals";
import { evaluate } from "../../../kernel/evaluate";
import { linkPath } from "../../../links/linkModel";
import { exprPath } from "../../../expressions/exprModel";
import { busFrame as coreBusFrame, newBusState, type InputSource } from "../../../bindings/inputBus";
import { createBindingRuntime, type BindingHost } from "../../../bindings/runtime";
import { buildDriversExport, exportableGraph, exportableProps } from "../drivers";

const mk = (id: string, name: string, props: Record<string, unknown> = {}) =>
  createLayer({ id, name, archetype: "rectangle", properties: { positioning: "absolute", "frame.width": 100, "frame.height": 60, ...props } }) as Layer;

const link = (slot: number, target: string, source: string, sourceProperty: string, extra: Record<string, unknown> = {}) => ({
  [linkPath(slot, "target")]: target, [linkPath(slot, "source")]: source, [linkPath(slot, "sourceProperty")]: sourceProperty, [linkPath(slot, "enabled")]: true, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [linkPath(slot, k), v])),
});
const expr = (slot: number, target: string, text: string) => ({ [exprPath(slot, "target")]: target, [exprPath(slot, "text")]: text, [exprPath(slot, "enabled")]: true });

/** Twenty: expressions (time, value, wiggle, ease, ref, refAtTime), links (direct, range, reversed, clamped, from a property nothing drives) and links followed by expressions. */
const LAYERS = [
  mk("a", "Watch", { "transform.x": 4, ...expr(1, "transform.rotate", "time * 40"), ...expr(2, "transform.x", "value + ref(\"Ring\", \"transform.x\") * 0.5") }),
  mk("b", "Ring", { "transform.rotate": 15, "transform.x": 9, ...link(1, "transform.rotate", "a", "transform.rotate", { map: "range", inMin: 0, inMax: 1, outMin: 0, outMax: -1, clamp: false }), ...expr(1, "transform.x", "value + sin(time * 2) * 30") }),
  mk("c", "Crown", { "transform.scale": 1, ...expr(1, "transform.scale", "linear(time, 0, 4, 1, 2)"), ...link(1, "transform.rotate", "a", "transform.rotate", { map: "direct" }), ...expr(2, "transform.rotate", "value * 0.5 + 3") }),
  mk("d", "Dial", { "appearance.opacity": 0.8, ...expr(1, "appearance.opacity", "clamp(0.5 + wiggle(2, 0.2, 3), 0, 1)"), ...link(1, "transform.x", "c", "transform.scale", { map: "range", inMin: 1, inMax: 2, outMin: 0, outMax: 100, clamp: true }), ...link(2, "transform.y", "a", "frame.width", { map: "range", inMin: 0, inMax: 200, outMin: 0, outMax: 40, clamp: false }), ...expr(2, "transform.y", "value + refAtTime(\"Watch\", \"transform.rotate\", time - 1) * 0.1") }),
  mk("e", "Hand", { "transform.scale": 1, ...expr(1, "transform.rotate", "wiggle(1.5, 20, 5) + time"), ...expr(2, "transform.x", "ease(time, 1, 3, 0, 80)"), ...link(1, "transform.scale", "b", "transform.rotate", { map: "range", inMin: -90, inMax: 90, outMin: 0.5, outMax: 1.5, clamp: true }), ...link(2, "appearance.opacity", "d", "appearance.opacity", { map: "direct" }) }),
  mk("f", "Pin", { ...link(1, "transform.x", "e", "transform.x", { map: "direct" }), ...link(2, "transform.y", "e", "transform.x", { map: "range", inMin: 0, inMax: 80, outMin: 0, outMax: -40, clamp: false }), ...expr(1, "transform.rotate", "ref(\"Hand\", \"transform.rotate\") * -1"), ...expr(2, "transform.scale", "1 + 0.1 * floor(time)"), ...link(3, "appearance.opacity", "b", "transform.x", { map: "range", inMin: 0, inMax: 60, outMin: 0, outMax: 1, clamp: true }) }),
];
const doc = createDocumentFromLayers(LAYERS);

function exportScript() {
  const out = buildDriversExport(doc);
  assert.ok(out.source, "a script is written");
  const ctx = vm.createContext({ Math, Number, Error, Array, JSON, Object, isFinite });
  vm.runInContext(out.source!, ctx);
  type Live = { step: (f: unknown) => { layer: string; prop: string; base: number; value: number }[] };
  return { out, ctx: ctx as unknown as { createLive: (c: unknown) => Live; GRAPH: unknown; PROPS: unknown; CONFIG: unknown[]; busFrame: (s: unknown, st: unknown, t: number, dt: number) => unknown; newBus: () => unknown } };
}

describe("links and expressions in the export evaluate like the editor (D5, D7)", () => {
  it("carries everything: twenty links and expressions on the five exportable properties, with no warning", () => {
    const { graph, warnings } = exportableGraph(doc);
    assert.deepEqual(warnings, []);
    assert.equal(graph!.nodes.length, 18); // eighteen driven properties...
    assert.equal(graph!.nodes.filter((n) => n.link).length + graph!.nodes.filter((n) => n.expr).length, 20); // ...by twenty links and expressions
  });

  it("every driven property at 60 time steps equals the kernel's value to 1e-9", () => {
    const { ctx } = exportScript();
    const live = ctx.createLive({ drivers: [], graph: ctx.GRAPH, props: ctx.PROPS });
    const props = exportableProps(doc).props;
    let compared = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i * 0.1;
      const got = live.step({ time: t, dt: 0.1, read: () => 0 });
      assert.equal(got.length, props.length);
      for (const r of got) {
        const want = evaluate(doc, MAIN_COMPOSITION_ID, r.layer, t)[r.prop];
        assert.equal(typeof want, "number", `${r.layer} ${r.prop} at ${t}: the kernel has a number`);
        assert.ok(Math.abs(r.value - (want as number)) < 1e-9, `${r.layer} ${r.prop} at ${t}: export ${r.value} vs editor ${want}`);
        compared++;
      }
    }
    assert.ok(compared >= 61 * 18);
  });

  it("with drivers on the same properties, the combined value equals the kernel's with the drivers' bound values", () => {
    const text = [
      "pointer.x |> remap(0, 1000, 0, 60)\n-> Watch.transform.x",
      "scroll.progress |> remap(0, 1, 0, 45)\n-> Ring.transform.rotate",
      "pointer.speed |> remap(0, 1500, 1, 1.6)\n-> Crown.transform.scale",
      "pointer.y |> remap(0, 600, 1, 0.4)\n-> Dial.appearance.opacity",
    ];
    const bindings: Binding[] = text.map((t, i) => ({ ...resolveLayerRefs(parseBinding(t), (n) => LAYERS.find((l) => l.name === n)?.id), id: `bd${i}`, ownerLayerId: "a", enabled: true }));
    const withDrivers = { ...doc, bindings: Object.fromEntries(bindings.map((b) => [b.id, BindingSchema.parse(b)])) };
    const out = buildDriversExport(withDrivers);
    const ctxVm = vm.createContext({ Math, Number, Error, Array, JSON, Object, isFinite });
    vm.runInContext(out.source!, ctxVm);
    const c = ctxVm as unknown as { createLive: (c: unknown) => { step: (f: unknown) => { layer: string; prop: string; value: number }[] }; GRAPH: unknown; PROPS: unknown; CONFIG: unknown[]; busFrame: (s: unknown, st: unknown, t: number, dt: number) => unknown; newBus: () => unknown };
    const live = c.createLive({ drivers: c.CONFIG, graph: c.GRAPH, props: c.PROPS });
    const src = (t: number): InputSource => ({
      pointer: () => ({ x: 500 + 450 * Math.sin(t * 1.7), y: 300 + 250 * Math.cos(t * 1.1), down: false, coarse: false, pressure: 0.5, type: "mouse" }),
      pageSize: () => ({ width: 1000, height: 600 }),
      scroll: () => ({ y: 1200 * (0.5 - 0.5 * Math.cos(t * 0.9)), max: 1200, viewport: 700 }),
    });
    const host: BindingHost = { layersOf: (s) => (s.kind === "layer" ? [s.ref] : []), base: (layerId, path) => { const v = evaluate(withDrivers, MAIN_COMPOSITION_ID, layerId, 0)[path]; return typeof v === "number" ? v : undefined; }, env: { pointerCoarse: false, reducedMotion: false, breakpoint: "", states: new Set() } };
    // the editor's base for a driver is the layer's value with links and expressions at that moment: the host reads it at the frame's time
    let now = 0;
    host.base = (layerId, path) => { const v = evaluate(withDrivers, MAIN_COMPOSITION_ID, layerId, now)[path]; return typeof v === "number" ? v : undefined; };
    const runtime = createBindingRuntime(bindings, host);
    const coreBus = newBusState();
    const expBus = c.newBus();
    let compared = 0;
    for (let i = 0; i <= 180; i++) {
      const t = i / 30;
      now = t;
      const frameCore = coreBusFrame(src(t), coreBus, t, 1 / 30);
      const bound = runtime.step(frameCore);
      const got = live.step(c.busFrame(src(t), expBus, t, 1 / 30));
      for (const r of got) {
        const want = evaluate(withDrivers, MAIN_COMPOSITION_ID, r.layer, t, { bound })[r.prop];
        assert.ok(Math.abs(r.value - (want as number)) < 1e-9, `t ${t}: ${r.layer} ${r.prop}: export ${r.value} vs editor ${want}`);
        compared++;
      }
    }
    assert.ok(compared >= 181 * 18);
  });

  it("what it cannot carry is left out with a warning that says why", () => {
    const odd = createDocumentFromLayers([
      mk("a", "Watch", { ...link(1, "typography.fontSize", "b", "transform.x"), ...expr(1, "transform.x", "time +") }),
      mk("b", "Ring", { ...link(1, "transform.rotate", "a", "transform.rotate", { map: "curve", curve: "power2.out" }) }),
    ]);
    const { graph, warnings } = exportableGraph(odd);
    assert.equal(graph, null);
    assert.equal(warnings.length, 3);
    assert.ok(warnings.some((w) => /only position, rotation, scale and opacity/.test(w)));
    assert.ok(warnings.some((w) => /does not parse/.test(w)));
    assert.ok(warnings.some((w) => /curve maps/.test(w)));
  });

  it("an expression's runtime is in the script only when an expression is used", () => {
    const linkOnly = createDocumentFromLayers([mk("a", "Watch", {}), mk("b", "Ring", { ...link(1, "transform.rotate", "a", "transform.rotate", { map: "direct" }) })]);
    const noExpr = buildDriversExport(linkOnly).source!;
    assert.doesNotMatch(noExpr, /function evaluateExpression/); // the embedded evaluator is not written out
    assert.match(buildDriversExport(doc).source!, /function evaluateExpression/);
  });
});
