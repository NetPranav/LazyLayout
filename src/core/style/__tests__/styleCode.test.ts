import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { layerBoxStyle } from "../../render/geometry";
import { resolveProps } from "../../render/resolve";
import { CUSTOM_STYLE_PATH, composeStyleCode, declarationsToStyle, parseStyleCode, splitStyleCode, styleCodePatch, valueProblem } from "../styleCode";

const FIFTY = [
  // known controls (a container)
  "padding: 24px", "gap: 12px", "border-radius: 8px", "opacity: 0.5", "background-color: #336699", "flex-direction: row",
  "justify-content: center", "align-items: center", "overflow-x: hidden", "cursor: pointer", "pointer-events: none", "mix-blend-mode: multiply",
  "margin: 4px", "letter-spacing: 2px", "text-align: center", "font-size: 18px", "line-height: 1.5", "color: #112233",
  // unknown to the controls: kept as written
  "backdrop-filter: blur(8px)", "transform: rotate(3deg) scale(1.1)", "clip-path: polygon(0 0, 100% 0, 100% 80%, 0 100%)",
  "filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))", "box-shadow: 0 1px 2px rgba(0,0,0,.2), inset 0 0 0 1px #fff", "transition: all 200ms ease",
  "--accent: #ff3366", "width: calc(100% - 32px)", "height: clamp(120px, 20vw, 320px)", "padding-inline: 1rem 2rem", "background: linear-gradient(90deg, #f00, #00f)",
  "grid-template-columns: repeat(3, 1fr)", "aspect-ratio: 16 / 9", "object-fit: cover", "will-change: transform", "contain: layout paint",
  "isolation: isolate", "perspective: 800px", "transform-style: preserve-3d", "backface-visibility: hidden", "scroll-snap-type: x mandatory",
  "mask-image: linear-gradient(#000, transparent)", "font-feature-settings: \"liga\" 1", "text-shadow: 0 1px 0 #fff", "outline: 2px dashed #f0f",
  "background-image: url(\"https://example.com/a.png\")", "animation: spin 2s linear infinite", "writing-mode: vertical-rl", "column-count: 2",
  "inset: 0", "z-index: 3", "visibility: visible",
];

const asMap = (decls: readonly (readonly [string, string])[]) => new Map(decls);

describe("Style code (D3)", () => {
  it("has 50 declarations in the round-trip set", () => assert.equal(FIFTY.length, 50));

  it("round-trips 50 declarations: code to controls and custom, back to code, and again", () => {
    const first = splitStyleCode(FIFTY.join(";\n"), "container");
    assert.deepEqual(first.errors, []);
    const layer = { archetype: "container", properties: { ...first.controls, [CUSTOM_STYLE_PATH]: first.custom.map(([p, v]) => `${p}: ${v}`).join(";") } };
    const text = composeStyleCode(layer);
    const second = splitStyleCode(text, "container");
    assert.deepEqual(second.errors, []);
    assert.deepEqual(second.controls, first.controls);
    assert.deepEqual(asMap(second.custom), asMap(first.custom));
    // every one of the 50 properties is somewhere: a control or custom
    const seen = new Set([...asMap(first.custom).keys()]);
    const total = Object.keys(first.controls).length + seen.size;
    assert.ok(total >= 40, `expected most of the 50 to be separate properties, got ${total}`);
  });

  it("a known declaration sets its control: padding 24px is Padding 24", () => {
    const r = splitStyleCode("padding: 24px; backdrop-filter: blur(8px)", "container");
    assert.equal(r.controls["layout.padding"], 24);
    assert.deepEqual(r.custom, [["backdrop-filter", "blur(8px)"]]);
  });

  it("a value that does not fit the control stays custom, so nothing is lost", () => {
    const r = splitStyleCode("padding: 8px 16px; opacity: calc(1 / 2); border-radius: 1rem", "container");
    assert.deepEqual(r.controls, {});
    assert.equal(r.custom.length, 3);
  });

  it("unknown declarations export unchanged: the canvas style carries them exactly", () => {
    const l = createLayer({ id: "l", archetype: "container", properties: { "frame.width": 200, "frame.height": 100, positioning: "absolute", [CUSTOM_STYLE_PATH]: "clip-path: polygon(0 0, 100% 0, 100% 80%, 0 100%); --accent: #ff3366; transition: all 200ms ease" } }) as Layer;
    const s = layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>;
    assert.equal(s.clipPath, "polygon(0 0, 100% 0, 100% 80%, 0 100%)");
    assert.equal(s["--accent"], "#ff3366");
    assert.equal(s.transition, "all 200ms ease");
  });

  it("hand-written declarations win over the controls they overlap", () => {
    const l = createLayer({ id: "l", archetype: "container", properties: { "frame.width": 200, "frame.height": 100, positioning: "absolute", [CUSTOM_STYLE_PATH]: "opacity: calc(1 / 4)" } }) as Layer;
    assert.equal((layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>).opacity, "calc(1 / 4)");
  });

  describe("hostile input is refused with a message and a line", () => {
    const hostile: [string, RegExp][] = [
      ["background: url(javascript:alert(1))", /picture|code/],
      ["width: expression(alert(1))", /code/],
      ["behavior: url(x.htc)", /not allowed/],
      ["-moz-binding: url(x)", /not allowed/],
      ["color: red; } body { display:none", /declarations only/],
      ["background: url(\"data:text/html;base64,AAAA\")", /picture/],
      ["content: \"</style><script>\"", /brackets/],
      ["@import url(x.css)", /property: value/],
      ["a { color: red }", /declarations only/],
    ];
    for (const [code, message] of hostile) {
      it(code, () => {
        const r = parseStyleCode(code);
        assert.deepEqual(r.declarations.filter(([p]) => p === "behavior" || p === "-moz-binding"), []);
        assert.ok(r.errors.length > 0, "an error is reported");
        assert.ok(message.test(r.errors[0].message), r.errors[0].message);
        assert.ok(r.errors[0].line >= 1);
      });
    }
    it("a hostile line does not stop the valid ones", () => {
      const r = parseStyleCode("padding: 4px;\nwidth: expression(1);\nopacity: 0.5");
      assert.deepEqual(r.declarations, [["padding", "4px"], ["opacity", "0.5"]]);
      assert.equal(r.errors[0].line, 2);
    });
    it("a document edited by hand cannot smuggle script in: stored custom styles are re-checked", () => {
      const l = createLayer({ id: "l", archetype: "container", properties: { "frame.width": 10, "frame.height": 10, positioning: "absolute", [CUSTOM_STYLE_PATH]: "width: expression(1); color: red" } }) as Layer;
      const s = layerBoxStyle(l, resolveProps(l), {}) as Record<string, unknown>;
      assert.equal(s.color, "red");
      assert.ok(!("expression" in s) && s.width !== "expression(1)");
    });
  });

  it("valueProblem lets ordinary values through", () => {
    for (const v of ["calc(100% - 4px)", "var(--x, #fff)", "url(#mask)", "url(/img/a.png)", "rgba(0,0,0,.4) 0 1px 2px", "\"liga\" 1"]) assert.equal(valueProblem(v), null, v);
  });

  it("declarationsToStyle camel-cases and keeps custom properties", () => {
    assert.deepEqual(declarationsToStyle([["border-top-left-radius", "4px"], ["--a-b", "1"]]), { borderTopLeftRadius: "4px", "--a-b": "1" });
  });

  it("comments are ignored and line numbers stay right", () => {
    const r = parseStyleCode("/* one\ntwo */\nwidth: expression(1)");
    assert.equal(r.errors[0].line, 3);
  });

  describe("styleCodePatch", () => {
    const layer = { archetype: "container", properties: { "layout.padding": 24, "appearance.radius": 8, [CUSTOM_STYLE_PATH]: "transition: all 1s" } as Record<string, unknown> };
    it("sets what the text says and resets what it no longer mentions", () => {
      const r = styleCodePatch(layer, "padding: 10px; clip-path: circle(40%)");
      assert.deepEqual(r.errors, []);
      assert.equal(r.patch["layout.padding"], 10);
      assert.equal(r.patch["appearance.radius"], null); // removed from the text: back to its default
      assert.equal(r.patch[CUSTOM_STYLE_PATH], "clip-path: circle(40%)");
    });
    it("clears the custom text when nothing custom is left", () => {
      assert.equal(styleCodePatch(layer, "padding: 24px; border-radius: 8px").patch[CUSTOM_STYLE_PATH], null);
    });
    it("writes nothing while there is an error", () => {
      const r = styleCodePatch(layer, "padding: 10px; width: expression(1)");
      assert.deepEqual(r.patch, {});
      assert.equal(r.errors.length, 1);
    });
    it("what compose writes, patch reads back to the same layer", () => {
      const text = composeStyleCode(layer);
      const r = styleCodePatch(layer, text);
      assert.equal(r.patch["layout.padding"], 24);
      assert.equal(r.patch["appearance.radius"], 8);
      assert.equal(r.patch[CUSTOM_STYLE_PATH], "transition: all 1s");
    });
  });
});
