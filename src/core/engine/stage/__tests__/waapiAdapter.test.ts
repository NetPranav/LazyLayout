import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../../document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "../../../document/compositions";
import type { Clip, MotionDocument } from "../../../document/schema";
import { evaluate } from "../../../kernel/evaluate";
import { StageAdapters } from "../StageAdapters";
import { WaapiAdapter, type WaapiAnimation, type WaapiElement } from "../WaapiAdapter";
import { canRunOnWaapi } from "../waapiEligibility";
import { styleWrites } from "../styleWrites";

type Frame = Record<string, string | number>;

class FakeAnimation implements WaapiAnimation {
  currentTime: number | null = 0;
  playbackRate = 1;
  state: "paused" | "running" | "canceled" = "running";
  id = "";
  constructor(readonly keyframes: Frame[], readonly duration: number) {}
  play() {
    this.state = "running";
  }
  pause() {
    this.state = "paused";
  }
  cancel() {
    this.state = "canceled";
  }
  /** The keyframe values at the current time, interpolated linearly the way the browser does between baked frames. */
  valueAt(property: string): string | number | undefined {
    const t = Math.min(1, Math.max(0, (this.currentTime ?? 0) / this.duration));
    const frames = this.keyframes.filter((f) => f[property] !== undefined);
    const i = frames.findIndex((f) => (f.offset as number) >= t);
    if (i <= 0) return frames[0]?.[property];
    const a = frames[i - 1];
    const b = frames[i];
    const av = parseFloat(String(a[property]));
    const bv = parseFloat(String(b[property]));
    if (Number.isFinite(av) && Number.isFinite(bv)) {
      const span = (b.offset as number) - (a.offset as number);
      const k = span === 0 ? 1 : (t - (a.offset as number)) / span;
      return av + (bv - av) * k;
    }
    return a[property];
  }
}

class FakeElement implements WaapiElement {
  animations: FakeAnimation[] = [];
  animate(keyframes: Frame[], options: { duration: number }) {
    const a = new FakeAnimation(keyframes, options.duration);
    this.animations.push(a);
    return a;
  }
}

const track = (property: string, from: number, to: number, ease = "linear") => ({
  id: `t_${property}_${from}_${to}`,
  property,
  keyframes: [{ id: "k0", time: 0, value: from }, { id: "k1", time: 1, value: to, ease }],
});

function build(tracks: Clip["tracks"]): { doc: MotionDocument; id: string } {
  const b = new DocBuilder();
  const id = b.layer("rectangle", "Box", null);
  b.clip(id, { name: "A", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks });
  return { doc: b.build(), id };
}

function setup(doc: MotionDocument, element = new FakeElement()) {
  const adapter = new WaapiAdapter();
  adapter.mount({ node: () => element as unknown as Element, getDocument: () => doc, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
  return { adapter, element };
}

describe("canRunOnWaapi", () => {
  it("accepts compositor and paint properties the rules route to css", () => {
    assert.equal(canRunOnWaapi(["transform.x", "appearance.opacity"]), true);
    assert.equal(canRunOnWaapi(["appearance.background.color", "frame.width", "frame.rotation"]), true);
  });
  it("sends svg-only, 3D, path and discrete properties to the kernel", () => {
    assert.equal(canRunOnWaapi(["svg.pathMorph"]), false);
    assert.equal(canRunOnWaapi(["scene3d.position"]), false);
    assert.equal(canRunOnWaapi(["transform.motionPath"]), false);
    assert.equal(canRunOnWaapi(["appearance.border.style"]), false);
    assert.equal(canRunOnWaapi([]), false);
  });
});

describe("WaapiAdapter", () => {
  it("bakes the kernel's curve, easing included, into one animation per layer", () => {
    const { doc, id } = build([track("appearance.opacity", 1, 0, "power2.inOut"), track("transform.x", 0, 100, "power3.out")]);
    const { adapter, element } = setup(doc);
    adapter.seek(0.4);
    assert.equal(element.animations.length, 1, "one animation covers every property of the layer");
    const [anim] = element.animations;
    assert.equal(anim.state, "paused", "seeking shows a frame, it does not play");
    assert.equal(anim.currentTime, 400);
    const expected = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.4);
    assert.ok(Math.abs((anim.valueAt("opacity") as number) - (expected["appearance.opacity"] as number)) < 0.005);
  });

  it("matches the kernel at five times for ten reference animations", () => {
    const refs: Array<[string, number, number, string]> = [
      ["appearance.opacity", 1, 0.2, "power1.inOut"],
      ["appearance.radius", 0, 40, "power2.out"],
      ["frame.width", 40, 160, "power1.out"],
      ["frame.height", 120, 30, "linear"],
      ["frame.x", 10, 300, "power3.out"],
      ["frame.y", 10, 150, "linear"],
      ["appearance.opacity", 0, 1, "power4.in"],
      ["appearance.radius", 40, 0, "power2.in"],
      ["frame.width", 400, 40, "power2.inOut"],
      ["frame.x", 300, 0, "power4.in"],
    ];
    const css: Record<string, string> = { "appearance.opacity": "opacity", "appearance.radius": "borderRadius", "frame.width": "width", "frame.height": "height", "frame.x": "left", "frame.y": "top" };
    for (const [property, from, to, ease] of refs) {
      const { doc, id } = build([track(property, from, to, ease)]);
      const { adapter, element } = setup(doc);
      for (const t of [0, 0.2, 0.5, 0.8, 1]) {
        adapter.seek(t);
        const expected = styleWrites([property], evaluate(doc, MAIN_COMPOSITION_ID, id, t));
        const name = Object.keys(expected)[0];
        const want = parseFloat(expected[name]);
        const got = parseFloat(String(element.animations[0].valueAt(css[property])));
        assert.ok(Math.abs(got - want) <= (property === "appearance.opacity" ? 0.005 : 0.5), `${property} at ${t}: ${got} vs ${want}`);
      }
    }
  });

  it("plays at the transport's rate from the transport's time", () => {
    const { doc } = build([track("transform.x", 0, 100)]);
    const { adapter, element } = setup(doc);
    adapter.play(0.25, 2);
    const [anim] = element.animations;
    assert.equal(anim.state, "running");
    assert.equal(anim.playbackRate, 2);
    assert.equal(anim.currentTime, 250);
    adapter.pause(0.5);
    assert.equal(anim.state, "paused");
    assert.equal(anim.currentTime, 500);
  });

  it("leaves a running animation alone while it agrees with the transport, and moves it when it doesn't", () => {
    const { doc } = build([track("transform.x", 0, 100)]);
    const { adapter, element } = setup(doc);
    adapter.play(0, 1);
    const [anim] = element.animations;
    anim.currentTime = 300;
    adapter.seek(0.3 + 1 / 60); // within two frames
    assert.equal(anim.currentTime, 300, "no write");
    adapter.seek(0.9); // the user clicked the ruler, or the loop wrapped
    assert.equal(anim.currentTime, 900);
  });

  it("bakes again, keeping the time and play state, when the document changes", () => {
    const first = build([track("transform.x", 0, 100)]);
    const holder = { doc: first.doc };
    const element = new FakeElement();
    const adapter = new WaapiAdapter();
    adapter.mount({ node: () => element as unknown as Element, getDocument: () => holder.doc, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    adapter.play(0.4, 1);
    holder.doc = build([track("transform.x", 0, 200)]).doc;
    adapter.invalidate();
    adapter.seek(0.4);
    assert.equal(element.animations[0].state, "canceled");
    const next = element.animations[1];
    assert.equal(next.state, "running");
    assert.equal(next.currentTime, 400);
  });

  it("cancels everything when disposed", () => {
    const { doc } = build([track("transform.x", 0, 100)]);
    const { adapter, element } = setup(doc);
    adapter.seek(0.5);
    adapter.dispose();
    assert.equal(element.animations[0].state, "canceled");
  });
});

describe("StageAdapters", () => {
  it("gives each animated layer to exactly one adapter", () => {
    const b = new DocBuilder();
    const smooth = b.layer("rectangle", "Smooth", null);
    const morph = b.layer("rectangle", "Morph", null);
    b.clip(smooth, { name: "A", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("appearance.opacity", 0, 1)] });
    b.clip(morph, { name: "B", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("appearance.border.style", 0, 1)] });
    const doc = b.build();
    const smoothEl = new FakeElement();
    const styled = { style: { values: new Map<string, string>(), setProperty(n: string, v: string) { this.values.set(n, v); }, removeProperty(n: string) { this.values.delete(n); return ""; }, getPropertyValue(n: string) { return this.values.get(n) ?? ""; } }, animate: () => { throw new Error("the kernel layer must not use WAAPI"); } };
    const engines = new StageAdapters({ waapi: true });
    engines.mount({
      node: (id) => (id === smooth ? (smoothEl as unknown as Element) : (styled as unknown as Element)),
      getDocument: () => doc,
      compositionId: () => MAIN_COMPOSITION_ID,
      fps: () => 60,
      duration: () => 1,
    });
    engines.play(0.5, 1); // Web Animations take a layer over while playing (Phase 59); scrubbing is the kernel's
    engines.seek(0.5);
    assert.equal(smoothEl.animations.length, 1);
    assert.equal(engines.kernel.stats.evaluations, 1, "the other layer is drawn by the kernel");
  });

  it("falls back to the kernel where Web Animations don't exist", () => {
    const { doc, id } = build([track("appearance.opacity", 0, 1)]);
    const values = new Map<string, string>();
    const el = { style: { setProperty: (n: string, v: string) => values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" } };
    const engines = new StageAdapters({ waapi: false });
    engines.mount({ node: () => el as unknown as Element, getDocument: () => doc, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    engines.seek(0.5);
    assert.equal(Number(values.get("opacity")), evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5)["appearance.opacity"]);
  });
});

describe("Phase 59: scrub vs play", () => {
  /** A stage with one layer Web Animations can run, one only the kernel can, and the elements they are drawn into. */
  function stage() {
    const b = new DocBuilder();
    const smooth = b.layer("rectangle", "Smooth", null);
    const morph = b.layer("rectangle", "Morph", null);
    b.clip(smooth, { name: "A", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("appearance.opacity", 0, 1, "power2.inOut")] });
    b.clip(morph, { name: "B", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("transform.motionPath", 0, 1)] });
    const doc = b.build();
    const values = new Map<string, string>();
    const smoothEl = Object.assign(new FakeElement(), {
      style: { setProperty: (n: string, v: string) => values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" },
    });
    const kernelOnly = new Map<string, string>();
    const morphEl = {
      style: { setProperty: (n: string, v: string) => kernelOnly.set(n, v), removeProperty: (n: string) => (kernelOnly.delete(n), ""), getPropertyValue: (n: string) => kernelOnly.get(n) ?? "" },
      animate: () => {
        throw new Error("the kernel-only layer must never become a Web Animation");
      },
    };
    const engines = new StageAdapters({ waapi: true });
    engines.mount({
      node: (id) => (id === smooth ? (smoothEl as unknown as Element) : (morphEl as unknown as Element)),
      getDocument: () => doc,
      compositionId: () => MAIN_COMPOSITION_ID,
      fps: () => 60,
      duration: () => 1,
    });
    return { engines, smooth, doc, smoothEl, values };
  }

  it("scrubbing draws every layer with the kernel and runs no Web Animation", () => {
    const { engines, smoothEl, values, smooth, doc } = stage();
    engines.seek(0.4);
    assert.equal(smoothEl.animations.filter((a) => a.state !== "canceled").length, 0);
    assert.equal(Number(values.get("opacity")), evaluate(doc, MAIN_COMPOSITION_ID, smooth, 0.4)["appearance.opacity"]);
  });

  it("playing hands a routed layer to Web Animations at the transport's time and rate, and gives back the kernel's styles", () => {
    const { engines, smoothEl, values } = stage();
    engines.seek(0.4);
    assert.ok(values.has("opacity"));
    engines.play(0.4, 2);
    engines.seek(0.4); // the engine's next frame
    const live = smoothEl.animations.filter((a) => a.state !== "canceled");
    assert.equal(live.length, 1);
    assert.equal(live[0].state, "running");
    assert.equal(live[0].playbackRate, 2);
    assert.equal(live[0].currentTime, 400);
    assert.equal(values.has("opacity"), false, "the kernel's inline value is gone while the animation runs the layer");
  });

  it("pausing hands the layer back to the kernel at the paused time", () => {
    const { engines, smoothEl, values, smooth, doc } = stage();
    engines.play(0.2, 1);
    engines.pause(0.7);
    engines.seek(0.7);
    assert.equal(smoothEl.animations.filter((a) => a.state !== "canceled").length, 0);
    assert.equal(Number(values.get("opacity")), evaluate(doc, MAIN_COMPOSITION_ID, smooth, 0.7)["appearance.opacity"]);
  });

  it("a speed change while playing keeps the same animation", () => {
    const { engines, smoothEl } = stage();
    engines.play(0.1, 1);
    const [first] = smoothEl.animations;
    engines.play(0.1, 4);
    assert.equal(smoothEl.animations.length, 1, "no new animation");
    assert.equal(first.playbackRate, 4);
  });

  it("scrubbing again after a play leaves the layer exactly where the kernel puts it", () => {
    const { engines, values, smooth, doc } = stage();
    engines.play(0, 1);
    engines.pause(0.3);
    engines.seek(0.3);
    for (const t of [0.9, 0.1, 0.55]) {
      engines.seek(t);
      assert.equal(Number(values.get("opacity")), evaluate(doc, MAIN_COMPOSITION_ID, smooth, t)["appearance.opacity"], `at ${t}`);
    }
  });
});

describe("WaapiAdapter bake cache (performance, 2026-11-18)", () => {
  function twoLayers() {
    const b = new DocBuilder();
    const a = b.layer("rectangle", "A", null);
    const c = b.layer("rectangle", "C", null);
    b.clip(a, { name: "A", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("transform.x", 0, 100)] });
    b.clip(c, { name: "C", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("transform.x", 0, 50)] });
    return { doc: b.build(), a, c };
  }

  it("an edit to one layer re-samples only that layer and keeps the other's running animation", () => {
    const { doc, a, c } = twoLayers();
    let current = doc;
    const els = new Map([[a, new FakeElement()], [c, new FakeElement()]]);
    const adapter = new WaapiAdapter();
    adapter.mount({ node: (id) => els.get(id) as unknown as Element, getDocument: () => current, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    adapter.seek(0.5);
    assert.equal(adapter.stats.samples, 2);
    const cAnimation = els.get(c)!.animations[0];

    // edit layer A only (structural sharing: C's objects keep their identity)
    current = { ...doc, layers: { ...doc.layers, [a]: { ...doc.layers[a]!, name: "A2" } } };
    adapter.invalidate();
    adapter.seek(0.6);
    assert.equal(adapter.stats.samples, 3, "only A was sampled again");
    assert.equal(els.get(c)!.animations.length, 1, "C's animation was not recreated");
    assert.notEqual(cAnimation.state, "canceled");
  });

  it("prebake samples ahead of time, so the next seek samples nothing", () => {
    const { doc, a, c } = twoLayers();
    const els = new Map([[a, new FakeElement()], [c, new FakeElement()]]);
    const adapter = new WaapiAdapter();
    adapter.mount({ node: (id) => els.get(id) as unknown as Element, getDocument: () => doc, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    assert.equal(adapter.prebake(() => 50), true);
    assert.equal(adapter.stats.samples, 2);
    adapter.seek(0.3);
    assert.equal(adapter.stats.samples, 2, "seek found the keyframes ready");
    assert.equal(els.get(a)!.animations.length, 1);
  });

  it("prebake stops when the idle time runs out and says it isn't done", () => {
    const { doc, a, c } = twoLayers();
    const els = new Map([[a, new FakeElement()], [c, new FakeElement()]]);
    const adapter = new WaapiAdapter();
    adapter.mount({ node: (id) => els.get(id) as unknown as Element, getDocument: () => doc, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    assert.equal(adapter.prebake(() => 0), false);
    assert.equal(adapter.stats.samples, 0);
  });

  it("a change to the clip's own keyframes re-samples that layer", () => {
    const { doc, a, c } = twoLayers();
    let current = doc;
    const els = new Map([[a, new FakeElement()], [c, new FakeElement()]]);
    const adapter = new WaapiAdapter();
    adapter.mount({ node: (id) => els.get(id) as unknown as Element, getDocument: () => current, compositionId: () => MAIN_COMPOSITION_ID, fps: () => 60, duration: () => 1 });
    adapter.seek(0.5);
    const clipId = Object.values(doc.clips).find((cl) => cl.layerId === a)!.id;
    current = { ...doc, clips: { ...doc.clips, [clipId]: { ...doc.clips[clipId]!, tracks: [track("transform.x", 0, 300)] } } };
    adapter.invalidate();
    adapter.seek(0.5);
    assert.equal(adapter.stats.samples, 3);
    assert.equal(els.get(a)!.animations.length, 2, "A got a new animation with the new keyframes");
  });
});

describe("WaapiAdapter inputs compared by value (performance, 2026-11-18)", () => {
  it("the same inputs in a new object keep the cached bakes", () => {
    const b = new DocBuilder();
    const id = b.layer("rectangle", "A", null);
    b.clip(id, { name: "A", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("transform.x", 0, 100)] });
    const doc = b.build();
    const { adapter } = setup(doc);
    adapter.seek(0.2);
    adapter.setInputs({ scrollClipTime: {} } as never);
    adapter.seek(0.3);
    const after = adapter.stats.samples;
    adapter.setInputs({ scrollClipTime: {} } as never);
    adapter.seek(0.4);
    assert.equal(adapter.stats.samples, after, "no re-sample for equal inputs");
  });
});
