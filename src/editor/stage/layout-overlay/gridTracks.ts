import { equalTracks, parseTracks, trackSpans, type Rect, type Track } from "@/core/layout/grid";

export type Axis = "col" | "row";
export interface Span {
  pos: number;
  len: number;
}
export interface TrackSet {
  tracks: Track[];
  spans: Span[];
  /** The tracks are read off the drawn children because the template (auto, minmax) cannot be drawn. */
  measured: boolean;
}

const CLUSTER = 4;
export const MIN_TRACK = 8;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tracks from where the children are drawn, relative to the frame: one per distinct start edge. */
function measuredSet(rects: readonly Rect[], axis: Axis): TrackSet {
  const start = (r: Rect) => (axis === "col" ? r.x : r.y);
  const size = (r: Rect) => (axis === "col" ? r.w : r.h);
  const sorted = [...rects].sort((a, b) => start(a) - start(b));
  const groups: Rect[][] = [];
  for (const r of sorted) {
    const last = groups[groups.length - 1];
    if (last && start(r) - start(last[0]) <= CLUSTER) last.push(r);
    else groups.push([r]);
  }
  const spans = groups.map((g) => ({ pos: start(g[0]), len: Math.max(...g.map(size)) }));
  return { tracks: spans.map((s) => ({ kind: "px" as const, value: round2(s.len) })), spans, measured: true };
}

/**
 * The tracks of one axis of a grid and where they lie. `rects` are the children relative to the frame, `size` the frame's size
 * on that axis. Fixed and fr tracks come from the template; anything else is read off the drawn children.
 */
export function trackSet(template: string | undefined, count: number, axis: Axis, size: number, gap: number, padStart: number, padEnd: number, rects: readonly Rect[]): TrackSet {
  const tracks = parseTracks(template && template.trim() ? template : axis === "col" ? equalTracks(count) : "");
  const usable = tracks && (axis === "col" || tracks.every((t) => t.kind === "px"));
  if (usable && tracks) return { tracks, spans: trackSpans(tracks, size, gap, padStart, padEnd), measured: false };
  return measuredSet(rects, axis);
}

/** The written track list for these tracks. */
export function templateOf(tracks: readonly Track[]): string {
  return tracks.map((t) => `${round2(t.value)}${t.kind}`).join(" ");
}

/** The tracks after track `i` is dragged to `len` px: two fr neighbours trade space; anything else becomes a fixed px track. */
export function resizeTrack(set: TrackSet, i: number, len: number): Track[] {
  const next = set.tracks.map((t) => ({ ...t }));
  const a = next[i];
  const b = next[i + 1];
  if (a.kind === "fr" && b?.kind === "fr") {
    const total = set.spans[i].len + set.spans[i + 1].len;
    const l = Math.min(Math.max(len, MIN_TRACK), Math.max(MIN_TRACK, total - MIN_TRACK));
    const frs = a.value + b.value;
    a.value = round2((frs * l) / total);
    b.value = round2(frs - a.value);
  } else {
    next[i] = { kind: "px", value: Math.max(MIN_TRACK, Math.round(len)) };
  }
  return next;
}
