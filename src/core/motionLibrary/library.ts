/**
 * The motion library (ROADMAP Phase 91): the 51 curated presets of Sub-Phase 7.3 as versioned effects with an id, a
 * version, a category, tags and props that a person can search, insert, tune and detach. The presets stay where they
 * are (`core/motion/presets`: the catalogue, `getPresetsForArchetype` and its Rule 6.1 blocks); this file adds what a
 * library needs on top and never copies the animation data.
 *
 * An effect is a clip made from the preset with its props applied (`applyProps`). Its props are found from the clip
 * itself, so every effect has the same few controls: how long, how late, how strong (and the stagger, if it has one).
 */

import { ALL_PRESETS, getPresetsForArchetype, type MotionPreset } from "../motion/presets";
import type { ArchetypeId } from "../document/registry";
import { hydrateClip, type ClipDraft } from "../document/factories";
import { sampleTrack } from "../kernel/evaluate";
import type { PropValue } from "../document/registry";
import { TEXT_EFFECTS, type ExtraEffect } from "./textEffects";

export const LIBRARY_VERSION = "1.0.0";
export const LIBRARY_CATEGORIES = ["interactive", "media", "structural", "text"] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export interface LibraryProp {
  key: "duration" | "delay" | "strength" | "stagger";
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  unit: "s" | "%";
}

export interface LibraryEffect {
  /** `fx_` and the preset's name, so an id never changes when the library grows. */
  id: string;
  version: string;
  name: string;
  category: LibraryCategory;
  tags: string[];
  description: string;
  badge: MotionPreset["badge"] | ExtraEffect["badge"];
  archetypes: ArchetypeId[];
  props: LibraryProp[];
  /** The preset this effect is made from (kept, not copied), or the id of a recipe in `textEffects.ts`. */
  presetId: string;
  /** Settings the layer needs for the effect to show; written when it is inserted, removed with it (Phase 92). */
  layerProps?: Record<string, PropValue>;
  /** What the layer's text has to contain (`number`), or nothing. */
  needs?: "number";
  /** Recipes made for the library say where they come from. */
  provenance?: { original: true; recipe: string };
}

export const effectIdOf = (presetId: string): string => `fx_${presetId.replace(/^preset_/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;

/** Strength scales movement and fades; a progress that goes 0 to 1 (text motion) is not something to scale. */
const PROGRESS = "text.fxProgress";
const numeric = (anim: ClipDraft): boolean => (anim.tracks ?? []).some((t) => t.property !== PROGRESS && t.keyframes.some((k) => typeof k.value === "number"));

/** The controls an animation has: found from what it contains. */
export function propsOf(anim: ClipDraft): LibraryProp[] {
  const out: LibraryProp[] = [
    { key: "duration", label: "Duration", default: anim.duration, min: 0.05, max: 10, step: 0.05, unit: "s" },
    { key: "delay", label: "Delay", default: anim.delay ?? 0, min: 0, max: 10, step: 0.05, unit: "s" },
  ];
  if (numeric(anim)) out.push({ key: "strength", label: "Strength", default: 100, min: 0, max: 200, step: 5, unit: "%" });
  if (anim.stagger) out.push({ key: "stagger", label: "Stagger", default: anim.stagger.amount ?? 0, min: 0, max: 3, step: 0.05, unit: "s" });
  return out;
}

export type LibraryValues = Partial<Record<LibraryProp["key"], number>>;

/** The animation with props applied. Values are kept inside each prop's range; one at its default changes nothing. */
export function applyProps(anim: ClipDraft, values: LibraryValues = {}): ClipDraft {
  const out = structuredClone(anim);
  const specs = propsOf(anim);
  const get = (key: LibraryProp["key"]): number | undefined => {
    const s = specs.find((p) => p.key === key);
    const v = values[key];
    return s && v !== undefined && Number.isFinite(v) ? Math.min(s.max, Math.max(s.min, v)) : undefined;
  };
  const duration = get("duration");
  if (duration !== undefined && duration !== anim.duration) {
    const k = duration / anim.duration;
    for (const t of out.tracks ?? []) for (const kf of t.keyframes) kf.time = Math.round(kf.time * k * 1e6) / 1e6;
    out.duration = duration;
  }
  const delay = get("delay");
  if (delay !== undefined) {
    if (delay > 0) out.delay = delay;
    else delete out.delay;
  }
  const strength = get("strength");
  if (strength !== undefined && strength !== 100) {
    const f = strength / 100;
    for (const t of out.tracks ?? []) {
      if (t.property === PROGRESS) continue;
      const keys = t.keyframes;
      const rest = anim.type === "exit" ? keys[0]?.value : keys[keys.length - 1]?.value; // what the layer is at rest
      if (typeof rest !== "number") continue;
      for (const kf of keys) if (typeof kf.value === "number") kf.value = Math.round((rest + (kf.value - rest) * f) * 1e6) / 1e6;
    }
  }
  const stagger = get("stagger");
  if (stagger !== undefined && out.stagger) out.stagger = { ...out.stagger, amount: stagger };
  return out;
}

/** The values that differ from the effect's defaults: what an instance stores. */
export function overridesOf(effect: LibraryEffect, values: LibraryValues): LibraryValues {
  const out: LibraryValues = {};
  for (const p of effect.props) {
    const v = values[p.key];
    if (v !== undefined && Number.isFinite(v)) {
      const clamped = Math.min(p.max, Math.max(p.min, v));
      if (clamped !== p.default) out[p.key] = clamped;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const signature = (p: MotionPreset): string => JSON.stringify({ t: p.animation.type, tr: p.animation.trigger, d: p.animation.duration, e: p.animation.easing, s: p.animation.stagger, sc: p.animation.scrollTrigger, tracks: (p.animation.tracks ?? []).map((k) => [k.property, k.keyframes.map((f) => [f.time, f.value])]) });

export interface Library {
  effects: LibraryEffect[];
  /** Presets that were the same animation as an earlier one: dropped, their archetypes merged into the one kept. */
  dropped: Array<{ presetId: string; sameAs: string }>;
}

/** Builds the library from presets. Pure: the same presets give the same library. */
export function buildLibrary(presets: readonly MotionPreset[] = ALL_PRESETS, extras: readonly ExtraEffect[] = TEXT_EFFECTS): Library {
  const seen = new Map<string, LibraryEffect>();
  const effects: LibraryEffect[] = [];
  const dropped: Library["dropped"] = [];
  for (const p of presets) {
    const sig = signature(p);
    const same = seen.get(sig);
    if (same) {
      for (const a of p.compatibleArchetypes) if (!same.archetypes.includes(a)) same.archetypes.push(a);
      dropped.push({ presetId: p.id, sameAs: same.presetId });
      continue;
    }
    const effect: LibraryEffect = {
      id: effectIdOf(p.id),
      version: LIBRARY_VERSION,
      name: p.name,
      category: p.family as LibraryCategory,
      tags: [...new Set([...p.tags, p.badge.toLowerCase(), p.animation.type])],
      description: p.description,
      badge: p.badge,
      archetypes: [...p.compatibleArchetypes],
      props: propsOf(p.animation),
      presetId: p.id,
    };
    seen.set(sig, effect);
    effects.push(effect);
  }
  for (const x of extras) {
    const sig = JSON.stringify({ l: x.layerProps, a: x.animation });
    if (seen.has(sig) || effects.some((e) => e.id === x.id)) {
      dropped.push({ presetId: x.id, sameAs: seen.get(sig)?.presetId ?? x.id });
      continue;
    }
    const effect: LibraryEffect = {
      id: x.id, version: LIBRARY_VERSION, name: x.name, category: x.category,
      tags: [...new Set([...x.tags, x.badge.toLowerCase(), x.animation.type])],
      description: x.description, badge: x.badge, archetypes: [...x.archetypes],
      props: propsOf(x.animation), presetId: x.id, layerProps: x.layerProps,
      ...(x.needs ? { needs: x.needs } : {}), provenance: x.provenance,
    };
    seen.set(sig, effect);
    effects.push(effect);
  }
  return { effects, dropped };
}

let cached: { library: Library; byId: Map<string, LibraryEffect> } | null = null;
const lib = () => (cached ??= (() => { const library = buildLibrary(); return { library, byId: new Map(library.effects.map((e) => [e.id, e])) }; })());

export const listEffects = (): readonly LibraryEffect[] => lib().library.effects;
export const droppedPresets = (): Library["dropped"] => lib().library.dropped;
export const getEffect = (id: string): LibraryEffect | undefined => lib().byId.get(id);

export interface EffectQuery {
  query?: string;
  category?: LibraryCategory;
  tag?: string;
  /** Only effects that can go on this kind of layer and are not blocked for it (Rule 6.1). */
  archetype?: ArchetypeId;
}

/** Searches by name, tag and description, best match first; ties by name. With no query, by name. */
export function searchEffects(q: EffectQuery = {}): LibraryEffect[] {
  const text = q.query?.trim().toLowerCase() ?? "";
  const words = text.split(/\s+/).filter(Boolean);
  const scored: Array<{ e: LibraryEffect; score: number }> = [];
  for (const e of listEffects()) {
    if (q.category && e.category !== q.category) continue;
    if (q.tag && !e.tags.some((t) => t.toLowerCase() === q.tag!.toLowerCase())) continue;
    if (q.archetype && whyNotOn(e, q.archetype) !== null) continue;
    let score = 1;
    if (words.length) {
      const name = e.name.toLowerCase();
      score = 0;
      for (const w of words) {
        let s = 0;
        if (name === w) s = 100;
        else if (name.startsWith(w)) s = 60;
        else if (name.includes(w)) s = 40;
        else if (e.tags.some((t) => t.toLowerCase() === w)) s = 30;
        else if (e.tags.some((t) => t.toLowerCase().includes(w))) s = 20;
        else if (e.description.toLowerCase().includes(w)) s = 8;
        else { score = 0; break; } // every word has to match something
        score += s;
      }
      if (score === 0) continue;
    }
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name)).map((s) => s.e);
}

/** Why an effect can't go on a layer of this kind, or null (Rule 6.1 and compatibility). `text` is the layer's own words, for effects that need one. */
export function whyNotOn(effect: LibraryEffect, archetype: ArchetypeId, text?: string): string | null {
  if (effect.needs === "number" && text !== undefined && !/\d/.test(text)) return `${effect.name} counts a number in the text. Put a number in this layer's text first.`;
  const { blocked } = getPresetsForArchetype(archetype);
  const hit = blocked.find((b) => effectIdOf(b.preset.id) === effect.id);
  if (hit) return hit.reason;
  return effect.archetypes.includes(archetype) ? null : `${effect.name} is for ${effect.archetypes.join(", ")} layers.`;
}

/** The animation an instance of this effect plays. */
export function animationOf(effect: LibraryEffect, values: LibraryValues = {}): ClipDraft {
  const source = ALL_PRESETS.find((p) => p.id === effect.presetId)?.animation ?? TEXT_EFFECTS.find((x) => x.id === effect.presetId)?.animation;
  if (!source) throw new Error(`The recipe behind ${effect.id} is gone.`);
  return applyProps(source, values);
}

// ---------------------------------------------------------------------------
// Thumbnails: pre-rendered loops
// ---------------------------------------------------------------------------

export interface ThumbFrame { t: number; x: number; y: number; scale: number; rotate: number; opacity: number }
export interface Thumbnail {
  /** Seconds one loop takes (the effect's own time plus its delay, held a moment at the end). */
  duration: number;
  /** Where in `frames` the still picture is taken from: the effect at rest, or half way for a loop. */
  poster: number;
  frames: ThumbFrame[];
}

/** The size of the movement the thumbnail shows, in px, in a 56 px box: effects move a lot more than that on a page. */
const THUMB_PX = 14;
const clampPx = (v: number) => Math.max(-THUMB_PX, Math.min(THUMB_PX, v / 4));

/**
 * The effect sampled into a few frames of position, size, turn and opacity: a loop that is drawn from numbers and played
 * with the browser's own animation, never a live canvas, scene or editor. Effects that change something a thumbnail can't
 * show (a clip path, a gradient) still move through what they do change, or fade.
 */
export function thumbnailOf(effect: LibraryEffect, steps = 12): Thumbnail {
  const anim = animationOf(effect);
  const tracks = hydrateClip(anim).tracks;
  const end = Math.max(anim.duration, ...tracks.flatMap((t) => t.keyframes.map((k) => k.time)));
  const frames: ThumbFrame[] = [];
  for (let i = 0; i <= steps; i++) {
    const time = (end * i) / steps;
    const at = (property: string, rest: number): number => {
      const track = tracks.find((t) => t.property === property);
      const v = track ? sampleTrack(track, time) : undefined;
      return typeof v === "number" ? v : rest;
    };
    frames.push({
      t: i / steps,
      x: clampPx(at("transform.x", 0)),
      y: clampPx(at("transform.y", 0)),
      scale: Math.max(0.2, Math.min(2, at("transform.scale", at("transform.scaleX", 1)))),
      rotate: at("transform.rotate", 0),
      // text motion has no opacity of its own: its progress shows as the box filling in
      opacity: Math.max(0, Math.min(1, tracks.some((t) => t.property === PROGRESS) ? 0.15 + 0.85 * at(PROGRESS, 1) : at("appearance.opacity", 1))),
    });
  }
  const type = anim.type;
  return { duration: Math.max(0.6, end + (anim.delay ?? 0)) + 0.4, poster: type === "exit" ? 0 : frames.length - 1, frames };
}
