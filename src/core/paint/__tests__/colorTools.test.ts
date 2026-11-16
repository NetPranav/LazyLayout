/**
 * ROADMAP Phase 123: colour tools. The contrast check agrees with the reference formulas on 50 pairs (WCAG 2's
 * ratio, as the spec writes it; APCA-W3 0.0.98G-4g, with the published values of `apca-w3` as anchors); a
 * suggestion always passes; harmonies, tints and shades and a picture's palette; all saved as colour tokens.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { parseColor, rgbToOklch, type Rgba } from "../colorMath";
import { apcaContrast, harmony, meets, paletteFromPixels, suggestPassing, tintsAndShades, wcagContrast, wcagLevel } from "../colorTools";
import { backgroundBehind, fixContrast, saveHarmony, savePalette, saveScale } from "../../editing/colorToolOps";

const C = (hex: string) => parseColor(hex)!;

/** WCAG 2.2's definitions, written out from the spec (its sRGB threshold is 0.04045). */
function refWcag(a: Rgba, b: Rgba): number {
  const L = (c: Rgba) => [c.r, c.g, c.b].map((v) => v / 255).map((s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** APCA-W3 0.0.98G-4g (`APCAcontrast(sRGBtoY(text), sRGBtoY(bg))`), written out from its published source. */
function refApca(text: Rgba, bg: Rgba): number {
  const Y = (c: Rgba) => 0.2126729 * (c.r / 255) ** 2.4 + 0.7151522 * (c.g / 255) ** 2.4 + 0.072175 * (c.b / 255) ** 2.4;
  const soft = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const t = soft(Y(text));
  const b = soft(Y(bg));
  if (Math.abs(b - t) < 0.0005) return 0;
  if (b > t) {
    const s = (b ** 0.56 - t ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (b ** 0.65 - t ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

/** 50 pairs: the classic anchors, then a fixed pseudo-random spread. */
function pairs(): [Rgba, Rgba][] {
  const out: [Rgba, Rgba][] = [["#000000", "#ffffff"], ["#ffffff", "#000000"], ["#888888", "#ffffff"], ["#ffffff", "#888888"], ["#777777", "#ffffff"], ["#0000ff", "#ffffff"], ["#ff0000", "#00ff00"], ["#1b1464", "#ff5c8a"], ["#333333", "#f5f5f5"], ["#ffcc00", "#003366"]].map(([a, b]) => [C(a), C(b)]);
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s % 256);
  while (out.length < 50) out.push([{ r: rnd(), g: rnd(), b: rnd(), a: 1 }, { r: rnd(), g: rnd(), b: rnd(), a: 1 }]);
  return out;
}

describe("Phase 123: contrast", () => {
  it("WCAG 2 and APCA agree with the reference formulas on 50 pairs", () => {
    for (const [a, b] of pairs()) {
      assert.ok(Math.abs(wcagContrast(a, b) - refWcag(a, b)) < 1e-9);
      assert.ok(Math.abs(apcaContrast(a, b) - refApca(a, b)) < 1e-9);
    }
  });

  it("the published anchors: black on white is 21:1 and Lc 106.04; white on black Lc −107.88; #888 and white Lc 63.06 and −68.54", () => {
    assert.equal(Math.round(wcagContrast(C("#000"), C("#fff")) * 100) / 100, 21);
    assert.equal(Math.round(wcagContrast(C("#777"), C("#fff")) * 100) / 100, 4.48);
    assert.ok(Math.abs(apcaContrast(C("#000"), C("#fff")) - 106.04067) < 0.01);
    assert.ok(Math.abs(apcaContrast(C("#fff"), C("#000")) + 107.88473) < 0.01);
    assert.ok(Math.abs(apcaContrast(C("#888"), C("#fff")) - 63.05647) < 0.01);
    assert.ok(Math.abs(apcaContrast(C("#fff"), C("#888")) + 68.54146) < 0.01);
    assert.deepEqual([wcagLevel(7.2), wcagLevel(5), wcagLevel(3.5), wcagLevel(3.5, true), wcagLevel(2)], ["AAA", "AA", "AA large", "AA", "fail"]);
  });

  it("a suggestion always passes, keeps the hue, and is none only when no lightness can pass", () => {
    const targets = [{ wcag: 4.5 }, { wcag: 3 }, { wcag: 7 }, { apca: 60 }, { apca: 75 }, { wcag: 4.5, apca: 60 }];
    let none = 0;
    for (const [a, b] of pairs())
      for (const t of targets) {
        const s = suggestPassing(a, b, t);
        if (!s) {
          none++;
          // the ends of the lightness walk are black and white: neither passes
          assert.ok(!meets(C("#000"), b, t) && !meets(C("#fff"), b, t), "none only when even black and white fail");
          continue;
        }
        assert.ok(meets(s, b, t), `${JSON.stringify(s)} on ${JSON.stringify(b)} for ${JSON.stringify(t)}`);
        if (meets(a, b, t)) assert.deepEqual([s.r, s.g, s.b], [a.r, a.g, a.b], "a passing colour is kept");
      }
    assert.ok(none < 60, "most pairs have a suggestion");
    // the nearest: a light grey on white needing AA becomes the lightest grey that passes, not black
    const g = suggestPassing(C("#bbbbbb"), C("#ffffff"), { wcag: 4.5 })!;
    assert.ok(wcagContrast(g, C("#fff")) < 4.7 && g.r > 100);
  });
});

describe("Phase 123: harmony, scales, palettes", () => {
  it("harmony rules turn the hue by their angles and keep the base first", () => {
    const base = C("#2f6bff");
    const h = (c: Rgba) => rgbToOklch(c).h;
    const tri = harmony(base, "triad");
    assert.equal(tri.length, 3);
    assert.deepEqual([tri[0].r, tri[0].g, tri[0].b], [0x2f, 0x6b, 0xff]);
    const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180;
    assert.ok(Math.abs(Math.abs(turn(h(base), h(harmony(base, "complementary")[1]))) - 180) < 8);
    assert.equal(harmony(base, "tetrad").length, 4);
    assert.equal(harmony(base, "analogous").length, 3);
  });

  it("tints and shades: 11 steps from light to dark, the base among them", () => {
    const s = tintsAndShades(C("#2f6bff"));
    assert.deepEqual(s.map((x) => x.step), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const L = s.map((x) => rgbToOklch(x.color).l);
    assert.ok(L.every((l, i) => i === 0 || l < L[i - 1]), "darker at every step");
    assert.ok(s.some((x) => x.color.r === 0x2f && x.color.g === 0x6b && x.color.b === 0xff));
  });

  it("a picture's palette: its main colours, most common first, the same every time", () => {
    const w = 60;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const [r, g, b] = x < 36 ? [20, 60, 200] : y < 20 ? [240, 200, 40] : [200, 30, 60];
        data.set([r + ((x * 7) % 9), g, b - ((y * 5) % 7), 255], i);
      }
    const p = paletteFromPixels(data, w, h, 3);
    assert.deepEqual(p.map((s) => Math.round(s.share * 100)), [60, 20, 20]);
    assert.ok(Math.abs(p[0].color.b - 197) < 6 && p[0].color.r < 30);
    assert.deepEqual(paletteFromPixels(data, w, h, 3), p);
  });
});

describe("Phase 123: in the document", () => {
  beforeEach(() =>
    setDocument(
      createDocumentFromLayers([
        createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["card"], properties: { "frame.width": 800, "frame.height": 600, "appearance.background.color": "#ffffff" } }) as Layer,
        createLayer({ id: "card", archetype: "container", parentId: "pg", name: "Card", children: ["t"], properties: { "appearance.background.color": "#1e293b" } }) as Layer,
        createLayer({ id: "t", archetype: "text", parentId: "card", name: "Title", properties: { "content.text": "Hello", "typography.color": "#475569" } }) as Layer,
      ]),
    ),
  );

  it("palettes, harmonies and scales are saved as colour tokens named in a group", () => {
    savePalette("Photo", ["#123456", "#abcdef"]);
    saveHarmony("Brand", "#2f6bff", "triad");
    saveScale("Blue", "#2f6bff");
    const vars = Object.values(getDocument().variables ?? {});
    const names = vars.map((v) => v.name);
    assert.ok(names.includes("Photo/1") && names.includes("Photo/2"));
    assert.ok(["Brand/base", "Brand/2", "Brand/3"].every((n) => names.includes(n)));
    assert.equal(names.filter((n) => n.startsWith("Blue/")).length, 11);
    assert.ok(vars.every((v) => v.type === "color"));
    assert.equal(Object.values(vars.find((v) => v.name === "Photo/1")!.values)[0], "#123456");
  });

  it("a text's contrast is fixed against what's behind it (the card, not the page)", () => {
    assert.deepEqual(backgroundBehind("t"), { r: 0x1e, g: 0x29, b: 0x3b, a: 1 });
    assert.equal(fixContrast(["t"], { wcag: 4.5 }), 1);
    const now = parseColor(String(getDocument().layers.t.properties["typography.color"]))!;
    assert.ok(wcagContrast(now, C("#1e293b")) >= 4.5);
    assert.ok(now.r > 0x47, "lighter, not darker, on a dark card");
  });
});
