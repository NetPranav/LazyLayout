import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDepthOffsets, mixWithBlack, standLetters, extrudeLetters, removeDepth, getLettersDepth } from "../standingLetters";
import { getDefaultProps } from "../../document/registry";
import { documentCommands, getDocument } from "../../store/useDocumentStore";
import { isLettersGroup } from "../splitText";

describe("standing letters: pure helpers", () => {
  describe("computeDepthOffsets", () => {
    it("computes 8 evenly spaced negative translateZ offsets for depth = 24", () => {
      const offsets = computeDepthOffsets(24, 8);
      assert.deepEqual(offsets, [-3, -6, -9, -12, -15, -18, -21, -24]);
    });

    it("computes 4 evenly spaced negative offsets for depth = 16", () => {
      const offsets = computeDepthOffsets(16, 4);
      assert.deepEqual(offsets, [-4, -8, -12, -16]);
    });

    it("handles depth = 40 with 8 steps", () => {
      const offsets = computeDepthOffsets(40, 8);
      assert.deepEqual(offsets, [-5, -10, -15, -20, -25, -30, -35, -40]);
    });

    it("handles zero depth gracefully", () => {
      const offsets = computeDepthOffsets(0, 8);
      assert.equal(offsets.length, 8);
      assert.ok(offsets.every((o) => o === 0 || Object.is(o, -0)));
    });

    it("returns empty array when count is <= 0", () => {
      assert.deepEqual(computeDepthOffsets(24, 0), []);
      assert.deepEqual(computeDepthOffsets(24, -1), []);
    });
  });

  describe("mixWithBlack", () => {
    it("mixes pure white with 35% black (channels at 65% of 255 = 166)", () => {
      const mixed = mixWithBlack("#FFFFFF", 0.35);
      // 255 * 0.65 = 165.75 -> 166 -> #A6A6A6
      assert.equal(mixed.toUpperCase(), "#A6A6A6");
    });

    it("mixes pure red with 35% black", () => {
      const mixed = mixWithBlack("#FF0000", 0.35);
      assert.equal(mixed.toUpperCase(), "#A60000");
    });

    it("mixing black with black stays black", () => {
      const mixed = mixWithBlack("#000000", 0.35);
      assert.equal(mixed.toUpperCase(), "#000000");
    });

    it("handles CSS named color 'white'", () => {
      const mixed = mixWithBlack("white", 0.35);
      assert.equal(mixed.toUpperCase(), "#A6A6A6");
    });

    it("weight 0 returns the original color", () => {
      const mixed = mixWithBlack("#FFFFFF", 0);
      assert.equal(mixed.toUpperCase(), "#FFFFFF");
    });

    it("weight 1 returns full black", () => {
      const mixed = mixWithBlack("#FFFFFF", 1);
      assert.equal(mixed.toUpperCase(), "#000000");
    });

    it("handles fallback gracefully on invalid input", () => {
      const mixed = mixWithBlack("not-a-color", 0.35);
      assert.equal(mixed.toUpperCase(), "#000000");
    });
  });
});

describe("standing letters: command operations", () => {
  it("standLetters tilts group as ground plane and stands each letter upright", () => {
    // Setup a letters group with 3 letters
    const rootId = Object.values(getDocument().layers).find((l) => l.parentId === null)?.id ?? null;
    const groupId = documentCommands.addLayer({
      archetype: "container",
      parentId: rootId,
      name: "FERRARI letters",
      properties: {
        ...getDefaultProps("container"),
        "frame.kind": "group",
        positioning: "absolute",
        "frame.x": 50,
        "frame.y": 100,
        "frame.width": 300,
        "frame.height": 60,
      },
    }, "Add letters group");

    const letterF = documentCommands.addLayer({
      archetype: "text",
      parentId: groupId,
      name: "F",
      properties: {
        ...getDefaultProps("text"),
        "content.text": "F",
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 40,
        "frame.height": 60,
        "typography.color": "#FF0000",
      },
    }, "Add letter F");

    const letterE = documentCommands.addLayer({
      archetype: "text",
      parentId: groupId,
      name: "E",
      properties: {
        ...getDefaultProps("text"),
        "content.text": "E",
        "frame.x": 45,
        "frame.y": 0,
        "frame.width": 40,
        "frame.height": 60,
        "typography.color": "#FF0000",
      },
    }, "Add letter E");

    assert.ok(isLettersGroup(getDocument().layers[groupId], getDocument().layers));

    // Stand letters up
    const res = standLetters(groupId);
    assert.equal(res, groupId);

    const doc = getDocument();
    const group = doc.layers[groupId];
    assert.equal(group.properties["transform.perspective"], 900);
    assert.equal(group.properties["transform.rotateX"], 55);
    assert.equal(group.properties["transform.style3d"], "preserve3d");

    const f = doc.layers[letterF];
    assert.equal(f.properties["transform.rotateX"], -55);
    assert.equal(f.properties["transform.origin"], "bottom center");

    const e = doc.layers[letterE];
    assert.equal(e.properties["transform.rotateX"], -55);
    assert.equal(e.properties["transform.origin"], "bottom center");
  });

  it("extrudeLetters creates 8 depth copies behind each letter and removeDepth restores", () => {
    const rootId = Object.values(getDocument().layers).find((l) => l.parentId === null)?.id ?? null;
    const groupId = documentCommands.addLayer({
      archetype: "container",
      parentId: rootId,
      name: "TEST letters",
      properties: {
        ...getDefaultProps("container"),
        "frame.kind": "group",
        positioning: "absolute",
        "frame.x": 50,
        "frame.y": 100,
        "frame.width": 200,
        "frame.height": 60,
      },
    }, "Add test group");

    const letterT = documentCommands.addLayer({
      archetype: "text",
      parentId: groupId,
      name: "T",
      properties: {
        ...getDefaultProps("text"),
        "content.text": "T",
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 40,
        "frame.height": 60,
        "typography.color": "#FFFFFF",
      },
    }, "Add letter T");

    // Extrude with depth = 24: a property of the letter, drawn by the renderer (no extra layers)
    const letters = extrudeLetters(groupId, 24, 8);
    assert.equal(letters, 1);
    let doc = getDocument();
    assert.equal(doc.layers[groupId].children.length, 1, "no copies are added as layers");
    assert.equal(doc.layers[letterT].properties["text.depth"], 24);
    assert.equal(doc.layers[letterT].properties["text.depthSteps"], 8);
    assert.equal(getLettersDepth(groupId), 24);

    // again with another depth: replaced, not stacked
    extrudeLetters(groupId, 40, 8);
    assert.equal(getDocument().layers[letterT].properties["text.depth"], 40);

    // Remove depth restores a plain letter
    const removed = removeDepth(groupId);
    assert.equal(removed, 1);
    doc = getDocument();
    assert.equal(doc.layers[letterT].properties["text.depth"] ?? 0, 0);
    assert.equal(getLettersDepth(groupId), null);
  });

  it("depth groups from older documents are recognised by their structure and removed; a user's '... depth' group is kept", () => {
    const rootId = Object.values(getDocument().layers).find((l) => l.parentId === null)?.id ?? null;
    const groupId = documentCommands.addLayer({ archetype: "container", parentId: rootId, name: "OLD letters", properties: { ...getDefaultProps("container"), "group.role": "letters" } }, "g");
    const letter = documentCommands.addLayer({ archetype: "text", parentId: groupId, name: "O", properties: { ...getDefaultProps("text"), "content.text": "O" } }, "l");
    const legacy = documentCommands.addLayer({ archetype: "container", parentId: groupId, name: "O depth", properties: getDefaultProps("container") }, "d");
    documentCommands.addLayer({ archetype: "text", parentId: legacy, name: "O depth 1", properties: { ...getDefaultProps("text"), "content.text": "O", "transform.translateZ": -3, "appearance.pointerEvents": "none" } }, "c");
    const mine = documentCommands.addLayer({ archetype: "container", parentId: groupId, name: "Sky depth", properties: getDefaultProps("container") }, "u");
    documentCommands.addLayer({ archetype: "text", parentId: mine, name: "cloud", properties: { ...getDefaultProps("text"), "content.text": "cloud" } }, "u2");
    assert.equal(getLettersDepth(groupId), 3);
    removeDepth(groupId);
    const doc = getDocument();
    assert.equal(doc.layers[legacy], undefined, "the old depth group is gone");
    assert.ok(doc.layers[mine], "the user's own group is kept");
    assert.ok(doc.layers[letter]);
  });
});
