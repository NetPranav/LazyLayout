/**
 * Corner pin: a layer's four corners dragged onto the corners of a surface (a road, a wall, a screen) so it lies on it in
 * perspective, the way After Effects' corner pin and planar tracker place a layer. The layer is drawn with a CSS
 * `matrix3d` that maps its rectangle onto the four points. Pure maths, tested directly.
 */

/** Top left, top right, bottom right, bottom left. */
export type Quad = [[number, number], [number, number], [number, number], [number, number]];

/** "x0,y0,x1,y1,x2,y2,x3,y3" as a quad, or null when it is not four finite points. */
export function parsePin(text: unknown): Quad | null {
  if (typeof text !== "string" || text === "") return null;
  const n = text.split(",").map(Number);
  if (n.length !== 8 || !n.every(Number.isFinite)) return null;
  return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
}

export const formatPin = (q: Quad): string => q.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(",");

/** The projective map of the unit square onto `q` (Heckbert): x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (g u + h v + 1). */
function squareToQuad(q: Quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}

/** Where the point (u, v) of the surface, each 0 to 1 across it, lies: for the grid drawn on it. */
export function mapUnit(q: Quad, u: number, v: number): [number, number] {
  const m = squareToQuad(q);
  const w = m.g * u + m.h * v + 1;
  return [(m.a * u + m.b * v + m.c) / w, (m.d * u + m.e * v + m.f) / w];
}

/** True when the four points make a simple, non-folded four-sided shape (a pin that would flip the layer inside out is refused). */
export function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-6) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** The CSS `matrix3d(...)` that maps a `width` by `height` rectangle at the origin onto `q` (points relative to the layer's own top left). */
export function pinMatrix3d(width: number, height: number, q: Quad): string {
  const m = squareToQuad(q);
  const v = [m.a / width, m.d / width, 0, m.g / width, m.b / height, m.e / height, 0, m.h / height, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${v.map((n) => (Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(9)))).join(",")})`;
}
