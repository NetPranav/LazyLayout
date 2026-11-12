import type { PropValue } from "../document/registry";

/** Reading a layer's expression slots (ROADMAP Phase 77): `expr.N.target`, `.text` and `.enabled`, up to eight. */
export const EXPR_SLOTS = 8;
export const exprPath = (slot: number, name: "target" | "text" | "enabled"): string => `expr.${slot}.${name}`;

export interface LayerExpression {
  slot: number;
  /** The property path it drives. */
  target: string;
  text: string;
  enabled: boolean;
}

export function readExpressions(props: Readonly<Record<string, PropValue>>): LayerExpression[] {
  const out: LayerExpression[] = [];
  for (let slot = 1; slot <= EXPR_SLOTS; slot++) {
    const target = props[exprPath(slot, "target")];
    const text = props[exprPath(slot, "text")];
    if (typeof target !== "string" || target === "" || typeof text !== "string" || text.trim() === "") continue;
    out.push({ slot, target, text, enabled: props[exprPath(slot, "enabled")] !== false });
  }
  return out;
}

export const hasExpressions = (props: Readonly<Record<string, PropValue>>): boolean => readExpressions(props).some((e) => e.enabled);
