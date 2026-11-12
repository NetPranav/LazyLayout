import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getPropertyDefinition, isPropertyLegalFor } from "../../document/properties";
import { evaluate } from "../../kernel/evaluate";
import { styleWrites } from "../../engine/stage/styleWrites";
import { canRunOnWaapi } from "../../engine/stage/waapiEligibility";
import { RenderLayer } from "../RenderLayer";
import { layerBoxStyle } from "../geometry";
import { resolveProps } from "../resolve";
import { BLEND_MODE_VALUES, adjustmentFilter, blendStyle, isBlendMode, maskSpec, maskStyle, maskSvg, readerOf, safeMaskColour } from "../compositing";

const layer = (properties: Layer["properties"] = {}, id = "l"): Layer => createLayer({ id, archetype: "container", properties: { "frame.width": 200, "frame.height": 100, positioning: "absolute", ...properties } }) as Layer;
const box = (properties: Layer["properties"]) => {
  const l = layer(properties);
  return layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>;
};
const read = (record: Record<string, string | number | boolean>) => readerOf(record);
const decode = (css: string) => decodeURIComponent(/data:image\/svg\+xml;utf8,([^"]*)"/.exec(css)![1]);

describe("Phase 74: the new properties", () => {
  it("are in the registry, legal on a container, neutral by default", () => {
    for (const path of ["appearance.isolation", "adjust.blur", "adjust.brightness", "adjust.contrast", "adjust.saturate", "adjust.hueRotate", "adjust.grayscale", "adjust.sepia", "adjust.invert", "mask.mode", "mask.shape", "mask.path", "mask.x", "mask.y", "mask.width", "mask.height", "mask.radius", "mask.feather", "mask.expansion", "mask.fill", "mask.opacity"]) {
      assert.ok(getPropertyDefinition(path), path);
      assert.ok(isPropertyLegalFor(path, "container"), `${path} on a container`);
    }
    assert.equal(getPropertyDefinition("mask.mode")!.default, "none");
    assert.equal(getPropertyDefinition("adjust.brightness")!.default, 1);
    assert.equal(getPropertyDefinition("appearance.isolation")!.default, "auto");
  });
  it("the numbers and the mask path animate; the modes hold", () => {
    assert.equal(getPropertyDefinition("adjust.blur")!.animatable, true);
    assert.equal(getPropertyDefinition("mask.width")!.animatable, true);
    assert.equal(getPropertyDefinition("mask.fill")!.animatable, true);
    assert.equal(getPropertyDefinition("mask.path")!.interpolation, "path");
    assert.equal(getPropertyDefinition("mask.mode")!.animatable, false);
  });
  it("an adjustment is a render role, and a mask or adjustment never rides on a Web Animation", () => {
    assert.ok(getPropertyDefinition("render.role")!.options!.includes("adjustment"));
    assert.equal(canRunOnWaapi(["adjust.blur"]), false);
    assert.equal(canRunOnWaapi(["mask.width"]), false);
    assert.equal(canRunOnWaapi(["appearance.opacity"]), true);
  });
});

describe("Phase 74: blend modes and isolated groups reach the drawn box", () => {
  it("every blend mode is drawn, normal and auto write nothing", () => {
    for (const mode of BLEND_MODE_VALUES.filter((m) => m !== "normal")) assert.equal(box({ "appearance.blendMode": mode }).mixBlendMode, mode, mode);
    assert.equal(box({ "appearance.blendMode": "normal" }).mixBlendMode, undefined);
    assert.equal(box({}).mixBlendMode, undefined);
    assert.equal(box({}).isolation, undefined);
    assert.equal(box({ "appearance.isolation": "isolate" }).isolation, "isolate");
  });
  it("an unknown blend mode is ignored, not written", () => {
    assert.equal(isBlendMode("plus-lighter"), false);
    assert.deepEqual(blendStyle(read({ "appearance.blendMode": "banana" })), {});
  });
  it("is in the markup the stage and the export draw", () => {
    const l = layer({ "appearance.blendMode": "multiply", "appearance.isolation": "isolate" });
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "l", layers: { l } }));
    assert.match(html, /mix-blend-mode:multiply/);
    assert.match(html, /isolation:isolate/);
  });
});

describe("Phase 74: adjustment layers", () => {
  it("a neutral adjustment writes nothing; each setting writes its filter, in a fixed order", () => {
    assert.equal(adjustmentFilter(read({})), "");
    assert.equal(adjustmentFilter(read({ "adjust.blur": 8 })), "blur(8px)");
    assert.equal(adjustmentFilter(read({ "adjust.invert": 1, "adjust.saturate": 1.5, "adjust.blur": 4, "adjust.hueRotate": 90 })), "blur(4px) saturate(1.5) hue-rotate(90deg) invert(1)");
    assert.equal(adjustmentFilter(read({ "adjust.brightness": 99 })), "brightness(5)", "clamped");
  });
  it("lands on the backdrop filter, beside a background blur", () => {
    assert.equal(box({ "adjust.saturate": 0 }).backdropFilter, "saturate(0)");
    assert.equal(box({ "paint.backgroundBlur": 6, "adjust.contrast": 2 }).backdropFilter, "blur(6px) contrast(2)");
    assert.equal(box({}).backdropFilter, undefined);
  });
});

describe("Phase 74: masks", () => {
  const size = { width: 200, height: 100 };
  it("no mask when the mode is none, or unknown", () => {
    assert.equal(maskSpec(read({}), size), null);
    assert.equal(maskSpec(read({ "mask.mode": "sideways" }), size), null);
    assert.equal(maskStyle(read({ "mask.mode": "none" }), size), null);
  });
  it("an alpha mask is a solid shape; width and height of 0 mean the layer's", () => {
    const spec = maskSpec(read({ "mask.mode": "alpha", "mask.shape": "ellipse" }), size)!;
    assert.deepEqual([spec.width, spec.height], [200, 100]);
    const svg = maskSvg(spec, size);
    assert.match(svg, /<ellipse cx="100" cy="50" rx="100" ry="50" fill="#000"\/>/);
    assert.doesNotMatch(svg, /<mask|luminanceToAlpha/);
  });
  it("a width or height of 0 is a real zero (a shape can grow from nothing); -1, the default, is the layer's own", () => {
    const zero = maskSpec(read({ "mask.mode": "alpha", "mask.shape": "ellipse", "mask.width": 0 }), size)!;
    assert.deepEqual([zero.width, zero.height], [0, 100]);
    assert.match(maskSvg(zero, size), /rx="0"/);
    const dflt = maskSpec(read({ "mask.mode": "alpha" }), size)!;
    assert.deepEqual([dflt.width, dflt.height], [200, 100]);
    assert.equal(getPropertyDefinition("mask.width")!.default, -1);
  });
  it("an inverted alpha mask cuts the shape out of a full rectangle", () => {
    const svg = maskSvg(maskSpec(read({ "mask.mode": "alphaInverted", "mask.shape": "rect", "mask.x": 10, "mask.y": 10, "mask.width": 50, "mask.height": 40 }), size)!, size);
    assert.match(svg, /<mask id="m"/);
    assert.match(svg, /<rect x="10" y="10" width="50" height="40" rx="0" fill="#000"\/>/);
  });
  it("a luma mask reads the shape's brightness, flipped for the inverted mode", () => {
    const luma = maskSvg(maskSpec(read({ "mask.mode": "luma", "mask.fill": "#808080" }), size)!, size);
    assert.match(luma, /feColorMatrix type="luminanceToAlpha"/);
    assert.match(luma, /fill="#808080"/);
    assert.doesNotMatch(luma, /feFuncA/);
    assert.match(maskSvg(maskSpec(read({ "mask.mode": "lumaInverted" }), size)!, size), /feFuncA type="table" tableValues="1 0"/);
  });
  it("feather blurs the edge, expansion grows it, opacity fades it", () => {
    const svg = maskSvg(maskSpec(read({ "mask.mode": "alpha", "mask.feather": 10, "mask.expansion": 4, "mask.opacity": 0.5 }), size)!, size);
    assert.match(svg, /feGaussianBlur stdDeviation="5"/);
    assert.match(svg, /stroke-width="8"/);
    assert.match(svg, /opacity="0.5"/);
  });
  it("a path mask uses the path, and refuses unsafe path data", () => {
    const ok = maskSvg(maskSpec(read({ "mask.mode": "alpha", "mask.shape": "path", "mask.path": "M0 0 L100 0 L50 80 Z" }), size)!, size);
    assert.match(ok, /<path d="M0 0 L100 0 L50 80 Z"/);
    const bad = maskSvg(maskSpec(read({ "mask.mode": "alpha", "mask.shape": "path", "mask.path": 'M0 0"><script>alert(1)</script>' }), size)!, size);
    assert.doesNotMatch(bad, /script/);
  });
  it("only a safe colour gets into the image", () => {
    assert.equal(safeMaskColour("#abc"), "#abc");
    assert.equal(safeMaskColour("rgba(0, 0, 0, 0.5)"), "rgba(0, 0, 0, 0.5)");
    assert.equal(safeMaskColour('red" onload="x'), "#ffffff");
    assert.equal(safeMaskColour("url(javascript:1)"), "#ffffff");
  });
  it("is a data URI on the drawn box, with the -webkit- forms, stretched over it", () => {
    const style = box({ "mask.mode": "alpha", "mask.shape": "ellipse" });
    assert.match(String(style.maskImage), /^url\("data:image\/svg\+xml;utf8,/);
    assert.equal(style.WebkitMaskImage, style.maskImage);
    assert.equal(style.maskSize, "100% 100%");
    assert.match(decode(String(style.maskImage)), /<ellipse/);
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "l", layers: { l: layer({ "mask.mode": "luma" }) } }));
    assert.match(html, /mask-image:url\(/);
  });
  it("a layer that hugs its content is masked as a 100 by 100 box stretched over it", () => {
    const l = layer({ "mask.mode": "alpha", "mask.shape": "ellipse", "frame.width": 0, "frame.height": 0 });
    const svg = decode(String(layerBoxStyle(l, resolveProps(l), {}).maskImage));
    assert.match(svg, /viewBox="0 0 100 100"/);
    assert.match(svg, /rx="50" ry="50"/);
  });
});

describe("Phase 74: a keyframed adjustment or mask is drawn by the same code as a still one (evaluate() parity)", () => {
  const scene = () => {
    const clip = attachClip(hydrateClip({ name: "Reveal", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [
      { property: "mask.width", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 200 }] },
      { property: "adjust.blur", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 20 }] },
      { property: "mask.path", keyframes: [{ time: 0, value: "M0 0 L100 0 L100 100 L0 100 Z" }, { time: 1, value: "M0 0 L200 0 L200 100 L0 100 Z" }] },
    ] }), "l");
    const base = layer({ "mask.mode": "alpha", "mask.shape": "rect", "mask.height": 100 });
    return { doc: createDocumentFromLayers([base], [clip]), base };
  };
  it("at 5 times the style writer says what the render definition says for the same values", () => {
    const { doc, base } = scene();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const resolved = evaluate(doc, "comp_main", "l", t);
      const written = styleWrites(["mask.width", "adjust.blur", "mask.path"], resolved);
      const still = { ...base, properties: { ...base.properties, ...resolved } } as Layer;
      const drawn = layerBoxStyle(still, resolveProps(still), {}) as Record<string, unknown>;
      assert.equal(written["mask-image"], drawn.maskImage, `mask at ${t}`);
      assert.equal(written["backdrop-filter"], drawn.backdropFilter ?? "none", `adjustment at ${t}`);
      assert.equal(resolved["mask.width"], 200 * t);
    }
  });
  it("the mask path morphs between its keyframes", () => {
    const { doc } = scene();
    const mid = evaluate(doc, "comp_main", "l", 0.5)["mask.path"];
    assert.equal(typeof mid, "string");
    assert.match(String(mid), /^M/);
    assert.notEqual(mid, "M0 0 L100 0 L100 100 L0 100 Z");
    assert.notEqual(mid, "M0 0 L200 0 L200 100 L0 100 Z");
  });
  it("an animated mask is written as the six mask styles, an animated adjustment as the backdrop filter", () => {
    const { doc } = scene();
    const w = styleWrites(["mask.width"], evaluate(doc, "comp_main", "l", 0.5));
    assert.deepEqual(Object.keys(w).sort(), ["-webkit-mask-image", "-webkit-mask-repeat", "-webkit-mask-size", "mask-image", "mask-repeat", "mask-size"]);
    const a = styleWrites(["adjust.blur"], evaluate(doc, "comp_main", "l", 0.5));
    assert.equal(a["backdrop-filter"], "blur(10px)");
    assert.equal(a["-webkit-backdrop-filter"], "blur(10px)");
    assert.equal(styleWrites(["adjust.blur"], evaluate(doc, "comp_main", "l", 0))["backdrop-filter"], "none");
  });
});

import { registerCompositingCommands } from "../compositingCommands";
import { invokeCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";

describe("Phase 74: the compositing commands", () => {
  const fresh = () => {
    setDocument(createDocumentFromLayers([createLayer({ id: "a", archetype: "container", parentId: null, children: ["b", "c"], properties: { "frame.width": 400 } }) as Layer, layer({}, "b"), layer({}, "c")], []));
    return registerCompositingCommands();
  };
  const props = (id: string) => getDocument().layers[id].properties;

  it("set the blend mode and isolation, an adjustment and a mask, each one undo step, only what is given", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("layer.setBlend", { ids: ["b"], mode: "multiply", isolate: true }), true);
      assert.equal(props("b")["appearance.blendMode"], "multiply");
      assert.equal(props("b")["appearance.isolation"], "isolate");
      invokeCommand("layer.setBlend", { ids: ["b"], isolate: false });
      assert.equal(props("b")["appearance.blendMode"], "multiply", "left alone");
      assert.equal(props("b")["appearance.isolation"], "auto");
      invokeCommand("layer.setAdjustment", { ids: ["b"], blur: 12, saturate: 0.5, asLayer: true });
      assert.deepEqual([props("b")["adjust.blur"], props("b")["adjust.saturate"], props("b")["render.role"]], [12, 0.5, "adjustment"]);
      invokeCommand("layer.setMask", { ids: ["b"], mode: "luma", shape: "ellipse", width: 0, feather: 8, fill: "#808080" });
      assert.deepEqual([props("b")["mask.mode"], props("b")["mask.shape"], props("b")["mask.width"], props("b")["mask.feather"], props("b")["mask.fill"]], ["luma", "ellipse", 0, 8, "#808080"]);
      historyCommands.undo();
      assert.equal(props("b")["mask.mode"], undefined);
      assert.equal(props("b")["adjust.blur"], 12, "the earlier steps stay");
    } finally {
      off();
    }
  });

  it("refuse a bad value before writing it", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("layer.setBlend", { ids: ["b"], mode: "banana" }), false);
      assert.equal(invokeCommand("layer.setAdjustment", { ids: ["b"], blur: 999 }), false);
      assert.equal(invokeCommand("layer.setMask", { ids: ["b"], mode: "sideways" }), false);
      assert.equal(props("b")["appearance.blendMode"], undefined);
    } finally {
      off();
    }
  });

  it("layer.setMatte names a source, takes the usual mode, and refuses itself or a layer that isn't there", () => {
    const off = fresh();
    try {
      invokeCommand("layer.setMatte", { ids: ["b"], sourceId: "c" });
      assert.deepEqual([props("b")["matte.source"], props("b")["matte.mode"]], ["c", "alpha"]);
      invokeCommand("layer.setMatte", { ids: ["b"], mode: "lumaInverted", showSource: true });
      assert.deepEqual([props("b")["matte.source"], props("b")["matte.mode"], props("b")["matte.showSource"]], ["c", "lumaInverted", true]);
      invokeCommand("layer.setMatte", { ids: ["b"], sourceId: null });
      assert.deepEqual([props("b")["matte.source"] ?? "", props("b")["matte.mode"]], ["", "none"], "cleared");
      const before = JSON.stringify(props("b"));
      invokeCommand("layer.setMatte", { ids: ["b"], sourceId: "b" });
      invokeCommand("layer.setMatte", { ids: ["b"], sourceId: "ghost" });
      assert.equal(JSON.stringify(props("b")), before);
    } finally {
      off();
    }
  });
});
