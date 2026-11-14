/**
 * Cloner (Design track D9): copies of a layer laid out as a grid (rows and columns), a ring, or filling the area of its
 * parent. Pure, like the repeater: the renderer draws what `clonerCopies` returns.
 *
 * - **grid**: `cols x rows` cells, `gapX` and `gapY` between them; the layer is the first cell (top left), the rest follow.
 * - **radial**: `count` copies on a circle of `radius` px around the layer's centre; the first is at `start` degrees (0 is
 *   straight up) and the layer itself is that first one; with `faceOut` each copy also turns to face away from the centre.
 * - **fill**: as many copies as fit at `gapX`, `gapY` in the parent's box, tiled so the layer's own cell is one of them.
 *
 * Every mode returns copies (not counting the layer), each with its `index` (for links and expressions to read later) and
 * a translation plus a turn; capped at `MAX_CLONES`.
 */
export const MAX_CLONES = 10000;

export type CloneMode = "off" | "grid" | "radial" | "fill";
export const CLONE_MODES: readonly CloneMode[] = ["off", "grid", "radial", "fill"];

export interface ClonerSettings {
  mode: Exclude<CloneMode, "off">;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  count: number;
  radius: number;
  start: number;
  faceOut: boolean;
}

export interface CloneCopy {
  /** 1-based, in drawing order (the layer itself is 0). */
  index: number;
  dx: number;
  dy: number;
  /** Degrees, about the copy's own centre. */
  rotate: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const finite = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const int = (v: unknown, fallback: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.floor(finite(v, fallback))));

/** The cloner a layer has, or null when `clone.mode` is off or missing. */
export function readCloner(get: (path: string) => unknown): ClonerSettings | null {
  const mode = get("clone.mode");
  if (mode !== "grid" && mode !== "radial" && mode !== "fill") return null;
  return {
    mode,
    cols: int(get("clone.cols"), 3, 1, 200),
    rows: int(get("clone.rows"), 3, 1, 200),
    gapX: finite(get("clone.gapX"), 10),
    gapY: finite(get("clone.gapY"), 10),
    count: int(get("clone.count"), 8, 1, MAX_CLONES),
    radius: Math.max(0, finite(get("clone.radius"), 100)),
    start: finite(get("clone.start"), 0),
    faceOut: get("clone.faceOut") === true,
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** The copies after the layer itself. `parent` is the box the layer sits in (its parent's frame), used by `fill`. */
export function clonerCopies(s: ClonerSettings, box: Box, parent: { width: number; height: number }): CloneCopy[] {
  const out: CloneCopy[] = [];
  const push = (dx: number, dy: number, rotate = 0) => {
    if (out.length < MAX_CLONES) out.push({ index: out.length + 1, dx: round(dx), dy: round(dy), rotate: round(rotate) });
  };
  const pitchX = box.width + s.gapX;
  const pitchY = box.height + s.gapY;
  if (s.mode === "grid") {
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (r > 0 || c > 0) push(c * pitchX, r * pitchY);
  } else if (s.mode === "radial") {
    // copy k sits at angle start + k * 360 / count; the layer itself is k = 0, so every copy is offset from it
    const at = (k: number): [number, number] => {
      const a = ((s.start + (k * 360) / s.count) * Math.PI) / 180;
      return [s.radius * Math.sin(a), -s.radius * Math.cos(a)];
    };
    const [x0, y0] = at(0);
    for (let k = 1; k < s.count; k++) {
      const [x, y] = at(k);
      push(x - x0, y - y0, s.faceOut ? (k * 360) / s.count : 0);
    }
  } else if (pitchX > 0 && pitchY > 0) {
    // every cell of the layer's own lattice whose box touches the parent
    const ixMin = Math.floor((-box.width - box.x) / pitchX) + 1;
    const ixMax = Math.ceil((parent.width - box.x) / pitchX) - 1;
    const iyMin = Math.floor((-box.height - box.y) / pitchY) + 1;
    const iyMax = Math.ceil((parent.height - box.y) / pitchY) - 1;
    for (let iy = iyMin; iy <= iyMax; iy++) for (let ix = ixMin; ix <= ixMax; ix++) if (ix !== 0 || iy !== 0) push(ix * pitchX, iy * pitchY);
  }
  return out;
}

/** The copy's CSS: a translation, and a turn about the layer's centre when it has one. */
export function cloneTransform(c: CloneCopy): string {
  return c.rotate === 0 ? `translate(${c.dx}px, ${c.dy}px)` : `translate(${c.dx}px, ${c.dy}px) rotate(${c.rotate}deg)`;
}

/** How many copies (not counting the layer) a fill would draw, without making them (the panel shows it). */
export function fillCount(s: ClonerSettings, box: Box, parent: { width: number; height: number }): number {
  return clonerCopies({ ...s, mode: "fill" }, box, parent).length;
}
