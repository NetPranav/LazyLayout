import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onArrange } from "../editCommands";
import { getContextKeys, setFocusScope, setTextEditing } from "../../commands/contextKeys";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useCanvasViewStore } from "../../store/useCanvasViewStore";

describe("Arrange shortcuts: where they listen", () => {
  beforeEach(() => {
    const root = { ...createLayer({ id: "root", archetype: "container", parentId: null, name: "Root" }), children: ["a", "b"] };
    setDocument(createDocumentFromLayers([root, createLayer({ id: "a", archetype: "rectangle", parentId: "root", name: "a" }), createLayer({ id: "b", archetype: "rectangle", parentId: "root", name: "b" })]));
    useSelectionStore.getState().select("a", "element");
    useCanvasViewStore.setState({ mode: "design" });
    setFocusScope(null);
    setTextEditing(false);
  });

  it("works over the canvas, and over the inspector or a bar (no panel claims the pointer)", () => {
    setFocusScope("canvas");
    assert.equal(onArrange(getContextKeys()), true);
    setFocusScope(null);
    assert.equal(onArrange(getContextKeys()), true, "pointer over the inspector, top bar or toolbar");
  });

  it("does not work over the timeline or the blueprint, where those keys are theirs", () => {
    setFocusScope("timeline");
    assert.equal(onArrange(getContextKeys()), false);
    setFocusScope("blueprint");
    assert.equal(onArrange(getContextKeys()), false);
  });

  it("never while typing, with nothing selected, or outside Design", () => {
    setTextEditing(true);
    assert.equal(onArrange(getContextKeys()), false, "a text field has focus");
    setTextEditing(false);
    useSelectionStore.setState({ selectedIds: [] });
    assert.equal(onArrange(getContextKeys()), false, "nothing selected");
    useSelectionStore.getState().select("a", "element");
    useCanvasViewStore.setState({ mode: "preview" });
    assert.equal(onArrange(getContextKeys()), false, "not in Design (Preview)");
  });
});
