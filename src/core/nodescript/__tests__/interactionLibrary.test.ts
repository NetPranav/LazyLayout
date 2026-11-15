import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BlueprintGraph } from "../../ast/ASTManager.js";
import {
  INTERACTION_NODE_CATALOG,
  validateInteractionGraph,
} from "../interactionLibrary.js";

function makeGraph(
  id: string,
  type: "event" | "function" | "macro",
  nodes: BlueprintGraph["nodes"],
  wires: BlueprintGraph["wires"],
): BlueprintGraph {
  return { id, name: id, type, nodes, wires, variables: [] };
}

describe("Phase 159 · Blueprint model & interaction library", () => {
  it("validates 10 cross-element interaction graphs matching grammar examples", () => {
    const scenarios: Array<{
      id: string;
      event: string;
      flow?: string;
      action: string;
      flowInPin?: string;
      flowOutPin?: string;
    }> = [
      { id: "g1-hover-show", event: "interaction/onHover", action: "interaction/showHide" },
      { id: "g2-key-state", event: "interaction/onKey", action: "interaction/setState" },
      { id: "g3-drag-spring", event: "interaction/onDrag", action: "interaction/springProperty" },
      { id: "g4-view-play", event: "interaction/onView", action: "interaction/play" },
      { id: "g5-scroll-scrollto", event: "interaction/onScrollCrossing", action: "interaction/scrollTo" },
      { id: "g6-marker-sound", event: "interaction/onMarker", action: "interaction/playSound" },
      { id: "g7-overlap-spawn", event: "interaction/onOverlap", action: "interaction/spawn" },
      { id: "g8-hit-explode", event: "interaction/onHit", action: "interaction/explode" },
      { id: "g9-timer-flipflop", event: "interaction/onTimer", flow: "interaction/flipFlop", action: "interaction/setProperty", flowInPin: "exec", flowOutPin: "a" },
      { id: "g10-pointer-branch", event: "interaction/onPointer", flow: "interaction/branch", action: "interaction/setStateInput", flowInPin: "exec", flowOutPin: "then" },
    ];

    assert.ok(INTERACTION_NODE_CATALOG.length >= 40);

    for (const s of scenarios) {
      const nodes: BlueprintGraph["nodes"] = {
        evt: { id: "evt", type: s.event, title: s.event, position: { x: 0, y: 0 } },
        act: { id: "act", type: s.action, title: s.action, position: { x: 400, y: 0 } },
      };
      const wires: BlueprintGraph["wires"] = [];
      if (s.flow) {
        nodes.flw = { id: "flw", type: s.flow, title: s.flow, position: { x: 200, y: 0 } };
        wires.push(
          { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "flw", targetPinId: s.flowInPin!, pinType: "exec", isExec: true },
          { id: "w2", sourceNodeId: "flw", sourcePinId: s.flowOutPin!, targetNodeId: "act", targetPinId: "exec", pinType: "exec", isExec: true },
        );
      } else {
        wires.push({ id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "act", targetPinId: "exec", pinType: "exec", isExec: true });
      }

      const res = validateInteractionGraph(makeGraph(s.id, "event", nodes, wires));
      assert.equal(res.isValid, true, `${s.id} failed validation: ${JSON.stringify(res.issues)}`);
    }
  });

  it("rejects latent nodes in function graphs, latent inside forEach, and pin type mismatches", () => {
    const latentInFn = makeGraph(
      "bad-fn",
      "function",
      { d: { id: "d", type: "interaction/delay", title: "Delay", position: { x: 0, y: 0 } } },
      [],
    );
    const fnRes = validateInteractionGraph(latentInFn);
    assert.equal(fnRes.isValid, false);
    assert.ok(fnRes.issues.some((i) => i.code === "BP_LATENT_IN_FUNCTION"));

    const latentInLoop = makeGraph(
      "bad-loop",
      "event",
      {
        fe: { id: "fe", type: "interaction/forEach", title: "ForEach", position: { x: 0, y: 0 }, pinValues: { maxIterations: 50 } },
        d: { id: "d", type: "interaction/springProperty", title: "Spring", position: { x: 200, y: 0 } },
      },
      [{ id: "w1", sourceNodeId: "fe", sourcePinId: "loopBody", targetNodeId: "d", targetPinId: "exec", pinType: "exec", isExec: true }],
    );
    const loopRes = validateInteractionGraph(latentInLoop);
    assert.equal(loopRes.isValid, false);
    assert.ok(loopRes.issues.some((i) => i.code === "BP_LATENT_IN_LOOP"));

    const typeMismatch = makeGraph(
      "bad-type",
      "event",
      {
        p: { id: "p", type: "interaction/onPointer", title: "Pointer", position: { x: 0, y: 0 } },
        s: { id: "s", type: "interaction/showHide", title: "ShowHide", position: { x: 200, y: 0 } },
      },
      [{ id: "w1", sourceNodeId: "p", sourcePinId: "x", targetNodeId: "s", targetPinId: "visible", pinType: "number" }],
    );
    const typeRes = validateInteractionGraph(typeMismatch);
    assert.equal(typeRes.isValid, false);
    assert.ok(typeRes.issues.some((i) => i.code === "BP_PIN_TYPE_MISMATCH"));
  });
});
