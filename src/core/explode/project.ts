/**
 * Labels that follow 3D parts (Design track D20): where a point on a part is on the screen, each frame, and the leader line from the
 * label to it. Pure: a camera (position, target, up, vertical field of view) and the viewport size in, screen px out, the same
 * maths as a perspective camera (three.js's `PerspectiveCamera` with `lookAt`).
 */
import type { Vec } from "./explode";

export interface Camera {
  position: Vec;
  target: Vec;
  up?: Vec;
  /** Vertical field of view, degrees. */
  fov: number;
  near?: number;
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Screen position (px from the viewport's top left) of a world point, its depth in front of the camera, and whether it is in front at all. */
export function projectPoint(cam: Camera, world: Vec, viewport: { width: number; height: number }): { x: number; y: number; depth: number; visible: boolean } {
  const f = norm(sub(cam.target, cam.position)); // forward
  const r = norm(cross(f, cam.up ?? [0, 1, 0])); // right
  const u = cross(r, f); // true up
  const d = sub(world, cam.position);
  const z = dot(d, f);
  const near = cam.near ?? 0.01;
  if (z <= near) return { x: NaN, y: NaN, depth: z, visible: false };
  const k = 1 / Math.tan(((cam.fov * Math.PI) / 180) / 2);
  const aspect = viewport.width / viewport.height;
  const ndcX = (dot(d, r) * k) / (z * aspect);
  const ndcY = (dot(d, u) * k) / z;
  return { x: ((ndcX + 1) / 2) * viewport.width, y: ((1 - ndcY) / 2) * viewport.height, depth: z, visible: true };
}

/** A point on a part after its own move (an explode offset) and the part's turn about its centre (radians about Y), in world space. */
export function partPoint(partCentre: Vec, localPoint: Vec, offset: Vec = [0, 0, 0], turnY = 0): Vec {
  const c = Math.cos(turnY), s = Math.sin(turnY);
  const [x, y, z] = localPoint;
  return [partCentre[0] + offset[0] + x * c + z * s, partCentre[1] + offset[1] + y, partCentre[2] + offset[2] - x * s + z * c];
}

/**
 * The leader line from a label's box to its point: it starts at the middle of the box side facing the point, so it never crosses
 * the label. Returns the two ends.
 */
export function leaderLine(label: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }): { from: [number, number]; to: [number, number] } {
  const cx = label.x + label.width / 2, cy = label.y + label.height / 2;
  const dx = point.x - cx, dy = point.y - cy;
  let from: [number, number];
  if (Math.abs(dx) * label.height >= Math.abs(dy) * label.width) from = [dx >= 0 ? label.x + label.width : label.x, cy];
  else from = [cx, dy >= 0 ? label.y + label.height : label.y];
  return { from, to: [point.x, point.y] };
}
