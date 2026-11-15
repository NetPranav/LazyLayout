/**
 * @file splitIntoLayers.ts
 * @module core/signals/splitIntoLayers
 * @description Phase 153: Non-destructive Split into real, rule-addressable letter,
 * word, or line layers within < 0.5 px of unsplit glyph boxes, preserving per-piece
 * overrides across text edits, supporting Detach, and keeping single-pass AT reading.
 */

export type SplitGranularity = "letters" | "words" | "lines";

export interface SplitGlyphBox {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lineIndex: number;
  readonly wordIndex: number;
}

export interface SplitLayoutOptions {
  readonly fontSizePx?: number;
  readonly lineHeightRatio?: number;
  readonly letterSpacingPx?: number;
  readonly wordSpacingPx?: number;
  readonly maxWidthPx?: number;
  /** When true, styles/color target Lane C's `[data-text-stroke-copy]` fill element. */
  readonly strokedText?: boolean;
  /** Optional browser/DOM glyph measurements mapped directly onto split boxes. */
  readonly measuredGlyphBoxes?: readonly SplitGlyphBox[];
}

export interface SplitPieceLayer {
  readonly id: string;
  readonly parentId: string | null;
  readonly pieceKey: string;
  readonly granularity: SplitGranularity;
  readonly text: string;
  readonly index: number;
  readonly count: number;
  readonly homeX: number;
  readonly homeY: number;
  readonly width: number;
  readonly height: number;
  readonly lineIndex: number;
  readonly wordIndex: number;
  readonly overrides: Readonly<Record<string, number | string | boolean>>;
  readonly a11y: {
    readonly "aria-hidden": "true";
    readonly strokeCopySelector?: "[data-text-stroke-copy]";
  };
}

export interface SplitLayerGroupResult {
  readonly parentId: string;
  readonly sourceText: string;
  readonly granularity: SplitGranularity;
  readonly detached: boolean;
  readonly parentA11y: {
    readonly "aria-label": string;
    readonly role: "text";
    readonly "data-split-group": "true";
  };
  readonly pieces: readonly SplitPieceLayer[];
}

/** Deterministic reference glyph advance fraction relative to `fontSizePx`. */
function glyphAdvanceRatio(ch: string): number {
  if (ch === " " || ch === "\t") return 0.3;
  if ("iIl|!.,:;'\"".includes(ch)) return 0.34;
  if ("fjt()[]".includes(ch)) return 0.42;
  if ("mwMW@%".includes(ch)) return 0.86;
  if (ch >= "A" && ch <= "Z") return 0.68;
  return 0.56;
}

/**
 * Computes deterministic glyph boxes for a text string matching unsplit baseline flow
 * within sub-pixel accuracy (`< 0.5 px`).
 */
export function measureUnsplitGlyphBoxes(
  text: string,
  options: SplitLayoutOptions = {},
): readonly SplitGlyphBox[] {
  if (options.measuredGlyphBoxes && options.measuredGlyphBoxes.length > 0) {
    return options.measuredGlyphBoxes;
  }

  const fontSize = Math.max(8, options.fontSizePx ?? 32);
  const lineHeight = fontSize * (options.lineHeightRatio ?? 1.25);
  const letterSpacing = options.letterSpacingPx ?? 0;
  const maxWidth = options.maxWidthPx ?? Infinity;

  const boxes: SplitGlyphBox[] = [];
  const paragraphs = text.split("\n");
  let lineIndex = 0;
  let globalWordIndex = 0;

  for (const para of paragraphs) {
    let cursorX = 0;
    const words = para.split(/(\s+)/);

    for (const token of words) {
      if (token.length === 0) continue;
      const isWhitespace = /^\s+$/.test(token);

      if (!isWhitespace) {
        let tokenWidth = 0;
        for (let c = 0; c < token.length; c++) {
          tokenWidth += glyphAdvanceRatio(token[c]!) * fontSize + letterSpacing;
        }
        if (cursorX > 0 && cursorX + tokenWidth > maxWidth) {
          lineIndex++;
          cursorX = 0;
        }

        for (let c = 0; c < token.length; c++) {
          const ch = token[c]!;
          const w = glyphAdvanceRatio(ch) * fontSize;
          boxes.push({
            text: ch,
            x: cursorX,
            y: lineIndex * lineHeight,
            width: w,
            height: lineHeight,
            lineIndex,
            wordIndex: globalWordIndex,
          });
          cursorX += w + letterSpacing;
        }
        globalWordIndex++;
      } else {
        for (let c = 0; c < token.length; c++) {
          const ch = token[c]!;
          const w = (options.wordSpacingPx ?? glyphAdvanceRatio(ch) * fontSize) + letterSpacing;
          boxes.push({
            text: ch,
            x: cursorX,
            y: lineIndex * lineHeight,
            width: w,
            height: lineHeight,
            lineIndex,
            wordIndex: -1,
          });
          cursorX += w;
        }
      }
    }
    lineIndex++;
  }

  return boxes;
}

function unionBoxes(boxes: readonly SplitGlyphBox[]): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Splits a text layer into real, rule-addressable letter, word, or line layers
 * while keeping screen-reader narration as one intact parent string.
 */
export function splitTextIntoRealLayers(
  sourceLayerId: string,
  text: string,
  granularity: SplitGranularity,
  options: SplitLayoutOptions = {},
): SplitLayerGroupResult {
  const glyphBoxes = measureUnsplitGlyphBoxes(text, options);
  const nonSpaceBoxes = glyphBoxes.filter((b) => !/^\s+$/.test(b.text));
  const strokeCopySelector = options.strokedText ? ("[data-text-stroke-copy]" as const) : undefined;

  const grouped: Array<{ key: string; text: string; lineIndex: number; wordIndex: number; boxes: SplitGlyphBox[] }> = [];

  if (granularity === "letters") {
    const occurrenceCount = new Map<string, number>();
    for (const box of nonSpaceBoxes) {
      const occ = occurrenceCount.get(box.text) ?? 0;
      occurrenceCount.set(box.text, occ + 1);
      grouped.push({
        key: `char:${box.text}#${occ}`,
        text: box.text,
        lineIndex: box.lineIndex,
        wordIndex: box.wordIndex,
        boxes: [box],
      });
    }
  } else if (granularity === "words") {
    const byWord = new Map<number, SplitGlyphBox[]>();
    for (const box of nonSpaceBoxes) {
      if (box.wordIndex < 0) continue;
      const arr = byWord.get(box.wordIndex) ?? [];
      arr.push(box);
      byWord.set(box.wordIndex, arr);
    }
    const wordOcc = new Map<string, number>();
    for (const [, wordBoxes] of [...byWord.entries()].sort((a, b) => a[0] - b[0])) {
      const wordText = wordBoxes.map((b) => b.text).join("");
      const occ = wordOcc.get(wordText) ?? 0;
      wordOcc.set(wordText, occ + 1);
      grouped.push({
        key: `word:${wordText}#${occ}`,
        text: wordText,
        lineIndex: wordBoxes[0]!.lineIndex,
        wordIndex: wordBoxes[0]!.wordIndex,
        boxes: wordBoxes,
      });
    }
  } else {
    const byLine = new Map<number, SplitGlyphBox[]>();
    for (const box of glyphBoxes) {
      const arr = byLine.get(box.lineIndex) ?? [];
      arr.push(box);
      byLine.set(box.lineIndex, arr);
    }
    for (const [lineIdx, lineBoxes] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
      const trimmed = lineBoxes.filter((b) => !/^\s+$/.test(b.text));
      if (trimmed.length === 0) continue;
      grouped.push({
        key: `line:${lineIdx}`,
        text: lineBoxes.map((b) => b.text).join("").trim(),
        lineIndex: lineIdx,
        wordIndex: trimmed[0]!.wordIndex,
        boxes: trimmed,
      });
    }
  }

  const count = grouped.length;
  const pieces: SplitPieceLayer[] = grouped.map((entry, idx) => {
    const rect = unionBoxes(entry.boxes);
    return {
      id: `${sourceLayerId}::split:${granularity}:${idx}`,
      parentId: sourceLayerId,
      pieceKey: entry.key,
      granularity,
      text: entry.text,
      index: idx,
      count,
      homeX: rect.x,
      homeY: rect.y,
      width: rect.width,
      height: rect.height,
      lineIndex: entry.lineIndex,
      wordIndex: entry.wordIndex,
      overrides: {},
      a11y: {
        "aria-hidden": "true",
        ...(strokeCopySelector ? { strokeCopySelector } : {}),
      },
    };
  });

  return {
    parentId: sourceLayerId,
    sourceText: text,
    granularity,
    detached: false,
    parentA11y: {
      "aria-label": text,
      role: "text",
      "data-split-group": "true",
    },
    pieces,
  };
}

/** Applies or updates overrides on a single split piece non-destructively. */
export function setSplitPieceOverrides(
  group: SplitLayerGroupResult,
  pieceKey: string,
  overrides: Readonly<Record<string, number | string | boolean>>,
): SplitLayerGroupResult {
  return {
    ...group,
    pieces: group.pieces.map((piece) =>
      piece.pieceKey === pieceKey
        ? { ...piece, overrides: { ...piece.overrides, ...overrides } }
        : piece,
    ),
  };
}

/**
 * Re-splits edited text while preserving existing per-piece overrides keyed by `pieceKey`.
 */
export function reconcileSplitTextLayers(
  previous: SplitLayerGroupResult,
  nextText: string,
  granularity: SplitGranularity = previous.granularity,
  options: SplitLayoutOptions = {},
): SplitLayerGroupResult {
  const overrideByKey = new Map<string, Readonly<Record<string, number | string | boolean>>>();
  for (const piece of previous.pieces) {
    if (Object.keys(piece.overrides).length > 0) {
      overrideByKey.set(piece.pieceKey, piece.overrides);
    }
  }

  const fresh = splitTextIntoRealLayers(previous.parentId, nextText, granularity, options);
  return {
    ...fresh,
    pieces: fresh.pieces.map((piece) => {
      const preserved = overrideByKey.get(piece.pieceKey);
      return preserved ? { ...piece, overrides: { ...preserved } } : piece;
    }),
  };
}

/** Detaches split pieces into independent top-level layers (`parentId: null`). */
export function detachSplitLayers(group: SplitLayerGroupResult): SplitLayerGroupResult {
  return {
    ...group,
    detached: true,
    pieces: group.pieces.map((piece, idx) => ({
      ...piece,
      id: `${group.parentId}_detached_${idx}`,
      parentId: null,
    })),
  };
}
