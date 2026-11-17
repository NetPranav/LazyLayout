/**
 * Icons, illustrations and stock media (ROADMAP Phase 126). Pure functions: the icon sets we ship and their licences,
 * searching them, an icon's shapes as an SVG file, and stock photos from a provider read into one form with their
 * licence and credit line. Putting them into the asset store and on the canvas is `assets/mediaOps.ts`.
 *
 * - **Icons**: Lucide (ISC), already a dependency (`lucide-react`); each icon's shapes come from its module's
 *   `__iconNode`, loaded only when it is used. The licence is in `DOCS/INITIAL/LICENSES.md`.
 * - **Photos**: Openverse (openly licensed images, no key needed). Every result keeps its licence, author, page and
 *   the credit line Openverse writes for it.
 */

import type { AssetSource } from "../document/schema";

// --- icon sets -----------------------------------------------------------------------------------

export interface IconSet {
  id: string;
  name: string;
  licence: string;
  licenceUrl: string;
  url: string;
  /** The SVG drawing style its icons share. */
  stroke: { width: number; linecap: "round"; linejoin: "round" };
}

export const ICON_SETS: readonly IconSet[] = [{ id: "lucide", name: "Lucide", licence: "ISC", licenceUrl: "https://lucide.dev/license", url: "https://lucide.dev", stroke: { width: 2, linecap: "round", linejoin: "round" } }];

/** One element of an icon: a tag and its attributes, as Lucide stores it. */
export type IconNode = readonly (readonly [string, Readonly<Record<string, string | number>>])[];

const SHAPES = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
/** The geometry an icon's shapes may carry (nothing that runs or links). */
const GEOMETRY = new Set(["d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "points", "transform", "fill", "stroke", "stroke-width", "opacity", "fill-rule", "clip-rule"]);
const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * An icon as a standalone SVG file (24 × 24, stroked in `color`), only its shapes and their geometry kept. The stroke
 * is written on each shape as well as the root, so an importer that doesn't inherit it still draws the icon.
 */
export function iconSvg(node: IconNode, set: IconSet = ICON_SETS[0], color = "#0f172a"): string {
  const paint = ` fill="none" stroke="${esc(color)}" stroke-width="${set.stroke.width}" stroke-linecap="${set.stroke.linecap}" stroke-linejoin="${set.stroke.linejoin}"`;
  const parts = node
    .filter(([tag]) => SHAPES.has(tag))
    .map(([tag, attrs]) => {
      const own = Object.entries(attrs).filter(([k]) => GEOMETRY.has(k) && !["fill", "stroke", "stroke-width"].includes(k));
      return `<${tag}${own.map(([k, v]) => ` ${k}="${esc(v)}"`).join("")}${paint}/>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${esc(color)}" stroke-width="${set.stroke.width}" stroke-linecap="${set.stroke.linecap}" stroke-linejoin="${set.stroke.linejoin}">${parts.join("")}</svg>`;
}

/**
 * Lucide icons that come from the Feather project, and so are also under Feather's MIT licence (the list in
 * `lucide-react/LICENSE`, v1.41.0).
 */
export const FEATHER_DERIVED: ReadonlySet<string> = new Set(["airplay", "alert-circle", "alert-octagon", "alert-triangle", "aperture", "arrow-down-circle", "arrow-down-left", "arrow-down-right", "arrow-down", "arrow-left-circle", "arrow-left", "arrow-right-circle", "arrow-right", "arrow-up-circle", "arrow-up-left", "arrow-up-right", "arrow-up", "at-sign", "calendar", "cast", "check", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "chevrons-down", "chevrons-left", "chevrons-right", "chevrons-up", "circle", "clipboard", "clock", "code", "columns", "command", "compass", "corner-down-left", "corner-down-right", "corner-left-down", "corner-left-up", "corner-right-down", "corner-right-up", "corner-up-left", "corner-up-right", "crosshair", "database", "divide-circle", "divide-square", "dollar-sign", "download", "external-link", "feather", "frown", "hash", "headphones", "help-circle", "info", "italic", "key", "layout", "life-buoy", "link-2", "link", "loader", "lock", "log-in", "log-out", "maximize", "meh", "minimize", "minimize-2", "minus-circle", "minus-square", "minus", "monitor", "moon", "more-horizontal", "more-vertical", "move", "music", "navigation-2", "navigation", "octagon", "pause-circle", "percent", "plus-circle", "plus-square", "plus", "power", "radio", "rss", "search", "server", "share", "shopping-bag", "sidebar", "smartphone", "smile", "square", "table-2", "tablet", "target", "terminal", "trash-2", "trash", "triangle", "tv", "type", "upload", "x-circle", "x-octagon", "x-square", "x", "zoom-in", "zoom-out"]);

/** What the asset store records for an icon from a set (a Feather-derived Lucide icon names both licences). */
export const iconSource = (name: string, set: IconSet = ICON_SETS[0]): AssetSource => ({
  kind: "icon",
  provider: set.name,
  id: name,
  title: titleOf(name),
  url: `${set.url}/icons/${name}`,
  licence: set.id === "lucide" && FEATHER_DERIVED.has(name) ? "ISC and MIT (Feather)" : set.licence,
  licenceUrl: set.licenceUrl,
});

/** `arrow-up-right` → `Arrow up right`. */
export const titleOf = (name: string): string => (name.charAt(0).toUpperCase() + name.slice(1)).replace(/-/g, " ");

/**
 * Icon names matching a search, best first: the name itself, then names starting with it, then names with a word
 * starting with it, then names containing it. Every word of the search must match. Empty: the first ones.
 */
export function searchIcons(names: readonly string[], query: string, limit = 120): string[] {
  const words = query.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return names.slice(0, limit);
  const score = (name: string): number => {
    const parts = name.split("-");
    let total = 0;
    for (const w of words) {
      if (name === w) total += 0;
      else if (name.startsWith(w)) total += 1;
      else if (parts.some((p) => p.startsWith(w))) total += 2;
      else if (name.includes(w)) total += 3;
      else return Infinity;
    }
    return total * 1000 + name.length;
  };
  return names
    .map((n) => ({ n, s: score(n) }))
    .filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s || a.n.localeCompare(b.n))
    .slice(0, limit)
    .map((x) => x.n);
}

// --- stock photos --------------------------------------------------------------------------------

export interface StockPhoto {
  id: string;
  title: string;
  /** The picture itself, and a small one for the results. */
  url: string;
  thumbnail: string;
  width?: number;
  height?: number;
  source: AssetSource;
}

export const OPENVERSE = { name: "Openverse", api: "https://api.openverse.org/v1/images/", url: "https://openverse.org" } as const;

/** The Openverse search for `query` (openly licensed photos, page `page`). */
export function openverseSearchUrl(query: string, page = 1, pageSize = 20): string {
  // `license_type=commercial,modification`: only photos that may be used on a commercial site AND edited (filters,
  // crops, masks), so no NC (non-commercial) or ND (no-derivatives) licences reach a design.
  const q = new URLSearchParams({ q: query.trim().slice(0, 200), page: String(Math.max(1, Math.floor(page))), page_size: String(Math.min(50, Math.max(1, pageSize))), mature: "false", license_type: "commercial,modification" });
  return `${OPENVERSE.api}?${q}`;
}

const str = (v: unknown, max = 2000): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const https = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^https:\/\//i.test(s) ? s : undefined;
};

/** A licence code and version as people read it: `by-sa` 4.0 → `CC BY-SA 4.0`; `cc0` → `CC0 1.0`; `pdm` → `Public Domain Mark`. */
export function licenceName(code: string, version?: string): string {
  const c = code.toLowerCase();
  if (c === "pdm") return "Public Domain Mark";
  if (c === "cc0") return `CC0${version ? ` ${version}` : ""}`;
  return `CC ${c.toUpperCase()}${version ? ` ${version}` : ""}`;
}

/** Openverse's results, kept only when they have a picture over https, a licence and a page to credit. */
export function parseOpenverse(json: unknown): StockPhoto[] {
  const results = typeof json === "object" && json !== null && Array.isArray((json as { results?: unknown }).results) ? (json as { results: unknown[] }).results : [];
  const out: StockPhoto[] = [];
  for (const r of results.slice(0, 50)) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id, 200);
    const url = https(o.url);
    const licence = str(o.license, 40);
    if (!id || !url || !licence) continue;
    // Belt and braces: drop non-commercial or no-derivatives licences even if the API returned them.
    if (/(^|-)(nc|nd)(-|$)/i.test(licence)) continue;
    const title = str(o.title, 300) ?? "Untitled";
    const author = str(o.creator, 300);
    const name = licenceName(licence, str(o.license_version, 20));
    out.push({
      id,
      title,
      url,
      thumbnail: https(o.thumbnail) ?? url,
      ...(typeof o.width === "number" && o.width > 0 ? { width: o.width } : {}),
      ...(typeof o.height === "number" && o.height > 0 ? { height: o.height } : {}),
      source: {
        kind: "photo",
        provider: OPENVERSE.name,
        id,
        title,
        ...(https(o.foreign_landing_url) ? { url: https(o.foreign_landing_url) } : {}),
        licence: name,
        ...(https(o.license_url) ? { licenceUrl: https(o.license_url) } : {}),
        ...(author ? { author } : {}),
        ...(https(o.creator_url) ? { authorUrl: https(o.creator_url) } : {}),
        attribution: str(o.attribution, 1000) ?? creditLine(title, author, name),
      },
    });
  }
  return out;
}

/** A credit line: `"Title" by Author, licensed under CC BY 4.0.` */
export const creditLine = (title: string, author: string | undefined, licence: string): string => `"${title}"${author ? ` by ${author}` : ""}, licensed under ${licence}.`;
