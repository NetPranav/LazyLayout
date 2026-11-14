import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupLetterBoxes, type LetterBox } from "../splitText";

/** Lays text out as boxes the way the measurer would: a 10 px letter, a 10 px space, lines 24 px apart, spaces and breaks left out. */
function lay(lines: string[]): { text: string; boxes: LetterBox[] } {
  const boxes: LetterBox[] = [];
  lines.forEach((line, row) => {
    let x = 0;
    for (const ch of line) {
      if (ch.trim() !== "") boxes.push({ char: ch, x, y: row * 24, width: 10, height: 20 });
      x += 10;
    }
  });
  return { text: lines.join(" "), boxes };
}
const texts = (p: LetterBox[] | null) => p?.map((b) => b.char);

describe("grouping letters into words and lines (D12)", () => {
  it("words: a piece per word, with the box the word fills", () => {
    const { text, boxes } = lay(["Hello big world"]);
    const w = groupLetterBoxes(text, boxes, "words")!;
    assert.deepEqual(texts(w), ["Hello", "big", "world"]);
    assert.deepEqual([w[0].x, w[0].width], [0, 50]); // 5 letters
    assert.deepEqual([w[1].x, w[1].width], [60, 30]); // after a 10 px space
    assert.deepEqual([w[2].x, w[2].width], [100, 50]);
    assert.deepEqual([w[0].y, w[0].height], [0, 20]);
  });

  it("punctuation stays with the word before it, and a quote opens the word after it", () => {
    const { text, boxes } = lay(['Hello, "world"! Fine.']);
    assert.deepEqual(texts(groupLetterBoxes(text, boxes, "words")), ["Hello,", '"world"!', "Fine."]);
  });

  it("words across lines stay words, and a single piece is one", () => {
    const { text, boxes } = lay(["one two", "three"]);
    assert.deepEqual(texts(groupLetterBoxes(text, boxes, "words")), ["one", "two", "three"]);
    const one = lay(["Hi"]);
    assert.deepEqual(texts(groupLetterBoxes(one.text, one.boxes, "words")), ["Hi"]);
  });

  it("lines: a piece per drawn line, with its spaces kept and its box the line's", () => {
    const { text, boxes } = lay(["the quick brown", "fox jumps", "over"]);
    const l = groupLetterBoxes(text, boxes, "lines")!;
    assert.deepEqual(texts(l), ["the quick brown", "fox jumps", "over"]);
    assert.deepEqual([l[0].x, l[0].width, l[0].y], [0, 150, 0]);
    assert.deepEqual([l[1].width, l[1].y], [90, 24]);
    assert.deepEqual([l[2].width, l[2].y], [40, 48]);
  });

  it("the first letter's style carries to the piece", () => {
    const boxes: LetterBox[] = [{ char: "H", x: 0, y: 0, width: 10, height: 20, bold: true, color: "#f00" }, { char: "i", x: 10, y: 0, width: 5, height: 20, bold: false }];
    const w = groupLetterBoxes("Hi", boxes, "words")!;
    assert.equal(w[0].bold, true);
    assert.equal(w[0].color, "#f00");
  });

  it("text and boxes that do not match are refused, not guessed at", () => {
    const { boxes } = lay(["Hello world"]);
    assert.equal(groupLetterBoxes("Hello", boxes, "words"), null);
    assert.equal(groupLetterBoxes("Hello world and more", boxes, "lines"), null);
  });

  it("emoji and accented letters are one letter each", () => {
    const text = "né 👍🏽 ok";
    const boxes: LetterBox[] = [];
    let x = 0;
    for (const ch of ["n", "é", " ", "👍🏽", " ", "o", "k"]) {
      if (ch !== " ") boxes.push({ char: ch, x, y: 0, width: 10, height: 20 });
      x += 10;
    }
    assert.deepEqual(texts(groupLetterBoxes(text, boxes, "words")), ["né", "👍🏽", "ok"]);
  });

  it("newlines in the text are line breaks, not letters", () => {
    const { boxes } = lay(["ab", "cd"]);
    assert.deepEqual(texts(groupLetterBoxes("ab\ncd", boxes, "lines")), ["ab", "cd"]);
    assert.deepEqual(texts(groupLetterBoxes("ab\ncd", boxes, "words")), ["ab", "cd"]);
  });
});
