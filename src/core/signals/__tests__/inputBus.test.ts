import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  busFrame,
  convertPagePoint,
  createHostInputBus,
  newBusState,
  type HostEventTargetLike,
  type InputSource,
} from "../inputBus";
import { toNumber } from "../../bindings/evaluate";

class MockTarget implements HostEventTargetLike {
  readonly listeners = new Map<string, Set<{ fn: (ev: unknown) => void; passive: boolean }>>();
  addEventListener(type: string, listener: (ev: unknown) => void, options?: AddEventListenerOptions | boolean) {
    const set = this.listeners.get(type) ?? new Set();
    const passive = typeof options === "object" ? !!options.passive : false;
    set.add({ fn: listener, passive });
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (ev: unknown) => void) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const item of set) if (item.fn === listener) set.delete(item);
  }
  emit(type: string, event: unknown) {
    for (const item of this.listeners.get(type) ?? []) item.fn(event);
  }
}

describe("Phase 132 — Unified Input Bus & Coordinate Spaces", () => {
  it("converts pointer coordinates across page, frame, parent, and local spaces in px, uv, and ndc", () => {
    const spaces = {
      page: { width: 1000, height: 800 },
      frame: { x: 100, y: 50, width: 800, height: 600 },
      parent: { x: 200, y: 150, width: 400, height: 300 },
      local: { x: 300, y: 200, width: 200, height: 100 },
    };
    const pt: readonly [number, number] = [400, 250];
    assert.deepEqual(convertPagePoint(pt, "px", "page", spaces), [400, 250]);
    assert.deepEqual(convertPagePoint(pt, "px", "frame", spaces), [300, 200]);
    assert.deepEqual(convertPagePoint(pt, "px", "parent", spaces), [200, 100]);
    assert.deepEqual(convertPagePoint(pt, "px", "local", spaces), [100, 50]);
    assert.deepEqual(convertPagePoint(pt, "uv", "layer-local", spaces), [0.5, 0.5]);
    assert.deepEqual(convertPagePoint(pt, "ndc", "local", spaces), [0, 0]);
  });

  it("handles rotated local layers and zero-dimension rects safely", () => {
    const spaces = {
      page: { width: 800, height: 600 },
      local: { x: 100, y: 100, width: 200, height: 100, rotationDeg: 90 },
    };
    // Center is (200, 150). Point (200, 100) is 50px straight up from center -> rotated back -90deg maps to local center-left
    const [u, v] = convertPagePoint([200, 100], "uv", "local", spaces);
    assert.ok(Math.abs(u - 0.25) < 1e-5);
    assert.ok(Math.abs(v - 0.5) < 1e-5);

    assert.deepEqual(
      convertPagePoint([10, 20], "ndc", "local", {
        page: { width: 0, height: 0 },
        local: { x: 0, y: 0, width: 0, height: 0 },
      }),
      [-1, -1]
    );
  });

  it("resolves pointerIn across spaces in busFrame even for background/pointer-events-none layers", () => {
    const source: InputSource = {
      pointer: () => ({ x: 250, y: 150, down: false, coarse: false, pressure: 0, type: "mouse" }),
      pageSize: () => ({ width: 1000, height: 1000 }),
      scroll: () => ({ y: 0, max: 0 }),
      ownerLayerId: "bg-layer",
      frameRect: () => ({ x: 50, y: 50, width: 400, height: 400 }),
      parentRect: () => ({ x: 100, y: 100, width: 300, height: 300 }),
      layerRect: () => ({ x: 200, y: 100, width: 100, height: 100 }),
    };
    const frame = busFrame(source, newBusState(), 0, 1 / 60);
    assert.deepEqual(frame.read({ kind: "pointerIn", channel: "uv", space: "local" }), [0.5, 0.5]);
    assert.deepEqual(frame.read({ kind: "pointerIn", channel: "ndc", space: "local" }), [0, 0]);
    assert.deepEqual(frame.read({ kind: "pointerIn", channel: "px", space: "parent" }), [150, 50]);
    assert.deepEqual(frame.read({ kind: "pointerIn", channel: "px", space: "frame" }), [200, 100]);
    assert.deepEqual(frame.read({ kind: "pointerIn", channel: "uv", space: "page" }), [0.25, 0.15]);
  });

  it("registers one passive listener set per host, latches per frame, and cleans up on dispose", () => {
    const target = new MockTarget();
    const win = new MockTarget();
    let registeredTask: ((info: { now: number; dt: number; frame: number }) => void) | null = null;
    const bus = createHostInputBus({
      target,
      windowTarget: win,
      scheduler: {
        register: (_phase, task) => {
          registeredTask = task;
          return () => {
            registeredTask = null;
          };
        },
      },
      measurePageSize: () => ({ width: 1200, height: 800 }),
      measureScroll: () => ({ y: 120, max: 1000, viewport: 800 }),
    });

    for (const [ev, set] of target.listeners) {
      assert.equal(set.size, 1, `target listener count for ${ev}`);
      for (const l of set) assert.equal(l.passive, true);
    }

    target.emit("pointermove", { clientX: 300, clientY: 200, buttons: 0, pressure: 0, pointerType: "mouse" });
    target.emit("wheel", { deltaY: 42 });
    target.emit("keydown", { code: "KeyW" });
    assert.equal(bus.snapshot().pointer, null);

    registeredTask!({ now: 16.6, dt: 1 / 60, frame: 1 });
    assert.equal(bus.snapshot().pointer?.x, 300);
    assert.equal(bus.snapshot().pointer?.y, 200);
    assert.equal(bus.snapshot().scroll.wheelDeltaY, 42);
    assert.equal(bus.snapshot().keys.down.has("KeyW"), true);

    registeredTask!({ now: 33.2, dt: 1 / 60, frame: 2 });
    assert.equal(bus.snapshot().scroll.wheelDeltaY, 0);

    const f = busFrame(bus.inputSource, newBusState(), 0.016, 1 / 60);
    let acc = 0;
    for (let i = 0; i < 200; i++) acc += toNumber(f.read({ kind: "pointerIn", channel: "uv", space: "page" }));
    assert.ok(acc > 0);

    bus.dispose();
    assert.equal(bus.listenerCount, 0);
    for (const [, set] of target.listeners) assert.equal(set.size, 0);
    for (const [, set] of win.listeners) assert.equal(set.size, 0);
  });
});
