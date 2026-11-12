import type { Layer, MotionDocument } from "../document/schema";
import type { PropValue } from "../document/registry";

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

