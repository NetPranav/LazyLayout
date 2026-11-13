/**
 * Style code (Design track D3): write CSS declarations for one layer, as in a stylesheet.
 *
 * - A declaration whose property is a normal control (`padding`, `opacity`, `border-radius`, ...) and whose value fits it
 *   (`24px`, `0.5`, `#ff0000`) sets that control; any other declaration is kept as written in `style.custom`, drawn on the
 *   canvas and exported as written.
 * - The other way, `composeStyleCode` writes a layer's controls and custom declarations back as text.
 * - Safe by construction: only `property: value` declarations (no selectors, no braces, no at-rules, no script, no
 *   `expression()`, no `javascript:` or HTML-bearing `url()`), a size limit, and every refusal comes with a line number.
 *
 * Pure: no page access. Used by the inspector's Style code box and by the renderer (which draws `style.custom`).
 */
import type { CSSProperties } from "react";
import { PROPERTY_REGISTRY, type PropertyDefinition } from "../document/properties";

export const CUSTOM_STYLE_PATH = "style.custom";
export const MAX_STYLE_CODE_CHARS = 8000;
export const MAX_DECLARATIONS = 200;

export type Declaration = readonly [prop: string, value: string];
export interface StyleCodeError {
  /** 1-based line of the declaration. */
  line: number;
  message: string;
}
export interface ParsedStyleCode {
  declarations: Declaration[];
  errors: StyleCodeError[];
}

const PROP_NAME = /^(--[A-Za-z0-9_-]+|-?[a-z][a-z0-9-]*)$/;
/** Properties that run script or load code in some engines. */
const FORBIDDEN_PROPS = new Set(["behavior", "-moz-binding", "binding", "-ms-behavior"]);

/** Removes `/* ... *\/` comments, keeping newlines so line numbers stay right. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Splits on `;` outside parentheses and quotes. Returns each piece with the line it starts on. */
function splitDeclarations(text: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let depth = 0;
  let quote: string | null = null;
  let buf = "";
  let line = 1;
  let startLine = 1;
  for (const ch of text) {
    if (ch === "\n") line++;
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
    } else if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      buf += ch;
    } else if (ch === ";" && depth === 0) {
      out.push({ text: buf, line: startLine });
      buf = "";
      startLine = line;
    } else {
      if (buf.trim() === "" && ch !== "\n" && ch !== " " && ch !== "\t" && ch !== "\r") startLine = line;
      buf += ch;
    }
  }
  if (buf.trim() !== "") out.push({ text: buf, line: startLine });
  return out;
}

/** Why a value is refused, or null when it is fine. */
export function valueProblem(value: string): string | null {
  if (value === "") return "the value is empty";
  if (/[{}<>]/.test(value)) return "braces and angle brackets are not allowed";
  if (/\\/.test(value)) return "escape sequences are not allowed";
  if (/@import|expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:/i.test(value)) return "this value can run code";
  for (const m of value.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    const target = m[2].trim().toLowerCase();
    const ok = target.startsWith("#") || target.startsWith("/") || target.startsWith("./") || target.startsWith("https://") || /^data:image\/(png|jpeg|jpg|gif|webp|avif);/.test(target);
    if (!ok) return "url() may point only to a picture (https, a relative path, an image data URL, or #id)";
  }
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth < 0) return "a closing bracket has no opening one";
  }
  if (depth !== 0) return "a bracket is not closed";
  return null;
}

/** Parses declarations. Valid ones are returned; every refused one is an error with its line. */
export function parseStyleCode(text: string): ParsedStyleCode {
  const errors: StyleCodeError[] = [];
  const declarations: Declaration[] = [];
  if (text.length > MAX_STYLE_CODE_CHARS) return { declarations, errors: [{ line: 1, message: `too long (more than ${MAX_STYLE_CODE_CHARS} characters)` }] };
  const clean = stripComments(text);
  if (/[{}]/.test(clean)) {
    const at = clean.slice(0, clean.search(/[{}]/)).split("\n").length;
    return { declarations, errors: [{ line: at, message: "write declarations only (property: value;), not selectors or rules" }] };
  }
  for (const piece of splitDeclarations(clean)) {
    const raw = piece.text.trim();
    if (raw === "") continue;
    const colon = raw.indexOf(":");
    if (colon <= 0) {
      errors.push({ line: piece.line, message: `"${raw.slice(0, 40)}" is not property: value` });
      continue;
    }
    const prop = raw.slice(0, colon).trim().toLowerCase();
    const value = raw.slice(colon + 1).trim().replace(/\s*!important\s*$/i, "");
    if (!PROP_NAME.test(prop)) {
      errors.push({ line: piece.line, message: `"${prop.slice(0, 40)}" is not a CSS property name` });
      continue;
    }
    if (FORBIDDEN_PROPS.has(prop)) {
      errors.push({ line: piece.line, message: `${prop} is not allowed` });
      continue;
    }
    const problem = valueProblem(value);
    if (problem) {
      errors.push({ line: piece.line, message: `${prop}: ${problem}` });
      continue;
    }
    if (declarations.length >= MAX_DECLARATIONS) {
      errors.push({ line: piece.line, message: `more than ${MAX_DECLARATIONS} declarations` });
      break;
    }
    declarations.push([prop, value]);
  }
  return { declarations, errors };
}

/** `border-radius` -> `borderRadius`; custom properties (`--x`) keep their name. */
export const toReactProp = (prop: string): string => (prop.startsWith("--") ? prop : prop.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

/** The declarations as a React style object (what the canvas and the export draw). */
export function declarationsToStyle(declarations: readonly Declaration[]): CSSProperties {
  const style: Record<string, string> = {};
  for (const [prop, value] of declarations) style[toReactProp(prop)] = value;
  return style as CSSProperties;
}

/** The custom declarations stored on a layer, re-checked on read: a document edited by hand cannot smuggle script in. */
export function customDeclarationsOf(stored: unknown): Declaration[] {
  return typeof stored === "string" && stored !== "" ? parseStyleCode(stored).declarations : [];
}

// ---------------------------------------------------------------------------------------------------------------------
// Known properties: a declaration that is a control
// ---------------------------------------------------------------------------------------------------------------------

type Kind = "length" | "number" | "color" | "enum";
const KNOWN_KINDS = new Set<string>(["length", "number", "color", "enum"]);

/** CSS name -> the one registry path that is that property, for the simple value kinds. Built once. */
let reverse: Map<string, { path: string; def: PropertyDefinition }> | null = null;
function reverseMap() {
  if (reverse) return reverse;
  const byCss = new Map<string, { path: string; def: PropertyDefinition }[]>();
  for (const [path, def] of Object.entries(PROPERTY_REGISTRY)) {
    if (!def.css || !KNOWN_KINDS.has(def.valueType)) continue;
    const list = byCss.get(def.css) ?? [];
    list.push({ path, def });
    byCss.set(def.css, list);
  }
  reverse = new Map();
  for (const [css, list] of byCss) if (list.length === 1) reverse.set(css, list[0]);
  return reverse;
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i;

/** A declaration's value as the control's value, or undefined when it does not fit the control (it then stays custom). */
function controlValue(def: PropertyDefinition, value: string): string | number | undefined {
  const kind = def.valueType as Kind;
  if (kind === "length") {
    const m = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(value);
    return m ? Number(m[1]) : undefined;
  }
  if (kind === "number") {
    const m = /^-?\d+(?:\.\d+)?$/.exec(value);
    return m ? Number(value) : undefined;
  }
  if (kind === "color") return COLOR.test(value) && !/^(inherit|initial|unset|currentcolor)$/i.test(value) ? value : undefined;
  if (kind === "enum") return def.options ? (def.options.includes(value) ? value : undefined) : /^[a-z-]+$/.test(value) ? value : undefined;
  return undefined;
}

export interface SplitStyleCode {
  /** Control values to write (property path -> value). */
  controls: Record<string, string | number>;
  /** Declarations that are not a control, kept as written. */
  custom: Declaration[];
  errors: StyleCodeError[];
}

/** Splits code into the controls it sets (for this layer type) and the custom rest. A later declaration wins over an earlier one of the same property. */
export function splitStyleCode(text: string, archetype: string): SplitStyleCode {
  const { declarations, errors } = parseStyleCode(text);
  const controls: Record<string, string | number> = {};
  const customByProp = new Map<string, string>();
  const rev = reverseMap();
  for (const [prop, value] of declarations) {
    const known = rev.get(prop);
    const v = known && known.def.archetypes.includes(archetype as never) ? controlValue(known.def, value) : undefined;
    if (known && v !== undefined) {
      controls[known.path] = v;
      customByProp.delete(prop); // the control now owns this property
    } else {
      customByProp.set(prop, value);
    }
  }
  return { controls, custom: [...customByProp].map(([p, v]) => [p, v] as const), errors };
}

const lengthText = (n: number) => (n === 0 ? "0" : `${n}px`);
const valueText = (def: PropertyDefinition, v: unknown): string => (def.valueType === "length" && typeof v === "number" ? lengthText(v) : String(v));

/** The text for a layer: every control that has a CSS name and differs from its default, then the custom declarations. */
export function composeStyleCode(layer: { archetype: string; properties: Record<string, unknown> }): string {
  const lines: string[] = [];
  const rev = reverseMap();
  const taken = new Set<string>();
  for (const [css, { path, def }] of rev) {
    if (!def.archetypes.includes(layer.archetype as never)) continue;
    const v = layer.properties[path];
    if (v === undefined || v === def.default || v === "") continue;
    lines.push(`${css}: ${valueText(def, v)};`);
    taken.add(css);
  }
  lines.sort();
  for (const [prop, value] of customDeclarationsOf(layer.properties[CUSTOM_STYLE_PATH])) if (!taken.has(prop)) lines.push(`${prop}: ${value};`);
  return lines.join("\n");
}

export interface StyleCodePatch {
  /** Property writes: a control's value, or null to put a control back to its default. Empty when the text has errors. */
  patch: Record<string, string | number | null>;
  errors: StyleCodeError[];
}

/**
 * What to write when the text for `layer` is applied: the controls the text sets, the custom rest, and a reset for every
 * control the layer has set (and the text no longer mentions). Nothing is written while the text has errors, so a typo
 * never half-applies.
 */
export function styleCodePatch(layer: { archetype: string; properties: Record<string, unknown> }, text: string): StyleCodePatch {
  const split = splitStyleCode(text, layer.archetype);
  if (split.errors.length > 0) return { patch: {}, errors: split.errors };
  const patch: Record<string, string | number | null> = { ...split.controls };
  for (const { path, def } of reverseMap().values()) {
    if (!def.archetypes.includes(layer.archetype as never) || path in patch) continue;
    const v = layer.properties[path];
    if (v !== undefined && v !== def.default && v !== "") patch[path] = null;
  }
  patch[CUSTOM_STYLE_PATH] = split.custom.length > 0 ? split.custom.map(([p, v]) => `${p}: ${v}`).join("; ") : null;
  return { patch, errors: [] };
}
