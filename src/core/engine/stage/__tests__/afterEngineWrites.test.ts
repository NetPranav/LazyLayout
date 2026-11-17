import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FrameScheduler } from "../../../time/scheduler";
import { LayerNodeRegistry } from "../../../render/LayerNodeRegistry";
import type { StageRenderer } from "../../../render/StageRenderer";
import { afterEngineWrites, installStageEngine } from "../StageEngine";
import type { EngineAdapter } from "../types";

/** An adapter that logs what it is asked to do, so the order of writes and listeners can be checked. */
function loggingAdapter(log: string[], failSeek = false): EngineAdapter {
  return {
    id: "log",
    capabilities: { scrub: true, deterministic: true, offMainThread: false },
    mount: () => {},
    play: () => log.push("play"),
    pause: () => log.push("pause"),
    seek: () => {
      log.push("seek");
      if (failSeek) throw new Error("seek failed");
    },
    setInputs: () => {},
    currentTime: () => null,
    invalidate: () => {},
    dispose: () => {},
  };
}

function setup(failSeek = false) {
  const log: string[] = [];
  const scheduler = new FrameScheduler(null);
  scheduler.setDeterministic(true);
  const renderer = { registry: new LayerNodeRegistry() } as unknown as StageRenderer;
  const uninstall = installStageEngine(renderer, { scheduler, adapter: loggingAdapter(log, failSeek), parity: false });
  return { log, scheduler, uninstall };
}

describe("afterEngineWrites", () => {
  it("is told after each frame the engine draws, after its writes", () => {
    const { log, scheduler, uninstall } = setup();
    const off = afterEngineWrites(() => log.push("after"));
    scheduler.step(1 / 60);
    assert.deepEqual(log, ["seek", "after"], "the first frame draws, then the listener hears of it");
    log.length = 0;
    scheduler.step(1 / 60);
    assert.deepEqual(log, ["after"], "a frame with nothing to draw still ends with the listener (it only drops what it saw)");
    off();
    log.length = 0;
    scheduler.step(1 / 60);
    assert.deepEqual(log, [], "an unsubscribed listener hears nothing");
    uninstall();
  });

  it("is told even when the frame's writes fail, so a page watcher never keeps the engine's changes", () => {
    const { log, scheduler, uninstall } = setup(true);
    const off = afterEngineWrites(() => log.push("after"));
    scheduler.step(1 / 60); // the scheduler catches the failing task and counts it
    assert.deepEqual(log, ["seek", "after"]);
    off();
    uninstall();
  });

  it("stops being told once the engine is uninstalled", () => {
    const { log, scheduler, uninstall } = setup();
    const off = afterEngineWrites(() => log.push("after"));
    uninstall();
    scheduler.step(1 / 60);
    assert.deepEqual(log, []);
    off();
  });
});
