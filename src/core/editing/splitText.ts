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
import { parseRuns } from "../text/runs";
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

function splitGraphemes(value: string): { at: number; char: string }[] {
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

/** The letters of a drawn text layer, with their boxes, or null when the layer is not on screen. */
export function measureLetters(id: string): LetterBox[] | null {
  if (typeof document === "undefined") return null;
  const node = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype="text"][data-element-id="${id}"]`);
  if (!node) return null;

  // Temporarily reset transform so range boxes are measured in unrotated space
  const prevTransform = node.style.transform;
  node.style.transform = "none";

  try {
    const box = node.getBoundingClientRect();
    const scale = node.offsetWidth > 0 ? box.width / node.offsetWidth : 1;
    const out: LetterBox[] = [];

    const layer = getDocument().layers[id];
    const rawText = layer ? (typeof layer.properties["content.text"] === "string" ? layer.properties["content.text"] : layer.name) : "";
    const runs = layer ? parseRuns(layer.properties["content.runs"], rawText) : null;

    const charStyles: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string }[] = [];
    if (runs) {
      for (const run of runs) {
        for (let i = 0; i < run.text.length; i++) {
          charStyles.push({
            bold: run.bold,
            italic: run.italic,
            underline: run.underline,
            strike: run.strike,
            color: run.color,
          });
        }
      }
    }

    let globalCharOffset = 0;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
      const value = text.data;
      const pieces = splitGraphemes(value);

      const el = text.parentElement;
      let elBold: boolean | undefined = undefined;
      let elItalic: boolean | undefined = undefined;
      let elUnderline: boolean | undefined = undefined;
      let elStrike: boolean | undefined = undefined;
      let elColor: string | undefined = undefined;

      if (el && el !== node) {
        const fw = el.style.fontWeight;
        if (fw === "700" || fw === "bold" || Number(fw) >= 700) elBold = true;
        if (el.style.fontStyle === "italic") elItalic = true;
        const deco = el.style.textDecoration || "";
        if (deco.includes("underline")) elUnderline = true;
        if (deco.includes("line-through")) elStrike = true;
        if (el.style.color) elColor = el.style.color;
      }

      for (const { at, char } of pieces) {
        const charIdx = globalCharOffset + at;
        if (char.trim() === "") continue;

        const range = document.createRange();
        range.setStart(text, at);
        range.setEnd(text, at + char.length);
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;

        const runStyle = charStyles[charIdx];
        const bold = runStyle?.bold ?? elBold;
        const italic = runStyle?.italic ?? elItalic;
        const underline = runStyle?.underline ?? elUnderline;
        const strike = runStyle?.strike ?? elStrike;
        const color = runStyle?.color ?? elColor;

        out.push({
          char,
          x: (r.left - box.left) / scale,
          y: (r.top - box.top) / scale,
          width: r.width / scale,
          height: r.height / scale,
          ...(bold !== undefined ? { bold } : {}),
          ...(italic !== undefined ? { italic } : {}),
          ...(underline !== undefined ? { underline } : {}),
          ...(strike !== undefined ? { strike } : {}),
          ...(color ? { color } : {}),
        });
      }
      globalCharOffset += value.length;
    }
    return out;
  } finally {
    node.style.transform = prevTransform;
  }
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
export function splitIntoLetters(id: string, boxes: readonly LetterBox[]): string | null {
  if (cannotSplit(id) !== null || boxes.length === 0) return null;
  const src = getDocument().layers[id];
  const p = src.properties;
  const x0 = num(p["frame.x"]);
  const y0 = num(p["frame.y"]);
  const rot = num(p["frame.rotation"]);
  let w0 = num(p["frame.width"]);
  let h0 = num(p["frame.height"]);

  if (typeof document !== "undefined") {
    const node = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype="text"][data-element-id="${id}"]`);
    if (node && node.offsetWidth > 0) w0 = node.offsetWidth;
    if (node && node.offsetHeight > 0) h0 = node.offsetHeight;
  }
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
  } as typeof p;

  let group: string | null = null;
  transaction("Split into letters", () => {
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
          "Letter",
        ),
      );
    }
    group = groupLayers(made, "group");
    if (group) {
      renameLayer(group, `${src.name} letters`);
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

/** Whether a layer is a group of split letters. */
export function isLettersGroup(layer: Layer | null | undefined, allLayers: Record<string, Layer>): boolean {
  if (!layer) return false;
  if (layer.archetype !== "container") return false;
  if (!layer.children || layer.children.length === 0) return false;
  const hasLettersName = layer.name.endsWith(" letters");
  const allTextChildren = layer.children.every((childId) => allLayers[childId]?.archetype === "text");
  return allTextChildren && (hasLettersName || layer.children.length > 0);
}

/** Gives the letters of a letters group a staggered entrance (fade and slide up, 40ms stagger). */
export function animateLetters(targetId: string, stagger = 0.04): string[] | null {
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

  const clipIds: string[] = [];
  transaction("Animate letters", () => {
    letterIds.forEach((letterId, i) => {
      const delay = Math.round(i * stagger * 1000) / 1000;
      const template = hydrateClip({
        name: `Letter ${i + 1} entrance`,
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
