/**
 * ============================================================================
 * 3D TEXT MULTI-LINE LAYOUT ENGINE (Phase 3D-026)
 * ============================================================================
 * Positions glyph contours with exact advance widths, font kerning, tracking,
 * multi-line line heights, and horizontal alignment (left, center, right).
 * ============================================================================
 */

import type { Font, Glyph } from "./font";
import { opentypePathToBezPath } from "./font";
import { flattenPath, type Ring } from "../path/flatten";

export interface TextLayoutOptions {
  size?: number;
  align?: "left" | "center" | "right";
  tracking?: number;
  lineHeight?: number;
  maxWidth?: number;
}

export interface GlyphPosition {
  char: string;
  glyph: Glyph;
  x: number;
  y: number;
  advance: number;
  rings: Ring[];
}

export interface LineLayout {
  text: string;
  width: number;
  advances: number[];
  glyphs: GlyphPosition[];
}

export interface TextLayoutResult extends Array<Ring> {
  width: number;
  height: number;
  lines: LineLayout[];
  rings: Ring[];
}

/**
 * Computes multi-line text layout, returning positioned rings ready for extrusion.
 */
export function layoutText(
  font: Font,
  text: string,
  options?: TextLayoutOptions
): TextLayoutResult {
  const size = Math.max(1e-4, options?.size ?? 72);
  const align = options?.align ?? "left";
  const tracking = options?.tracking ?? 0;
  const lineHeightFactor = options?.lineHeight ?? 1.2;
  const lineSpacing = size * lineHeightFactor;
  const scale = (1 / (font.unitsPerEm || 1000)) * size;

  // Split lines
  const rawLines = text.split("\n");
  const lines: LineLayout[] = [];

  for (let l = 0; l < rawLines.length; l++) {
    const lineStr = rawLines[l];
    let lineWidth = 0;
    const advances: number[] = [];
    const glyphsInLine: { char: string; glyph: Glyph; x: number; advance: number }[] = [];

    let prevGlyph: Glyph | null = null;
    let curX = 0;

    for (let c = 0; c < lineStr.length; c++) {
      const char = lineStr[c];
      const glyph = font.charToGlyph(char);

      let kern = 0;
      if (prevGlyph) {
        kern = (font.getKerningValue(prevGlyph, glyph) || 0) * scale;
      }
      curX += kern;

      const baseAdv = (glyph.advanceWidth || 0) * scale;
      const totalAdv = baseAdv + tracking;

      advances.push(totalAdv + kern);
      glyphsInLine.push({
        char,
        glyph,
        x: curX,
        advance: totalAdv,
      });

      curX += totalAdv;
      prevGlyph = glyph;
    }

    lineWidth = curX;
    lines.push({
      text: lineStr,
      width: lineWidth,
      advances,
      glyphs: [],
    });
  }

  // Find max width
  let maxWidth = 0;
  for (const line of lines) {
    if (line.width > maxWidth) maxWidth = line.width;
  }
  const totalHeight = Math.max(size, lines.length * lineSpacing);

  const allRings: Ring[] = [];

  // Position glyphs according to alignment
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const y = l * lineSpacing;

    let alignOffset = 0;
    if (align === "center") {
      alignOffset = -line.width * 0.5;
    } else if (align === "right") {
      alignOffset = -line.width;
    }

    const lineGlyphs: GlyphPosition[] = [];
    const rawGlyphs = line.text.split("").map((c, idx) => {
      const glyph = font.charToGlyph(c);
      return { char: c, glyph, advance: line.advances[idx] };
    });

    let curX = 0;
    let prevGlyph: Glyph | null = null;

    for (let c = 0; c < line.text.length; c++) {
      const char = line.text[c];
      const glyph = font.charToGlyph(char);

      if (prevGlyph) {
        curX += (font.getKerningValue(prevGlyph, glyph) || 0) * scale;
      }

      const gx = curX + alignOffset;
      const gy = y;

      const otPath = glyph.getPath(gx, gy, size);
      const bez = opentypePathToBezPath(otPath);
      const rings = flattenPath(bez, 0.05);

      const pos: GlyphPosition = {
        char,
        glyph,
        x: gx,
        y: gy,
        advance: line.advances[c] ?? 0,
        rings,
      };

      lineGlyphs.push(pos);
      allRings.push(...rings);

      curX += (glyph.advanceWidth || 0) * scale + tracking;
      prevGlyph = glyph;
    }

    line.glyphs = lineGlyphs;
  }

  const result = allRings as TextLayoutResult;
  result.width = maxWidth;
  result.height = totalHeight;
  result.lines = lines;
  result.rings = allRings;
  return result;
}
