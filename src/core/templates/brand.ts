/**
 * ============================================================================
 * THE BRAND TOKENS (ROADMAP Phase 51)
 * ============================================================================
 * Every section template binds its colours and corner radius to these variables, so they are the one place a theme
 * lives: change a value, or switch the document's mode from Light to Dark, and every template restyles at once. The
 * variables are created the first time a template is inserted, and found by name afterwards, so a person's own edits
 * to them stay.
 * ============================================================================
 */

import { getDocument } from "../store/documentState";
import { modesOf, type VariableType, type VariableValue } from "../tokens/tokens";
import { createVariable } from "../tokens/tokenOps";

export const BRAND_TOKENS = ["background", "surface", "text", "muted", "primary", "on-primary", "border", "radius"] as const;
export type Token = (typeof BRAND_TOKENS)[number];

interface BrandVariable {
  type: VariableType;
  light: VariableValue;
  dark: VariableValue;
  description: string;
}

/** The starting theme: a calm indigo on white, and the same on near-black. */
export const BRAND_DEFAULTS: Record<Token, BrandVariable> = {
  background: { type: "color", light: "#ffffff", dark: "#0e0f13", description: "The page behind everything." },
  surface: { type: "color", light: "#f5f6f8", dark: "#181a20", description: "Cards and bands that sit on the page." },
  text: { type: "color", light: "#14161c", dark: "#f3f4f6", description: "Headings and body text." },
  muted: { type: "color", light: "#5d6472", dark: "#a0a6b4", description: "Secondary text." },
  primary: { type: "color", light: "#4f46e5", dark: "#818cf8", description: "Buttons and highlights." },
  "on-primary": { type: "color", light: "#ffffff", dark: "#0e0f13", description: "Text and icons on the primary colour." },
  border: { type: "color", light: "#e3e5ea", dark: "#2a2d37", description: "Lines and card edges." },
  radius: { type: "number", light: 12, dark: 12, description: "Corner radius of cards and buttons." },
};

export const brandName = (token: Token): string => `brand/${token}`;

/**
 * The variable id of each brand token, creating any that is missing. The first mode of the document gets the light value,
 * the second the dark one, and any further mode the light one.
 */
export function ensureBrandTokens(): Record<Token, string> {
  const out = {} as Record<Token, string>;
  for (const token of BRAND_TOKENS) {
    const existing = Object.values(getDocument().variables ?? {}).find((v) => v.name === brandName(token));
    if (existing) {
      out[token] = existing.id;
      continue;
    }
    const def = BRAND_DEFAULTS[token];
    const modes = modesOf(getDocument());
    const values: Record<string, VariableValue> = {};
    modes.forEach((m, i) => (values[m.id] = i === 1 ? def.dark : def.light));
    const id = createVariable(brandName(token), def.type, values, { description: def.description });
    if (!id) throw new Error(`Couldn't create the brand variable ${brandName(token)}.`);
    out[token] = id;
  }
  return out;
}

/** A token's value in the first (light) mode, for the literal a layer keeps beside its binding. */
export const lightValue = (token: Token): VariableValue => BRAND_DEFAULTS[token].light;
