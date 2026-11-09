import { parseCss, toCssHex } from "./color";

/** A colour mixed with black (`weight` 0: unchanged, 1: black), keeping its alpha. Black when the colour can't be read. */
export function mixWithBlack(colorStr: string, weight = 0.35): string {
  const w = Math.max(0, Math.min(1, weight));
  const parsed = parseCss(colorStr);
  if (!parsed) return "#000000";
  return toCssHex({ r: parsed.r * (1 - w), g: parsed.g * (1 - w), b: parsed.b * (1 - w), a: parsed.a });
}
