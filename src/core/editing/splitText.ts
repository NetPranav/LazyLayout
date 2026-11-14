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
import { useLayersUiStore } from "../store/useLayersUiStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { hydrateClip } from "../document/factories";
import type { Layer } from "../document/schema";
import type { PropValue } from "../document/registry";

export interface LetterBox {
  char: string;
  /** Position and size of the letter's glyph box, in px from the text layer's own top left. */
  x: number;
  y: number;
  width: number;
  height: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

/** The letters (grapheme clusters: an emoji or an accented letter is one) of a string, with where each starts. */
export function splitGraphemes(value: string): { at: number; char: string }[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (s) => ({ at: s.index, char: s.segment }));
  }
  const pieces: { at: number; char: string }[] = [];
  let at = 0;
  for (const char of value) {
    pieces.push({ at, char });
    at += char.length;
  }
  return pieces;
}

/** What the canvas measured of a drawn text: each letter's box, and the size the text is drawn at. */
export interface LetterMeasure {
  boxes: LetterBox[];
  width: number;
  height: number;
}

/**
 * Measuring letters needs the drawn page, which only the editor has. It registers how (see
 * `src/editor/stage/measureLetters.ts`); core stays free of the DOM, and a test can register its own.
 */
let letterMeasurer: ((id: string) => LetterMeasure | null) | null = null;
export function registerLetterMeasurer(fn: ((id: string) => LetterMeasure | null) | null): void {
  letterMeasurer = fn;
}
/** The letters of a drawn text layer, or null when nothing can measure it (it isn't on screen). */
export function measureLettersOf(id: string): LetterMeasure | null {
  return letterMeasurer ? letterMeasurer(id) : null;
}

export type SplitKind = "letters" | "words" | "lines";

const isSpace = (g: string) => g.trim() === "" || g === "\u200b";

/**
 * Groups measured letters into words or lines (Design track D12, Phase 83). `text` is the text as typed and `boxes` are the measured
 * letters in reading order (the measurer leaves out spaces and line breaks), so the two are matched one letter at a time.
 *
 * - **words**: a run of letters the word segmenter calls one word, with the punctuation after it kept attached ("Hello," is one piece);
 *   scripts written without spaces split where the segmenter says.
 * - **lines**: the letters on one drawn line; a new line starts when a letter sits lower than the one before by more than half a letter.
 *
 * Each piece is one box (the union of its letters) whose `char` is its text, with the first letter's style. Returns null when the text
 * and the boxes do not match (they would put pieces in the wrong places).
 */
export function groupLetterBoxes(text: string, boxes: readonly LetterBox[], kind: "words" | "lines"): LetterBox[] | null {
  const graphemes = splitGraphemes(text).filter((g) => g.char !== "\u200b"); // (a line break stays: it is whitespace, and so a word boundary)
  if (graphemes.filter((g) => !isSpace(g.char)).length !== boxes.length) return null;
  // for each grapheme: the box it is, or null for a space
  const boxOf: (number | null)[] = [];
  let next = 0;
  for (const g of graphemes) boxOf.push(isSpace(g.char) ? null : next++);

  // pieces as runs of grapheme indices
  const runs: [number, number][] = [];
  if (kind === "words") {
    const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
    // the text the graphemes make (newlines and zero-width spaces were dropped), so offsets agree with `gi`
    const flat = graphemes.map((g) => g.char).join("");
    const offsets: number[] = [];
    let o = 0;
    graphemes.forEach((g) => { offsets.push(o); o += g.char.length; });
    const at = new Map<number, number>(offsets.map((off, i) => [off, i]));
    let open: [number, number] | null = null;
    let lastWord = false;
    const close = () => { if (open) runs.push(open); open = null; lastWord = false; };
    for (const part of seg ? Array.from(seg.segment(flat)) : [{ index: 0, segment: flat, isWordLike: true }]) {
      const start = at.get(part.index);
      if (start === undefined) continue;
      const end = start + splitGraphemes(part.segment).length - 1;
      if (part.segment.trim() === "") { close(); continue; }
      if (part.isWordLike) {
        if (open && lastWord) close(); // two words with nothing between them (no spaces in the script): two pieces
        open = open ?? [start, end];
        open[1] = end;
        lastWord = true;
      } else {
        open = open ?? [start, end]; // punctuation stays with the word before it
        open[1] = end;
      }
    }
    close();
  } else {
    // lines: from the drawn boxes, one run per line
    let lineStart = -1;
    let prev: LetterBox | null = null;
    let lastIdx = -1;
    graphemes.forEach((_, i) => {
      const b = boxOf[i] === null ? null : boxes[boxOf[i] as number];
      if (!b) return;
      if (prev && b.y + b.height / 2 - (prev.y + prev.height / 2) > 0.5 * Math.min(prev.height, b.height)) {
        runs.push([lineStart, lastIdx]);
        lineStart = -1;
      }
      if (lineStart < 0) lineStart = i;
      lastIdx = i;
      prev = b;
    });
    if (lineStart >= 0) runs.push([lineStart, lastIdx]);
  }

  const pieces: LetterBox[] = [];
  for (const [a, b] of runs) {
    const mine: LetterBox[] = [];
    for (let i = a; i <= b; i++) if (boxOf[i] !== null) mine.push(boxes[boxOf[i] as number]);
    if (mine.length === 0) continue;
    const x0 = Math.min(...mine.map((m) => m.x));
    const y0 = Math.min(...mine.map((m) => m.y));
    const x1 = Math.max(...mine.map((m) => m.x + m.width));
    const y1 = Math.max(...mine.map((m) => m.y + m.height));
    const first = mine[0];
    pieces.push({ ...first, char: graphemes.slice(a, b + 1).map((g) => g.char).join(""), x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return pieces;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Why a text layer cannot be split, or null when it can. */
export function cannotSplit(id: string): string | null {
  const layer = getDocument().layers[id];
  if (!layer || layer.archetype !== "text") return "Only text can be split into letters.";
  if (layer.locked) return "Unlock the text to split it.";
  if (!layer.parentId) return "This text has no place to put its letters.";
  const p = layer.properties;
  if (num(p["transform.rotateX"]) !== 0 || num(p["transform.rotateY"]) !== 0 || (typeof p["transform.pin"] === "string" && p["transform.pin"] !== "")) {
    return "Straighten the text (no 3D tilt or corner pin) before splitting it into letters.";
  }
  return null;
}

/** Replaces the text with a group of one layer per letter. Returns the group's id, or null when it cannot be done. */
export function splitIntoLetters(id: string, boxes: readonly LetterBox[], drawn?: { width: number; height: number }, kind: SplitKind = "letters"): string | null {
  if (cannotSplit(id) !== null || boxes.length === 0) return null;
  const src = getDocument().layers[id];
  const p = src.properties;
  const x0 = num(p["frame.x"]);
  const y0 = num(p["frame.y"]);
  const rot = num(p["frame.rotation"]);
  let w0 = num(p["frame.width"]);
  let h0 = num(p["frame.height"]);

  if (drawn && drawn.width > 0) w0 = drawn.width;
  if (drawn && drawn.height > 0) h0 = drawn.height;
  if (w0 === 0 && boxes.length > 0) {
    w0 = Math.max(...boxes.map((b) => b.x + b.width));
  }
  if (h0 === 0 && boxes.length > 0) {
    h0 = Math.max(...boxes.map((b) => b.y + b.height));
  }

  const fontSize = num(p["typography.fontSize"], 16);
  const lineHeightPx = fontSize * num(p["typography.lineHeight"], 1.5);
  const letterProps = {
    ...p,
    positioning: "absolute",
    "text.sizing": "fixed",
    "typography.whiteSpace": "nowrap",
    "typography.textAlign": "left",
    "typography.letterSpacing": 0,
    "content.runs": "",
    "layout.paddingTop": 0,
    "layout.paddingRight": 0,
    "layout.paddingBottom": 0,
    "layout.paddingLeft": 0,
    "layout.padding": 0,
    "frame.rotation": 0,
    // a letter is sized in px, whatever unit the text's own box used (a % of the parent would stretch each letter)
    "frame.widthUnit": "px",
    "frame.heightUnit": "px",
    // a word's depth and the mark of being split are the word's, set again on the letters by their own commands
    "text.depth": 0,
    // a piece is left out of what a screen reader reads: its group carries the whole text, once
    "a11y.hidden": true,
    "a11y.label": "",
    "a11y.role": "",
  } as typeof p;
  // a gradient or picture fill keeps running across the word: each letter shows its own part of the word's fill
  const fills = typeof p["paint.fills"] === "string" ? p["paint.fills"] : "";
  const sharedFill = fills !== "" && /"type"\s*:\s*"(?!solid)/.test(fills);

  let group: string | null = null;
  transaction(`Split into ${kind}`, () => {
    const made: string[] = [];
    for (const b of boxes) {
      const specificProps: Record<string, PropValue> = { ...letterProps };
      if (b.bold !== undefined) {
        specificProps["typography.fontWeight"] = b.bold ? 700 : (p["typography.fontWeight"] ?? 400);
        specificProps["typography.format.bold"] = b.bold;
      }
      if (b.italic !== undefined) {
        specificProps["typography.fontStyle"] = b.italic ? "italic" : "normal";
        specificProps["typography.format.italic"] = b.italic;
      }
      if (b.color) {
        specificProps["typography.color"] = b.color;
      }
      if (sharedFill) {
        const r = (n: number) => Math.round(n * 100) / 100;
        specificProps["paint.fillBox"] = `${r(b.x)},${r(b.y - (lineHeightPx - b.height) / 2)},${r(w0)},${r(h0)}`;
      }
      if (b.underline || b.strike) {
        specificProps["typography.textDecoration"] = [b.underline ? "underline" : "", b.strike ? "line-through" : ""].filter(Boolean).join(" ");
      }

      made.push(
        documentCommands.addLayer(
          {
            archetype: "text",
            parentId: src.parentId,
            name: b.char,
            properties: {
              ...specificProps,
              "content.text": b.char,
              "frame.x": Math.round((x0 + b.x) * 100) / 100,
              // the glyph box sits in the middle of its line, so the layer is a line high and moved up by half the leading
              "frame.y": Math.round((y0 + b.y - (lineHeightPx - b.height) / 2) * 100) / 100,
              "frame.width": Math.ceil(b.width) + 4,
              "frame.height": Math.ceil(lineHeightPx),
            },
          },
          kind === "letters" ? "Letter" : kind === "words" ? "Word" : "Line",
        ),
      );
    }
    group = groupLayers(made, "group");
    if (group) {
      renameLayer(group, `${src.name} ${kind}`);
      // the group is found again by this mark, not by its name (which the user may change); it is named with the whole text for a screen reader
      const wholeText = typeof p["content.text"] === "string" && p["content.text"] !== "" ? (p["content.text"] as string).replace(/\s*\n+\s*/g, " ") : boxes.map((b) => b.char).join("");
      const srcRole = typeof p["a11y.role"] === "string" && p["a11y.role"] !== "" ? (p["a11y.role"] as string) : "group";
      documentCommands.updateProps(group, { "group.role": kind, "a11y.label": wholeText, "a11y.role": srcRole });
      if (rot !== 0) {
        const groupLayer = getDocument().layers[group];
        const gp = groupLayer.properties;
        const gx = num(gp["frame.x"]);
        const gy = num(gp["frame.y"]);
        const gw = num(gp["frame.width"]);
        const gh = num(gp["frame.height"]);
        const csX = x0 + w0 / 2;
        const csY = y0 + h0 / 2;
        const cgX = gx + gw / 2;
        const cgY = gy + gh / 2;
        const dx = cgX - csX;
        const dy = cgY - csY;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const cNewX = csX + rx;
        const cNewY = csY + ry;
        const newGx = Math.round((cNewX - gw / 2) * 100) / 100;
        const newGy = Math.round((cNewY - gh / 2) * 100) / 100;
        documentCommands.updateProps(group, {
          "frame.x": newGx,
          "frame.y": newGy,
          "frame.rotation": rot,
        });
      }
      const toExpand = [group];
      let cur = getDocument().layers[group]?.parentId;
      while (cur) {
        toExpand.push(cur);
        cur = getDocument().layers[cur]?.parentId;
      }
      useLayersUiStore.getState().expandAll(toExpand);
      useSelectionStore.getState().select(group, "element");
    }
    deleteLayers([id]);
  });
  return group;
}

/**
 * Whether a layer is a group of split letters: marked `group.role: "letters"` by Split into letters. A group made
 * before the mark existed counts only if it still looks exactly like one: named "... letters", holding one-letter texts
 * (and the depth groups older documents kept beside them). Any other group of texts is not taken for one.
 */
export function isLettersGroup(layer: Layer | null | undefined, allLayers: Record<string, Layer>): boolean {
  if (!layer || layer.archetype !== "container") return false;
  const role = layer.properties["group.role"];
  if (role === "letters" || role === "words" || role === "lines") return true;
  if (!layer.name.endsWith(" letters") || layer.children.length === 0) return false;
  let letters = 0;
  for (const childId of layer.children) {
    const child = allLayers[childId];
    if (!child) return false;
    if (child.archetype === "text") {
      const t = child.properties["content.text"];
      if (typeof t !== "string" || splitGraphemes(t).length !== 1) return false;
      letters++;
    } else if (!(child.archetype === "container" && child.name.endsWith(" depth"))) return false;
  }
  return letters > 0;
}

/** Is a clip the entrance Animate letters makes: on mount, sliding up 20px while fading in, and nothing else. */
function isLetterEntrance(clip: { type: string; trigger: unknown; tracks: { property: string; keyframes: { value: unknown }[] }[] }): boolean {
  if (clip.type !== "entrance" || clip.trigger !== "mount" || clip.tracks.length !== 2) return false;
  const y = clip.tracks.find((t) => t.property === "transform.y");
  const o = clip.tracks.find((t) => t.property === "appearance.opacity");
  return !!y && !!o && y.keyframes[0]?.value === 20 && o.keyframes[0]?.value === 0;
}

/** Gives the letters of a letters group a staggered entrance (fade and slide up, 40ms stagger). */
export function animateLetters(targetId: string, stagger?: number): string[] | null {
  const doc = getDocument();
  let groupLayer = doc.layers[targetId];
  if (!groupLayer) return null;
  if (!isLettersGroup(groupLayer, doc.layers)) {
    if (groupLayer.parentId && isLettersGroup(doc.layers[groupLayer.parentId], doc.layers)) {
      groupLayer = doc.layers[groupLayer.parentId];
    } else {
      return null;
    }
  }

  const letterIds = groupLayer.children.filter((id) => doc.layers[id]?.archetype === "text");
  if (letterIds.length === 0) return null;
  const role = groupLayer.properties["group.role"];
  const label = role === "words" ? "Word" : role === "lines" ? "Line" : "Letter";
  stagger = stagger ?? (role === "words" ? 0.1 : role === "lines" ? 0.18 : 0.04); // a word takes longer to read than a letter

  const clipIds: string[] = [];
  transaction("Animate letters", () => {
    // run again, it replaces the entrance it made before rather than stacking a second one on each letter
    for (const clip of Object.values(getDocument().clips)) {
      if (letterIds.includes(clip.layerId) && isLetterEntrance(clip)) documentCommands.removeClip(clip.id, "Animate letters");
    }
    letterIds.forEach((letterId, i) => {
      const delay = Math.round(i * stagger * 1000) / 1000;
      const template = hydrateClip({
        name: `${label} ${i + 1} entrance`,
        type: "entrance",
        trigger: "mount",
        duration: 0.6,
        delay,
        easing: "power3.out",
        enabled: true,
        tracks: [
          {
            property: "transform.y",
            keyframes: [
              { time: 0, value: 20, ease: "power3.out" },
              { time: 0.6, value: 0, ease: "power3.out" },
            ],
          },
          {
            property: "appearance.opacity",
            keyframes: [
              { time: 0, value: 0, ease: "linear" },
              { time: 0.3, value: 1.0, ease: "linear" },
            ],
          },
        ],
      });
      const clipId = documentCommands.addClip(letterId, template, "Animate letters");
      clipIds.push(clipId);
    });
  });

  return clipIds;
}

/**
 * Splits a drawn text layer into letters, words or lines (Design track D12, Phase 83), each a layer of its own at exactly its place, in
 * a group named with the whole text. Returns the group's id, or null with the reason in `why` when it cannot be done.
 */
export function splitText(id: string, kind: SplitKind): { group: string | null; why: string | null } {
  const reason = cannotSplit(id);
  if (reason) return { group: null, why: reason.replace("into letters", kind === "letters" ? "into letters" : `into ${kind}`) };
  const measure = measureLettersOf(id);
  if (!measure || measure.boxes.length === 0) return { group: null, why: "The text has to be on the page to be measured." };
  let boxes: readonly LetterBox[] = measure.boxes;
  if (kind !== "letters") {
    const layer = getDocument().layers[id];
    const text = typeof layer.properties["content.text"] === "string" ? (layer.properties["content.text"] as string) : layer.name;
    const grouped = groupLetterBoxes(text, measure.boxes, kind);
    if (!grouped || grouped.length === 0) return { group: null, why: `The ${kind} could not be told apart from what is drawn (the text has styled runs or a line that does not match). Split it into letters instead.` };
    boxes = grouped;
  }
  const group = splitIntoLetters(id, boxes, { width: measure.width, height: measure.height }, kind);
  return { group, why: group ? null : "That text could not be split." };
}
