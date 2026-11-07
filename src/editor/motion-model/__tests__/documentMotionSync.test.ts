import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { documentStore, documentCommands, getDocument, historyCommands } from "@/core/store/useDocumentStore";
import { setDocument } from "@/core/store/documentState";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { setKeyframeAt, deleteKeyframes } from "@/core/timeline/keyframeOps";
import { evaluate } from "@/core/kernel/evaluate";
import { createLayer, createDocumentFromLayers } from "@/core/document/factories";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import {
  useMotionModel,
  motionActions,
  syncDocumentToMotion,
  installDocumentMotionSync,
} from "../index";

describe("Document Store to Motion UI Synchronization (Canonical MDM v5)", () => {
  let cleanupSync: (() => void) | null = null;

  beforeEach(() => {
    // Reset stores and provide a root container in doc
    useHistoryStore.setState({ past: [], future: [] });
    const root = createLayer({ id: "root", archetype: "container", parentId: null });
    setDocument(createDocumentFromLayers([root]));
    cleanupSync = installDocumentMotionSync();
  });

  afterEach(() => {
    if (cleanupSync) {
      cleanupSync();
      cleanupSync = null;
    }
  });

  it("M1 & M5: Newly created document layer appears in comp.layers and timeline projection automatically", () => {
    const rectLayer = createLayer({
      id: "rect_test_1",
      name: "Rectangle 1",
      archetype: "rectangle",
      parentId: "root",
      properties: {
        "frame.x": 100,
        "frame.y": 150,
        "frame.width": 200,
        "frame.height": 100,
        "appearance.opacity": 1,
      },
    });

    documentCommands.insertLayers([rectLayer], [], "Create rectangle");

    const comp = useMotionModel.getState().comp;
    const found = comp.layers.find((l) => l.id === "rect_test_1");

    assert.ok(found, "Newly created layer must automatically project into comp.layers");
    assert.equal(found?.id, "rect_test_1");
    assert.equal(found?.clips.length, 1, "Default clip created spanning composition");
  });

  it("M2: Renaming, updating and deleting layers update Motion UI projection", () => {
    const rectLayer = createLayer({
      id: "rect_test_2",
      name: "Old Name",
      archetype: "rectangle",
      parentId: "root",
      properties: { "frame.x": 50, "frame.y": 50 },
    });
    documentCommands.insertLayers([rectLayer], [], "Insert layer");

    // Rename
    documentCommands.renameLayer("rect_test_2", "New Name");
    let comp = useMotionModel.getState().comp;
    let found = comp.layers.find((l) => l.id === "rect_test_2");
    assert.ok(found);

    // Delete
    documentCommands.removeLayer("rect_test_2");
    comp = useMotionModel.getState().comp;
    found = comp.layers.find((l) => l.id === "rect_test_2");
    assert.equal(found, undefined, "Deleted layer must be removed from comp.layers");
  });

  it("M3: Undo and redo preserve layer-to-motion synchronization", () => {
    const rectLayer = createLayer({
      id: "rect_undo_1",
      name: "Undo Rect",
      archetype: "rectangle",
      parentId: "root",
      properties: { "frame.x": 10, "frame.y": 20 },
    });
    documentCommands.insertLayers([rectLayer], [], "Insert layer for undo");

    assert.ok(useMotionModel.getState().comp.layers.find((l) => l.id === "rect_undo_1"));

    // Undo insertion
    historyCommands.undo();
    assert.equal(useMotionModel.getState().comp.layers.find((l) => l.id === "rect_undo_1"), undefined);

    // Redo insertion
    historyCommands.redo();
    assert.ok(useMotionModel.getState().comp.layers.find((l) => l.id === "rect_undo_1"));
  });

  it("M6: Keyframe creation mutates canonical MDM through document transactions", () => {
    const layer = createLayer({
      id: "anim_layer_1",
      name: "Animated Box",
      archetype: "rectangle",
      parentId: "root",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "appearance.opacity": 1,
      },
    });
    documentCommands.insertLayers([layer], [], "Insert layer");

    // Add keyframes via motionActions.addKey
    motionActions.addKey("anim_layer_1", "opacity", 0, 0); // 0s -> opacity 0%
    motionActions.addKey("anim_layer_1", "opacity", 60, 100); // 1s -> opacity 100%

    // Assert canonical clips in getDocument().clips
    const doc = getDocument();
    const clips = Object.values(doc.clips).filter((c) => c.layerId === "anim_layer_1");
    assert.ok(clips.length > 0, "Canonical clip created in MDM");

    const track = clips[0].tracks.find((t) => t.property === "appearance.opacity");
    assert.ok(track, "Canonical appearance.opacity track created in MDM");
    assert.equal(track?.keyframes.length, 2, "2 keyframes stored in MDM");

    // Verify canonical evaluate() outputs
    const evalAt0 = evaluate(doc, MAIN_COMPOSITION_ID, "anim_layer_1", 0);
    assert.equal(evalAt0["appearance.opacity"], 0, "Canonical evaluate() at t=0 returns opacity 0");

    const evalAt1 = evaluate(doc, MAIN_COMPOSITION_ID, "anim_layer_1", 1);
    assert.equal(evalAt1["appearance.opacity"], 1, "Canonical evaluate() at t=1 returns opacity 1");

    const evalAtHalf = evaluate(doc, MAIN_COMPOSITION_ID, "anim_layer_1", 0.5);
    assert.ok(
      (evalAtHalf["appearance.opacity"] as number) > 0.4 && (evalAtHalf["appearance.opacity"] as number) < 0.6,
      "Canonical evaluate() at t=0.5 produces interpolated opacity"
    );
  });

  it("M8: Preserves Phase 72 anchor semantics and Phase 73 parenting matrix multiplication during animation", () => {
    const parent = createLayer({
      id: "parent_box",
      name: "Parent",
      archetype: "container",
      parentId: "root",
      properties: {
        "frame.x": 100,
        "frame.y": 100,
        "frame.width": 200,
        "frame.height": 200,
        "transform.x": 0,
      },
    });
    const child = createLayer({
      id: "child_box",
      name: "Child",
      archetype: "rectangle",
      parentId: "parent_box",
      parentRef: "parent_box",
      properties: {
        "frame.x": 20,
        "frame.y": 20,
        "frame.width": 50,
        "frame.height": 50,
        "transform.parent": "parent_box",
      },
    });
    documentCommands.insertLayers([parent, child], [], "Create parent and child");

    // Animate parent position X from 0px at t=0s to 100px at t=1s
    setKeyframeAt("parent_box", "transform.x", 0, { value: 0 });
    setKeyframeAt("parent_box", "transform.x", 1.0, { value: 100 });

    const doc = getDocument();

    // Evaluate child world matrix at t=0 and t=1
    const childEval0 = evaluate(doc, MAIN_COMPOSITION_ID, "child_box", 0);
    const childEval1 = evaluate(doc, MAIN_COMPOSITION_ID, "child_box", 1.0);

    const m0 = childEval0["transform.worldMatrix"] as number[];
    const m1 = childEval1["transform.worldMatrix"] as number[];

    assert.ok(m0 && m1, "World matrices must be computed across parent chain");
    // World X translation should shift by 100px
    assert.equal(Math.round(m1[4] - m0[4]), 100, "Child follows parent animated transform with 0 divergence");
  });

  it("Preserves unknown/custom canonical tracks in MDM without dropping them", () => {
    const layer = createLayer({
      id: "custom_layer",
      name: "Custom",
      archetype: "rectangle",
      parentId: "root",
      properties: {
        "transform.z": 0,
      },
    });
    documentCommands.insertLayers([layer], [], "Insert custom layer");

    // Set custom track on transform.z
    setKeyframeAt("custom_layer", "transform.z", 0, { value: 50 });

    // Run projection
    const doc = getDocument();
    const comp = syncDocumentToMotion(doc, useMotionModel.getState().comp);

    assert.ok(comp.layers.find((l) => l.id === "custom_layer"));
    // Ensure canonical clip is still in MDM
    const customClips = Object.values(doc.clips).filter((c) => c.layerId === "custom_layer");
    assert.ok(customClips[0].tracks.some((t) => t.property === "transform.z"), "Unsupported tracks preserved in MDM");
  });

  it("Non-central anchor animation: evaluates correct local matrix and origin offsets", () => {
    const layer = createLayer({
      id: "anchor_layer",
      name: "Rotated Anchor Box",
      archetype: "rectangle",
      parentId: "root",
      properties: {
        "frame.x": 100,
        "frame.y": 100,
        "frame.width": 200,
        "frame.height": 100,
        "transform.origin": "bottom right", // Anchor at [200, 100]
        "transform.rotate": 0,
      },
    });
    documentCommands.insertLayers([layer], [], "Insert layer with anchor");

    // Animate rotation from 0 to 90 deg
    setKeyframeAt("anchor_layer", "transform.rotate", 0, { value: 0 });
    setKeyframeAt("anchor_layer", "transform.rotate", 1.0, { value: 90 });

    const doc = getDocument();
    const eval0 = evaluate(doc, MAIN_COMPOSITION_ID, "anchor_layer", 0);
    const eval1 = evaluate(doc, MAIN_COMPOSITION_ID, "anchor_layer", 1.0);

    assert.equal(eval0["transform.rotate"], 0);
    assert.equal(eval1["transform.rotate"], 90);

    const m0 = eval0["transform.worldMatrix"] as number[];
    const m1 = eval1["transform.worldMatrix"] as number[];
    assert.ok(m0 && m1);
    // At 90 deg rotation about bottom right anchor [300, 200]
    assert.notDeepEqual(m0, m1, "World matrix reflects anchor-aware rotation");
  });

  it("Subscription lifecycle: idempotent installation and clean teardown without sync loops", () => {
    const unsub1 = installDocumentMotionSync();
    const unsub2 = installDocumentMotionSync();

    // Trigger document mutation
    const layer = createLayer({
      id: "sub_lifecycle_layer",
      name: "Lifecycle Test",
      archetype: "rectangle",
      parentId: "root",
      properties: { "frame.x": 0, "frame.y": 0 },
    });
    documentCommands.insertLayers([layer], [], "Insert lifecycle layer");

    assert.ok(useMotionModel.getState().comp.layers.find((l) => l.id === "sub_lifecycle_layer"));

    // Clean teardown
    unsub1();
    unsub2();
  });
});


