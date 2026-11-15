/**
 * @file blueprintDebugger.test.ts
 * @description Phase 168 tests: pin-aware node search, reroutes, comment boxes,
 * variables, collapse-to-function, bidirectional Simple<->Graph conversion,
 * and a 25-step authoring + debugger step-through journey assertion.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ASTManager } from "../../ast/ASTManager";
import {
  addCommentBox,
  collapseSelectionToFunction,
  createBlueprintDebugSession,
  insertRerouteOnWire,
  openSimpleRuleAsGraph,
  searchNodesForPin,
  tryConvertGraphToSimpleRule,
  upsertGraphVariable,
  type BlueprintEditorState,
} from "../blueprintDebugger";

describe("Phase 168: Blueprint graph editor & debugger", () => {
  it("supports pin-aware node search and bidirectional Simple rule conversion", () => {
    const execTargets = searchNodesForPin("spring", {
      requiredPinDirection: "input",
      requiredPinType: "exec",
    });
    assert.ok(execTargets.some((s) => s.type === "interaction/springProperty"));

    const graph = openSimpleRuleAsGraph({
      id: "hero_hover",
      event: "hovered",
      subjectLayerId: "cta_btn",
      actions: [{ kind: "glow", targetLayerId: "cta_bg" }],
      feel: "snappy",
      intensity: "medium",
      enabled: true,
    });
    const roundTripped = tryConvertGraphToSimpleRule(graph);
    assert.ok(roundTripped);
    assert.equal(roundTripped.event, "hovered");
    assert.equal(roundTripped.actions[0]!.kind, "glow");
  });

  it("executes a 25-step authoring and Preview debugger journey deterministically", () => {
    // Steps 1-5: create graph and nodes
    let graph = ASTManager.createGraph("g_journey", "JourneyGraph", "event"); // step 1
    graph = {
      ...graph,
      nodes: {
        on_click: {
          id: "on_click",
          type: "interaction/onPointer",
          title: "On Pointer",
          position: { x: 40, y: 80 },
          customParams: { target: "cta_btn" },
        }, // step 2
        set_glow: {
          id: "set_glow",
          type: "interaction/setProperty",
          title: "Set Property",
          position: { x: 300, y: 80 },
          customParams: { target: "cta_bg", path: "effects.glow", value: 1 },
        }, // step 3
        delay_1: {
          id: "delay_1",
          type: "interaction/delay",
          title: "Delay",
          position: { x: 560, y: 80 },
          customParams: { durationSec: 0.05 },
        }, // step 4
      },
      wires: [
        {
          id: "w1",
          sourceNodeId: "on_click",
          sourcePinId: "exec",
          targetNodeId: "set_glow",
          targetPinId: "exec",
          pinType: "exec",
          isExec: true,
        },
        {
          id: "w2",
          sourceNodeId: "set_glow",
          sourcePinId: "exec",
          targetNodeId: "delay_1",
          targetPinId: "exec",
          pinType: "exec",
          isExec: true,
        },
      ], // step 5
    };

    // Steps 6-9: add variable + insert reroute + verify structure
    graph = upsertGraphVariable(graph, {
      id: "var_clicks",
      name: "clicks",
      type: "number",
      defaultValue: 0,
    }); // step 6
    assert.equal(graph.variables.length, 1); // step 7
    graph = insertRerouteOnWire(graph, "w1", "reroute_1", { x: 170, y: 80 }); // step 8
    assert.ok(graph.nodes.reroute_1); // step 9

    // Steps 10-12: add editor state + comment box + verify comment membership
    let editorState: BlueprintEditorState = {
      activeGraphId: "g_journey",
      graphs: { g_journey: graph },
      comments: {},
    }; // step 10
    editorState = addCommentBox(editorState, "g_journey", {
      id: "cmt_1",
      text: "Glow & pause sequence",
      x: 260,
      y: 40,
      width: 420,
      height: 160,
      nodeIds: ["set_glow", "delay_1"],
    }); // step 11
    assert.equal(editorState.comments.g_journey!.length, 1); // step 12

    // Steps 13-15: collapse selection into function & assert function graph + call node
    const collapsed = collapseSelectionToFunction(
      editorState,
      "g_journey",
      ["set_glow", "delay_1"],
      "RunGlowSequence"
    ); // step 13
    editorState = collapsed.state;
    assert.ok(editorState.graphs[collapsed.functionGraphId]); // step 14
    assert.ok(editorState.graphs.g_journey!.nodes[collapsed.callNodeId]); // step 15

    // Steps 16-25: instantiate debugger on original graph, set breakpoint + watch, enqueue event, step
    const dbg = createBlueprintDebugSession([graph]); // step 16
    dbg.addBreakpoint("on_click"); // step 17
    dbg.addWatch("ctaGlow", "cta_bg.effects.glow"); // step 18
    dbg.enqueueEvent({ eventType: "pointer", target: "cta_btn" }); // step 19
    const s1 = dbg.stepFrame(1 / 60); // step 20
    assert.equal(dbg.isPausedOnBreakpoint(), "on_click"); // step 21
    assert.ok(s1.traceLog.length >= 1); // step 22
    const pulses = dbg.getWirePulses(); // step 23
    assert.ok(pulses.length >= 1);
    const s2 = dbg.continueExecution(0.05); // step 24
    assert.equal(dbg.isPausedOnBreakpoint(), null);
    assert.ok(dbg.getEventLog().length >= s1.traceLog.length); // step 25
    assert.equal(s2.frame, 2);
  });
});
