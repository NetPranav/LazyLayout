/**
 * ROADMAP Phase 131 (found by the Stage 3 journeys): `paint.setFills` and `paint.setStrokes`, through the command bus
 * with their schema, take every paint Stage 3 added: a mask on any paint, noise, pattern, mesh and live fills, and a
 * stroke paint's own weight and position. What they store is what the renderer reads; nonsense is refused.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { invokeCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument } from "../../store/useDocumentStore";
import { parseFills } from "../../paint/paints";
import { registerEditingCommands } from "../editCommands";

const fresh = () => {
  setDocument(createDocumentFromLayers([
    createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["r", "badge"], properties: { "frame.width": 800 } }) as Layer,
    createLayer({ id: "r", archetype: "rectangle", parentId: "pg", name: "r", properties: { "frame.width": 200, "frame.height": 100 } }) as Layer,
    createLayer({ id: "badge", archetype: "container", parentId: "pg", name: "badge", properties: {} }) as Layer,
  ]));
  return registerEditingCommands();
};
const read = (path: string) => parseFills(getDocument().layers.r.properties[path]) ?? [];

describe("Phase 131: the paint commands take Stage 3's paints", () => {
  it("a masked conic, noise, mesh and a live fill, as fills", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("paint.setFills", { ids: ["r"], fills: [
        { type: "conic", stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }], center: { x: 0.5, y: 0.5 }, angle: 0, mask: { type: "linear", start: 0, end: 1, angle: 90 } },
        { type: "noise", kind: "grain", scale: 2, contrast: 0.5, color: "#000000", seed: 3 },
        { type: "mesh", cols: 2, rows: 2, smooth: true, points: [{ x: 0, y: 0, color: "#ff0000" }, { x: 1, y: 0, color: "#00ff00" }, { x: 0, y: 1, color: "#0000ff" }, { x: 1, y: 1, color: "#ffffff" }] },
        { type: "live", source: "badge" },
      ] }), true);
      const fills = read("paint.fills");
      assert.deepEqual(fills.map((f) => f.type), ["conic", "noise", "mesh", "live"]);
      assert.equal(fills[0].mask?.type, "linear");
    } finally {
      off();
    }
  });

  it("strokes with their own weight and position", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("paint.setStrokes", { ids: ["r"], strokes: [{ type: "solid", color: "#ff0000", weight: 6, align: "outside" }, { type: "solid", color: "#0000ff", weight: 2, align: "inside" }] }), true);
      assert.deepEqual(read("paint.strokes").map((s) => [s.weight, s.align]), [[6, "outside"], [2, "inside"]]);
    } finally {
      off();
    }
  });

  it("nonsense is refused", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("paint.setFills", { ids: ["r"], fills: [{ type: "sparkle" }] }), false);
      assert.equal(invokeCommand("paint.setStrokes", { ids: ["r"], strokes: [{ type: "solid", color: "#000", align: "sideways" }] }), false);
    } finally {
      off();
    }
  });
});
