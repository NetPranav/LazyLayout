import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import { getPropertyDefinition } from "../../document/properties";
import type { PropValue } from "../../document/registry";
import { evaluate } from "../../kernel/evaluate";
import { animatedLayers, animatedPaths, fxFilters, styleWrites } from "../../engine/stage/styleWrites";
import { canRunOnWaapi } from "../../engine/stage/waapiEligibility";
import { routeAnimation } from "../../rules/routing";
import { EFFECT_ROUTES, MOTION_BLUR_ROUTE, routeEffect, routeStack } from "../../rules/effectRouting";
import { invokeCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { layerBoxStyle } from "../geometry";
import { resolveProps } from "../resolve";
import { readerOf } from "../compositing";
import { FX_DEFAULTS, FX_PARAMS, FX_SLOTS, FX_TYPES, fxCssFunctions, fxFilterSpec, fxStyle, hasFx, motionBlurSigma, readStack, type FxEffect } from "../fxStack";
import { registerFxCommands } from "../fxCommands";

const props = (extra: Record<string, PropValue>) => readerOf({ "frame.width": 100, "frame.height": 100, ...extra });
const effect = (type: FxEffect["type"], params: FxEffect["params"] = {}, slot = 1): FxEffect => ({ slot, type, enabled: true, params: { ...FX_DEFAULTS[type], ...params } });

describe("Phase 75: the stack's properties", () => {
  it("every slot has every property, legal on a container, neutral by default", () => {
    for (let slot = 1; slot <= FX_SLOTS; slot++) for (const name of ["type", "enabled", "radius", "color", "scale", "amount", "hueRotate"]) assert.ok(getPropertyDefinition(`fx.${slot}.${name}`), `fx.${slot}.${name}`);
    assert.equal(getPropertyDefinition("fx.1.type")!.default, "none");
    assert.equal(getPropertyDefinition("fx.3.radius")!.animatable, true);
    assert.equal(getPropertyDefinition("fx.3.color")!.interpolation, "color");
    assert.equal(getPropertyDefinition("fx.3.type")!.animatable, false);
    assert.equal(getPropertyDefinition("fx.9.type"), undefined, "eight slots");
    assert.equal(getPropertyDefinition("motion.shutterAngle")!.default, 180);
  });
  it("every effect's parameters are properties", () => {
    for (const type of FX_TYPES) for (const name of FX_PARAMS[type]) assert.ok(getPropertyDefinition(`fx.1.${name}`), `${type}: ${name}`);
  });
});

describe("Phase 75: reading and drawing the stack", () => {
  it("lists the effects in slot order, skipping empty slots and unknown types", () => {
    const stack = readStack(props({ "fx.1.type": "blur", "fx.1.radius": 4, "fx.3.type": "glow", "fx.3.radius": 9, "fx.3.color": "#0f0", "fx.5.type": "sparkle", "fx.6.type": "noise", "fx.6.enabled": false }));
    assert.deepEqual(stack.map((e) => [e.slot, e.type, e.enabled]), [[1, "blur", true], [3, "glow", true], [6, "noise", false]]);
    assert.equal(stack[1].params.color, "#0f0");
  });
  it("blur, glow, drop shadow and colour adjust are CSS filter functions; a change-nothing setting writes none", () => {
    assert.deepEqual(fxCssFunctions(effect("blur", { radius: 6 })), ["blur(6px)"]);
    assert.deepEqual(fxCssFunctions(effect("blur", { radius: 0 })), []);
    assert.deepEqual(fxCssFunctions(effect("dropShadow", { x: 2, y: 8, radius: 12, color: "#000000", opacity: 1 })), ["drop-shadow(2px 8px 12px #000000)"]);
    assert.match(fxCssFunctions(effect("dropShadow", { opacity: 0.35 }))[0], /^drop-shadow\(0px 8px 12px color-mix\(in srgb, #000000 35%, transparent\)\)$/);
    assert.deepEqual(fxCssFunctions(effect("dropShadow", { opacity: 0 })), []);
    assert.deepEqual(fxCssFunctions(effect("colorAdjust", { brightness: 1, contrast: 1.2, saturate: 0, hueRotate: 90 })), ["contrast(1.2)", "saturate(0)", "hue-rotate(90deg)"]);
    assert.deepEqual(fxCssFunctions(effect("colorAdjust")), []);
    const glow = fxCssFunctions(effect("glow", { radius: 10, intensity: 3, color: "#ffcc00", opacity: 1 }));
    assert.equal(glow.length, 3, "one shadow per step of intensity");
    assert.equal(glow[0], "drop-shadow(0px 0px 10px #ffcc00)");
    assert.deepEqual(fxCssFunctions(effect("displacement")), [], "an SVG effect has no CSS function");
  });
  it("a colour that isn't safe is replaced, not written", () => {
    assert.match(fxCssFunctions(effect("glow", { color: 'red); background: url(x' }))[0], /#ffffff/);
  });
  it("displacement and noise are SVG filters, one each, with the parameters in their primitives", () => {
    const d = fxFilterSpec("L1", effect("displacement", { scale: 30, frequency: 0.05, seed: 7 }, 2))!;
    assert.equal(d.id, "fxs-L1-2");
    assert.deepEqual(d.primitives.map((p) => p.tag), ["feTurbulence", "feDisplacementMap"]);
    assert.equal(d.primitives[1].attrs.scale, 30);
    assert.equal(d.primitives[0].attrs.baseFrequency, 0.05);
    assert.equal(d.region, 30);
    const n = fxFilterSpec("L1", effect("noise", { amount: 0.6 }, 3))!;
    assert.deepEqual(n.primitives.map((p) => p.tag), ["feTurbulence", "feColorMatrix", "feComposite", "feMerge"]);
    assert.match(String(n.primitives[1].attrs.values), /0\.4 0\.4 0\.4 0 0$/);
    assert.equal(fxFilterSpec("L1", effect("blur")), null);
  });
  it("without svg the stack is the CSS effects only (the export and the first paint); with svg the SVG ones sit in their place", () => {
    const read = props({ "fx.1.type": "blur", "fx.1.radius": 4, "fx.2.type": "displacement", "fx.2.scale": 10, "fx.3.type": "colorAdjust", "fx.3.saturate": 0 });
    assert.deepEqual(fxStyle("L", read, { svg: false }).functions, ["blur(4px)", "saturate(0)"]);
    const withSvg = fxStyle("L", read, { svg: true });
    assert.deepEqual(withSvg.functions, ["blur(4px)", "url(#fxs-L-2)", "saturate(0)"]);
    assert.deepEqual(withSvg.filters.map((f) => f.id), ["fxs-L-2"]);
  });
  it("a disabled effect isn't drawn, and the order is the slot order", () => {
    const read = props({ "fx.1.type": "blur", "fx.1.radius": 4, "fx.1.enabled": false, "fx.2.type": "colorAdjust", "fx.2.contrast": 2, "fx.3.type": "blur", "fx.3.radius": 9 });
    assert.deepEqual(fxStyle("L", read, { svg: true }).functions, ["contrast(2)", "blur(9px)"]);
  });
  it("the render definition draws the CSS effects after the layer's own filters", () => {
    const l = createLayer({ id: "l", archetype: "container", properties: { "frame.width": 100, "frame.height": 100, "filter.blur": 3, "fx.1.type": "blur", "fx.1.radius": 5, "fx.2.type": "displacement", "fx.2.scale": 9 } }) as Layer;
    assert.equal((layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>).filter, "blur(3px) blur(5px)");
  });
  it("hasFx: an enabled effect, or the motion blur switch", () => {
    assert.equal(hasFx({}, false), false);
    assert.equal(hasFx({ "fx.2.type": "blur" }, false), true);
    assert.equal(hasFx({ "fx.2.type": "blur", "fx.2.enabled": false }, false), false);
    assert.equal(hasFx({}, true), true);
  });
});

describe("Phase 75: the rules explain each effect's route", () => {
  it("every effect has a route and a reason, and CSS is used whenever it can say the effect", () => {
    for (const type of FX_TYPES) {
      const route = routeEffect(type);
      assert.ok(route.reason.length > 40, type);
      assert.equal(route.backend === "svg", type === "displacement" || type === "noise", type);
    }
    assert.deepEqual(routeStack(["blur", "noise"]).map((r) => [r.type, r.backend]), [["blur", "css"], ["noise", "svg"]]);
    assert.equal(MOTION_BLUR_ROUTE.backend, "svg");
  });
  it("agrees with the general routing rules and with what the stack really draws", () => {
    assert.equal(routeAnimation({ properties: ["feDisplacementMap"] }).backend, EFFECT_ROUTES.displacement.backend);
    assert.equal(routeAnimation({ properties: ["filter.blur"] }).backend, EFFECT_ROUTES.blur.backend);
    for (const type of FX_TYPES) {
      const e = effect(type, type === "colorAdjust" ? { saturate: 0 } : {});
      const css = fxCssFunctions(e).length > 0;
      const svg = fxFilterSpec("L", e) !== null;
      assert.equal(EFFECT_ROUTES[type].backend === "css", css && !svg, `${type}: the table says ${EFFECT_ROUTES[type].backend}`);
    }
  });
});

describe("Phase 75: a 4-effect stack matches evaluate() at five times", () => {
  const scene = (): MotionDocument => {
    const clip = attachClip(hydrateClip({ name: "Fx", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [
      { property: "fx.1.radius", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 12 }] },
      { property: "fx.2.y", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 20 }] },
      { property: "fx.3.saturate", keyframes: [{ time: 0, value: 1 }, { time: 1, value: 0 }] },
      { property: "fx.4.scale", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 40 }] },
    ] }), "l");
    const layer = createLayer({ id: "l", archetype: "container", parentId: null, properties: { "frame.width": 100, "frame.height": 100,
      "fx.1.type": "blur", "fx.1.radius": 0,
      "fx.2.type": "dropShadow", "fx.2.x": 0, "fx.2.y": 0, "fx.2.radius": 6, "fx.2.color": "#000000", "fx.2.opacity": 1,
      "fx.3.type": "colorAdjust", "fx.3.saturate": 1,
      "fx.4.type": "displacement", "fx.4.scale": 0, "fx.4.frequency": 0.03, "fx.4.seed": 2 } }) as Layer;
    return createDocumentFromLayers([layer], [clip]);
  };
  it("the written filter and the SVG filters carry the kernel's parameters", () => {
    const doc = scene();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const resolved = evaluate(doc, "comp_main", "l", t);
      const written = styleWrites(["fx.stack"], resolved, "l").filter;
      const expected = [t > 0 ? `blur(${Math.round(12 * t * 1000) / 1000}px)` : "", `drop-shadow(0px ${Math.round(20 * t * 1000) / 1000}px 6px #000000)`, t > 0 ? `saturate(${Math.round((1 - t) * 1000) / 1000})` : "", "url(#fxs-l-4)"].filter(Boolean).join(" ");
      assert.equal(written, expected, `at ${t}`);
      const [filter] = fxFilters("l", resolved);
      assert.equal(filter.id, "fxs-l-4");
      assert.equal(filter.primitives[1].attrs.scale, Math.round(40 * t * 1000) / 1000, `displacement scale at ${t}`);
    }
  });
  it("the engine plans the layer on the kernel, never as a Web Animation", () => {
    const doc = scene();
    assert.ok(animatedPaths(doc, "l").has("fx.stack"));
    assert.ok(animatedLayers(doc).has("l"));
    assert.equal(canRunOnWaapi(["fx.stack"]), false);
    assert.equal(canRunOnWaapi(["fx.1.radius"]), false);
  });
  it("a layer with no effects is left alone", () => {
    const plain = createDocumentFromLayers([createLayer({ id: "l", archetype: "container", parentId: null, properties: {} }) as Layer], []);
    assert.equal(animatedLayers(plain).has("l"), false);
    assert.equal(styleWrites(["appearance.opacity"], { "appearance.opacity": 1 }, "l").filter, undefined);
  });
});

describe("Phase 75: motion blur", () => {
  const moving = (extra: Partial<Layer> = {}, props: Record<string, PropValue> = {}): MotionDocument => {
    const clip = attachClip(hydrateClip({ name: "Slide", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property: "transform.x", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 600 }] }] }), "l");
    const layer = { ...(createLayer({ id: "l", archetype: "container", parentId: null, properties: { "frame.width": 100, "frame.height": 100, ...props } }) as Layer), ...extra } as Layer;
    return createDocumentFromLayers([layer], [clip]);
  };
  it("is opt-in: nothing without the layer's switch", () => {
    assert.equal(evaluate(moving(), "comp_main", "l", 0.5)["motion.blur.x"], undefined);
  });
  it("blurs along the motion by speed times exposure: 600 px/s at a 180 degree shutter and 60 fps is a 5 px smear", () => {
    const r = evaluate(moving({ motionBlur: true }), "comp_main", "l", 0.5);
    assert.ok(Math.abs((r["motion.blur.x"] as number) - 5 * 0.2887) < 0.01, String(r["motion.blur.x"]));
    assert.equal(r["motion.blur.y"], 0, "not moving down: no blur down");
  });
  it("a longer shutter blurs more; a layer that is still, or not yet moving, gets none", () => {
    const wide = evaluate(moving({ motionBlur: true }, { "motion.shutterAngle": 360 }), "comp_main", "l", 0.5)["motion.blur.x"] as number;
    const normal = evaluate(moving({ motionBlur: true }), "comp_main", "l", 0.5)["motion.blur.x"] as number;
    assert.ok(Math.abs(wide / normal - 2) < 0.01);
    const still = createDocumentFromLayers([{ ...(createLayer({ id: "l", archetype: "container", parentId: null, properties: { "frame.width": 100 } }) as Layer), motionBlur: true } as Layer], []);
    assert.equal(evaluate(still, "comp_main", "l", 0.5)["motion.blur.x"], undefined);
  });
  it("is a pure function of the time: scrubbing to a moment shows what playing there shows", () => {
    const doc = moving({ motionBlur: true });
    const a = evaluate(doc, "comp_main", "l", 0.37)["motion.blur.x"];
    evaluate(doc, "comp_main", "l", 0.9);
    assert.equal(evaluate(doc, "comp_main", "l", 0.37)["motion.blur.x"], a);
  });
  it("is drawn as an SVG Gaussian blur along the layer's own motion", () => {
    const resolved = evaluate(moving({ motionBlur: true }), "comp_main", "l", 0.5);
    const written = styleWrites(["fx.stack"], resolved, "l").filter;
    assert.equal(written, "url(#mb-l)");
    const [spec] = fxFilters("l", resolved);
    assert.equal(spec.primitives[0].tag, "feGaussianBlur");
    assert.match(String(spec.primitives[0].attrs.stdDeviation), /^1\.\d+ 0$/);
    assert.deepEqual(motionBlurSigma({ x: 0, y: 0 }, 60, 180), { x: 0, y: 0 });
  });
});

describe("Phase 75: the effect commands", () => {
  const fresh = () => {
    setDocument(createDocumentFromLayers([createLayer({ id: "a", archetype: "container", parentId: null, properties: { "frame.width": 100 } }) as Layer], []));
    return registerFxCommands();
  };
  const p = () => getDocument().layers.a.properties;
  const types = () => readStack(readerOf(p() as Record<string, PropValue>)).map((e) => e.type);

  it("add puts an effect in the next slot with its starting values; one undo step", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("layer.addEffect", { ids: ["a"], type: "blur" }), true);
      invokeCommand("layer.addEffect", { ids: ["a"], type: "dropShadow", params: { y: 20, nonsense: 1 } });
      assert.deepEqual(types(), ["blur", "dropShadow"]);
      assert.equal(p()["fx.1.radius"], FX_DEFAULTS.blur.radius);
      assert.equal(p()["fx.2.y"], 20);
      assert.equal(p()["fx.2.nonsense"], undefined, "a parameter the effect doesn't have is ignored");
      historyCommands.undo();
      assert.deepEqual(types(), ["blur"]);
    } finally {
      off();
    }
  });
  it("add at a position pushes the others down; a ninth effect is refused", () => {
    const off = fresh();
    try {
      for (const t of ["blur", "glow", "noise"] as const) invokeCommand("layer.addEffect", { ids: ["a"], type: t });
      invokeCommand("layer.addEffect", { ids: ["a"], type: "colorAdjust", at: 1 });
      assert.deepEqual(types(), ["colorAdjust", "blur", "glow", "noise"]);
      for (let i = 0; i < 6; i++) invokeCommand("layer.addEffect", { ids: ["a"], type: "blur" });
      assert.equal(types().length, FX_SLOTS);
      const refused = (getDocument(), invokeCommand("layer.addEffect", { ids: ["a"], type: "noise" }));
      assert.equal(refused, true, "the command runs and reports the refusal");
      assert.equal(types().length, FX_SLOTS);
    } finally {
      off();
    }
  });
  it("set changes a parameter or switches an effect off; remove closes the gap; move reorders", () => {
    const off = fresh();
    try {
      invokeCommand("layer.addEffect", { ids: ["a"], type: "blur" });
      invokeCommand("layer.addEffect", { ids: ["a"], type: "glow" });
      invokeCommand("layer.addEffect", { ids: ["a"], type: "noise" });
      invokeCommand("layer.setEffect", { ids: ["a"], slot: 1, params: { radius: 30, scale: 99 }, enabled: false });
      assert.equal(p()["fx.1.radius"], 30);
      assert.equal(p()["fx.1.scale"], undefined, "not a blur parameter");
      assert.equal(p()["fx.1.enabled"], false);
      invokeCommand("layer.moveEffect", { ids: ["a"], slot: 3, to: 1 });
      assert.deepEqual(types(), ["noise", "blur", "glow"]);
      assert.equal(p()["fx.2.radius"], 30, "the moved effect keeps its settings");
      assert.equal(p()["fx.2.enabled"], false);
      invokeCommand("layer.removeEffect", { ids: ["a"], slot: 2 });
      assert.deepEqual(types(), ["noise", "glow"]);
      assert.equal(p()["fx.3.type"], undefined, "no stale slot");
      assert.equal(p()["fx.3.radius"], undefined);
    } finally {
      off();
    }
  });
  it("motion blur: the switch and the shutter angle", () => {
    const off = fresh();
    try {
      invokeCommand("layer.setMotionBlur", { ids: ["a"], on: true, shutterAngle: 270 });
      assert.equal(getDocument().layers.a.motionBlur, true);
      assert.equal(p()["motion.shutterAngle"], 270);
      invokeCommand("layer.setMotionBlur", { ids: ["a"], on: false });
      assert.equal(getDocument().layers.a.motionBlur, undefined);
    } finally {
      off();
    }
  });
});
