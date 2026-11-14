import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBinding, resolveLayerRefs, type Binding } from "../../document/signals";
import { createBindingRuntime, type BindingHost } from "../runtime";
import type { Frame, Value } from "../evaluate";

const ids: Record<string, string> = { hero: "lay_hero", ring: "lay_ring" };
const make = (text: string, id = "b1", extra: Partial<Binding> = {}): Binding => ({
  ...resolveLayerRefs(parseBinding(text), (n) => ids[n]),
  id,
  ownerLayerId: "lay_hero",
  enabled: true,
  ...extra,
});
const host = (base: Record<string, number> = {}): BindingHost => ({
  layersOf: (set) => (set.kind === "layer" ? [set.ref] : []),
  base: (layerId, path) => base[`${layerId}:${path}`],
  env: { pointerCoarse: false, reducedMotion: false, breakpoint: "desktop", states: new Set() },
});
const frame = (progress: number, t = 0): Frame => ({ time: t, dt: 1 / 60, seed: 0, read: (s) => ((s.kind === "scroll" ? progress : 0) as Value) });
const value = (out: ReturnType<ReturnType<typeof createBindingRuntime>["step"]>, layer: string, path: string) => out.get(layer)?.get(path);

describe("binding runtime (D4)", () => {
  const rotate = make("scroll.progress |> remap(0, 1, 360, 0)\n-> hero.transform.rotate");

  it("scroll progress drives a property, mapped by remap", () => {
    const rt = createBindingRuntime([rotate], host());
    assert.equal(rt.diagnostics.length, 0);
    assert.equal(value(rt.step(frame(0)), "lay_hero", "transform.rotate"), 360);
    assert.equal(value(rt.step(frame(0.5)), "lay_hero", "transform.rotate"), 180);
    assert.equal(value(rt.step(frame(1)), "lay_hero", "transform.rotate"), 0);
  });

  it("an offset (add) lands on top of the layer's own value", () => {
    const rt = createBindingRuntime([rotate], host({ "lay_hero:transform.rotate": 45 }));
    assert.equal(value(rt.step(frame(0.5)), "lay_hero", "transform.rotate"), 225);
  });

  it("opposite directions: a ring linked to the watch at x -1 turns the other way", () => {
    const watch = make("scroll.progress |> remap(0, 1, 0, 90)\n-> hero.transform.rotate", "b1");
    const ring = make("scroll.progress |> remap(0, 1, 0, -90)\n-> ring.transform.rotate", "b2");
    const rt = createBindingRuntime([watch, ring], host());
    const out = rt.step(frame(1));
    assert.equal(value(out, "lay_hero", "transform.rotate"), 90);
    assert.equal(value(out, "lay_ring", "transform.rotate"), -90);
  });

  it("opacity multiplies, and the result is clamped to the registry range", () => {
    const fade = make("scroll.progress |> remap(0, 1, 1, 3)\n-> hero.appearance.opacity");
    const rt = createBindingRuntime([fade], host({ "lay_hero:appearance.opacity": 0.5 }));
    assert.equal(value(rt.step(frame(1)), "lay_hero", "appearance.opacity"), 1); // 0.5 * 3 = 1.5, clamped to 1
  });

  it("two bindings on one property: replace by priority, then add, multiply and max", () => {
    const a = make("scroll.progress |> remap(0, 1, 10, 10)\n-> hero.transform.x blend replace", "a", { priority: 1 });
    const b = make("scroll.progress |> remap(0, 1, 20, 20)\n-> hero.transform.x blend replace", "b", { priority: 5 });
    const c = make("scroll.progress |> remap(0, 1, 3, 3)\n-> hero.transform.x blend add", "c");
    const rt = createBindingRuntime([a, b, c], host());
    assert.equal(value(rt.step(frame(0)), "lay_hero", "transform.x"), 23); // b wins the replace (priority 5), c adds 3
  });

  it("a disabled binding does nothing, and nothing enabled means the runtime is idle (it costs nothing)", () => {
    const off = createBindingRuntime([{ ...rotate, enabled: false }], host());
    assert.equal(off.idle, true);
    assert.equal(off.step(frame(0.3)).size, 0);
    assert.equal(createBindingRuntime([], host()).idle, true);
    assert.equal(createBindingRuntime([rotate], host()).idle, false);
  });

  it("a binding to a layout property is refused with SIG_LAYOUT", () => {
    const rt = createBindingRuntime([make("scroll.progress -> hero.layout.gap")], host());
    assert.equal(rt.diagnostics[0]?.code, "SIG_LAYOUT");
    assert.equal(rt.step(frame(1)).size, 0);
  });

  it("an unknown path and a not-yet-applied target kind are reported, not thrown", () => {
    const unknown = createBindingRuntime([make("scroll.progress -> hero.transform.nonsense")], host());
    assert.equal(unknown.diagnostics[0]?.code, "unknown-path");
    const css = createBindingRuntime([make("scroll.progress -> hero.uniform.uX")], host());
    assert.equal(css.diagnostics[0]?.code, "unsupported-target");
  });

  it("a guard decides when a binding applies: coarse pointers get another reaction", () => {
    const g = make("scroll.progress |> remap(0, 1, 0, 50)\n-> hero.transform.x when pointer.coarse = false");
    const mouse = createBindingRuntime([g], host());
    assert.equal(value(mouse.step(frame(1)), "lay_hero", "transform.x"), 50);
    const touch = createBindingRuntime([g], { ...host(), env: { ...host().env, pointerCoarse: true } });
    assert.equal(touch.step(frame(1)).size, 0);
  });

  it("state carries across frames and reset forgets it", () => {
    const smooth = make("scroll.progress |> smooth(0.2)\n-> hero.transform.x blend replace");
    const rt = createBindingRuntime([smooth], host());
    rt.step(frame(0));
    const mid = value(rt.step(frame(1, 1 / 60)), "lay_hero", "transform.x")!;
    assert.ok(mid > 0 && mid < 1);
    rt.reset();
    assert.equal(value(rt.step(frame(1)), "lay_hero", "transform.x"), 1); // the first frame after a reset starts from the input
  });

  describe("CSS variable targets", () => {
    it("a driver sets a CSS variable: the value comes back in vars, and no property is written", () => {
      const rt = createBindingRuntime([make("scroll.progress |> remap(0, 1, 0, 10)\n-> hero.cssvar.glow")], host());
      assert.equal(rt.diagnostics.length, 0);
      assert.equal(rt.idle, false);
      const out = rt.step(frame(0.5));
      assert.equal(out.size, 0);
      assert.equal(rt.vars.get("lay_hero")?.get("glow"), 5);
      rt.step(frame(1));
      assert.equal(rt.vars.get("lay_hero")?.get("glow"), 10);
    });

    it("two drivers on one variable: the higher priority wins, and a later one wins a tie", () => {
      const a = make("scroll.progress |> remap(0, 1, 0, 1)\n-> hero.cssvar.v", "a", { priority: 1 });
      const b = make("scroll.progress |> remap(0, 1, 100, 100)\n-> hero.cssvar.v", "b", { priority: 5 });
      const c = make("scroll.progress |> remap(0, 1, 7, 7)\n-> hero.cssvar.v", "c", { priority: 5 });
      const rt = createBindingRuntime([a, b, c], host());
      rt.step(frame(0.3));
      assert.equal(rt.vars.get("lay_hero")?.get("v"), 7);
    });

    it("a guard that fails leaves the variable unset; a disabled driver does nothing", () => {
      const g = make("scroll.progress -> hero.cssvar.v when pointer.coarse = false");
      const touch = createBindingRuntime([g], { ...host(), env: { ...host().env, pointerCoarse: true } });
      touch.step(frame(1));
      assert.equal(touch.vars.size, 0);
      const off = createBindingRuntime([{ ...g, enabled: false }], host());
      assert.equal(off.idle, true);
    });
  });
});
