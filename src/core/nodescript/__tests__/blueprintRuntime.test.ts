import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BlueprintGraph } from "../../ast/ASTManager.js";
import { createBlueprintRuntime, type BlueprintRuntimeSnapshot } from "../blueprintRuntime.js";

function makeRefGraph(id: string, variant: number): BlueprintGraph {
  if (variant % 5 === 0) {
    // Pointer -> Delay (latent) -> ShowHide
    return {
      id,
      name: id,
      type: "event",
      variables: [],
      nodes: {
        evt: { id: "evt", type: "interaction/onPointer", title: "onPointer", position: { x: 0, y: 0 }, customParams: { target: `layer_${variant}` } },
        dly: { id: "dly", type: "interaction/delay", title: "delay", position: { x: 200, y: 0 }, customParams: { seconds: 0.1 } },
        act: { id: "act", type: "interaction/showHide", title: "showHide", position: { x: 400, y: 0 }, customParams: { target: `popup_${variant}`, visible: true } },
      },
      wires: [
        { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "dly", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "dly", sourcePinId: "completed", targetNodeId: "act", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
  }
  if (variant % 5 === 1) {
    // Hover -> SpringProperty (latent) -> PlaySound
    return {
      id,
      name: id,
      type: "event",
      variables: [],
      nodes: {
        evt: { id: "evt", type: "interaction/onHover", title: "onHover", position: { x: 0, y: 0 }, customParams: { target: `btn_${variant}` } },
        spr: { id: "spr", type: "interaction/springProperty", title: "spring", position: { x: 200, y: 0 }, customParams: { target: `btn_${variant}`, path: "transform.y", value: -10, time: 0.1 } },
        snd: { id: "snd", type: "interaction/playSound", title: "sound", position: { x: 400, y: 0 }, customParams: { soundId: "click" } },
      },
      wires: [
        { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "spr", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "spr", sourcePinId: "completed", targetNodeId: "snd", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
  }
  if (variant % 5 === 2) {
    // Key -> FlipFlop -> SetState(open/closed)
    return {
      id,
      name: id,
      type: "event",
      variables: [],
      nodes: {
        evt: { id: "evt", type: "interaction/onKey", title: "onKey", position: { x: 0, y: 0 }, customParams: { target: `menu_${variant}` } },
        ff: { id: "ff", type: "interaction/flipFlop", title: "flipFlop", position: { x: 200, y: 0 } },
        sA: { id: "sA", type: "interaction/setState", title: "open", position: { x: 400, y: 0 }, customParams: { machineId: `m_${variant}`, stateId: "open" } },
        sB: { id: "sB", type: "interaction/setState", title: "closed", position: { x: 400, y: 80 }, customParams: { machineId: `m_${variant}`, stateId: "closed" } },
      },
      wires: [
        { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "ff", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "ff", sourcePinId: "a", targetNodeId: "sA", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w3", sourceNodeId: "ff", sourcePinId: "b", targetNodeId: "sB", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
  }
  if (variant % 5 === 3) {
    // View -> DoOnce -> SetProperty
    return {
      id,
      name: id,
      type: "event",
      variables: [],
      nodes: {
        evt: { id: "evt", type: "interaction/onView", title: "onView", position: { x: 0, y: 0 }, customParams: { target: `sec_${variant}` } },
        once: { id: "once", type: "interaction/doOnce", title: "doOnce", position: { x: 200, y: 0 } },
        setp: { id: "setp", type: "interaction/setProperty", title: "setProperty", position: { x: 400, y: 0 }, customParams: { target: `sec_${variant}`, path: "appearance.opacity", value: 1 } },
      },
      wires: [
        { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "once", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "once", sourcePinId: "completed", targetNodeId: "setp", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
  }
  // Timer -> Sequence -> (Burst + Play)
  return {
    id,
    name: id,
    type: "event",
    variables: [],
    nodes: {
      evt: { id: "evt", type: "interaction/onTimer", title: "onTimer", position: { x: 0, y: 0 } },
      seq: { id: "seq", type: "interaction/sequence", title: "sequence", position: { x: 200, y: 0 } },
      a0: { id: "a0", type: "interaction/burst", title: "burst", position: { x: 400, y: 0 }, customParams: { emitter: `em_${variant}`, count: 12 } },
      a1: { id: "a1", type: "interaction/play", title: "play", position: { x: 400, y: 80 }, customParams: { compositionId: `comp_${variant}` } },
    },
    wires: [
      { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "seq", targetPinId: "exec", pinType: "exec", isExec: true },
      { id: "w2", sourceNodeId: "seq", sourcePinId: "then0", targetNodeId: "a0", targetPinId: "exec", pinType: "exec", isExec: true },
      { id: "w3", sourceNodeId: "seq", sourcePinId: "then1", targetNodeId: "a1", targetPinId: "exec", pinType: "exec", isExec: true },
    ],
  };
}

function runTape(graphs: readonly BlueprintGraph[]): BlueprintRuntimeSnapshot[] {
  const runtime = createBlueprintRuntime(graphs, { maxNodesPerFrame: 500 });
  const snapshots: BlueprintRuntimeSnapshot[] = [];

  for (let frame = 0; frame < 15; frame++) {
    if (frame === 0) {
      for (let i = 0; i < graphs.length; i++) {
        if (i % 5 === 0) runtime.enqueueEvent({ eventType: "pointer", target: `layer_${i}` });
        if (i % 5 === 1) runtime.enqueueEvent({ eventType: "hover", target: `btn_${i}` });
        if (i % 5 === 2) runtime.enqueueEvent({ eventType: "key", target: `menu_${i}` });
        if (i % 5 === 3) runtime.enqueueEvent({ eventType: "view", target: `sec_${i}` });
        if (i % 5 === 4) runtime.enqueueEvent({ eventType: "timer" });
      }
    }
    if (frame === 2) {
      for (let i = 0; i < graphs.length; i++) {
        if (i % 5 === 2) runtime.enqueueEvent({ eventType: "key", target: `menu_${i}` });
        if (i % 5 === 3) runtime.enqueueEvent({ eventType: "view", target: `sec_${i}` });
      }
    }
    snapshots.push(runtime.stepFrame(0.05));
  }
  return snapshots;
}

describe("Phase 161 · Blueprint runtime", () => {
  it("produces bit-identical timelines across repeated tape replays on 20 reference graphs", () => {
    const graphs = Array.from({ length: 20 }, (_, i) => makeRefGraph(`ref_${i}`, i));
    const runA = runTape(graphs);
    const runB = runTape(graphs);

    assert.deepEqual(runA, runB);

    const finalSnap = runA[runA.length - 1]!;
    // After delay (0.1s elapsed after frame 0 -> completes at frame 2/3), popups become visible
    assert.equal(finalSnap.visibility["popup_0"], true);
    // FlipFlop pressed twice (frame 0 -> "open", frame 2 -> "closed")
    assert.equal(finalSnap.stateMachines["m_2"], "closed");
    // Spring interpolated smoothly to -10
    assert.ok(Math.abs((finalSnap.properties["btn_1.transform.y"] as number) - -10) < 1e-6);
  });

  it("cancels pending latent continuations and enforces per-frame node execution budget", () => {
    const delayGraph = makeRefGraph("cancel-test", 0);
    const rt = createBlueprintRuntime([delayGraph]);
    rt.enqueueEvent({ eventType: "pointer", target: "layer_0" });
    const f1 = rt.stepFrame(0.02);
    assert.equal(f1.activeContinuations.length, 1);
    assert.equal(rt.cancelContinuation(f1.activeContinuations[0]!.continuationId), true);
    const f2 = rt.stepFrame(0.2);
    assert.equal(f2.visibility["popup_0"], undefined);

    // Infinite exec cycle guarded by maxNodesPerFrame
    const loopGraph: BlueprintGraph = {
      id: "cycle",
      name: "cycle",
      type: "event",
      variables: [],
      nodes: {
        evt: { id: "evt", type: "interaction/onPointer", title: "onPointer", position: { x: 0, y: 0 } },
        seq: { id: "seq", type: "interaction/sequence", title: "seq", position: { x: 100, y: 0 } },
      },
      wires: [
        { id: "w1", sourceNodeId: "evt", sourcePinId: "exec", targetNodeId: "seq", targetPinId: "exec", pinType: "exec", isExec: true },
        { id: "w2", sourceNodeId: "seq", sourcePinId: "then0", targetNodeId: "seq", targetPinId: "exec", pinType: "exec", isExec: true },
      ],
    };
    const guarded = createBlueprintRuntime([loopGraph], { maxNodesPerFrame: 25 });
    guarded.enqueueEvent({ eventType: "pointer" });
    const out = guarded.stepFrame(0.016);
    assert.equal(out.budgetExceededCount, 1);
  });
});
