/**
 * The layer clipboard (ROADMAP Phase 29). Copied layers travel as text with a marker, so they go through the system
 * clipboard (to another tab, another window, another project) and survive being pasted into a text field harmlessly.
 * Every paste re-validates the payload against the document schema, caps its size, and gives every layer a fresh id.
 * A copy is also mirrored to `localStorage`, which is what a paste falls back to when the browser gives the page no
 * clipboard text (some engines don't, without a permission prompt): tabs of the same origin always share it.
 */

import { z } from "zod";
import {
  AssetEntrySchema,
  LayerSchema,
  StyleEntrySchema,
  VariableEntrySchema,
  type AssetEntry,
  type Clip,
  type Layer,
  type StyleEntry,
  type VariableEntry,
} from "../document/schema";
import {
  BehaviourSchema,
  ClipSchema,
  SequenceSchema,
  StateSchema,
  TransitionSchema,
  type Behaviour,
  type LayerState,
  type Sequence,
  type Transition,
} from "../document/motion";
import { BindingSchema, type Binding } from "../document/signals";
import { EffectInstanceSchema, SurfaceSchema, type EffectInstance, type Surface } from "../document/effects";
import { InteractionGraphSchema, type InteractionGraph } from "../document/graph";

export const CLIP_MARK = "lazylayout:clip:1";
export const CLIP_STORAGE_KEY = "lazylayout:clipboard";
/** Most layers one paste may bring, and the longest payload text read (protects the tab from a hostile clipboard). */
export const MAX_CLIP_LAYERS = 5_000;
export const MAX_CLIP_CHARS = 8_000_000;

const PayloadSchema = z.object({
  v: z.literal(1),
  layers: z.array(LayerSchema).min(1).max(MAX_CLIP_LAYERS),
  clips: z.array(ClipSchema).max(MAX_CLIP_LAYERS),
  roots: z.array(z.string()).min(1),
  source: z.object({ projectId: z.string().optional(), parentId: z.string().nullable(), at: z.number() }),
  states: z.array(StateSchema).max(MAX_CLIP_LAYERS).optional(),
  behaviours: z.array(BehaviourSchema).max(MAX_CLIP_LAYERS).optional(),
  transitions: z.array(TransitionSchema).max(MAX_CLIP_LAYERS).optional(),
  surfaces: z.array(SurfaceSchema).max(MAX_CLIP_LAYERS).optional(),
  effects: z.array(EffectInstanceSchema).max(MAX_CLIP_LAYERS).optional(),
  bindings: z.array(BindingSchema).max(MAX_CLIP_LAYERS).optional(),
  graphs: z.array(InteractionGraphSchema).max(MAX_CLIP_LAYERS).optional(),
  sequences: z.array(SequenceSchema).max(MAX_CLIP_LAYERS).optional(),
  assets: z.record(z.string(), AssetEntrySchema).optional(),
  variables: z.record(z.string(), VariableEntrySchema).optional(),
  styles: z.record(z.string(), StyleEntrySchema).optional(),
});

export interface ClipPayload {
  v: 1;
  layers: Layer[];
  clips: Clip[];
  /** Ids (in `layers`) of the copied subtree roots, in the order they were selected. */
  roots: string[];
  /** Where they came from: the parent they were copied out of (null for a frame) and when. */
  source: { projectId?: string; parentId: string | null; at: number };
  states?: LayerState[];
  behaviours?: Behaviour[];
  transitions?: Transition[];
  surfaces?: Surface[];
  effects?: EffectInstance[];
  bindings?: Binding[];
  graphs?: InteractionGraph[];
  sequences?: Sequence[];
  assets?: Record<string, AssetEntry>;
  variables?: Record<string, VariableEntry>;
  styles?: Record<string, StyleEntry>;
}

export function serializeClip(payload: ClipPayload): string {
  return `${CLIP_MARK}\n${JSON.stringify(payload)}`;
}

/** Extracts a balanced `{...}` JSON object starting at `openIdx` (respecting strings/escapes). */
function extractJsonObject(source: string, openIdx: number): string | null {
  if (source[openIdx] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  return null;
}

function validateClipObject(rawJson: string): ClipPayload | null {
  try {
    const json: unknown = JSON.parse(rawJson);
    const parsed = PayloadSchema.safeParse(json);
    if (!parsed.success) return null;
    const { layers, roots } = parsed.data;
    const ids = new Set(layers.map((l) => l.id));
    if (ids.size !== layers.length || !roots.every((r) => ids.has(r))) return null;
    return parsed.data as ClipPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts and validates the payload in `text`, accepting either direct `lazylayout:clip:1` text
 * or saved plain-text / Markdown snippets wrapping the payload in prose or code fences.
 */
export function parseClip(text: string | null | undefined): ClipPayload | null {
  if (!text || text.length > MAX_CLIP_CHARS) return null;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const markerIdx = text.indexOf(CLIP_MARK, searchFrom);
    if (markerIdx === -1) break;
    const afterMark = text.slice(markerIdx + CLIP_MARK.length);
    const wsMatch = /^\s*/.exec(afterMark);
    const openOffset = wsMatch ? wsMatch[0].length : 0;
    if (afterMark[openOffset] === "{") {
      const jsonBlock = extractJsonObject(afterMark, openOffset);
      if (jsonBlock) {
        const parsed = validateClipObject(jsonBlock);
        if (parsed) return parsed;
      }
    }
    searchFrom = markerIdx + CLIP_MARK.length;
  }
  // Fallback for Markdown/text files where a user copied a fenced JSON block without the header line.
  const trimmed = text.trim();
  const bareMatch = /```(?:lazylayout|json)?\s*\r?\n(\{[\s\S]*\})\s*\r?\n```/i.exec(trimmed);
  if (bareMatch) {
    const jsonBlock = extractJsonObject(bareMatch[1], 0);
    if (jsonBlock) return validateClipObject(jsonBlock);
  }
  return null;
}

/** Mirrors the clip to localStorage. Returns false when storage is full or blocked, so a cut knows nothing was kept. */
export function mirrorWrite(text: string): boolean {
  try {
    window.localStorage.setItem(CLIP_STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function mirrorRead(): string | null {
  try {
    return window.localStorage.getItem(CLIP_STORAGE_KEY);
  } catch {
    return null;
  }
}
