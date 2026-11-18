/**
 * Library wave 1, text (ROADMAP Phase 92). Each effect here is a recipe over what the editor already has: the text
 * motion properties of Design track D12 (`text.fx`, `text.fxProgress`, scramble, typewriter, rotating words, count-up)
 * moved by a clip. They are original (a recipe of properties, not code taken from a library) and open (everything an
 * effect does is visible and editable in the Text motion section after it is inserted).
 *
 * Ten effects were asked for. Four of them are already in the preset catalogue (`core/motion/presets/textPresets.ts`) and
 * are not made again: split reveal is "Word Stagger Cascade", blur-in is "Blur Reveal", shiny text is "Gradient Sheen",
 * and "Kinetic Tracking" covers the tracking motion. Gradient flow and variable proximity need a gradient text fill and the
 * pointer-driven axis and are not built (see ROADMAP Phase 92).
 */

import type { ClipDraft } from "../document/factories";
import type { PropValue } from "../document/registry";
import type { ArchetypeId } from "../document/registry";

export interface ExtraEffect {
  id: string;
  name: string;
  category: "text";
  tags: string[];
  description: string;
  badge: "SplitText" | "Mount" | "ScrollTrigger" | "Ambient";
  archetypes: ArchetypeId[];
  /** Settings the layer needs for the effect to show (written when the effect is inserted). */
  layerProps: Record<string, PropValue>;
  /** What the layer's own text has to contain, or null. */
  needs: "number" | null;
  provenance: { original: true; recipe: string };
  animation: ClipDraft;
}

const clip = (name: string, duration: number, easing: string, extra: Partial<ClipDraft> = {}): ClipDraft => ({
  name, type: "entrance", trigger: "mount", duration, easing, enabled: true,
  tracks: [{ property: "text.fxProgress", keyframes: [{ time: 0, value: 0, ease: easing }, { time: duration, value: 1, ease: easing }] }],
  ...extra,
});

export const TEXT_EFFECTS: ExtraEffect[] = [
  {
    id: "fx_text_decrypt",
    name: "Decrypt",
    category: "text",
    tags: ["scramble", "decrypt", "letters", "reveal", "entrance", "text-fx"],
    description: "Random characters settle into the real text from left to right.",
    badge: "Mount",
    archetypes: ["text"],
    layerProps: { "text.fx": "scramble", "text.fxSeed": 7 },
    needs: null,
    provenance: { original: true, recipe: "text.fx scramble, text.fxProgress 0 to 1" },
    animation: clip("Decrypt", 1.4, "power2.out"),
  },
  {
    id: "fx_text_typed",
    name: "Typed Text",
    category: "text",
    tags: ["typewriter", "typing", "caret", "characters", "entrance", "text-fx"],
    description: "Characters appear one at a time with a blinking caret. Unlike Typewriter Step, the text itself is typed, so selection and reading order stay right.",
    badge: "Mount",
    archetypes: ["text"],
    layerProps: { "text.fx": "typewriter", "text.fxCaret": true },
    needs: null,
    provenance: { original: true, recipe: "text.fx typewriter with caret, text.fxProgress 0 to 1 linear" },
    animation: clip("Typed Text", 1.8, "linear"),
  },
  {
    id: "fx_text_rotating_words",
    name: "Rotating Words",
    category: "text",
    tags: ["rotate", "words", "loop", "headline", "ambient", "text-fx"],
    description: "Shows each word of a list in turn, forever. Change the words in Text motion.",
    badge: "Ambient",
    archetypes: ["text"],
    layerProps: { "text.fx": "rotate", "text.fxWords": "Design, Motion, Ship" },
    needs: null,
    provenance: { original: true, recipe: "text.fx rotate over a word list, text.fxProgress looping 0 to 1" },
    animation: clip("Rotating Words", 3, "linear", { type: "loop", repeat: -1 }),
  },
  {
    id: "fx_text_count_up",
    name: "Count Up",
    category: "text",
    tags: ["counter", "number", "count", "stat", "entrance", "text-fx"],
    description: "The first number in the text counts up from 0 to its value. The text needs a number in it.",
    badge: "Mount",
    archetypes: ["text"],
    layerProps: { "text.fx": "countup" },
    needs: "number",
    provenance: { original: true, recipe: "text.fx countup, text.fxProgress 0 to 1 power2.out" },
    animation: clip("Count Up", 1.6, "power2.out"),
  },
  {
    id: "fx_text_scroll_reveal",
    name: "Scroll Reveal Text",
    category: "text",
    tags: ["scroll", "scrub", "typewriter", "reveal", "scrolltrigger", "text-fx"],
    description: "The text is typed out as you scroll the page, and un-typed as you scroll back.",
    badge: "ScrollTrigger",
    archetypes: ["text"],
    layerProps: { "text.fx": "typewriter" },
    needs: null,
    provenance: { original: true, recipe: "text.fx typewriter, text.fxProgress scrubbed by scroll" },
    animation: clip("Scroll Reveal Text", 1, "none", { type: "scroll", trigger: "scrollProgress", scrollTrigger: { start: "top 85%", end: "top 35%", scrub: 0.5 } }),
  },
];
