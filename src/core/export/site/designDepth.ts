/**
 * Design-depth export (ROADMAP Phase 130). The exporter already draws every layer with the stage's own render
 * definitions, so boolean groups, modifiers and generators (one SVG path), fill stacks with blend modes and masks,
 * noise, pattern, mesh and live fills, strokes with widths and brushes, effects, text on paths and in shapes, image
 * looks and 2.5D spaces (CSS 3D) come out as the stage shows them. This file adds what the stage can't say by itself:
 *
 * - **warnings** for what an exported page can't do exactly, each with what it does instead;
 * - **credits** for stock photos (Phase 126): a `CREDITS.md`, and on a plain HTML page a credits line, since an
 *   openly licensed photo's licence asks for its credit where it is used.
 */

import type { MotionDocument } from "../../document/schema";
import { parseEffects } from "../../paint/effects";
import { parseFills } from "../../paint/paints";

const has = (doc: MotionDocument, test: (p: Record<string, unknown>, archetype: string) => boolean) => Object.values(doc.layers).some((l) => test(l.properties as Record<string, unknown>, l.archetype));

/** What an exported page draws differently from the canvas, in words a designer reads. Empty when nothing does. */
export function designDepthWarnings(doc: MotionDocument): string[] {
  const out: string[] = [];
  const effects = (p: Record<string, unknown>) => parseEffects(p["paint.effects"]);
  if (has(doc, (p) => effects(p).some((e) => e.visible && (e.type === "layerBlur" || e.type === "backgroundBlur") && e.blurType === "progressive")))
    out.push("A progressive blur is drawn in 5 steps (as on the canvas), so its ramp is stepped, not smooth.");
  if (has(doc, (p) => effects(p).some((e) => e.visible && e.type === "glass")))
    out.push("Glass is drawn with CSS (a frosted blur and an edge light); it doesn't bend what's behind it, which needs backdrop sampling (Stage 4).");
  if (has(doc, (p) => (parseFills(p["paint.fills"]) ?? []).some((f) => f.visible && f.type === "mesh")))
    out.push("A mesh gradient is written as a picture of a fixed resolution; very large shapes may show its pixels.");
  if (has(doc, (p) => p["paint.backgroundBlur"] !== undefined || effects(p).some((e) => e.visible && e.type === "backgroundBlur")))
    out.push("Where a browser can't blur what's behind a layer (backdrop-filter), the layer shows a more opaque tint instead.");
  // keyframed properties the exported page shows at rest
  const animated = new Set<string>();
  for (const clip of Object.values(doc.clips ?? {})) for (const t of clip.tracks ?? []) animated.add(t.property);
  if (animated.has("typography.textPathStart")) out.push("Text on a path is exported where it starts at rest; its animated start isn't written yet.");
  for (const k of ["camera.x", "camera.y", "camera.z", "camera.focus", "camera.aperture"]) {
    if (animated.has(k)) {
      out.push("A depth camera is exported where it rests; its animation isn't written yet (Stage 4 binds cameras to scroll).");
      break;
    }
  }
  if (has(doc, (p, a) => (a === "container" || a === "form") && p["transform.style3d"] === "preserve3d" && typeof p["transform.perspective"] === "number"))
    out.push("A 2.5D space is drawn with CSS 3D; links and buttons inside it are clicked where they would sit flat.");
  return out;
}

export interface Credit {
  title: string;
  author?: string;
  licence: string;
  url?: string;
  line: string;
}

/** The credits of the stock photos the export uses (only those its pages show). */
export function photoCredits(doc: MotionDocument, used: Iterable<string>): Credit[] {
  const out: Credit[] = [];
  for (const id of used) {
    const s = doc.assets?.[id]?.source;
    if (!s || s.kind !== "photo") continue;
    out.push({ title: s.title ?? s.id, ...(s.author ? { author: s.author } : {}), licence: s.licence, ...(s.url ? { url: s.url } : {}), line: s.attribution ?? `"${s.title ?? s.id}"${s.author ? ` by ${s.author}` : ""}, ${s.licence}.` });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `CREDITS.md`: every photo's credit line, page and licence. */
export function creditsMarkdown(credits: readonly Credit[]): string {
  return ["# Credits", "", "Openly licensed photos used on this site:", "", ...credits.map((c) => `- ${c.line}${c.url ? ` (${c.url})` : ""}`), ""].join("\n");
}

/** The credits line a plain HTML page shows at its end. */
export function creditsHtml(credits: readonly Credit[]): string {
  const items = credits.map((c) => (c.url ? `<a href="${esc(c.url)}">${esc(c.line)}</a>` : esc(c.line))).join(" · ");
  return `<footer class="ll-credits" style="font:12px/1.5 system-ui,sans-serif;color:#64748b;padding:8px 16px">Photos: ${items}</footer>`;
}
