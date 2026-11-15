/**
 * 3D arrangements for page layers (ROADMAP Phase 128): a group's children placed on a ring, dome, helix, sphere,
 * cylinder, wall or stack inside a 2.5D space (Phase 127), each facing the centre, the viewer or outwards. Every item
 * stays a real, editable layer: its position (`frame.x` / `frame.y`), depth (`transform.translateZ`) and turn
 * (`transform.rotateX` / `rotateY`) are its own properties, written once.
 *
 * A layer draws `rotateX(a) rotateY(b) translateZ(t)` about its centre (the turn first, then the depth along the
 * turned face), so an item meant to stand at `p` (from the space's centre) facing `n` gets `t = p · n` and the rest of
 * `p` in its frame position. Facing the centre or outwards, `p` runs along `n`; facing the viewer, `n` is straight on.
 */

import { getDocument } from "../store/documentState";
import { setLayerProps, transaction } from "./editOps";
import { isSpace, makeSpace } from "./spaceOps";

export type ArrangementKind = "ring" | "dome" | "helix" | "sphere" | "cylinder" | "wall" | "stack";
export const ARRANGEMENTS: readonly ArrangementKind[] = ["ring", "dome", "helix", "sphere", "cylinder", "wall", "stack"];
export const ARRANGEMENT_LABEL: Record<ArrangementKind, string> = { ring: "Ring", dome: "Dome", helix: "Helix", sphere: "Sphere", cylinder: "Cylinder", wall: "Wall", stack: "Stack" };

export type Facing = "centre" | "viewer" | "outward";

export interface ArrangeOptions {
  /** Radius of rings, helices, cylinders, domes and spheres (px). */
  radius?: number;
  /** The gap between items: rows of a cylinder, a helix's rise per item, a wall's grid, a stack's depth step (px). */
  spacing?: number;
  facing?: Facing;
}

type V = { x: number; y: number; z: number };

/** An item's place: where it stands from the space's centre (y down, z towards the viewer) and the way it faces. */
export interface Placement {
  p: V;
  /** The face's direction, unit. */
  n: V;
  /** Degrees around the vertical axis for rings (its own turn, keeping the item upright). */
  yaw?: number;
}

const DEG = Math.PI / 180;
const unit = (v: V): V => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

/** Points spread evenly over a sphere (golden-angle spiral), top to bottom; `upper` keeps the top half. */
function fibonacci(n: number, upper: boolean): V[] {
  const out: V[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    // y from -1 (top) towards 1 (bottom); a dome stops at the equator
    const y = upper ? -1 + (i + 0.5) / n : -1 + (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    out.push({ x: Math.sin(a) * r, y, z: Math.cos(a) * r });
  }
  return out;
}

/** Where `count` items go in an arrangement (from the space's centre), each with the way it faces. */
export function arrangement(kind: ArrangementKind, count: number, options: ArrangeOptions = {}): Placement[] {
  const n = Math.max(0, Math.min(500, Math.floor(count)));
  const R = Math.max(1, options.radius ?? 300);
  const gap = Math.max(0, options.spacing ?? 40);
  const facing = options.facing ?? "outward";
  const around = (theta: number, y: number): Placement => {
    const out = { x: Math.sin(theta), y: 0, z: Math.cos(theta) };
    const n = facing === "viewer" ? { x: 0, y: 0, z: 1 } : facing === "centre" ? { x: -out.x, y: 0, z: -out.z } : out;
    const yaw = facing === "viewer" ? 0 : (theta / DEG + (facing === "centre" ? 180 : 0)) % 360;
    return { p: { x: R * out.x, y, z: R * out.z }, n, yaw };
  };
  const onSphere = (pts: V[]): Placement[] =>
    pts.map((u) => {
      const out = unit(u);
      const nn = facing === "viewer" ? { x: 0, y: 0, z: 1 } : facing === "centre" ? { x: -out.x, y: -out.y, z: -out.z } : out;
      return { p: { x: R * out.x, y: R * out.y, z: R * out.z }, n: nn };
    });
  switch (kind) {
    case "ring":
      return Array.from({ length: n }, (_, i) => around((2 * Math.PI * i) / Math.max(1, n), 0));
    case "helix": {
      // one turn every 8 items, rising by `spacing` per item, centred on the space
      const per = 8;
      return Array.from({ length: n }, (_, i) => around((2 * Math.PI * i) / per, (i - (n - 1) / 2) * gap));
    }
    case "cylinder": {
      const perRow = Math.max(3, Math.min(n, 8));
      const rows = Math.ceil(n / perRow);
      return Array.from({ length: n }, (_, i) => around((2 * Math.PI * (i % perRow)) / perRow, (Math.floor(i / perRow) - (rows - 1) / 2) * gap));
    }
    case "sphere":
      return onSphere(fibonacci(n, false));
    case "dome":
      return onSphere(fibonacci(n, true));
    case "wall": {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);
      return Array.from({ length: n }, (_, i) => ({ p: { x: ((i % cols) - (cols - 1) / 2) * gap, y: (Math.floor(i / cols) - (rows - 1) / 2) * gap, z: 0 }, n: { x: 0, y: 0, z: 1 } }));
    }
    case "stack":
      return Array.from({ length: n }, (_, i) => ({ p: { x: i * gap * 0.25, y: -i * gap * 0.25, z: -i * gap }, n: { x: 0, y: 0, z: 1 } }));
  }
}

/**
 * The layer properties that put an item there: its turn (`rotateX` then `rotateY`, as the layer draws them) facing
 * `n`, its depth along that face, and the rest of the offset in its frame. `centre` is the space's centre and `w`/`h`
 * the item's size, both in the space's px.
 */
export function placementProps(pl: Placement, centre: { x: number; y: number }, w: number, h: number): Record<string, number> {
  let a: number;
  let b: number;
  if (pl.yaw !== undefined) {
    // around the vertical: a turn about Y only keeps the item upright
    a = 0;
    b = pl.yaw;
  } else {
    // n = (sin b, -sin a cos b, cos a cos b)
    b = Math.asin(Math.max(-1, Math.min(1, pl.n.x))) / DEG;
    a = Math.atan2(-pl.n.y, pl.n.z) / DEG;
  }
  const n = { x: Math.sin(b * DEG), y: -Math.sin(a * DEG) * Math.cos(b * DEG), z: Math.cos(a * DEG) * Math.cos(b * DEG) };
  const t = pl.p.x * n.x + pl.p.y * n.y + pl.p.z * n.z;
  const dx = pl.p.x - t * n.x;
  const dy = pl.p.y - t * n.y;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    "frame.x": r(centre.x + dx - w / 2),
    "frame.y": r(centre.y + dy - h / 2),
    "transform.translateZ": r(t),
    "transform.rotateX": r(a),
    "transform.rotateY": r(((b + 540) % 360) - 180),
  };
}

/**
 * Arranges a group's children in 3D: the group becomes a 3D space (when it isn't one yet) and each child is placed,
 * in the order they are listed. Returns how many children moved.
 */
export function arrange3d(groupId: string, kind: ArrangementKind, options: ArrangeOptions = {}): number {
  const layers = getDocument().layers;
  const group = layers[groupId];
  if (!group || (group.archetype !== "container" && group.archetype !== "form") || group.locked === true) return 0;
  const kids = group.children.filter((id) => layers[id] && layers[id].locked !== true);
  if (!kids.length) return 0;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const centre = { x: num(group.properties["frame.width"], 0) / 2, y: num(group.properties["frame.height"], 0) / 2 };
  const places = arrangement(kind, kids.length, options);
  return transaction(`Arrange as ${ARRANGEMENT_LABEL[kind].toLowerCase()}`, () => {
    if (!isSpace(getDocument().layers[groupId])) makeSpace([groupId]);
    let moved = 0;
    kids.forEach((id, i) => {
      const l = getDocument().layers[id];
      const w = num(l.properties["frame.width"], 100);
      const h = num(l.properties["frame.height"], 100);
      moved += setLayerProps([id], { positioning: "absolute", ...placementProps(places[i], centre, w, h) }, "Arrange in 3D");
    });
    return moved;
  });
}
