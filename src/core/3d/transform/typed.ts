/**
 * ============================================================================
 * 3D TRANSFORM COMMAND PARSER (Phase 3D-016)
 * ============================================================================
 * Pure parser for modal G / R / S transform commands (e.g., "g x 2", "r z 90",
 * "s 2", "g shift+z 1.5 enter").
 * Returns a structured result or an error object without throwing.
 * ============================================================================
 */

export type TransformMode = "translate" | "rotate" | "scale";
export type TransformAxis = "X" | "Y" | "Z";

export interface ParsedTransformSuccess {
  ok: true;
  mode: TransformMode;
  axis?: TransformAxis;
  plane: boolean;
  value?: number;
  error?: undefined;
}

export interface ParsedTransformError {
  ok: false;
  mode?: undefined;
  axis?: undefined;
  plane: false;
  value?: undefined;
  error: string;
}

export type ParsedTransformResult = ParsedTransformSuccess | ParsedTransformError;

/**
 * Parses a modal transform command string like:
 * - "g x 2" -> { ok: true, mode: "translate", axis: "X", plane: false, value: 2 }
 * - "r z 90" -> { ok: true, mode: "rotate", axis: "Z", plane: false, value: 90 }
 * - "s 2" -> { ok: true, mode: "scale", plane: false, value: 2 }
 * - "g shift+z 1.5 enter" -> { ok: true, mode: "translate", axis: "Z", plane: true, value: 1.5 }
 * - "g -1.5" -> { ok: true, mode: "translate", plane: false, value: -1.5 }
 *
 * Invalid input returns an error value (never throws).
 */
export function parseTransformCommand(input: string): ParsedTransformResult {
  if (typeof input !== "string") {
    return { ok: false, plane: false, error: "Command input must be a string" };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, plane: false, error: "Empty command string" };
  }

  // Tokenize by whitespace, ignoring punctuation commas if any
  const rawTokens = trimmed
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 0);

  if (rawTokens.length === 0) {
    return { ok: false, plane: false, error: "Empty command string" };
  }

  // 1. Identify transform mode from first token
  const modeToken = rawTokens[0].toLowerCase();
  let mode: TransformMode;
  if (modeToken === "g" || modeToken === "translate") {
    mode = "translate";
  } else if (modeToken === "r" || modeToken === "rotate") {
    mode = "rotate";
  } else if (modeToken === "s" || modeToken === "scale") {
    mode = "scale";
  } else {
    return {
      ok: false,
      plane: false,
      error: `Unknown transform mode '${rawTokens[0]}'`,
    };
  }

  let axis: TransformAxis | undefined;
  let plane = false;
  let value: number | undefined;

  let i = 1;
  while (i < rawTokens.length) {
    const rawTok = rawTokens[i];
    const tok = rawTok.toLowerCase();

    // Check for trailing confirmation tokens like "enter" or "return"
    if (tok === "enter" || tok === "return") {
      i++;
      continue;
    }

    // Check for "shift+x", "shift+y", "shift+z", "shift-z", etc.
    const shiftMatch = tok.match(/^shift[+-_]([xyz])$/);
    if (shiftMatch) {
      axis = shiftMatch[1].toUpperCase() as TransformAxis;
      plane = true;
      i++;
      continue;
    }

    // Check for separate tokens: "shift" followed by "x"|"y"|"z"
    if (tok === "shift" && i + 1 < rawTokens.length) {
      const nextTok = rawTokens[i + 1].toLowerCase();
      if (nextTok === "x" || nextTok === "y" || nextTok === "z") {
        axis = nextTok.toUpperCase() as TransformAxis;
        plane = true;
        i += 2;
        continue;
      }
    }

    // Check for single axis tokens: "x", "y", "z"
    if (tok === "x" || tok === "y" || tok === "z") {
      axis = tok.toUpperCase() as TransformAxis;
      plane = false;
      i++;
      continue;
    }

    // Check for numeric value (e.g., "2", "-1.5", ".5", "+90")
    const num = Number(rawTok);
    if (!Number.isNaN(num) && rawTok.trim() !== "") {
      value = num;
      i++;
      continue;
    }

    // Unrecognized token
    return {
      ok: false,
      plane: false,
      error: `Unrecognized token '${rawTok}' in transform command`,
    };
  }

  return {
    ok: true,
    mode,
    ...(axis !== undefined ? { axis } : {}),
    plane,
    ...(value !== undefined ? { value } : {}),
  };
}
