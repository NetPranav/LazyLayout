/**
 * ROADMAP Phase 121: the Effects rows read and write glows, progressive blurs and grain, keeping the effects they
 * don't show (a texture here).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "@/core/document/factories";
import type { Layer } from "@/core/document/schema";
import { getDocument } from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { parseEffects } from "@/core/paint/effects";
import { effectItemsOf, writeEffectItems } from "../effectsModel";

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["h"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "h", archetype: "container", parentId: "pg", name: "Header", properties: { positioning: "absolute", "frame.width": 400, "frame.height": 80, "paint.effects": JSON.stringify([{ type: "texture", size: 1, radius: 3, clipToShape: true }]) } }) as Layer,
    ]),
  ),
);

describe("Phase 121: the inspector's rows", () => {
  it("glows, a progressive background blur and grain read back as the rows written; the texture is kept", () => {
    writeEffectItems(["h"], [
      { id: "shadow-new", type: "outer-glow", hex: "FFD24A", x: 5, y: 5, blur: 16, spread: 2, amount: 0 },
      { id: "shadow-new", type: "inner-glow", hex: "FFFFFF", x: 0, y: 0, blur: 3, spread: 0, amount: 0 },
      { id: "background-blur", type: "background-blur", hex: "000000", x: 0, y: 0, blur: 0, spread: 0, amount: 24, progressive: true, startAmount: 2, direction: "up" },
      { id: "grain", type: "grain", hex: "000000", x: 0, y: 0, blur: 0, spread: 0, amount: 12, size: 0.5 },
    ], "h");
    const rows = effectItemsOf("h");
    assert.deepEqual(rows.map((r) => r.type), ["outer-glow", "inner-glow", "background-blur", "grain"]);
    assert.deepEqual([rows[0].x, rows[0].y, rows[0].blur, rows[0].spread], [0, 0, 16, 2], "a glow has no offset");
    assert.deepEqual([rows[2].progressive, rows[2].amount, rows[2].startAmount, rows[2].direction], [true, 24, 2, "up"]);
    assert.equal(getDocument().layers.h.properties["paint.backgroundBlur"] ?? 0, 0, "a progressive blur isn't also the plain one");
    assert.deepEqual([rows[3].amount, rows[3].size], [12, 0.5]);
    assert.ok(parseEffects(getDocument().layers.h.properties["paint.effects"]).some((e) => e.type === "texture"));

    // back to a plain blur, and no grain
    writeEffectItems(["h"], [{ ...rows[2], progressive: false, amount: 9 }], "h");
    assert.equal(getDocument().layers.h.properties["paint.backgroundBlur"], 9);
    assert.deepEqual(parseEffects(getDocument().layers.h.properties["paint.effects"]).map((e) => e.type), ["texture"]);
  });
});
