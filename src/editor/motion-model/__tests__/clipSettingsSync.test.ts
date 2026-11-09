import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { documentCommands, getDocument, historyCommands } from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { createLayer, createDocumentFromLayers, attachClip } from "@/core/document/factories";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import type { ClipCategory, Trigger } from "../types";
import {
  useMotionModel,
  motionActions,
  syncDocumentToMotion,
  installDocumentMotionSync,
} from "../index";

describe("Phase 53: Animation Grammar & Clip Settings Synchronization", () => {
  let cleanupSync: (() => void) | null = null;

  beforeEach(() => {
    useHistoryStore.setState({ past: [], future: [] });
    const root = createLayer({ id: "root", archetype: "container", parentId: null });
    const rect = createLayer({
      id: "rect_53",
      name: "Rectangle 53",
      archetype: "rectangle",
      parentId: "root",
      properties: {
        "frame.x": 100,
        "frame.y": 100,
        "frame.width": 200,
        "frame.height": 100,
      },
    });
    setDocument(createDocumentFromLayers([root, rect]));
    cleanupSync = installDocumentMotionSync();
  });

  afterEach(() => {
    if (cleanupSync) {
      cleanupSync();
      cleanupSync = null;
    }
  });

  it("choosing each category writes the expected { type, trigger } to the document clip", () => {
    const expectedPairs: Array<{
      category: ClipCategory;
      expectedType: string;
      expectedTrigger: string;
      expectedUiTrigger: Trigger;
    }> = [
      { category: "Entrance", expectedType: "entrance", expectedTrigger: "mount", expectedUiTrigger: "On load" },
      { category: "Hover", expectedType: "hover", expectedTrigger: "hover", expectedUiTrigger: "On hover" },
      { category: "Tap", expectedType: "tap", expectedTrigger: "press", expectedUiTrigger: "On press" },
      { category: "Scroll", expectedType: "scroll", expectedTrigger: "scrollProgress", expectedUiTrigger: "While scrolling" },
      { category: "Loop", expectedType: "loop", expectedTrigger: "mount", expectedUiTrigger: "On load" },
      { category: "Morph", expectedType: "morph", expectedTrigger: "mount", expectedUiTrigger: "On load" },
      { category: "Exit", expectedType: "exit", expectedTrigger: "unmount", expectedUiTrigger: "On leave" },
      { category: "Focus", expectedType: "focus", expectedTrigger: "focus", expectedUiTrigger: "On focus" },
      { category: "Stagger", expectedType: "stagger", expectedTrigger: "mount", expectedUiTrigger: "On load" },
      { category: "Layout", expectedType: "layout", expectedTrigger: "layoutChange", expectedUiTrigger: "When its layout changes" },
    ];

    for (const { category, expectedType, expectedTrigger, expectedUiTrigger } of expectedPairs) {
      motionActions.setClipCategory("rect_53", category);

      const doc = getDocument();
      const clip = Object.values(doc.clips).find((c) => c.layerId === "rect_53" && c.enabled);
      assert.ok(clip, `Document clip must exist for category "${category}"`);
      assert.equal(clip?.type, expectedType, `Category "${category}" must set document clip.type to "${expectedType}"`);
      assert.equal(clip?.trigger, expectedTrigger, `Category "${category}" must set default document clip.trigger to "${expectedTrigger}"`);

      if (category === "Stagger") {
        assert.ok(clip?.stagger, "A stagger clip must define its stagger refinement");
      }

      const comp = useMotionModel.getState().comp;
      const l = comp.layers.find((layer) => layer.id === "rect_53");
      assert.ok(l, "Layer must exist in Motion comp");
      assert.equal(l?.category, category, `Motion layer category must be "${category}"`);
      assert.equal(l?.trig, expectedUiTrigger, `Motion layer trig must be "${expectedUiTrigger}"`);
    }
  });

  it('a document clip with trigger "unmount" and type "exit" shows as "On leave" / "Exit" after sync', () => {
    const exitClip = attachClip(
      {
        id: "clip_exit_test",
        name: "Exit Animation",
        type: "exit",
        trigger: "unmount",
        duration: 2,
        easing: "power2.out",
        enabled: true,
        tracks: [],
      },
      "rect_53"
    );

    documentCommands.insertLayers([], [exitClip], "Insert exit clip");

    const comp = useMotionModel.getState().comp;
    const l = comp.layers.find((layer) => layer.id === "rect_53");
    assert.ok(l, "Motion layer must exist");
    assert.equal(l?.category, "Exit", 'Clip with type "exit" must sync category to "Exit"');
    assert.equal(l?.trig, "On leave", 'Clip with trigger "unmount" must sync trig to "On leave"');

    // Also verify pure projection function syncDocumentToMotion
    const projectedComp = syncDocumentToMotion(getDocument(), comp);
    const projLayer = projectedComp.layers.find((layer) => layer.id === "rect_53");
    assert.equal(projLayer?.category, "Exit");
    assert.equal(projLayer?.trig, "On leave");
  });

  it("undo restores the previous category and trigger", () => {
    // 1. Set to Exit
    motionActions.setClipCategory("rect_53", "Exit");
    let clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.type, "exit");
    assert.equal(clip?.trigger, "unmount");

    // 2. Set to Focus
    motionActions.setClipCategory("rect_53", "Focus");
    clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.type, "focus");
    assert.equal(clip?.trigger, "focus");
    assert.equal(useMotionModel.getState().comp.layers.find((l) => l.id === "rect_53")?.category, "Focus");

    // 3. Undo must restore Exit
    historyCommands.undo();
    clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.type, "exit", "Undo must restore clip type to exit");
    assert.equal(clip?.trigger, "unmount", "Undo must restore clip trigger to unmount");

    const l = useMotionModel.getState().comp.layers.find((layer) => layer.id === "rect_53");
    assert.equal(l?.category, "Exit", "Undo must restore MotionLayer category to Exit");
    assert.equal(l?.trig, "On leave", "Undo must restore MotionLayer trig to On leave");
  });

  it("user can change trigger independently after choosing category", () => {
    // 1. Choose Exit (sets On leave / unmount)
    motionActions.setClipCategory("rect_53", "Exit");
    let clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.type, "exit");
    assert.equal(clip?.trigger, "unmount");

    // 2. Change trigger to Follow the pointer (pointerMove)
    motionActions.setClipTrigger("rect_53", "Follow the pointer");
    clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.type, "exit", "Category type must remain exit");
    assert.equal(clip?.trigger, "pointerMove", "Trigger must be updated to pointerMove");

    const l = useMotionModel.getState().comp.layers.find((layer) => layer.id === "rect_53");
    assert.equal(l?.category, "Exit");
    assert.equal(l?.trig, "Follow the pointer");
  });

  it('legacy "On click" maps to canonical "press"', () => {
    motionActions.setClipTrigger("rect_53", "On click");
    const clip = Object.values(getDocument().clips).find((c) => c.layerId === "rect_53" && c.enabled);
    assert.equal(clip?.trigger, "press", 'UI "On click" must map to canonical "press"');

    // Canonical press projects to "On press" in the UI
    const comp = useMotionModel.getState().comp;
    const l = comp.layers.find((layer) => layer.id === "rect_53");
    assert.equal(l?.trig, "On press");
  });
});
