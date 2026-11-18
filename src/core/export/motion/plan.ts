/**
 * The motion export plan (ROADMAP Phase 94): which code each animation of a document becomes. It reads the document and
 * the routing decision and nothing else: no store, no editor, no browser. The same document gives the same plan on a
 * server, in a worker and in the editor, which is what lets an exporter be run anywhere and tested without a page.
 * Phase 95 writes the code for each entry; the generators it calls are in this folder (`gsap.ts`, `framer.ts`, `css.ts`).
 *
 * How an engine is chosen, for each enabled clip, in order:
 *  1. the routing decision (`routeAnimation`, Phase 8) says what the properties need: CSS and DOM, SVG, canvas, WebGL, WebGPU or
 *     three.js. Anything above SVG is not code an exported page can run without its own runtime, so the clip is listed as
 *     `skipped` with the reason, never dropped silently.
 *  2. SVG motion is `svg`.
 *  3. a spring, a stagger, a scroll-scrubbed clip or an event trigger is `motion` (the `motion` library handles these in a few lines).
 *  4. otherwise it is `css`: a `@keyframes` block, which needs no script.
 * GSAP is never chosen by routing (a licence decision, Phase 14); it is used only when the caller asks (`gsap: true`, Phase 98).
 */

import type { Clip, MotionDocument } from "../../document/schema";
import { parseEasing } from "../../document/motion";
import { routeAnimation } from "../../rules/routing";
import type { DeviceTier, RouteBackend } from "../../rules/types";

export const EXPORT_ENGINES = ["css", "motion", "svg", "gsap"] as const;
export type ExportEngine = (typeof EXPORT_ENGINES)[number];

export interface PlanOptions {
  /** Caps what routing may pick (FX-PERF-02). */
  deviceTier?: DeviceTier;
  /** Use GSAP for everything that is not SVG or skipped: an opt-in export target. */
  gsap?: boolean;
}

export interface PlanEntry {
  clipId: string;
  clipName: string;
  layerId: string;
  layerName: string;
  engine: ExportEngine;
  backend: RouteBackend;
  /** Why this engine: the routing reason, then the rule that picked the engine. */
  reason: string;
  properties: string[];
}

export interface SkippedEntry {
  clipId: string;
  clipName: string;
  layerId: string;
  backend: RouteBackend;
  reason: string;
}

export interface MotionExportPlan {
  entries: PlanEntry[];
  skipped: SkippedEntry[];
  /** The engines something in the plan uses, in a fixed order: what a README should list. */
  engines: ExportEngine[];
}

const EVENT_TRIGGERS = new Set(["hover", "press", "focus", "inView", "scrollProgress", "pointerMove", "drag", "custom", "unmount", "layoutChange"]);

function pickEngine(clip: Clip, backend: RouteBackend, gsap: boolean): { engine: ExportEngine; rule: string } {
  if (backend === "svg") return { engine: "svg", rule: "It animates SVG, so it runs as SVG." };
  if (gsap) return { engine: "gsap", rule: "GSAP was asked for." };
  const easing = clip.easing ? parseEasing(clip.easing) : null;
  if (easing?.kind === "spring") return { engine: "motion", rule: "A spring is written with the `motion` library." };
  if (clip.stagger) return { engine: "motion", rule: "A stagger is written with the `motion` library." };
  if (clip.scrollTrigger) return { engine: "motion", rule: "A scroll-driven clip is written with the `motion` library." };
  if (EVENT_TRIGGERS.has(clip.trigger)) return { engine: "motion", rule: `A clip started by ${clip.trigger} is written with the \`motion\` library.` };
  return { engine: "css", rule: "A plain timed animation is a CSS @keyframes block, which needs no script." };
}

/** The plan for a document. Pure; layers and clips are visited in document order, so the same document gives the same plan. */
export function planMotionExport(doc: MotionDocument, options: PlanOptions = {}): MotionExportPlan {
  const entries: PlanEntry[] = [];
  const skipped: SkippedEntry[] = [];
  for (const clip of Object.values(doc.clips)) {
    const layer = doc.layers[clip.layerId];
    if (!layer || !clip.enabled) continue;
    const properties = clip.tracks.map((t) => t.property);
    const decision = routeAnimation({ properties, deviceTier: options.deviceTier });
    if (decision.backend !== "css" && decision.backend !== "svg") {
      skipped.push({ clipId: clip.id, clipName: clip.name, layerId: clip.layerId, backend: decision.backend, reason: `${decision.reason} An exported page can't run that without a runtime of its own, so this animation is not exported.` });
      continue;
    }
    const { engine, rule } = pickEngine(clip, decision.backend, options.gsap === true);
    entries.push({ clipId: clip.id, clipName: clip.name, layerId: clip.layerId, layerName: layer.name, engine, backend: decision.backend, reason: `${decision.reason} ${rule}`, properties });
  }
  const used = new Set(entries.map((e) => e.engine));
  return { entries, skipped, engines: EXPORT_ENGINES.filter((e) => used.has(e)) };
}
