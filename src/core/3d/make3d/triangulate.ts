import { ShapeUtils, Vector2 } from "three";

interface P2 {
  x: number;
  y: number;
}

/**
 * Triangulates a polygon with holes (three's earcut). three's triangulator calls `Vector2` methods (`equals`) on the
 * points, so plain `{x, y}` objects are turned into `Vector2` first. Returns triangles as index triples into the
 * outer ring followed by each hole's points, in order.
 */
export function triangulate(outer: readonly P2[], holes: readonly (readonly P2[])[]): number[][] {
  const toV = (r: readonly P2[]) => r.map((p) => new Vector2(p.x, p.y));
  return ShapeUtils.triangulateShape(toV(outer), holes.map(toV));
}
