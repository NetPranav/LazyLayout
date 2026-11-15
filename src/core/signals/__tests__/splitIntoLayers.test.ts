import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detachSplitLayers,
  measureUnsplitGlyphBoxes,
  reconcileSplitTextLayers,
  setSplitPieceOverrides,
  splitTextIntoRealLayers,
} from "../splitIntoLayers.js";

describe("Phase 153 · Split into real layers", () => {
  it("matches unsplit glyph coordinates within 0.5 px across 5 fixture strings and keeps single AT read", () => {
    const fixtures = [
      "Hello",
      "LazyLayout Studio",
      "A\nMultiline\nHeadline",
      "Kerning & Punctuation!",
      "123.45% Motion Test",
    ];

    for (const sample of fixtures) {
      const unsplit = measureUnsplitGlyphBoxes(sample, { fontSizePx: 40 }).filter((g) => !/^\s+$/.test(g.text));
      const splitLetters = splitTextIntoRealLayers("headline", sample, "letters", {
        fontSizePx: 40,
        strokedText: true,
      });

      assert.equal(splitLetters.parentA11y["aria-label"], sample);
      assert.equal(splitLetters.pieces.length, unsplit.length);

      for (let i = 0; i < splitLetters.pieces.length; i++) {
        const piece = splitLetters.pieces[i]!;
        const glyph = unsplit[i]!;
        assert.ok(Math.abs(piece.homeX - glyph.x) < 0.5);
        assert.ok(Math.abs(piece.homeY - glyph.y) < 0.5);
        assert.equal(piece.a11y["aria-hidden"], "true");
        assert.equal(piece.a11y.strokeCopySelector, "[data-text-stroke-copy]");
      }
    }
  });

  it("splits words/lines, preserves overrides across non-destructive edits, and supports detach", () => {
    const initial = splitTextIntoRealLayers("title", "Fast Clean Motion", "words");
    assert.deepEqual(
      initial.pieces.map((p) => p.text),
      ["Fast", "Clean", "Motion"],
    );

    const edited = setSplitPieceOverrides(initial, "word:Clean#0", { "transform.rotate": -12 });
    const reconciled = reconcileSplitTextLayers(edited, "Super Clean Motion!", "words");
    const cleanWord = reconciled.pieces.find((p) => p.text === "Clean");
    assert.ok(cleanWord);
    assert.equal(cleanWord.overrides["transform.rotate"], -12);

    const detached = detachSplitLayers(reconciled);
    assert.equal(detached.detached, true);
    assert.ok(detached.pieces.every((p) => p.parentId === null));
  });
});
