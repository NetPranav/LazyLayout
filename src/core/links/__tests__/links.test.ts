import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import { evaluate } from "../../kernel/evaluate";
import { sampleCubicBezier } from "../../kernel/easing";
import { animatedLayers, animatedPaths, styleWrites } from "../../engine/stage/styleWrites";
import { tryRunCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { LINK_SLOTS, describeChain, findLinkCycle, isLinkable, linkCycleIf, linkPath, mapValue, readLinks, suggestMap } from "../linkModel";
import { registerLinkCommands } from "../linkCommands";

const layer = (id: string, name: string, properties: Record<string, PropValue> = {}): Layer => ({ ...(createLayer({ id, archetype: "container", parentId: null, name, properties: { "frame.width": 100, "frame.height": 100, ...properties } }) as Layer) });
const link = (slot: number, target: string, source: string, sourceProperty: string, extra: Record<string, PropValue> = {}): Record<string, PropValue> => {
  const out: Record<string, PropValue> = { [linkPath(slot, "target")]: target, [linkPath(slot, "source")]: source, [linkPath(slot, "sourceProperty")]: sourceProperty };
  for (const [k, v] of Object.entries(extra)) out[linkPath(slot, k)] = v;
  return out;
};
const doc = (layers: Layer[], clips: ReturnType<typeof attachClip>[] = []): MotionDocument => createDocumentFromLayers(layers, clips);
const ev = (d: MotionDocument, id: string, path: string, t = 0) => evaluate(d, "comp_main", id, t)[path];
const slide = (layerId: string, property: string, from: number, to: number) => attachClip(hydrateClip({ name: `Move ${property}`, type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property, keyframes: [{ time: 0, value: from }, { time: 1, value: to }] }] }), layerId);
const close = (a: unknown, b: number, msg?: string) => assert.ok(Math.abs((a as number) - b) < 1e-6, `${msg ?? ""} ${String(a)} vs ${b}`);

describe("Phase 76: link golden tests (a number carried across a map)", () => {
  it("direct: the rotation is the other layer's x", () => {
    const d = doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x")), layer("b", "Null", { "transform.x": 30 })]);
    assert.equal(ev(d, "a", "transform.rotate"), 30);
  });
  it("range: 0 to 400 px becomes 0 to 90 degrees, clamped, unclamped, or reversed", () => {
    const at = (x: number, extra: Record<string, PropValue>) => ev(doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x", { map: "range", inMin: 0, inMax: 400, outMin: 0, outMax: 90, ...extra })), layer("b", "Null", { "transform.x": x })]), "a", "transform.rotate");
    close(at(100, {}), 22.5);
    close(at(400, {}), 90);
    close(at(500, {}), 90, "clamped");
    close(at(500, { clamp: false }), 112.5, "unclamped goes on");
    close(at(-100, {}), 0);
    close(at(100, { outMin: 90, outMax: 0 }), 67.5, "a reversed output range reverses it");
    close(at(100, { inMin: 400, inMax: 0 }), 67.5, "and so does a reversed input range");
    close(at(100, { inMin: 50, inMax: 50 }), 0, "an input range with no width gives the start");
  });
  it("curve: the position in the range goes through the easing first", () => {
    const at = (x: number) => (ev(doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x", { map: "curve", curve: "cubic-bezier(0.25, 0.1, 0.25, 1)", inMin: 0, inMax: 400, outMin: 0, outMax: 100 })), layer("b", "Null", { "transform.x": x })]), "a", "transform.rotate") as number);
    close(at(0), 0);
    close(at(400), 100);
    close(at(100), 100 * sampleCubicBezier(0.25, 0.1, 0.25, 1, 0.25), "a quarter of the way");
    assert.ok(Math.abs(at(200) - 80.24) < 0.01, `CSS ease at the half-way mark is 0.8024: ${at(200)}`);
    assert.equal(mapValue({ map: "curve", clamp: true, curve: "nonsense", inMin: 0, inMax: 1, outMin: 0, outMax: 10 }, 0.5), 5, "an unknown curve is linear");
  });
  it("an animated source animates the target: five times to the digit", () => {
    const d = doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x", { map: "range", inMin: 0, inMax: 400, outMin: 0, outMax: 90 })), layer("b", "Null")], [slide("b", "transform.x", 0, 400)]);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) close(ev(d, "a", "transform.rotate", t), 90 * t, `at ${t}`);
  });
  it("chains: a link can read a property that is itself linked", () => {
    const d = doc([
      layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x")),
      layer("b", "Null", link(1, "transform.x", "c", "transform.x", { map: "range", inMin: 0, inMax: 100, outMin: 0, outMax: 200 })),
      layer("c", "Driver", { "transform.x": 50 }),
    ]);
    assert.equal(ev(d, "b", "transform.x"), 100);
    assert.equal(ev(d, "a", "transform.rotate"), 100, "the whole chain");
  });
  it("a layer can drive one of its own properties from another of its own", () => {
    const d = doc([layer("a", "Hero", { ...link(1, "transform.rotate", "a", "transform.x", { map: "range", inMin: 0, inMax: 100, outMin: 0, outMax: 360 }), "transform.x": 25 })]);
    close(ev(d, "a", "transform.rotate"), 90);
    const moving = doc([layer("a", "Hero", link(1, "transform.rotate", "a", "transform.x"))], [slide("a", "transform.x", 0, 80)]);
    close(ev(moving, "a", "transform.rotate", 0.5), 40, "it follows the animated x");
  });
  it("a link wins over the target's own animation", () => {
    const d = doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x")), layer("b", "Null", { "transform.x": 12 })], [slide("a", "transform.rotate", 0, 360)]);
    for (const t of [0, 0.5, 1]) assert.equal(ev(d, "a", "transform.rotate", t), 12);
  });
  it("several links on one layer, each driving its own property", () => {
    const d = doc([layer("a", "Hero", { ...link(1, "transform.rotate", "b", "transform.x"), ...link(2, "transform.y", "b", "transform.x", { map: "range", inMin: 0, inMax: 10, outMin: 0, outMax: 100 }), ...link(3, "appearance.opacity", "b", "transform.x", { map: "range", inMin: 0, inMax: 20, outMin: 0, outMax: 1 }) }), layer("b", "Null", { "transform.x": 10 })]);
    assert.deepEqual([ev(d, "a", "transform.rotate"), ev(d, "a", "transform.y"), ev(d, "a", "appearance.opacity")], [10, 100, 0.5]);
  });
  it("the linked position reaches the layer's world matrix (the stage draws it)", () => {
    const d = doc([layer("a", "Hero", link(1, "transform.x", "b", "transform.x")), layer("b", "Null", { "transform.x": 70 })]);
    const world = ev(d, "a", "transform.worldMatrix") as unknown as number[];
    assert.equal(world[4], 70);
  });
  it("a disabled link, a missing source layer or property, or a source that isn't a number leaves the target as it is", () => {
    const own = { "transform.rotate": 5 };
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...link(1, "transform.rotate", "b", "transform.x", { enabled: false }) }), layer("b", "Null", { "transform.x": 30 })]), "a", "transform.rotate"), 5);
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...link(1, "transform.rotate", "ghost", "transform.x") })]), "a", "transform.rotate"), 5);
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...link(1, "transform.rotate", "b", "transform.origin") }), layer("b", "Null", { "transform.origin": "top left" })]), "a", "transform.rotate"), 5);
  });
  it("a layer with no links is evaluated exactly as before", () => {
    const d = doc([layer("a", "Hero", { "transform.rotate": 9 })]);
    assert.equal(ev(d, "a", "transform.rotate"), 9);
    assert.deepEqual(readLinks(d.layers.a.properties), []);
  });
});

describe("Phase 76: cycles are refused, with the chain", () => {
  const a2b = () => doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x")), layer("b", "Null")]);
  it("finds the chain a new link would close", () => {
    const d = a2b();
    const chain = linkCycleIf(d, "b", { target: "transform.x", source: "a", sourceProperty: "transform.rotate" })!;
    assert.equal(describeChain(d, chain), "Null.transform.x ← Hero.transform.rotate ← Null.transform.x");
    assert.equal(linkCycleIf(d, "b", { target: "transform.y", source: "a", sourceProperty: "transform.rotate" }), null, "a different property of the same layer is fine");
  });
  it("a longer cycle shows every step", () => {
    const d = doc([layer("a", "A", link(1, "transform.x", "b", "transform.x")), layer("b", "B", link(1, "transform.x", "c", "transform.x")), layer("c", "C")]);
    const chain = linkCycleIf(d, "c", { target: "transform.x", source: "a", sourceProperty: "transform.x" })!;
    assert.equal(describeChain(d, chain), "C.transform.x ← A.transform.x ← B.transform.x ← C.transform.x");
  });
  it("a property can't follow itself", () => {
    assert.ok(linkCycleIf(a2b(), "a", { target: "transform.x", source: "a", sourceProperty: "transform.x" }));
  });
  it("a cycle already in a file is found, and evaluating it neither loops nor crashes", () => {
    const d = doc([layer("a", "A", { ...link(1, "transform.x", "b", "transform.x"), "transform.x": 3 }), layer("b", "B", { ...link(1, "transform.x", "a", "transform.x"), "transform.x": 4 })]);
    assert.ok(findLinkCycle(d));
    assert.equal(typeof ev(d, "a", "transform.x"), "number");
    assert.equal(findLinkCycle(a2b()), null);
  });
});

describe("Phase 76: the engine draws what the kernel says", () => {
  it("a driven property counts as animated, so the layer is on the kernel adapter and written every frame", () => {
    const d = doc([layer("a", "Hero", link(1, "transform.rotate", "b", "transform.x", { map: "range", inMin: 0, inMax: 400, outMin: 0, outMax: 90 })), layer("b", "Null")], [slide("b", "transform.x", 0, 400)]);
    assert.ok(animatedPaths(d, "a").has("transform.rotate"));
    assert.ok(animatedLayers(d).has("a"));
    for (const t of [0, 0.5, 1]) {
      const written = styleWrites(animatedPaths(d, "a"), evaluate(d, "comp_main", "a", t), "a").transform;
      assert.match(written, new RegExp(`rotate\\(${(90 * t).toString().replace(".", "\\.")}deg\\)|matrix|none`));
    }
  });
});

describe("Phase 76: the link commands (the pick-whip)", () => {
  const fresh = () => {
    setDocument(doc([layer("a", "Hero"), layer("b", "Null", { "transform.x": 40 })]));
    return registerLinkCommands();
  };
  const slotOf = (id: string) => readLinks(getDocument().layers[id].properties);

  it("links one property to another in a free slot, one undo step, and the target follows", () => {
    const off = fresh();
    try {
      const outcome = tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.x" });
      assert.equal(outcome.ok, true);
      assert.deepEqual((outcome as { result: { ok: boolean; slot: number; description: string } }).result, { ok: true, slot: 1, description: "Hero.transform.rotate ← Null.transform.x" });
      assert.equal(evaluate(getDocument(), "comp_main", "a", 0)["transform.rotate"], 40);
      historyCommands.undo();
      assert.deepEqual(slotOf("a"), []);
    } finally {
      off();
    }
  });
  it("linking the same property again replaces its link, in the same slot", () => {
    const off = fresh();
    try {
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.x" });
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.y", map: "range", inMin: 0, inMax: 10, outMin: 0, outMax: 1 });
      const links = slotOf("a");
      assert.equal(links.length, 1);
      assert.deepEqual([links[0].slot, links[0].sourceProperty, links[0].map, links[0].inMax], [1, "transform.y", "range", 10]);
    } finally {
      off();
    }
  });
  it("refuses a cycle with [LINK_CYCLE] and the chain, and writes nothing", () => {
    const off = fresh();
    try {
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.x" });
      const before = JSON.stringify(getDocument().layers.b.properties);
      const outcome = tryRunCommand("layer.setLink", { id: "b", targetProperty: "transform.x", sourceLayerId: "a", sourceProperty: "transform.rotate" });
      const result = (outcome as { result: { ok: boolean; code: string; message: string; chain: Array<{ layerId: string; property: string }> } }).result;
      assert.equal(result.ok, false);
      assert.equal(result.code, "LINK_CYCLE");
      assert.equal(result.message, "[LINK_CYCLE] Null.transform.x ← Hero.transform.rotate ← Null.transform.x");
      assert.deepEqual(result.chain.map((n) => `${n.layerId}.${n.property}`), ["b.transform.x", "a.transform.rotate", "b.transform.x"]);
      assert.equal(JSON.stringify(getDocument().layers.b.properties), before);
    } finally {
      off();
    }
  });
  it("refuses what can't be linked: a missing layer, a property that isn't a number, a bad curve, and a ninth link", () => {
    const off = fresh();
    try {
      const code = (args: Record<string, unknown>) => ((tryRunCommand("layer.setLink", args) as { result: { code?: string } }).result.code);
      assert.equal(code({ id: "a", targetProperty: "transform.rotate", sourceLayerId: "ghost", sourceProperty: "transform.x" }), "NO_SOURCE");
      assert.equal(code({ id: "a", targetProperty: "transform.origin", sourceLayerId: "b", sourceProperty: "transform.x" }), "NOT_LINKABLE");
      assert.equal(code({ id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "positioning" }), "NOT_LINKABLE");
      assert.equal(code({ id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.x", curve: "wobbly" }), "BAD_CURVE");
      const targets = ["transform.rotate", "transform.x", "transform.y", "transform.scale", "transform.scaleX", "transform.scaleY", "appearance.opacity", "appearance.radius"];
      for (const t of targets) assert.equal(tryRunCommand("layer.setLink", { id: "a", targetProperty: t, sourceLayerId: "b", sourceProperty: "transform.z" }).ok, true);
      assert.equal(slotOf("a").length, LINK_SLOTS);
      assert.equal(code({ id: "a", targetProperty: "transform.skewX", sourceLayerId: "b", sourceProperty: "transform.z" }), "LINK_SLOTS_FULL");
    } finally {
      off();
    }
  });
  it("removes a link by slot or by the property it drives, clearing its slot", () => {
    const off = fresh();
    try {
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.rotate", sourceLayerId: "b", sourceProperty: "transform.x" });
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "transform.y", sourceLayerId: "b", sourceProperty: "transform.x" });
      tryRunCommand("layer.removeLink", { id: "a", targetProperty: "transform.rotate" });
      assert.deepEqual(slotOf("a").map((l) => l.target), ["transform.y"]);
      assert.equal(getDocument().layers.a.properties[linkPath(1, "target")], undefined, "the slot is clear");
      tryRunCommand("layer.removeLink", { id: "a", slot: 2 });
      assert.deepEqual(slotOf("a"), []);
    } finally {
      off();
    }
  });
  it("suggests a range map when both properties have a range, otherwise direct", () => {
    assert.deepEqual(suggestMap("fx.1.radius", "mask.opacity"), { map: "range", inMin: 0, inMax: 200, outMin: 0, outMax: 1, clamp: true });
    assert.deepEqual(suggestMap("transform.x", "transform.rotate"), { map: "direct" });
    const off = fresh();
    try {
      tryRunCommand("layer.setLink", { id: "a", targetProperty: "mask.opacity", sourceLayerId: "b", sourceProperty: "fx.1.radius" });
      assert.deepEqual([slotOf("a")[0].map, slotOf("a")[0].inMax, slotOf("a")[0].outMax], ["range", 200, 1]);
    } finally {
      off();
    }
  });
  it("only numbers, lengths and angles can be linked", () => {
    assert.equal(isLinkable("transform.rotate", "container"), true);
    assert.equal(isLinkable("appearance.background.color", "container"), false);
    assert.equal(isLinkable("not.a.property", "container"), false);
  });
});
