/**
 * Rules that must hold whatever feature is added, checked across features (not one feature's happy path):
 *
 * 1. Edits go only where the edit target says: a layer edited in its own frame changes the base (no override appears),
 *    a layer picked inside a Tablet mirror changes only Tablet's override, and nothing else ever moves the target.
 * 2. Undo takes every command back exactly: after any sequence of edits and as many undos, the document is the one
 *    it started as, to the last property.
 *
 * (3, "no editor attribute is ever exported", lives with the exporter: src/core/export/site/__tests__/editorOnly.test.ts.)
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import { setDocument } from "../documentState";
import { documentCommands, getDocument, historyCommands } from "../useDocumentStore";
import { useHistoryStore } from "../useHistoryStore";
import { editBreakpointId, useBreakpointStore } from "../useBreakpointStore";
import { useSelectionStore } from "../useSelectionStore";
import { splitIntoLetters, animateLetters } from "../../editing/splitText";
import { extrudeLetters, standLetters } from "../../editing/standingLetters";
import { setLayerProps } from "../../editing/editOps";

function fixture(): MotionDocument {
  const L = (id: string, parentId: string | null, children: string[], properties: Record<string, PropValue>, archetype: "container" | "text" = "container") =>
    createLayer({ id, archetype, parentId, name: id, children, properties }) as Layer;
  const doc = createDocumentFromLayers([
    L("page", null, ["desk", "mirror"], { "frame.width": 1440, "frame.height": 900 }),
    L("desk", "page", ["card", "title"], { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 900, "breakpoints.responsive": true }),
    L("card", "desk", [], { positioning: "absolute", "frame.x": 100, "frame.y": 100, "frame.width": 200, "frame.height": 80 }),
    L("title", "desk", [], { positioning: "absolute", "frame.x": 100, "frame.y": 300, "frame.width": 300, "frame.height": 60, "content.text": "Hi", "typography.fontSize": 40 }, "text"),
    L("mirror", "page", [], { positioning: "absolute", "frame.x": 1560, "frame.y": 0, "frame.width": 768, "frame.height": 1024, "frame.mirrorOf": "desk", "frame.device": "tablet" }),
  ]);
  return { ...doc, breakpoints: [{ id: "desktop", name: "Desktop", width: 1440 }, { id: "tablet", name: "Tablet", width: 768 }] };
}

beforeEach(() => {
  setDocument(fixture());
  useHistoryStore.getState().clearHistory();
  useBreakpointStore.setState({ activeId: null, editId: undefined });
  useSelectionStore.getState().clearSelection();
});

describe("invariant: edits go only where the edit target says", () => {
  it("a layer edited in its own frame changes the base and gets no override", () => {
    useSelectionStore.getState().select("card", "element");
    assert.equal(editBreakpointId(), null);
    documentCommands.updateProps("card", { "frame.x": 140 });
    const card = getDocument().layers.card;
    assert.equal(card.properties["frame.x"], 140);
    assert.equal(card.overrides, undefined);
  });

  it("a layer picked in the Tablet mirror changes only Tablet's override, and picking it in its frame again edits the base", () => {
    useSelectionStore.getState().select("card", "element", { mirrorId: "mirror" });
    assert.equal(editBreakpointId(), "tablet");
    assert.equal(useBreakpointStore.getState().activeId, null, "the view did not move: only the edit target did");
    documentCommands.updateProps("card", { "frame.x": 20 });
    let card = getDocument().layers.card;
    assert.equal(card.properties["frame.x"], 100, "the base is untouched");
    assert.equal(card.overrides?.tablet?.["frame.x"], 20);

    useSelectionStore.getState().select("card", "element");
    assert.equal(editBreakpointId(), null);
    documentCommands.updateProps("card", { "frame.x": 160 });
    card = getDocument().layers.card;
    assert.equal(card.properties["frame.x"], 160);
    assert.equal(card.overrides?.tablet?.["frame.x"], 20, "Tablet keeps its own value");
  });

  it("selecting several, toggling, or clearing never leaves a stale mirror target", () => {
    useSelectionStore.getState().select("card", "element", { mirrorId: "mirror" });
    useSelectionStore.getState().selectMultiple(["card", "title"], "element");
    assert.equal(editBreakpointId(), null);
    useSelectionStore.getState().select("card", "element", { mirrorId: "mirror" });
    useSelectionStore.getState().clearSelection();
    assert.equal(editBreakpointId(), null);
  });

  it("deleting the mirror while a layer picked in it is selected sends edits back to the view", () => {
    useSelectionStore.getState().select("card", "element", { mirrorId: "mirror" });
    documentCommands.removeLayer("mirror");
    assert.equal(useSelectionStore.getState().selectedMirrorId, null);
    assert.equal(editBreakpointId(), null);
  });

  it("an explicit view (the breakpoint bar) still routes edits there", () => {
    useBreakpointStore.getState().setActive("tablet");
    useSelectionStore.getState().select("card", "element");
    assert.equal(editBreakpointId(), "tablet");
  });
});

describe("invariant: undo takes every command back exactly", () => {
  it("edits, a split, letters animated, stood up and given depth: as many undos give the starting document", () => {
    const start = structuredClone(getDocument());
    const steps: (() => void)[] = [
      () => documentCommands.updateProps("card", { "frame.x": 150, "appearance.opacity": 0.5 }),
      () => setLayerProps(["card", "title"], { "frame.y": 40 }, "Move"),
      () => {
        const g = splitIntoLetters("title", [
          { char: "H", x: 0, y: 0, width: 24, height: 40 },
          { char: "i", x: 26, y: 0, width: 10, height: 40 },
        ]);
        assert.ok(g);
      },
      () => {
        const g = Object.values(getDocument().layers).find((l) => l.properties["group.role"] === "letters")!;
        animateLetters(g.id);
      },
      () => standLetters(Object.values(getDocument().layers).find((l) => l.properties["group.role"] === "letters")!.id),
      () => extrudeLetters(Object.values(getDocument().layers).find((l) => l.properties["group.role"] === "letters")!.id, 24, 8),
      () => {
        useSelectionStore.getState().select("card", "element", { mirrorId: "mirror" });
        documentCommands.updateProps("card", { "frame.x": 10 });
        useSelectionStore.getState().clearSelection();
      },
    ];
    for (const step of steps) step();
    assert.notDeepEqual(getDocument().layers, start.layers);
    let guard = 0;
    while (historyCommands.undo() && guard++ < 100);
    assert.deepEqual(getDocument().layers, start.layers);
    assert.deepEqual(getDocument().clips, start.clips);
  });
});
