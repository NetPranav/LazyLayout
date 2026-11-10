"use client";

/**
 * Measures the letters of a drawn text layer for "Split into letters" (core asks through `registerLetterMeasurer`, so
 * it never touches the DOM itself). Positions come from the drawn text, so wrapping, letter spacing and kerning are
 * respected.
 */

import { getDocument } from "@/core/store/documentState";
import { parseRuns } from "@/core/text/runs";
import { registerLetterMeasurer, splitGraphemes, type LetterBox, type LetterMeasure } from "@/core/editing/splitText";

type CharStyle = Pick<LetterBox, "bold" | "italic" | "underline" | "strike" | "color">;

/**
 * The style of each character of the text, in reading order, without line breaks. The drawn text has no line breaks
 * either (a paragraph is its own block) and may hold a zero-width space for an empty paragraph, so characters are
 * matched one by one, skipping both, rather than by index (which slipped one character per line).
 */
function charStyles(id: string): CharStyle[] {
  const layer = getDocument().layers[id];
  if (!layer) return [];
  const raw = typeof layer.properties["content.text"] === "string" ? (layer.properties["content.text"] as string) : layer.name;
  const runs = parseRuns(layer.properties["content.runs"], raw);
  const out: CharStyle[] = [];
  for (const run of runs ?? []) {
    for (const ch of run.text) {
      if (ch === "\n" || ch === "\r") continue;
      out.push({ bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, color: run.color });
    }
  }
  return out;
}

export function measureLetters(id: string): LetterMeasure | null {
  if (typeof document === "undefined") return null;
  const node = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype="text"][data-element-id="${id}"]`);
  if (!node) return null;

  // measure in the text's own, untransformed space
  const prevTransform = node.style.transform;
  node.style.transform = "none";
  try {
    const box = node.getBoundingClientRect();
    const scale = node.offsetWidth > 0 ? box.width / node.offsetWidth : 1;
    const styles = charStyles(id);
    let next = 0; // the next run character to match
    const out: LetterBox[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      // the depth copies and list markers are drawings of the text, not the text
      acceptNode: (n) => (n.parentElement?.closest("[data-depth-copy],[data-list-marker]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
      for (const { at, char } of splitGraphemes(text.data)) {
        if (char === "\n" || char === "\r" || char === "​") continue;
        const style = styles.slice(next, next + char.length);
        next += char.length;
        if (char.trim() === "") continue;
        const range = document.createRange();
        range.setStart(text, at);
        range.setEnd(text, at + char.length);
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const s = style[0] ?? {};
        out.push({
          char,
          x: (r.left - box.left) / scale,
          y: (r.top - box.top) / scale,
          width: r.width / scale,
          height: r.height / scale,
          ...(s.bold !== undefined ? { bold: s.bold } : {}),
          ...(s.italic !== undefined ? { italic: s.italic } : {}),
          ...(s.underline !== undefined ? { underline: s.underline } : {}),
          ...(s.strike !== undefined ? { strike: s.strike } : {}),
          ...(s.color ? { color: s.color } : {}),
        });
      }
    }
    return { boxes: out, width: node.offsetWidth, height: node.offsetHeight };
  } finally {
    node.style.transform = prevTransform;
  }
}

registerLetterMeasurer(measureLetters);
