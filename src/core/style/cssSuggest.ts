/**
 * Autocomplete for the Style code box (Design track D3): what to offer at the caret. Pure: given the text and the caret it
 * returns the word being typed and the choices that start with it, for a property name or, after `prop:`, for a value.
 */
import { PROPERTY_REGISTRY } from "../document/properties";

/** Common CSS properties; the registry's own CSS names are added. */
const COMMON = [
  "align-content", "align-items", "align-self", "animation", "aspect-ratio", "backdrop-filter", "background", "background-attachment", "background-blend-mode",
  "background-clip", "background-color", "background-image", "background-position", "background-repeat", "background-size", "border", "border-bottom", "border-collapse",
  "border-color", "border-left", "border-radius", "border-right", "border-style", "border-top", "border-width", "bottom", "box-shadow", "box-sizing", "clip-path", "color",
  "column-gap", "columns", "contain", "content", "cursor", "display", "filter", "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap",
  "float", "font", "font-family", "font-feature-settings", "font-size", "font-style", "font-variant", "font-weight", "gap", "grid", "grid-area", "grid-auto-flow",
  "grid-column", "grid-gap", "grid-row", "grid-template-areas", "grid-template-columns", "grid-template-rows", "height", "inset", "isolation", "justify-content",
  "justify-items", "justify-self", "left", "letter-spacing", "line-height", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top", "mask", "mask-image",
  "max-height", "max-width", "min-height", "min-width", "mix-blend-mode", "object-fit", "object-position", "opacity", "order", "outline", "outline-offset", "overflow",
  "overflow-x", "overflow-y", "padding", "padding-bottom", "padding-left", "padding-right", "padding-top", "perspective", "perspective-origin", "place-content",
  "place-items", "pointer-events", "position", "right", "rotate", "row-gap", "scale", "scroll-behavior", "scroll-snap-align", "scroll-snap-type", "text-align",
  "text-decoration", "text-indent", "text-overflow", "text-shadow", "text-transform", "top", "transform", "transform-origin", "transform-style", "transition",
  "translate", "user-select", "vertical-align", "visibility", "white-space", "width", "will-change", "word-break", "writing-mode", "z-index",
];

/** Values worth offering for properties that take a keyword. */
const KEYWORDS: Record<string, string[]> = {
  display: ["block", "flex", "grid", "inline", "inline-block", "inline-flex", "none", "contents"],
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  overflow: ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-x": ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-y": ["visible", "hidden", "scroll", "auto", "clip"],
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "flex-wrap": ["nowrap", "wrap", "wrap-reverse"],
  "justify-content": ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
  "align-items": ["stretch", "flex-start", "center", "flex-end", "baseline"],
  "text-align": ["left", "center", "right", "justify"],
  "text-transform": ["none", "uppercase", "lowercase", "capitalize"],
  "white-space": ["normal", "nowrap", "pre", "pre-wrap", "pre-line"],
  visibility: ["visible", "hidden"],
  "pointer-events": ["auto", "none"],
  "mix-blend-mode": ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference", "exclusion"],
  cursor: ["auto", "pointer", "text", "move", "not-allowed", "grab", "grabbing", "crosshair", "default"],
  "box-sizing": ["border-box", "content-box"],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  "background-repeat": ["repeat", "no-repeat", "repeat-x", "repeat-y"],
  "background-size": ["auto", "cover", "contain"],
  "transform-style": ["flat", "preserve-3d"],
  isolation: ["auto", "isolate"],
};

let names: string[] | null = null;
const allNames = (): string[] => {
  if (names) return names;
  const set = new Set(COMMON);
  for (const def of Object.values(PROPERTY_REGISTRY)) if (def.css) set.add(def.css);
  return (names = [...set].sort());
};

/** Values for a property: its registry options when it has them, else the common keywords. */
function valuesFor(prop: string): string[] {
  const fromRegistry = Object.values(PROPERTY_REGISTRY).find((d) => d.css === prop && d.valueType === "enum" && d.options);
  return [...new Set([...(fromRegistry?.options ?? []), ...(KEYWORDS[prop] ?? [])])];
}

export interface Suggestion {
  /** `property` or `value`. */
  kind: "property" | "value";
  /** The word being typed (what the choices replace). */
  word: string;
  /** Where the word starts in the text. */
  from: number;
  choices: string[];
}

/** What to offer with the caret at `caret`: nothing when the word is empty or already the only match. */
export function suggest(text: string, caret: number, max = 8): Suggestion | null {
  const before = text.slice(0, caret);
  const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("\n"), before.lastIndexOf("{")) + 1;
  const decl = before.slice(start);
  const colon = decl.indexOf(":");
  if (colon < 0) {
    const word = decl.trim().toLowerCase();
    if (word === "") return null;
    const from = start + decl.length - decl.trimStart().length;
    const choices = allNames().filter((n) => n.startsWith(word) && n !== word).slice(0, max);
    return choices.length > 0 ? { kind: "property", word, from, choices } : null;
  }
  const prop = decl.slice(0, colon).trim().toLowerCase();
  const valueText = decl.slice(colon + 1);
  const word = valueText.trimStart();
  if (/[\s(,]/.test(word)) return null; // inside a longer value: stay quiet
  const from = start + colon + 1 + (valueText.length - word.length);
  const choices = valuesFor(prop).filter((v) => v.startsWith(word.toLowerCase()) && v !== word).slice(0, max);
  return choices.length > 0 ? { kind: "value", word, from, choices } : null;
}

/** The text with the chosen word in place of the one being typed, and where the caret goes. */
export function applySuggestion(text: string, caret: number, s: Suggestion, choice: string): { text: string; caret: number } {
  const insert = s.kind === "property" ? `${choice}: ` : `${choice};`;
  const next = text.slice(0, s.from) + (s.kind === "value" ? "" : "") + insert + text.slice(caret);
  return { text: next, caret: s.from + insert.length };
}
