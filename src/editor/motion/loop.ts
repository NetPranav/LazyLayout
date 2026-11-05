// The one animation loop ported from Nook (the owner's own product)
/**
 * An animation loop powered by frameScheduler (ROADMAP Phase 55).
 * It runs only while some spring is moving, and unregisters once every
 * spring is at rest, after snapping them to their exact targets and
 * painting the final frame. Nothing runs at rest.
 */

import { type Spring, settleAll, stepAll } from "./spring";
import { MOT } from "./presets";
import { frameScheduler, type FrameInfo } from "@/core/time/scheduler";

export interface FrameHost {
  register(task: (info: FrameInfo) => void): () => void;
  now(): number;
}

export const defaultHost: FrameHost = {
  register: (task) => frameScheduler.register("apply", task),
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
};

export interface Sim {
  sp: readonly Spring[];
  apply(): void;
  rest?(): void;
}

const activeSims: Sim[] = [];
let unregisterLoop: (() => void) | null = null;

function globalLoop(info: FrameInfo): void {
  const dt = Math.min(MOT.maxStep, Math.max(0, info.dt));
  const current = activeSims.slice();
  activeSims.length = 0;

  for (let i = 0; i < current.length; i++) {
    const s = current[i];
    stepAll(s.sp, dt, MOT.substeps);
    const done = settleAll(s.sp);
    if (!done && !activeSims.includes(s)) {
      activeSims.push(s);
    }
    s.apply();
    if (done && s.rest) {
      s.rest();
    }
  }

  if (activeSims.length === 0 && unregisterLoop) {
    unregisterLoop();
    unregisterLoop = null;
  }
}

/** Register a simulation to run in the global frame loop until it rests. */
export function simAdd(sim: Sim): void {
  if (!activeSims.includes(sim)) {
    activeSims.push(sim);
  }
  if (!unregisterLoop) {
    unregisterLoop = defaultHost.register(globalLoop);
  }
}

/** Remove a simulation from the active loop. */
export function simRemove(sim: Sim): void {
  const index = activeSims.indexOf(sim);
  if (index >= 0) {
    activeSims.splice(index, 1);
  }
  if (activeSims.length === 0 && unregisterLoop) {
    unregisterLoop();
    unregisterLoop = null;
  }
}

export interface LoopOptions {
  springs: readonly Spring[];
  /** Writes the current spring values to the DOM. Called once per frame. */
  paint: () => void;
  /** Longest step integrated per frame (s). */
  maxStep?: number;
  substeps?: number;
  host?: FrameHost;
}

export interface Loop {
  /** Start the loop if it is not running. Call after changing a target or velocity. */
  kick(): void;
  readonly running: boolean;
  /** Stop without settling (teardown). */
  stop(): void;
}

/**
 * Creates an independent loop instance (Nook IslandEngine pattern)
 */
export function createLoop({
  springs,
  paint,
  maxStep = MOT.maxStep,
  substeps = MOT.substeps,
  host = defaultHost,
}: LoopOptions): Loop {
  let unregister: (() => void) | null = null;

  function onFrame(info: FrameInfo) {
    const dt = Math.min(maxStep, Math.max(0, info.dt));
    stepAll(springs, dt, substeps);
    const done = settleAll(springs);
    if (done && unregister) {
      unregister();
      unregister = null;
    }
    paint();
  }

  return {
    kick() {
      if (unregister) return;
      unregister = host.register(onFrame);
    },
    get running() {
      return unregister !== null;
    },
    stop() {
      if (unregister) {
        unregister();
        unregister = null;
      }
    },
  };
}
