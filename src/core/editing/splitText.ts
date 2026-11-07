/**
 * Split a text layer into one text layer per letter, in one step. Each letter keeps the look of the text (font, size,
 * weight, colour) and sits exactly where it was, so the words look the same until a letter is tilted, moved, recoloured or
 * animated by itself. The letters come as a group named after the text. Spaces are not given layers.
 *
 * The positions are measured from the drawn text, so wrapping, letter spacing and kerning are respected.
 */

import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { deleteLayers, groupLayers, renameLayer, transaction } from "./editOps";

export interface LetterBox {
  char: string;
  /** Position and size of the letter's glyph box, in px from the text layer's own top left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The letters of a drawn text layer, with their boxes, or null when the layer is not on screen. */
export function measureLetters(id: string): LetterBox[] | null {
  if (typeof document === "undefined") return null;
  const node = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype="text"][data-element-id="${id}"]`);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  const scale = node.offsetWidth > 0 ? box.width / node.offsetWidth : 1;
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const out: LetterBox[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
    const value = text.data;
    const pieces = segmenter ? Array.from(segmenter.segment(value), (s) => ({ at: s.index, char: s.segment })) : Array.from(value, (char, at) => ({ at, char }));
    for (const { at, char } of pieces) {
      if (char.trim() === "") continue;
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + char.length);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ char, x: (r.left - box.left) / scale, y: (r.top - box.top) / scale, width: r.width / scale, height: r.height / scale });
    }
  }
  return out;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Why a text layer cannot be split, or null when it can. */
export function cannotSplit(id: string): string | null {
  const layer = getDocument().layers[id];
  if (!layer || layer.archetype !== "text") return "Only text can be split into letters.";
  if (layer.locked) return "Unlock the text to split it.";
  if (!layer.parentId) return "This text has no place to put its letters.";
  const p = layer.properties;
  if (num(p["frame.rotation"]) !== 0 || num(p["transform.rotateX"]) !== 0 || num(p["transform.rotateY"]) !== 0 || (typeof p["transform.pin"] === "string" && p["transform.pin"] !== "")) {
    return "Straighten the text (no rotation, tilt or corner pin) before splitting it into letters.";
  }
  return null;
}

/** Replaces the text with a group of one layer per letter. Returns the group's id, or null when it cannot be done. */
export function splitIntoLetters(id: string, boxes: readonly LetterBox[]): string | null {
  if (cannotSplit(id) !== null || boxes.length === 0) return null;
  const src = getDocument().layers[id];
  const p = src.properties;
  const x0 = num(p["frame.x"]);
  const y0 = num(p["frame.y"]);
  const fontSize = num(p["typography.fontSize"], 16);
  const lineHeightPx = fontSize * num(p["typography.lineHeight"], 1.4);
  const letterProps = { ...p, positioning: "absolute", "text.sizing": "fixed", "typography.whiteSpace": "nowrap", "typography.textAlign": "left", "content.runs": "" } as typeof p;
  let group: string | null = null;
  transaction("Split into letters", () => {
    const made: string[] = [];
    for (const b of boxes) {
      made.push(
        documentCommands.addLayer(
          {
            archetype: "text",
            parentId: src.parentId,
            name: b.char,
            properties: {
              ...letterProps,
              "content.text": b.char,
              "frame.x": Math.round((x0 + b.x) * 100) / 100,
              // the glyph box sits in the middle of its line, so the layer is a line high and moved up by half the leading
              "frame.y": Math.round((y0 + b.y - (lineHeightPx - b.height) / 2) * 100) / 100,
              "frame.width": Math.ceil(b.width) + 4,
              "frame.height": Math.ceil(lineHeightPx),
            },
          },
          "Letter",
        ),
      );
    }
    group = groupLayers(made, "group");
    if (group) renameLayer(group, `${src.name} letters`);
    deleteLayers([id]);
  });
  return group;
}
