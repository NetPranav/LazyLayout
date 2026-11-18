import type { Layer, MotionDocument } from "../document/schema";
import type { PropValue } from "../document/registry";
import { clonerCopies, readCloner } from "../render/cloner";

/**
 * ============================================================================
 * TRACK MATTES (ROADMAP Phase 74)
 * ============================================================================
 * A layer can use another layer as its mask. This turns the source layer (its box, its shape, and its position, scale and
 * rotation at the moment) into an SVG path in the TARGET layer's own pixels, which the target then draws as an ordinary
 * `mask.path` (`render/compositing.ts`). Pure: no DOM, no store.
 *
 * What it can read: a source whose box is a number of pixels placed absolutely, on the same canvas as the target (every
 * ancestor placed absolutely too, so both positions are known without measuring the page). An ellipse is an ellipse; any
 * other layer is its box, with its corner radius. A source it can't read gives no matte (the target is drawn unmasked and
 * the source stays visible), never a wrong one.
 * ============================================================================
 */

type Resolved = Readonly<Record<string, PropValue>>;

/** The cubic Bezier constant that makes a quarter circle. */
const KAPPA = 0.5522847498307936;
const round = (n: number) => Math.round(n * 1000) / 1000;
const num = (props: Resolved, path: string, fallback = 0): number => {
  const v = props[path];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};

/** A layer's position on the canvas (the sum of the `frame.x` / `frame.y` of it and its ancestors), or null when any of them isn't placed absolutely. */
export function canvasOrigin(layers: MotionDocument["layers"], layerId: string, resolvedOf: (id: string) => Resolved): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let id: string | null = layerId;
  for (let depth = 0; id && depth < 64; depth++) {
    const layer: Layer | undefined = layers[id];
    if (!layer) return null;
    const props = resolvedOf(id);
    const positioning = props.positioning ?? layer.properties.positioning;
    // the top-level frame is the origin of its own canvas, whatever it says
    if (layer.parentId !== null && positioning !== "absolute") return null;
    if (layer.parentId !== null) {
      x += num(props, "frame.x");
      y += num(props, "frame.y");
    }
    id = layer.parentId;
  }
  return { x, y };
}


/** The path of a rounded rectangle centred on the origin, as moves, lines and cubic curves in local pixels. */
function localShape(kind: "ellipse" | "box", w: number, h: number, radius: number): string[][] {
  const hw = w / 2;
  const hh = h / 2;
  if (kind === "ellipse") {
    const kx = hw * KAPPA;
    const ky = hh * KAPPA;
    return [["M", hw, 0], ["C", hw, ky, kx, hh, 0, hh], ["C", -kx, hh, -hw, ky, -hw, 0], ["C", -hw, -ky, -kx, -hh, 0, -hh], ["C", kx, -hh, hw, -ky, hw, 0], ["Z"]].map((seg) => seg.map(String));
  }
  const r = Math.max(0, Math.min(radius, hw, hh));
  if (r === 0) return [["M", -hw, -hh], ["L", hw, -hh], ["L", hw, hh], ["L", -hw, hh], ["Z"]].map((seg) => seg.map(String));
  const k = r * KAPPA;
  return [
    ["M", -hw + r, -hh], ["L", hw - r, -hh], ["C", hw - r + k, -hh, hw, -hh + r - k, hw, -hh + r],
    ["L", hw, hh - r], ["C", hw, hh - r + k, hw - r + k, hh, hw - r, hh],
    ["L", -hw + r, hh], ["C", -hw + r - k, hh, -hw, hh - r + k, -hw, hh - r],
    ["L", -hw, -hh + r], ["C", -hw, -hh + r - k, -hw + r - k, -hh, -hw + r, -hh], ["Z"],
  ].map((seg) => seg.map(String));
}

export interface MatteSourceShape {
  /** The source's centre on the canvas, with its animated translation, in px. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  ellipse: boolean;
  radius: number;
  /** Degrees, clockwise; the frame's rotation plus the animated rotation. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** The source layer as a shape on the canvas, or null when it can't be read (see the file header). */
export function matteSourceShape(layers: MotionDocument["layers"], sourceId: string, resolvedOf: (id: string) => Resolved): MatteSourceShape | null {
  const source = layers[sourceId];
  if (!source) return null;
  const props = resolvedOf(sourceId);
  const origin = canvasOrigin(layers, sourceId, resolvedOf);
  const width = num(props, "frame.width");
  const height = num(props, "frame.height");
  if (!origin || width <= 0 || height <= 0) return null;
  const scale = num(props, "transform.scale", 1);
  return {
    cx: origin.x + num(props, "transform.x") + width / 2,
    cy: origin.y + num(props, "transform.y") + height / 2,
    width,
    height,
    ellipse: source.archetype === "ellipse",
    radius: source.archetype === "ellipse" ? 0 : num(props, "appearance.radius"),
    rotation: num(props, "frame.rotation") + num(props, "transform.rotate"),
    scaleX: scale * num(props, "transform.scaleX", 1),
    scaleY: scale * num(props, "transform.scaleY", 1),
  };
}

/**
 * The matte as SVG path data in the target's pixels: the source's shape, scaled and rotated about its centre, moved to its
 * place, then taken relative to the target's top-left corner. `targetOrigin` is the target's position on the canvas.
 */
export function matteShapePath(shape: MatteSourceShape, targetOrigin: { x: number; y: number }): string {
  const theta = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const at = (lx: number, ly: number): string => {
    const sx = lx * shape.scaleX;
    const sy = ly * shape.scaleY;
    const x = shape.cx - targetOrigin.x + sx * cos - sy * sin;
    const y = shape.cy - targetOrigin.y + sx * sin + sy * cos;
    return `${round(x)} ${round(y)}`;
  };
  const parts: string[] = [];
  for (const seg of localShape(shape.ellipse ? "ellipse" : "box", shape.width, shape.height, shape.radius)) {
    const [cmd, ...rest] = seg;
    if (cmd === "Z") parts.push("Z");
    else {
      const nums = rest.map(Number);
      const points: string[] = [];
      for (let i = 0; i < nums.length; i += 2) points.push(at(nums[i], nums[i + 1]));
      parts.push(`${cmd} ${points.join(" ")}`);
    }
  }
  return parts.join(" ");
}


/** The most shapes one matte draws (a dot grid of clones can be large; the mask is redrawn when its source moves). */
export const MAX_MATTE_SHAPES = 2000;

/**
 * Every shape a matte source draws, so any layer can be a matte, not only one box or ellipse:
 * - a shape with a **cloner** (Clone: grid, ring, fill area) gives itself and every copy, so one dot multiplied over an
 *   area is a dotted matte;
 * - a **group or frame** with layers in it gives every shape inside it (hidden ones left out), moved with the group, so
 *   several shapes, clones and moving layers make one matte together.
 * Null when nothing in it can be read (see `matteSourceShape`).
 */
export function matteSourceShapes(layers: MotionDocument["layers"], sourceId: string, resolvedOf: (id: string) => Resolved): MatteSourceShape[] | null {
  const out: MatteSourceShape[] = [];
  const visit = (id: string, shiftX: number, shiftY: number, depth: number): void => {
    const layer = layers[id];
    if (!layer || out.length >= MAX_MATTE_SHAPES) return;
    const props = resolvedOf(id);
    if (depth > 0 && (layer.visible === false || props.visible === false)) return;
    if (layer.children.length > 0 && depth < 16) {
      // a group: what is inside it, moved as the group moves
      const gx = shiftX + num(props, "transform.x");
      const gy = shiftY + num(props, "transform.y");
      const before = out.length;
      for (const child of layer.children) visit(child, gx, gy, depth + 1);
      // a group with nothing readable inside is its own box, as a frame always was
      if (out.length > before || depth > 0) return;
    }
    const shape = matteSourceShape(layers, id, resolvedOf);
    if (!shape) return;
    const base = { ...shape, cx: shape.cx + shiftX, cy: shape.cy + shiftY };
    out.push(base);
    const cloner = readCloner((path) => props[path]);
    if (!cloner) return;
    const parent = layer.parentId ? resolvedOf(layer.parentId) : {};
    const box = { x: num(props, "frame.x"), y: num(props, "frame.y"), width: shape.width, height: shape.height };
    for (const copy of clonerCopies(cloner, box, { width: num(parent, "frame.width"), height: num(parent, "frame.height") })) {
      if (out.length >= MAX_MATTE_SHAPES) break;
      out.push({ ...base, cx: base.cx + copy.dx, cy: base.cy + copy.dy, rotation: base.rotation + copy.rotate });
    }
  };
  visit(sourceId, 0, 0, 0);
  return out.length > 0 ? out : null;
}

/** The matte path of several shapes: each one's outline, together (where they overlap, the union). */
export function matteShapesPath(shapes: readonly MatteSourceShape[], targetOrigin: { x: number; y: number }): string {
  if (shapes.length === 1) return matteShapePath(shapes[0], targetOrigin);
  return shapes.map((s) => compactShapePath(s, targetOrigin) ?? matteShapePath(s, targetOrigin)).join(" ");
}

/** An unturned ellipse as two arcs: a fifth of the length, so a grid of a thousand dots stays a short path. Null for any other shape. */
function compactShapePath(shape: MatteSourceShape, targetOrigin: { x: number; y: number }): string | null {
  if (!shape.ellipse || shape.rotation % 360 !== 0) return null;
  const rx = (shape.width / 2) * Math.abs(shape.scaleX);
  const ry = (shape.height / 2) * Math.abs(shape.scaleY);
  const x = shape.cx - targetOrigin.x;
  const y = shape.cy - targetOrigin.y;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return `M${r2(x - rx)} ${r2(y)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0Z`;
}
