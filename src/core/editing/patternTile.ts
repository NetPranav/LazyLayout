/**
 * A pattern's tile from a layer (ROADMAP Phase 114): the layer's outline (or, for a frame or group, its children's
 * outlines) with the colour of each one's top solid fill, in the layer's own box. Baked when the pattern is made:
 * editing the layer afterwards doesn't change the pattern (a live copy is Phase 116).
 */

import type { Layer } from "../document/schema";
import { effectiveFills } from "../paint/paints";
import { MAX_PATTERN_SHAPES, type PatternShape } from "../paint/procedural";
import { layerOutline, layerSize, toParent } from "./layerOutline";

const colorOf = (l: Layer): string | null => {
  const fill = effectiveFills(l.properties["paint.fills"], typeof l.properties["svg.fill"] === "string" ? (l.properties["svg.fill"] as string) : "#cbd5e1").find((p) => p.visible && p.type === "solid");
  return fill && fill.type === "solid" ? fill.color : null;
};

/** The tile a layer makes, or null when it has nothing to draw. */
export function tileFromLayer(id: string, layers: Readonly<Record<string, Layer>>): { w: number; h: number; shapes: PatternShape[] } | null {
  const l = layers[id];
  if (!l) return null;
  const { w, h } = layerSize(l);
  if (!(w > 0 && h > 0)) return null;
  const shapes: PatternShape[] = [];
  const own = layerOutline(l, layers);
  const isGroup = (l.archetype === "container" || l.archetype === "form") && l.children.length > 0 && !l.properties["boolean.operation"];
  if (own && !isGroup) {
    const color = colorOf(l);
    if (color) shapes.push({ d: own.path.toSvg(2), color });
  } else {
    for (const cid of l.children) {
      const c = layers[cid];
      if (!c || c.visible === false || shapes.length >= MAX_PATTERN_SHAPES) continue;
      const o = layerOutline(c, layers);
      const color = colorOf(c);
      if (o && color) shapes.push({ d: toParent(o.path, c).toSvg(2), color });
    }
  }
  return shapes.length ? { w, h, shapes } : null;
}
