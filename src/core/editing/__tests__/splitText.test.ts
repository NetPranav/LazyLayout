import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cannotSplit, isLettersGroup, splitIntoLetters, animateLetters, type LetterBox } from "../splitText";
import { setDocument, getDocument } from "../../store/documentState";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import { historyCommands } from "../../store/useDocumentStore";
import { useLayersUiStore } from "../../store/useLayersUiStore";
import { serializeRuns, type TextRun } from "../../text/runs";

function setupDoc(extraProps: Record<string, unknown> = {}) {
  const root = createLayer({
    id: "frame_root",
    archetype: "container",
    name: "Frame",
    properties: { "frame.x": 0, "frame.y": 0, "frame.width": 800, "frame.height": 600 },
  });
  const text = createLayer({
    id: "text_hello",
    archetype: "text",
    name: "Heading",
    parentId: "frame_root",
    properties: {
      "content.text": "Hello",
      "frame.x": 100,
      "frame.y": 200,
      "frame.width": 200,
      "frame.height": 40,
      "typography.fontSize": 32,
      "typography.lineHeight": 1.5,
      "typography.color": "#ff0000",
      ...extraProps,
    },
  });
  root.children = ["text_hello"];
  const doc = createDocumentFromLayers([root, text]);
  setDocument(doc);
  return { root, text };
}

describe("splitText: cannotSplit", () => {
  it("allows unrotated text layer with parent", () => {
    setupDoc();
    assert.equal(cannotSplit("text_hello"), null);
  });

  it("allows rotated text layer", () => {
    setupDoc({ "frame.rotation": 45 });
    assert.equal(cannotSplit("text_hello"), null);
  });

  it("refuses locked text layer", () => {
    const { text } = setupDoc();
    const doc = getDocument();
    doc.layers[text.id].locked = true;
    setDocument(doc);
    assert.equal(cannotSplit("text_hello"), "Unlock the text to split it.");
  });

  it("refuses non-text layers", () => {
    setupDoc();
    assert.equal(cannotSplit("frame_root"), "Only text can be split into letters.");
  });

  it("refuses top-level layers with no parentId", () => {
    const { text } = setupDoc();
    const doc = getDocument();
    doc.layers[text.id].parentId = null;
    setDocument(doc);
    assert.equal(cannotSplit("text_hello"), "This text has no place to put its letters.");
  });

  it("refuses 3D tilted text", () => {
    setupDoc({ "transform.rotateX": 25 });
    assert.equal(
      cannotSplit("text_hello"),
      "Straighten the text (no 3D tilt or corner pin) before splitting it into letters."
    );
  });

  it("refuses corner-pinned text", () => {
    setupDoc({ "transform.pin": "0,0,10,0,10,10,0,10" });
    assert.equal(
      cannotSplit("text_hello"),
      "Straighten the text (no 3D tilt or corner pin) before splitting it into letters."
    );
  });
});

describe("splitText: isLettersGroup", () => {
  it("a group marked as letters is one, whatever it is called", () => {
    const { root, text } = setupDoc();
    const doc = getDocument();
    assert.equal(isLettersGroup(doc.layers[text.id], doc.layers), false);
    assert.equal(isLettersGroup(doc.layers[root.id], doc.layers), false, "a frame holding a text is not a letters group");
    const marked = { ...doc.layers[root.id], name: "Anything", properties: { ...doc.layers[root.id].properties, "group.role": "letters" } };
    assert.equal(isLettersGroup(marked, doc.layers), true);
  });

  it("an unmarked group counts only if it still looks like split letters (one-letter texts, named '... letters')", () => {
    setupDoc();
    const doc = getDocument();
    const make = (id: string, name: string, children: string[]) => createLayer({ id, archetype: "container", name, parentId: "frame_root", children });
    const letter = createLayer({ id: "letter_h", archetype: "text", name: "H", parentId: "g1", properties: { "content.text": "H" } });
    doc.layers[letter.id] = letter;
    const old = make("g1", "Title letters", ["letter_h"]);
    const wordy = make("g2", "Title letters", ["text_hello"]); // "Hello" is a word, not a letter
    const named = make("g3", "My group", ["letter_h"]);
    for (const l of [old, wordy, named]) doc.layers[l.id] = l;
    setDocument(doc);
    assert.equal(isLettersGroup(old, doc.layers), true);
    assert.equal(isLettersGroup(wordy, doc.layers), false);
    assert.equal(isLettersGroup(named, doc.layers), false);
  });
});

describe("splitText: splitIntoLetters", () => {
  it("splits text into letters group and expands in layers store", () => {
    setupDoc();
    const boxes: LetterBox[] = [
      { char: "H", x: 0, y: 0, width: 20, height: 32 },
      { char: "i", x: 22, y: 0, width: 8, height: 32 },
    ];
    const groupId = splitIntoLetters("text_hello", boxes);
    assert.ok(groupId);
    const doc = getDocument();
    assert.equal(doc.layers["text_hello"], undefined, "original layer deleted");
    const group = doc.layers[groupId];
    assert.ok(group, "letters group exists");
    assert.equal(group.name, "Heading letters");
    assert.equal(group.children.length, 2);

    const letterH = doc.layers[group.children[0]];
    const letterI = doc.layers[group.children[1]];
    assert.equal(letterH.properties["content.text"], "H");
    assert.equal(letterI.properties["content.text"], "i");
    assert.equal(letterH.properties["typography.color"], "#ff0000");

    // Padding is reset to 0
    assert.equal(letterH.properties["layout.paddingTop"], 0);
    assert.equal(letterH.properties["layout.paddingLeft"], 0);

    // Group is expanded in useLayersUiStore
    assert.ok(useLayersUiStore.getState().expanded.has(groupId));
  });

  it("preserves rich runs styling (bold, italic, color) on letters", () => {
    const runs: TextRun[] = [
      { text: "A", bold: true, color: "#00ff00" },
      { text: "B", italic: true, color: "#0000ff" },
    ];
    setupDoc({
      "content.text": "AB",
      "content.runs": serializeRuns(runs),
    });

    const boxes: LetterBox[] = [
      { char: "A", x: 0, y: 0, width: 18, height: 30, bold: true, color: "#00ff00" },
      { char: "B", x: 20, y: 0, width: 18, height: 30, italic: true, color: "#0000ff" },
    ];
    const groupId = splitIntoLetters("text_hello", boxes);
    assert.ok(groupId);
    const doc = getDocument();
    const group = doc.layers[groupId];
    const letterA = doc.layers[group.children[0]];
    const letterB = doc.layers[group.children[1]];

    assert.equal(letterA.properties["typography.fontWeight"], 700);
    assert.equal(letterA.properties["typography.color"], "#00ff00");
    assert.equal(letterB.properties["typography.fontStyle"], "italic");
    assert.equal(letterB.properties["typography.color"], "#0000ff");
  });

  it("preserves rotation by applying frame.rotation to the group", () => {
    setupDoc({
      "frame.rotation": 30,
      "frame.x": 100,
      "frame.y": 100,
      "frame.width": 200,
      "frame.height": 50,
    });
    const boxes: LetterBox[] = [
      { char: "X", x: 0, y: 0, width: 20, height: 40 },
      { char: "Y", x: 25, y: 0, width: 20, height: 40 },
    ];
    const groupId = splitIntoLetters("text_hello", boxes);
    assert.ok(groupId);
    const doc = getDocument();
    const group = doc.layers[groupId];
    assert.equal(group.properties["frame.rotation"], 30);
  });
});

describe("splitText: animateLetters", () => {
  it("creates staggered entrance clips for each letter (40ms stagger)", () => {
    setupDoc();
    const boxes: LetterBox[] = [
      { char: "A", x: 0, y: 0, width: 20, height: 32 },
      { char: "B", x: 25, y: 0, width: 20, height: 32 },
      { char: "C", x: 50, y: 0, width: 20, height: 32 },
    ];
    const groupId = splitIntoLetters("text_hello", boxes);
    assert.ok(groupId);

    const clipIds = animateLetters(groupId, 0.04);
    assert.ok(clipIds);
    assert.equal(clipIds.length, 3);

    const doc = getDocument();
    const group = doc.layers[groupId];

    // Check stagger timing: letter i starts at i * 0.04s
    group.children.forEach((letterId, i) => {
      const clip = Object.values(doc.clips).find((c) => c.layerId === letterId);
      assert.ok(clip, `Letter ${i} has a clip`);
      assert.equal(clip.type, "entrance");
      assert.equal(clip.trigger, "mount");
      assert.equal(clip.duration, 0.6);
      const expectedDelay = Math.round(i * 0.04 * 1000) / 1000;
      assert.equal(clip.delay, expectedDelay, `Letter ${i} delay matches stagger timing`);

      // Verify tracks: slide up (transform.y 20 -> 0) and fade in (opacity 0 -> 1.0)
      const yTrack = clip.tracks.find((t) => t.property === "transform.y");
      const opacityTrack = clip.tracks.find((t) => t.property === "appearance.opacity");
      assert.ok(yTrack, "transform.y track exists");
      assert.ok(opacityTrack, "appearance.opacity track exists");

      assert.equal(yTrack.keyframes[0].value, 20);
      assert.equal(yTrack.keyframes[1].value, 0);
      assert.equal(opacityTrack.keyframes[0].value, 0);
      assert.equal(opacityTrack.keyframes[1].value, 1.0);
    });
  });

  it("one undo step removes all clips from animateLetters", () => {
    setupDoc();
    const boxes: LetterBox[] = [
      { char: "A", x: 0, y: 0, width: 20, height: 32 },
      { char: "B", x: 25, y: 0, width: 20, height: 32 },
    ];
    const groupId = splitIntoLetters("text_hello", boxes);
    assert.ok(groupId);

    animateLetters(groupId, 0.04);
    assert.equal(Object.keys(getDocument().clips).length, 2);

    historyCommands.undo();
    assert.equal(Object.keys(getDocument().clips).length, 0, "clips reverted in one undo step");
  });
});

describe("splitText: reliability", () => {
  const boxes: LetterBox[] = [
    { char: "A", x: 0, y: 4, width: 20, height: 32 },
    { char: "B", x: 25, y: 4, width: 20, height: 32 },
  ];

  it("the group is marked as letters, so renaming it keeps it a letters group", () => {
    setupDoc();
    const groupId = splitIntoLetters("text_hello", boxes)!;
    const doc = getDocument();
    assert.equal(doc.layers[groupId].properties["group.role"], "letters");
    assert.equal(isLettersGroup({ ...doc.layers[groupId], name: "Renamed" }, doc.layers), true);
  });

  it("Animate letters run twice gives each letter one entrance, not two", () => {
    setupDoc();
    const groupId = splitIntoLetters("text_hello", boxes)!;
    animateLetters(groupId);
    animateLetters(groupId);
    const doc = getDocument();
    for (const letterId of doc.layers[groupId].children) {
      assert.equal(Object.values(doc.clips).filter((c) => c.layerId === letterId).length, 1);
    }
  });

  it("a text sized in % gives letters sized in px", () => {
    setupDoc({ "frame.widthUnit": "%", "frame.heightUnit": "%" });
    const groupId = splitIntoLetters("text_hello", boxes)!;
    const doc = getDocument();
    for (const id of doc.layers[groupId].children) {
      assert.equal(doc.layers[id].properties["frame.widthUnit"], "px");
      assert.equal(doc.layers[id].properties["frame.heightUnit"], "px");
    }
  });

  it("a gradient fill keeps running across the word: each letter carries its offset in the word's box", () => {
    const gradient = JSON.stringify([{ type: "linear", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }], opacity: 1, visible: true }]);
    setupDoc({ "paint.fills": gradient });
    const groupId = splitIntoLetters("text_hello", boxes, { width: 200, height: 48 })!;
    const doc = getDocument();
    const [a, b] = doc.layers[groupId].children.map((id) => String(doc.layers[id].properties["paint.fillBox"]).split(",").map(Number));
    assert.deepEqual([a[0], a[2], a[3]], [0, 200, 48]);
    assert.deepEqual([b[0], b[2], b[3]], [25, 200, 48]);
  });

  it("a solid-only text gets no fill box", () => {
    setupDoc();
    const groupId = splitIntoLetters("text_hello", boxes)!;
    const doc = getDocument();
    assert.equal(doc.layers[doc.layers[groupId].children[0]].properties["paint.fillBox"], undefined);
  });
});
