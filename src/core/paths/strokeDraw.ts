/**
 * ROADMAP Phase 85: drawing a stroke on (After Effects' Trim Paths). Pure: the same numbers for the render definitions
 * (the stage at rest, and the export) and for the animation engine, so a stroke half drawn at rest and one half way
 * through its animation are the same dashes.
 *
 * A path element is given `pathLength="1"`, so its whole length is 1 whatever its shape; the part between `start` and
 * `end` is then one dash, `end - start` long, pushed along by `start + offset`. Because the dash pattern repeats every
 * 1, an offset that runs past the end of a closed path comes back in at its start with no extra work.
 *
 * - `draw.start`, `draw.end` (0 to 1): the part of the stroke that shows. 0 and 1 is the whole stroke (no dashes).
 * - `draw.offset` (turns): slides the visible part along the path; 1 is once round.
 * - `draw.reverse`: draws from the other end.
 * - `draw.stagger` (0 to 1): with several sub-paths, how far apart their drawing is spread. 0 draws all together; 1
 *   draws them one after another. Each sub-path is its own element (the render definition makes them), because one
 *   element's length runs through all its sub-paths, which would draw them one after another whatever the stagger.
 */
export const DRAW_PATHS = ["draw.start", "draw.end", "draw.offset", "draw.reverse", "draw.stagger"] as const;
export const isDrawPath = (path: string): boolean => path.startsWith("draw.");

export interface DrawSettings {
  start: number;
  end: number;
  offset: number;
  reverse: boolean;
  stagger: number;
}

type Read = (path: string) => unknown;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function drawSettings(read: Read): DrawSettings {
  return {
    start: clamp01(num(read("draw.start"), 0)),
    end: clamp01(num(read("draw.end"), 1)),
    offset: num(read("draw.offset"), 0),
    reverse: read("draw.reverse") === true,
    stagger: clamp01(num(read("draw.stagger"), 0)),
  };
}

/** Whether the settings change what is drawn at all (the whole stroke, not slid: nothing to do). */
export const drawIsActive = (s: DrawSettings): boolean => s.start > 0 || s.end < 1 || s.offset !== 0;

/** Whether the layer's own properties ask for drawing (at rest), or name a stagger: the render definition draws sub-paths apart for these. */
export function hasDraw(properties: Readonly<Record<string, unknown>>): boolean {
  return DRAW_PATHS.some((p) => properties[p] !== undefined);
}

export interface DrawDash {
  /** `stroke-dasharray`, in units of the path's length (with `pathLength="1"`). */
  array: string;
  /** `stroke-dashoffset`, in the same units. */
  offset: number;
  /** The part that shows, after stagger and reverse: for tests and for the panel. */
  from: number;
  to: number;
}

const round = (n: number): number => Math.round(n * 1e5) / 1e5 || 0; // never -0

/**
 * The window of sub-path `index` of `count`: with a stagger, each sub-path draws over a shorter stretch of the
 * progress, the next starting later. `p` is a position along the whole drawing (0 to 1).
 */
export function staggered(p: number, index: number, count: number, stagger: number): number {
  if (count <= 1 || stagger <= 0) return p;
  const delay = (stagger * index) / count;
  const span = 1 - (stagger * (count - 1)) / count;
  return clamp01((p - delay) / span);
}

/**
 * The dashes of each of `subpaths` elements (one per sub-path, each its own length of 1). Null when nothing is trimmed,
 * so the stroke is left as it was drawn. Without a stagger every element gets the same dashes: the sub-paths draw together.
 */
export function drawDashes(settings: DrawSettings, subpaths = 1): DrawDash[] | null {
  if (!drawIsActive(settings)) return null;
  const count = Math.max(1, Math.floor(subpaths));
  const out: DrawDash[] = [];
  for (let i = 0; i < count; i++) {
    let a = staggered(Math.min(settings.start, settings.end), i, count, settings.stagger);
    let b = staggered(Math.max(settings.start, settings.end), i, count, settings.stagger);
    if (settings.reverse) [a, b] = [1 - b, 1 - a];
    const length = b - a;
    if (length <= 1e-6) {
      // nothing shows: a dash of no length, parked beyond the path so a round cap can't leave a dot
      out.push({ array: "0 2", offset: -1.5, from: a, to: a });
      continue;
    }
    // a full dash and no gap would be a solid line, which is right; the gap is never 0 so a slid dash wraps cleanly
    out.push({ array: `${round(length)} ${round(Math.max(1 - length, 0))}`, offset: round(-(a + settings.offset)), from: round(a), to: round(b) });
  }
  return out;
}
