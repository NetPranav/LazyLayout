/**
 * ============================================================================
 * 3D TEXT FONT PARSER & GLYPH OUTLINE EXTRACTION (Phase 3D-026)
 * ============================================================================
 * Uses opentype.js to parse TTF/OTF font buffers into vector curves (BezPath)
 * and closed polygon rings for 3D extrusion.
 * ============================================================================
 */

import { parse as parseOpenType, type Font, type Glyph, type PathCommand } from "opentype.js";
import { BezPath } from "../../geometry/bezpath";
import { flattenPath, type Ring } from "../path/flatten";

export type { Font, Glyph };

export interface GlyphOutline {
  glyph: string;
  glyphIndex: number;
  advance: number;
  bezPath: BezPath;
  rings: Ring[];
}

export type GlyphOutlineList = GlyphOutline[] & {
  rings: Ring[];
  bezPath: BezPath;
};

/**
 * Parses an ArrayBuffer of TTF or OTF binary data into an OpenType Font instance.
 */
export function parseFont(buffer: ArrayBuffer): Font {
  return parseOpenType(buffer);
}

/**
 * Converts opentype path commands into a pure geometry BezPath.
 */
export function opentypePathToBezPath(path: { commands: readonly PathCommand[] }): BezPath {
  const bez = new BezPath();
  for (const cmd of path.commands) {
    if (cmd.type === "M" && cmd.x !== undefined && cmd.y !== undefined) {
      bez.moveTo({ x: cmd.x, y: cmd.y });
    } else if (cmd.type === "L" && cmd.x !== undefined && cmd.y !== undefined) {
      bez.lineTo({ x: cmd.x, y: cmd.y });
    } else if (
      cmd.type === "Q" &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined
    ) {
      bez.quadTo({ x: cmd.x1, y: cmd.y1 }, { x: cmd.x, y: cmd.y });
    } else if (
      cmd.type === "C" &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined &&
      cmd.x2 !== undefined &&
      cmd.y2 !== undefined
    ) {
      bez.curveTo({ x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, { x: cmd.x, y: cmd.y });
    } else if (cmd.type === "Z") {
      bez.closePath();
    }
  }
  return bez;
}

/**
 * Extracts per-glyph contours for characters in `text` at `size` px as BezPath and polygonal rings.
 */
export function glyphOutlines(
  font: Font,
  text: string,
  size = 72
): GlyphOutlineList {
  const result: GlyphOutline[] = [];
  const allRings: Ring[] = [];
  const combinedBez = new BezPath();

  const scale = (1 / (font.unitsPerEm || 1000)) * size;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = font.charToGlyph(char);
    const otPath = glyph.getPath(0, 0, size);
    const bez = opentypePathToBezPath(otPath);

    // Fine tolerance to ensure area matches within 0.1%
    const rings = flattenPath(bez, 0.05);

    result.push({
      glyph: char,
      glyphIndex: glyph.index,
      advance: (glyph.advanceWidth || 0) * scale,
      bezPath: bez,
      rings,
    });

    allRings.push(...rings);
    combinedBez.extend(bez);
  }

  const list = result as GlyphOutlineList;
  list.rings = allRings;
  list.bezPath = combinedBez;
  return list;
}
