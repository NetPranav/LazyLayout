import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySuggestion, suggest } from "../cssSuggest";

describe("Style code autocomplete (D3)", () => {
  it("offers property names that start with what is typed", () => {
    const s = suggest("back", 4)!;
    assert.equal(s.kind, "property");
    assert.ok(s.choices.includes("background"));
    assert.ok(s.choices.every((c) => c.startsWith("back")));
  });

  it("offers nothing for an empty word, or a word with no match", () => {
    assert.equal(suggest("", 0), null);
    assert.equal(suggest("padding: 4px;\n", 14), null);
    assert.equal(suggest("zzzz", 4), null);
  });

  it("works on the line being typed, after earlier declarations", () => {
    const text = "padding: 24px;\nbord";
    const s = suggest(text, text.length)!;
    assert.equal(s.word, "bord");
    assert.ok(s.choices.includes("border-radius"));
    assert.equal(s.from, text.length - 4);
  });

  it("offers values after a colon, from the registry's options and the keywords", () => {
    const s = suggest("display: fl", 11)!;
    assert.equal(s.kind, "value");
    assert.deepEqual(s.choices, ["flex"]);
    const m = suggest("mix-blend-mode: ", 16)!;
    assert.ok(m.choices.includes("multiply"));
  });

  it("stays quiet inside a longer value", () => {
    assert.equal(suggest("transform: rotate(3deg) sc", 26), null);
    assert.equal(suggest("background: url(", 16), null);
  });

  it("applying a property choice writes `name: ` and puts the caret after it", () => {
    const text = "padding: 24px;\nbord";
    const s = suggest(text, text.length)!;
    const r = applySuggestion(text, text.length, s, "border-radius");
    assert.equal(r.text, "padding: 24px;\nborder-radius: ");
    assert.equal(r.caret, r.text.length);
  });

  it("applying a value choice writes `value;`", () => {
    const text = "display: fl";
    const s = suggest(text, text.length)!;
    const r = applySuggestion(text, text.length, s, "flex");
    assert.equal(r.text, "display: flex;");
  });
});
