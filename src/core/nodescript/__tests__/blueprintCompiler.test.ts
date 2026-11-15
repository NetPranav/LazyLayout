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

    const keepOutGraph = makeReferenceGraph(1);
    const outKeepOut = compileBlueprintToTarget(keepOutGraph, "react");
    assert.ok(outKeepOut.usedVendoredModules.includes("physics2d"));
    assert.ok(outKeepOut.code.includes("physics2d.applyKeepOutConstraint"));
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
});
