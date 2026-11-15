/**
 * Variable-width strokes (ROADMAP Phase 119): the width profiles a stroke can follow beyond the presets in `strokes.ts`.
 *
 * - **Calligraphic**: the width a flat nib held at `angle` draws along this path. It is thick where the path runs
 *   across the nib and thin where it runs along it. The result is an ordinary profile (points along the length), so it
 *   saves, reuses and exports like any other; it is worked out from the path when it is applied.
 * - **Saved profiles**: a document keeps a list of named profiles (`widthProfiles`) to reuse on any stroke.
 */

import type { BezPath } from "../geometry/bezpath";
import { polylines } from "../geometry/measure";
import { WIDTH_MAX_POINTS, sanitizeProfile, serializeWidthProfile, parseWidthProfile, type WidthPoint } from "./strokes";

/** How many points a calligraphic profile has along the path. */
export const CALLIGRAPHIC_POINTS = 48;

/**
 * The profile a flat nib at `angle` degrees (0 is horizontal) draws along the first subpath of `spine`. `thin` is
 * the width (0..1) where the path runs along the nib. Null when the path has no length.
 */
export function calligraphicProfile(spine: BezPath, angle: number, thin = 0.15, count = CALLIGRAPHIC_POINTS): WidthPoint[] | null {
  const line = polylines(spine)?.find((l) => l.length() > 1e-6);
  if (!line) return null;
  const nib = ((Number.isFinite(angle) ? angle : 0) * Math.PI) / 180;
  const floor = Math.min(1, Math.max(0, Number.isFinite(thin) ? thin : 0.15));
  const n = Math.max(2, Math.min(WIDTH_MAX_POINTS, Math.round(count)));
  const pts: WidthPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const at = line.at(t);
    if (!at) continue;
    // the normal turned back is the direction of travel
    const dir = Math.atan2(-at.normal.x, at.normal.y);
    pts.push({ t, scale: floor + (1 - floor) * Math.abs(Math.sin(dir - nib)), bias: 0 });
  }
  return pts.length >= 2 ? sanitizeProfile(roundPoints(pts)) : null;
}

/** Points as they are stored (4 decimals), so a profile saved and read back is the same profile exactly. */
export const roundPoints = (pts: readonly WidthPoint[]): WidthPoint[] => parseWidthProfile(serializeWidthProfile(pts)) ?? [];

// --- the document's saved profiles -----------------------------------------------------------------

export interface SavedWidthProfile {
  id: string;
  name: string;
  points: { t: number; scale: number; bias?: number }[];
}

export const MAX_SAVED_PROFILES = 100;

/** The saved profiles of a document (absent: none). Malformed entries are skipped. */
export function savedProfilesOf(doc: { widthProfiles?: readonly SavedWidthProfile[] }): SavedWidthProfile[] {
  return (doc.widthProfiles ?? []).filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.points) && p.points.length > 0);
}

/** A profile in the stored form of a saved profile (the bias only when it isn't 0). */
export const storedPoints = (pts: readonly WidthPoint[]): SavedWidthProfile["points"] => JSON.parse(serializeWidthProfile(pts) || "[]");

/** The saved profile whose points are `pts`, if any. */
export function matchSaved(saved: readonly SavedWidthProfile[], pts: readonly WidthPoint[] | null): SavedWidthProfile | null {
  if (!pts || pts.length === 0) return null;
  const key = serializeWidthProfile(pts);
  return saved.find((s) => serializeWidthProfile(sanitizeProfile(s.points)) === key) ?? null;
}
