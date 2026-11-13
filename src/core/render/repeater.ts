/**
 * Repeater (Design track D8): repeat a layer N times, each copy stepped in position, rotation, scale and opacity, as in
 * After Effects' Repeater. Pure: the renderer calls `repeatCopies` and draws what it returns, so the canvas, the preview and
 * the export agree by construction.
 *
 * Copy 0 is the layer itself, untouched. Copy `i` (1 .. count-1) is moved by `i * (x, y)`, turned by `i * rotate` degrees,
 * scaled by `scale ** i` and faded by `opacity ** i`, the turn and the scale about the copy's own centre.
 */
export const MAX_REPEAT_COUNT = 500;

export interface RepeaterSettings {
  count: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

export interface RepeatCopy {
  index: number;
  /** CSS `transform` for the copy's wrapper, about `origin`. */
  transform: string;
  /** CSS `transform-origin`: the layer's centre in its parent's coordinates. */
  origin: string;
  opacity: number;
}

const finite = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (n: number) => Math.round(n * 10000) / 10000;

/** The settings a layer has, or null when it does not repeat (count 1 or less). */
export function readRepeater(get: (path: string) => unknown): RepeaterSettings | null {
  const count = Math.min(MAX_REPEAT_COUNT, Math.max(1, Math.floor(finite(get("repeat.count"), 1))));
  if (count <= 1) return null;
  return {
    count,
    x: finite(get("repeat.x"), 0),
    y: finite(get("repeat.y"), 0),
    rotate: finite(get("repeat.rotate"), 0),
    scale: Math.max(0, finite(get("repeat.scale"), 1)),
    opacity: Math.min(1, Math.max(0, finite(get("repeat.opacity"), 1))),
  };
}

/** The copies after the layer itself, for a layer whose box is `box` in its parent's coordinates. */
export function repeatCopies(s: RepeaterSettings, box: { x: number; y: number; width: number; height: number }): RepeatCopy[] {
  const origin = `${round(box.x + box.width / 2)}px ${round(box.y + box.height / 2)}px`;
  const out: RepeatCopy[] = [];
  for (let i = 1; i < s.count; i++) {
    const sc = s.scale ** i;
    out.push({
      index: i,
      transform: `translate(${round(i * s.x)}px, ${round(i * s.y)}px) rotate(${round(i * s.rotate)}deg) scale(${round(sc)})`,
      origin,
      opacity: round(s.opacity ** i),
    });
  }
  return out;
}

/** Where a point of the layer (in its parent's coordinates) lands in copy `i`: the golden check for the CSS above. */
export function repeatPoint(s: RepeaterSettings, box: { x: number; y: number; width: number; height: number }, i: number, p: [number, number]): [number, number] {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const a = ((i * s.rotate) * Math.PI) / 180;
  const k = s.scale ** i;
  const dx = (p[0] - cx) * k;
  const dy = (p[1] - cy) * k;
  return [cx + i * s.x + dx * Math.cos(a) - dy * Math.sin(a), cy + i * s.y + dx * Math.sin(a) + dy * Math.cos(a)];
}
