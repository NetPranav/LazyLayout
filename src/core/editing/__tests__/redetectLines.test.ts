import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { getDocument, setDocument } from "../../store/documentState";
import { registerLetterMeasurer, splitText, unsplitText, type LetterBox } from "../splitText";

const boxes = (lines: string[]): LetterBox[] => lines.flatMap((line, row) => [...line].map((ch, i) => ({ ch, i })).filter((c) => c.ch.trim() !== "").map((c) => ({ char: c.ch, x: c.i * 10, y: row * 24, width: 10, height: 20 })));

describe("re-detect lines (D12)", () => {
  it("a lines group remembers its source; unsplit puts back the one text with its settings; splitting again follows the new wrap", () => {
    const b = new DocBuilder();
    const f = b.layer("container", "Frame", null, {});
    const t = b.layer("text", "Headline", f, { "content.text": "one two three four", "frame.x": 10, "frame.y": 20, "frame.width": 120, "frame.height": 60, "typography.fontSize": 20 });
    setDocument(b.build());
    registerLetterMeasurer(() => ({ boxes: boxes(["one two", "three four"]), width: 120, height: 60 }));
    const out = splitText(t, "lines");
    assert.ok(out.group);
    const g = getDocument().layers[out.group!];
    assert.equal(g.properties["group.role"], "lines");
    assert.equal(g.children.length, 2);
    const back = unsplitText(out.group!);
    assert.ok(back);
    const text = getDocument().layers[back!];
    assert.equal(text.archetype, "text");
    assert.equal(text.properties["content.text"], "one two three four");
    assert.equal(text.properties["typography.fontSize"], 20);
    assert.equal(getDocument().layers[out.group!], undefined);
    // the box got narrower: the same text wraps into three lines now
    registerLetterMeasurer(() => ({ boxes: boxes(["one two", "three", "four"]), width: 60, height: 90 }));
    const again = splitText(back!, "lines");
    assert.equal(getDocument().layers[again.group!].children.length, 3);
    registerLetterMeasurer(null);
  });

  it("a group with no record of its source is left alone", () => {
    const b = new DocBuilder();
    const g = b.layer("container", "G", null, {});
    setDocument(b.build());
    assert.equal(unsplitText(g), null);
    assert.ok(getDocument().layers[g]);
  });
});
