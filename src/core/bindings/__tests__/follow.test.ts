import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema, type Binding } from "../../document/signals";
import type { Frame, Value } from "../evaluate";
import { DEFAULT_FOLLOW, PRESET_PIN_NAMES, followDrafts, pinOnPage } from "../follow";
import { createBindingRuntime, type BindingHost } from "../runtime";

const box = { x: 100, y: 50, width: 200, height: 100 };
const host: BindingHost = { layersOf: (s) => (s.kind === "layer" ? [s.ref] : []), base: () => undefined, env: { pointerCoarse: false, reducedMotion: false, breakpoint: "", states: new Set() } };
const bindings = (opts = DEFAULT_FOLLOW): Binding[] => followDrafts("L", box, opts).map((d, i) => BindingSchema.parse({ ...d, id: `b${i}`, ownerLayerId: "L", enabled: true }));
const frame = (x: number, y: number, t: number): Frame => ({ time: t, dt: 1 / 60, seed: 0, read: (s) => (s.kind === "pointerIn" ? ([x, y] as Value) : 0) });

describe("Follow (D6)", () => {
  it("builds one driver per axis, both valid bindings", () => {
    assert.equal(followDrafts("L", box, DEFAULT_FOLLOW).length, 2);
    assert.equal(followDrafts("L", box, { ...DEFAULT_FOLLOW, axis: "x" }).length, 1);
    assert.equal(followDrafts("L", box, { ...DEFAULT_FOLLOW, axis: "y" }).length, 1);
    bindings();
  });

  it("with no lag the chosen pin lands exactly on the pointer, for every one of the nine pins", () => {
    const pinAt: Record<string, [number, number]> = { topLeft: [0, 0], top: [100, 0], topRight: [200, 0], left: [0, 50], center: [100, 50], right: [200, 50], bottomLeft: [0, 100], bottom: [100, 100], bottomRight: [200, 100] };
    for (const pin of PRESET_PIN_NAMES) {
      const rt = createBindingRuntime(bindings({ ...DEFAULT_FOLLOW, pin, lag: 0 }), host);
      const out = rt.step(frame(640, 410, 0)).get("L")!;
      const [px, py] = pinAt[pin];
      assert.equal(box.x + px + out.get("transform.x")!, 640, `${pin} x`);
      assert.equal(box.y + py + out.get("transform.y")!, 410, `${pin} y`);
    }
  });

  it("the offset moves where the pin lands", () => {
    const rt = createBindingRuntime(bindings({ ...DEFAULT_FOLLOW, pin: "bottom", lag: 0, offsetX: 12, offsetY: -30 }), host);
    const out = rt.step(frame(500, 400, 0)).get("L")!;
    assert.equal(box.x + 100 + out.get("transform.x")!, 512);
    assert.equal(box.y + 100 + out.get("transform.y")!, 370);
  });

  it("lag eases toward the pointer and arrives, the same at 30 and 120 fps", () => {
    const run = (fps: number) => {
      const rt = createBindingRuntime(bindings({ ...DEFAULT_FOLLOW, pin: "center", lag: 0.2 }), host);
      let x = 0;
      rt.step({ time: 0, dt: 1 / fps, seed: 0, read: () => [box.x + 100, box.y + 50] as Value }); // start with the pin on the pointer
      for (let i = 1; i <= fps * 1.5; i++) x = rt.step({ time: i / fps, dt: 1 / fps, seed: 0, read: () => [700, 50 + 50] as Value }).get("L")!.get("transform.x")!;
      return box.x + 100 + x;
    };
    assert.ok(Math.abs(run(30) - 700) < 2);
    assert.ok(Math.abs(run(120) - 700) < 2);
    assert.ok(Math.abs(run(30) - run(120)) < 2);
  });

  it("one axis leaves the other alone", () => {
    const out = createBindingRuntime(bindings({ ...DEFAULT_FOLLOW, axis: "x", lag: 0 }), host).step(frame(300, 300, 0)).get("L")!;
    assert.ok(out.has("transform.x"));
    assert.ok(!out.has("transform.y"));
  });

  describe("a layer that is turned or scaled (the pin is the layer's own point)", () => {
    const b = { x: 100, y: 50, width: 200, height: 100 }; // centre (200, 100)
    it("pinOnPage at hand-computed poses", () => {
      const near = (a: [number, number], w: [number, number], m: string) => assert.ok(Math.abs(a[0] - w[0]) < 1e-9 && Math.abs(a[1] - w[1]) < 1e-9, `${m}: ${a} vs ${w}`);
      near(pinOnPage(b, "right"), [300, 100], "no pose");
      near(pinOnPage(b, "right", { rotate: 90 }), [200, 200], "right pin, turned a quarter clockwise, is below the centre");
      near(pinOnPage(b, "right", { rotate: 180 }), [100, 100], "turned a half");
      near(pinOnPage(b, "top", { rotate: 90 }), [250, 100], "top pin, turned a quarter, is to the right");
      near(pinOnPage(b, "bottomRight", { rotate: 90 }), [150, 200], "corner turned");
      near(pinOnPage(b, "right", { scaleX: 2 }), [400, 100], "scaled 2x sideways");
      near(pinOnPage(b, "bottom", { scaleY: 0.5 }), [200, 125], "scaled to half");
      near(pinOnPage(b, "right", { rotate: 90, scaleX: 2 }), [200, 300], "turned and scaled: scale first, then turn");
      near(pinOnPage(b, "center", { rotate: 33, scaleX: 3 }), [200, 100], "the centre does not move");
    });
    it("with no lag the layer's own pin lands on the pointer, turned and scaled or not", () => {
      for (const pose of [{}, { rotate: 90, frameRotation: 90 }, { rotate: -37, frameRotation: -37 }, { rotate: 180, scaleX: 1.5, scaleY: 1.5, frameRotation: 180 }, { rotate: 45, scaleX: 2, scaleY: 0.5, frameRotation: 45 }, { rotate: 70, frameRotation: 30 }]) {
        for (const pin of PRESET_PIN_NAMES) {
          const bound = followDrafts("L", b, { ...DEFAULT_FOLLOW, pin, lag: 0 }, pose).map((d, i) => BindingSchema.parse({ ...d, id: `p${i}`, ownerLayerId: "L", enabled: true }));
          const out = createBindingRuntime(bound, host).step(frame(640, 410, 0)).get("L")!;
          const [px, py] = pinOnPage(b, pin, pose);
          // the layer's offsets are in its own turned axes: on the page they are turned by the frame rotation
          const t = (((pose as { frameRotation?: number }).frameRotation ?? 0) * Math.PI) / 180;
          const tx = out.get("transform.x")!, ty = out.get("transform.y")!;
          const wx = tx * Math.cos(t) - ty * Math.sin(t), wy = tx * Math.sin(t) + ty * Math.cos(t);
          assert.ok(Math.abs(px + wx - 640) < 1e-6, `${pin} ${JSON.stringify(pose)} x`);
          assert.ok(Math.abs(py + wy - 410) < 1e-6, `${pin} ${JSON.stringify(pose)} y`);
        }
      }
    });
  });
});
