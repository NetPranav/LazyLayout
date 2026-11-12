declare module "opentype.js" {
  export interface PathCommand {
    type: "M" | "L" | "C" | "Q" | "Z";
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export interface Path {
    commands: PathCommand[];
    fill?: string | null;
    stroke?: string | null;
    strokeWidth?: number;
    toPathData(decimalPlaces?: number): string;
    toSVG(decimalPlaces?: number): string;
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }

  export interface Glyph {
    name: string;
    unicode: number;
    unicodes: number[];
    index: number;
    advanceWidth: number;
    leftSideBearing?: number;
    path: Path;
    getPath(x?: number, y?: number, fontSize?: number, options?: Record<string, unknown>, font?: Font): Path;
    getMetrics(): { xMin: number; yMin: number; xMax: number; yMax: number; leftSideBearing?: number; rightSideBearing?: number };
  }

  export interface Font {
    names: Record<string, Record<string, string>>;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: {
      length: number;
      get(index: number): Glyph;
    };
    charToGlyph(c: string): Glyph;
    stringToGlyphs(s: string): Glyph[];
    nameToGlyph(name: string): Glyph;
    glyphIndexToName(gid: number): string;
    nameToGlyphIndex(name: string): number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: Record<string, unknown>): Path;
    getPaths(text: string, x: number, y: number, fontSize: number, options?: Record<string, unknown>): Path[];
    getAdvanceWidth(text: string, fontSize?: number, options?: Record<string, unknown>): number;
    getKerningValue(leftGlyph: Glyph | number, rightGlyph: Glyph | number): number;
    forEachGlyph(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options: Record<string, unknown> | undefined,
      callback: (glyph: Glyph, x: number, y: number, fontSize: number) => void
    ): number;
  }

  export function parse(buffer: ArrayBuffer | Buffer, options?: Record<string, unknown>): Font;
  const opentype: {
    parse: typeof parse;
  };
  export default opentype;
}
