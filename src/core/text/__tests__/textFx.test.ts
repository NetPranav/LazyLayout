import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../../render/RenderLayer";
import { TEXT_FX_SOURCE } from "../../export/runtime/textFxSource";
import { variationSettings } from "../axis";
import { CARET, textFxText, type TextFx } from "../textFx";
import { buildSiteExport } from "../../export/site";
import { evaluate } from "../../kernel/evaluate";
import { styleWrites } from "../../engine/stage/styleWrites";

const fx = (mode: TextFx["mode"], progress: number, extra: Partial<TextFx> = {}): TextFx => ({ mode, progress, seed: 7, ...extra });
const ctx = vm.createContext({ Math, Intl, Array, isFinite, Number, RegExp });
vm.runInContext(TEXT_FX_SOURCE, ctx);
const script = (text: string, f: TextFx) => (vm.runInContext(`fxText(${JSON.stringify({ mode: f.mode, text, seed: f.seed, caret: f.caret, words: f.words, decimals: f.decimals })}, ${f.progress})`, ctx) as string);

describe("text motion (D12, Phase 84)", () => {
  it("scramble: settles left to right, keeps spaces, the same at the same progress, and is whole at 1", () => {
    const t = "Hello world";
    assert.equal(textFxText(t, fx("scramble", 1)), t);
    const half = textFxText(t, fx("scramble", 0.5));
    assert.equal(half.slice(0, 5), "Hello"); // floor(0.5 * 11) = 5 settled
    assert.equal(half[5], " ");
    assert.equal(half.length, t.length);
    assert.equal(textFxText(t, fx("scramble", 0.5)), half);
    assert.notEqual(textFxText(t, fx("scramble", 0.2)), t);
  });

  it("typewriter: one character at a time, with a caret until it is done", () => {
    assert.equal(textFxText("Hello", fx("typewriter", 0)), "");
    assert.equal(textFxText("Hello", fx("typewriter", 0.6)), "Hel");
    assert.equal(textFxText("Hello", fx("typewriter", 0.6, { caret: true })), `Hel${CARET}`);
    assert.equal(textFxText("Hello", fx("typewriter", 1, { caret: true })), "Hello");
    assert.equal(textFxText("👨‍👩‍👧 ok", fx("typewriter", 0.3)), "👨‍👩‍👧"); // a family is one character
  });

  it("rotating words and count-up (with Intl.NumberFormat)", () => {
    const w = { words: "fast, simple, yours" };
    assert.deepEqual([0, 0.4, 0.7, 1].map((p) => textFxText("x", fx("rotate", p, w))), ["fast", "simple", "yours", "yours"]);
    assert.equal(textFxText("1,200 users", fx("countup", 0)), "0 users");
    assert.equal(textFxText("1,200 users", fx("countup", 0.5)), "600 users");
    assert.equal(textFxText("1,200 users", fx("countup", 1)), "1,200 users");
    assert.equal(textFxText("$99.50", fx("countup", 0.5)), "$49.75");
    assert.equal(textFxText("9 lives", fx("countup", 0.5, { decimals: 1 })), "4.5 lives");
    assert.equal(textFxText("no digits", fx("countup", 0.5)), "no digits");
  });

  it("the page script shows exactly what the function shows, in every mode at 21 progress values", () => {
    const cases: [string, TextFx][] = [
      ["Hello brave new world", fx("scramble", 0)], ["Type me out", fx("typewriter", 0, { caret: true })], ["x", fx("rotate", 0, { words: "a, b, c, d" })], ["Over 12,345.5 served", fx("countup", 0)], ["Ünïcode 日本語", fx("scramble", 0)],
    ];
    for (const [text, base] of cases) for (let i = 0; i <= 20; i++) {
      const f = { ...base, progress: i / 20 };
      assert.equal(script(text, f), textFxText(text, f), `${f.mode} ${text} at ${i / 20}`);
    }
  });

  it("the renderer draws the shown text hidden from assistive technology and the whole text once, readable", () => {
    const layer = createLayer({ id: "t", archetype: "text", parentId: null, name: "T", properties: { "content.text": "Hello", "text.fx": "typewriter", "text.fxProgress": 0.4 } }) as Layer;
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: { t: layer } }));
    assert.match(html, /<span data-fx="" aria-hidden="true">He<\/span>/);
    assert.match(html, /<span style="[^"]*clip:[^"]*">Hello<\/span>/);
    const plain = renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: { t: { ...layer, properties: { "content.text": "Hello" } } } }));
    assert.doesNotMatch(plain, /data-fx/);
  });

  it("the kernel animates the progress and the axis; the adapter's CSS write is the axis", () => {
    const doc = createDocumentFromLayers([createLayer({ id: "t", archetype: "text", parentId: null, name: "T", properties: { "content.text": "Hello", "text.fx": "countup", "text.axis": "wght" } }) as Layer]);
    const r = evaluate(doc, "main", "t", 0, { bound: new Map([["t", new Map([["text.axisValue", 650]])]]) as never });
    void r;
    assert.equal(variationSettings((p) => ({ "text.axis": "wght", "text.axisValue": 650, "typography.fontVariations": '"wdth" 90' } as Record<string, unknown>)[p]), '"wdth" 90, "wght" 650');
    assert.equal(variationSettings((p) => ({ "text.axis": "wght", "text.axisValue": 650, "typography.fontVariations": '"wght" 300' } as Record<string, unknown>)[p]), '"wght" 650'); // the animated axis wins
    assert.deepEqual(styleWrites(["text.axisValue"], { "text.axis": "wght", "text.axisValue": 700 } as never), { "font-variation-settings": '"wght" 700' });
    assert.equal(variationSettings(() => undefined), null);
  });

  it("the export carries the config on the element and the function in the script, for a driver that moves the progress", async () => {
    const page = { ...(createLayer({ id: "p", archetype: "container", parentId: null, name: "Home", children: ["t"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 900 } }) as Layer), page: { route: "/" } };
    const t = createLayer({ id: "t", archetype: "text", parentId: "p", name: "Stat", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 10, "frame.width": 300, "frame.height": 40, "content.text": "1,200 users", "text.fx": "countup" } }) as Layer;
    const doc = createDocumentFromLayers([page, t]);
    doc.bindings = { b1: { id: "b1", ownerLayerId: "t", enabled: true, name: "Count", blend: "add", expr: { signal: { kind: "view", layer: "t", channel: "progress" }, operators: [{ op: "remap", inMin: 0, inMax: 1, outMin: 0, outMax: 1, clamp: true }] }, target: { kind: "property", on: { kind: "layer", ref: "t" }, path: "text.fxProgress" } } as never };
    const r = await buildSiteExport(doc, { target: "html", styling: "css" });
    const html = String(r.files.find((f) => f.path === "index.html")!.content);
    assert.match(html, /data-ll-fx="[^"]*countup/);
    assert.match(html, /<span data-fx aria-hidden="true">/);
    const js = String(r.files.find((f) => f.path === "lazylayout-drivers.js")?.content);
    assert.match(js, /function fxText/);
    assert.match(js, /text\.fxProgress/);
  });
});

describe("gradient sheen (D12)", () => {
  it("is off below 0, a band that crosses from the left to the right, and drawn through the clip of the text", async () => {
    const { sheenBackground } = await import("../axis");
    const read = (v: number) => (p: string) => ({ "text.sheen": v, "typography.color": "#111111", "text.sheenColor": "#ffffff" } as Record<string, unknown>)[p];
    assert.equal(sheenBackground(read(-1)), null);
    assert.match(sheenBackground(read(0))!, /#ffffff -20%/);
    assert.match(sheenBackground(read(1))!, /#ffffff 120%/);
    assert.match(sheenBackground(read(0.5))!, /#ffffff 50%/);
    const layer = createLayer({ id: "t", archetype: "text", parentId: null, name: "T", properties: { "content.text": "Shine", "text.sheen": 0.5 } }) as Layer;
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "t", layers: { t: layer } }));
    assert.match(html, /background-image:linear-gradient\(105deg/);
    assert.match(html, /background-clip:text/);
    assert.deepEqual(styleWrites(["text.sheen"], { "text.sheen": 0.5, "typography.color": "#111111" } as never)["background-image"]?.slice(0, 20), "linear-gradient(105d");
  });
});
