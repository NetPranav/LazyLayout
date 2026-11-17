/**
 * @file blueprintCompiler.test.ts
 * @description Phase 169 tests: compiles 20 reference Blueprint graphs into React,
 * Vue, and Vanilla TypeScript with zero `any`, zero LazyLayout imports, node-name
 * comments, CSS fast-path emission, keep-out constraints, and arbitrary-code rejection.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ASTManager, type BlueprintGraph } from "../../ast/ASTManager";
import { compileBlueprintToTarget, isGraphCssExpressible } from "../blueprintCompiler";

function makeReferenceGraph(index: number): BlueprintGraph {
  const g = ASTManager.createGraph(`ref_${index}`, `RefGraph_${index}`, "event");
  const isHover = index % 4 === 0;
  const isKeepOut = index % 4 === 1;
  const isConfetti = index % 4 === 2;

  return {
    ...g,
    nodes: {
      evt: {
        id: "evt",
        type: isHover ? "interaction/onHover" : "interaction/onPointer",
        title: `EventTrigger_${index}`,
        position: { x: 40, y: 80 },
        customParams: { target: `layer_${index}` },
      },
      act: {
        id: "act",
        type: isKeepOut
          ? "interaction/keepOut"
          : isConfetti
            ? "interaction/spawnParticles"
            : isHover
              ? "interaction/setProperty"
              : "interaction/springProperty",
        title: `ActionStep_${index}`,
        position: { x: 320, y: 80 },
        customParams: {
          target: `target_${index}`,
          property: isHover ? "effects.glow" : "transform.y",
          value: isHover ? 0.8 : 42,
          radius: 90,
        },
      },
    },
    wires: [
      {
        id: "w1",
        sourceNodeId: "evt",
        sourcePinId: "exec",
        targetNodeId: "act",
        targetPinId: "exec",
        pinType: "exec",
        isExec: true,
      },
    ],
  };
}

describe("Phase 169: Blueprint compiler & interaction parity", () => {
  it("compiles 20 reference graphs across React, Vue, and Vanilla with zero `any` and zero LazyLayout imports", () => {
    for (let i = 0; i < 20; i++) {
      const graph = makeReferenceGraph(i);
      for (const target of ["react", "vue", "vanilla"] as const) {
        const compiled = compileBlueprintToTarget(graph, target);
        assert.equal(compiled.target, target);
        assert.ok(compiled.code.includes(`EventTrigger_${i}`));
        assert.ok(compiled.code.includes(`ActionStep_${i}`));
        assert.equal(/\bany\b/.test(compiled.code), false, `unexpected 'any' in ${target} graph ${i}`);
        assert.equal(/@lazylayout|@\/core/.test(compiled.code), false, "no LazyLayout imports permitted");
      }
    }
  });

  it("emits CSS fast-path rules and keep-out effector constraints accurately", () => {
    const hoverGraph = makeReferenceGraph(0);
    assert.equal(isGraphCssExpressible(hoverGraph), true);
    const outHover = compileBlueprintToTarget(hoverGraph, "vanilla");
    assert.equal(outHover.hasCssFastPath, true);
    assert.ok(outHover.cssFallbackRules.includes(":hover"));

    // Keep-out needs the physics runtime, which the export doesn't have yet: it is reported, not stubbed.
    const keepOutGraph = makeReferenceGraph(1);
    const outKeepOut = compileBlueprintToTarget(keepOutGraph, "react");
    assert.ok(outKeepOut.unsupportedNodes.some((n) => n.includes("interaction/keepOut")));
    assert.ok(outKeepOut.code.includes("Not exported yet"));
    assert.equal(outKeepOut.code.includes("applyKeepOutConstraint"), false);
  });

  it("rejects arbitrary-code nodes during compilation", () => {
    const g = ASTManager.createGraph("bad_graph", "BadGraph", "event");
    g.nodes.evil = {
      id: "evil",
      type: "custom/eval",
      title: "Eval",
      position: { x: 100, y: 100 },
    };
    assert.throws(() => compileBlueprintToTarget(g, "vanilla"), /prohibited/);
  });

  it("wires each event to its own DOM event and runs actions in wire order, not canvas order (review 2026-11-17)", () => {
    const g = ASTManager.createGraph("order", "Order", "event");
    const graph: BlueprintGraph = {
      ...g,
      nodes: {
        hover: { id: "hover", type: "interaction/onHover", title: "Hover", position: { x: 0, y: 0 }, customParams: { target: "card" } },
        // Placed LEFT of `first` on the canvas, but wired second.
        second: { id: "second", type: "interaction/setProperty", title: "Second", position: { x: 10, y: 0 }, customParams: { target: "card", property: "transform.y", value: -8 } },
        first: { id: "first", type: "interaction/setProperty", title: "First", position: { x: 500, y: 0 }, customParams: { target: "card", property: "appearance.opacity", value: 0.5 } },
      },
      wires: [
        { id: "w1", sourceNodeId: "hover", sourcePinId: "exec", targetNodeId: "first", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "first", sourcePinId: "exec", targetNodeId: "second", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
    const out = compileBlueprintToTarget(graph, "vanilla");
    const [listener] = out.program.listeners;
    assert.equal(listener?.event, "pointerenter");
    assert.deepEqual(listener?.actions.map((a) => (a.kind === "setStyle" ? a.path : a.kind)), ["appearance.opacity", "transform.y"]);
    assert.deepEqual(out.unsupportedNodes, []);
  });

  it("the exported code really changes the element when the event fires", async () => {
    const ts = await import("typescript");
    const graph = makeReferenceGraph(0); // onHover -> setProperty effects.glow 0.8 on target_0
    graph.nodes.evt!.customParams = { target: "target_0" };
    const out = compileBlueprintToTarget(graph, "vanilla");
    const js = ts.transpileModule(out.code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;

    const listeners = new Map<string, () => void>();
    const style: Record<string, string> & { setProperty: (k: string, v: string) => void } = {
      setProperty(k: string, v: string) { style[k] = v; },
    } as never;
    const el = {
      style,
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const mount = new Function(`${js.replace(/^export /gm, "")}
return mount${"RefGraph_0"};`)() as (
      root: unknown,
      targets: Record<string, unknown>,
    ) => () => void;
    const dispose = mount(el, { target_0: el });
    assert.ok(listeners.has("pointerenter"), "listens for hover, not pointerdown");
    assert.equal(listeners.has("pointerdown"), false);
    listeners.get("pointerenter")!();
    assert.equal(style.boxShadow, "0 0 19px currentColor", "the DOM is written, not an in-memory map");
    dispose();
    assert.equal(listeners.size, 0, "dispose removes the listener");
  });
});
