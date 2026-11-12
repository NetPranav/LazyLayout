/**
 * The expression language's syntax tree (ROADMAP Phase 77). A small typed language for properties: arithmetic, comparisons,
 * `time`, `value`, `wiggle`, `loopOut`, `linear` and `ease`, `valueAtTime`, and references to other layers' properties. There is
 * no `eval` and no `Function`: text is parsed to this tree, checked, and walked by `evaluate.ts`.
 */
export type ExprType = "number" | "boolean" | "string";

export type Expr =
  | { k: "num"; v: number; at: number }
  | { k: "bool"; v: boolean; at: number }
  | { k: "str"; v: string; at: number }
  | { k: "id"; name: string; at: number }
  | { k: "un"; op: "-" | "!"; a: Expr; at: number }
  | { k: "bin"; op: BinaryOp; a: Expr; b: Expr; at: number }
  | { k: "cond"; c: Expr; a: Expr; b: Expr; at: number }
  | { k: "call"; name: string; args: Expr[]; at: number };

export type BinaryOp = "+" | "-" | "*" | "/" | "%" | "**" | "<" | ">" | "<=" | ">=" | "==" | "!=" | "&&" | "||";

/** A problem found in an expression, with where it is (a character position, from 0). */
export interface ExprError {
  code: "EXPR_SYNTAX" | "EXPR_TYPE" | "EXPR_LIMIT";
  message: string;
  at: number;
}

export type ParseResult = { ok: true; ast: Expr; type: ExprType } | { ok: false; errors: ExprError[] };

/** The limits that keep an expression small and safe. */
export const EXPR_LIMITS = { chars: 600, depth: 24, nodes: 300 } as const;
