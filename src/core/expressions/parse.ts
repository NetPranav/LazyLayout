import { EXPR_LIMITS, type BinaryOp, type Expr, type ExprError, type ExprType, type ParseResult } from "./ast";

/**
 * Parsing and type-checking an expression (ROADMAP Phase 77). Text becomes a tree (`ast.ts`) or a list of errors, each with
 * the character it is at, and nothing is run. A mistake is refused here, at the time of writing, not found while playing.
 */

/** What every function takes and gives. A string argument must be a literal in the text (a layer, a property, a loop type). */
export interface FunctionSignature {
  args: readonly ExprType[];
  /** How many of the trailing arguments may be left out. */
  optional?: number;
  returns: ExprType;
}

const N: ExprType = "number";
const S: ExprType = "string";

export const FUNCTIONS: Record<string, FunctionSignature> = {
  abs: { args: [N], returns: N }, floor: { args: [N], returns: N }, ceil: { args: [N], returns: N }, round: { args: [N], returns: N }, sqrt: { args: [N], returns: N },
  min: { args: [N, N], returns: N }, max: { args: [N, N], returns: N }, pow: { args: [N, N], returns: N }, mod: { args: [N, N], returns: N },
  clamp: { args: [N, N, N], returns: N },
  sin: { args: [N], returns: N }, cos: { args: [N], returns: N },
  radians: { args: [N], returns: N }, degrees: { args: [N], returns: N },
  /** `linear(t, tMin, tMax, a, b)`: t from the range tMin to tMax onto a to b, held outside it. */
  linear: { args: [N, N, N, N, N], returns: N },
  /** `ease(t, tMin, tMax, a, b)`: the same with a smooth start and finish. */
  ease: { args: [N, N, N, N, N], returns: N },
  smoothstep: { args: [N, N, N], returns: N },
  /** `noise(x, seed?)`: smooth noise from -1 to 1. */
  noise: { args: [N, N], optional: 1, returns: N },
  /** `wiggle(freq, amp, seed?)`: the value, moved at random `freq` times a second by up to `amp`. */
  wiggle: { args: [N, N, N], optional: 1, returns: N },
  /** `loopOut(type?)`: after the last keyframe, repeat the animation: "cycle", "pingpong", "offset" or "continue". */
  loopOut: { args: [S], optional: 1, returns: N },
  loopIn: { args: [S], optional: 1, returns: N },
  /** `valueAtTime(t)`: this property's own keyframed value at another time. */
  valueAtTime: { args: [N], returns: N },
  /** `ref("Layer", "transform.x")`: another layer's property now; `refAtTime(…, t)`: at another time. A layer is its id or its (unique) name. */
  ref: { args: [S, S], returns: N },
  refAtTime: { args: [S, S, N], returns: N },
};

/** The names an expression can use without calling anything. */
export const CONSTANTS: Record<string, ExprType> = { time: N, value: N, fps: N, duration: N, PI: N, E: N };

export const LOOP_TYPES = ["cycle", "pingpong", "offset", "continue"] as const;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Token = { t: "num" | "str" | "id" | "op" | "end"; v: string; at: number };

class SyntaxProblem extends Error {
  constructor(readonly error: ExprError) {
    super(error.message);
  }
}
const problem = (code: ExprError["code"], message: string, at: number): never => {
  throw new SyntaxProblem({ code, message, at });
};

const OPERATORS = ["**", "<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", ",", "?", ":"];

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && text[i + 1] >= "0" && text[i + 1] <= "9")) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(i))!;
      out.push({ t: "num", v: m[0], at: i });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < text.length && text[j] !== c) {
        if (text[j] === "\\") {
          j++;
          if (j >= text.length) break;
        }
        s += text[j++];
      }
      if (j >= text.length) problem("EXPR_SYNTAX", "A string is missing its closing quote.", i);
      out.push({ t: "str", v: s, at: i });
      i = j + 1;
      continue;
    }
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))!;
      out.push({ t: "id", v: m[0], at: i });
      i += m[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => text.startsWith(o, i));
    if (!op) problem("EXPR_SYNTAX", `"${c}" isn't something an expression can use.`, i);
    out.push({ t: "op", v: op!, at: i });
    i += op!.length;
  }
  out.push({ t: "end", v: "", at: text.length });
  return out;
}

// ---------------------------------------------------------------------------
// Parser (precedence climbing)
// ---------------------------------------------------------------------------

const BINARY: Record<string, { prec: number; right?: boolean }> = {
  "||": { prec: 1 }, "&&": { prec: 2 }, "==": { prec: 3 }, "!=": { prec: 3 },
  "<": { prec: 4 }, ">": { prec: 4 }, "<=": { prec: 4 }, ">=": { prec: 4 },
  "+": { prec: 5 }, "-": { prec: 5 }, "*": { prec: 6 }, "/": { prec: 6 }, "%": { prec: 6 },
  "**": { prec: 8, right: true },
};
const UNARY_PREC = 7;

class Parser {
  private pos = 0;
  private nodes = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek = () => this.tokens[this.pos];
  private next = () => this.tokens[this.pos++];
  private node<T extends Expr>(n: T, depth: number): T {
    if (++this.nodes > EXPR_LIMITS.nodes) problem("EXPR_LIMIT", `An expression can have at most ${EXPR_LIMITS.nodes} parts.`, n.at);
    if (depth > EXPR_LIMITS.depth) problem("EXPR_LIMIT", `Brackets and operators are nested more than ${EXPR_LIMITS.depth} deep.`, n.at);
    return n;
  }

  parse(): Expr {
    const e = this.ternary(0);
    const t = this.peek();
    if (t.t !== "end") problem("EXPR_SYNTAX", t.v === ")" ? "There is a closing bracket with no opening one." : `Unexpected "${t.v}".`, t.at);
    return e;
  }

  private ternary(depth: number): Expr {
    const c = this.binary(0, depth + 1);
    if (this.peek().v === "?" && this.peek().t === "op") {
      const at = this.next().at;
      const a = this.ternary(depth + 1);
      const colon = this.next();
      if (colon.v !== ":" || colon.t !== "op") problem("EXPR_SYNTAX", 'A "?" needs a ":" with the value for the other case.', colon.at);
      const b = this.ternary(depth + 1);
      return this.node({ k: "cond", c, a, b, at }, depth);
    }
    return c;
  }

  private binary(minPrec: number, depth: number): Expr {
    let left = this.unary(depth + 1);
    for (;;) {
      const t = this.peek();
      const info = t.t === "op" ? BINARY[t.v] : undefined;
      if (!info || info.prec < minPrec) return left;
      this.next();
      const right = this.binary(info.right ? info.prec : info.prec + 1, depth + 1);
      left = this.node({ k: "bin", op: t.v as BinaryOp, a: left, b: right, at: t.at }, depth);
    }
  }

  private unary(depth: number): Expr {
    const t = this.peek();
    if (t.t === "op" && (t.v === "-" || t.v === "!")) {
      this.next();
      // a unary minus binds tighter than * but looser than **, so -2 ** 2 is -(2 ** 2)
      const a = this.binary(UNARY_PREC, depth + 1);
      return this.node({ k: "un", op: t.v, a, at: t.at }, depth);
    }
    return this.primary(depth);
  }

  private primary(depth: number): Expr {
    const t = this.next();
    if (t.t === "num") return this.node({ k: "num", v: Number(t.v), at: t.at }, depth);
    if (t.t === "str") return this.node({ k: "str", v: t.v, at: t.at }, depth);
    if (t.t === "id") {
      if (t.v === "true" || t.v === "false") return this.node({ k: "bool", v: t.v === "true", at: t.at }, depth);
      if (this.peek().t === "op" && this.peek().v === "(") {
        this.next();
        const args: Expr[] = [];
        if (!(this.peek().t === "op" && this.peek().v === ")")) {
          for (;;) {
            args.push(this.ternary(depth + 1));
            if (this.peek().t === "op" && this.peek().v === ",") {
              this.next();
              continue;
            }
            break;
          }
        }
        const close = this.next();
        if (close.t !== "op" || close.v !== ")") problem("EXPR_SYNTAX", `${t.v}( is missing its closing bracket.`, close.at);
        return this.node({ k: "call", name: t.v, args, at: t.at }, depth);
      }
      return this.node({ k: "id", name: t.v, at: t.at }, depth);
    }
    if (t.t === "op" && t.v === "(") {
      const inner = this.ternary(depth + 1);
      const close = this.next();
      if (close.t !== "op" || close.v !== ")") problem("EXPR_SYNTAX", "A bracket is missing its closing bracket.", close.at);
      return inner;
    }
    return problem("EXPR_SYNTAX", t.t === "end" ? "The expression ends too soon." : `Unexpected "${t.v}".`, t.at);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The type of a tree, or throws the first type error. */
function check(e: Expr): ExprType {
  switch (e.k) {
    case "num": return "number";
    case "bool": return "boolean";
    case "str": return "string";
    case "id": {
      const t = CONSTANTS[e.name];
      if (!t) problem("EXPR_TYPE", `"${e.name}" isn't known. An expression can use ${Object.keys(CONSTANTS).join(", ")}, and the functions.`, e.at);
      return t!;
    }
    case "un": {
      const a = check(e.a);
      if (e.op === "-" && a !== "number") problem("EXPR_TYPE", 'A minus needs a number.', e.at);
      if (e.op === "!" && a !== "boolean") problem("EXPR_TYPE", 'A "!" needs a true or false value.', e.at);
      return a;
    }
    case "bin": {
      const a = check(e.a);
      const b = check(e.b);
      if (e.op === "&&" || e.op === "||") {
        if (a !== "boolean" || b !== "boolean") problem("EXPR_TYPE", `"${e.op}" joins two true or false values.`, e.at);
        return "boolean";
      }
      if (e.op === "==" || e.op === "!=") {
        if (a !== b || a === "string") problem("EXPR_TYPE", `"${e.op}" compares two numbers or two true or false values.`, e.at);
        return "boolean";
      }
      if (a !== "number" || b !== "number") problem("EXPR_TYPE", `"${e.op}" works on numbers.`, e.at);
      return ["<", ">", "<=", ">="].includes(e.op) ? "boolean" : "number";
    }
    case "cond": {
      if (check(e.c) !== "boolean") problem("EXPR_TYPE", 'The part before "?" must be a true or false value.', e.at);
      const a = check(e.a);
      const b = check(e.b);
      if (a !== b) problem("EXPR_TYPE", 'Both sides of "? :" must be the same kind of value.', e.at);
      return a;
    }
    case "call": {
      const sig = FUNCTIONS[e.name];
      if (!sig) problem("EXPR_TYPE", `"${e.name}" isn't a function an expression can call.`, e.at);
      const min = sig.args.length - (sig.optional ?? 0);
      if (e.args.length < min || e.args.length > sig.args.length) problem("EXPR_TYPE", `${e.name}() takes ${min === sig.args.length ? min : `${min} to ${sig.args.length}`} value${sig.args.length === 1 ? "" : "s"}, not ${e.args.length}.`, e.at);
      e.args.forEach((arg, i) => {
        const want = sig.args[i];
        const got = check(arg);
        if (got !== want) problem("EXPR_TYPE", `${e.name}() wants ${want === "string" ? "text in quotes" : "a number"} for value ${i + 1}.`, arg.at);
        if (want === "string" && arg.k !== "str") problem("EXPR_TYPE", `${e.name}() value ${i + 1} must be written as text in quotes, not worked out.`, arg.at);
      });
      if ((e.name === "loopOut" || e.name === "loopIn") && e.args[0]?.k === "str" && !(LOOP_TYPES as readonly string[]).includes(e.args[0].v)) problem("EXPR_TYPE", `A loop is one of ${LOOP_TYPES.join(", ")}.`, e.args[0].at);
      return sig.returns;
    }
  }
}

/** Parses and checks an expression. An expression gives a number (a true or false result counts as 1 or 0). */
export function parseExpression(text: string): ParseResult {
  if (text.length > EXPR_LIMITS.chars) return { ok: false, errors: [{ code: "EXPR_LIMIT", message: `An expression can be at most ${EXPR_LIMITS.chars} characters.`, at: EXPR_LIMITS.chars }] };
  try {
    const trimmed = text.trim();
    if (trimmed === "") return { ok: false, errors: [{ code: "EXPR_SYNTAX", message: "The expression is empty.", at: 0 }] };
    const ast = new Parser(tokenize(text)).parse();
    const type = check(ast);
    if (type === "string") problem("EXPR_TYPE", "An expression gives a number, not text.", ast.at);
    return { ok: true, ast, type };
  } catch (error) {
    if (error instanceof SyntaxProblem) return { ok: false, errors: [error.error] };
    throw error;
  }
}

/** The layers and properties an expression reads from other places: every `ref` and `refAtTime`, as written. */
export function expressionRefs(ast: Expr): Array<{ layer: string; property: string }> {
  const out: Array<{ layer: string; property: string }> = [];
  const walk = (e: Expr) => {
    if (e.k === "call") {
      if ((e.name === "ref" || e.name === "refAtTime") && e.args[0]?.k === "str" && e.args[1]?.k === "str") out.push({ layer: e.args[0].v, property: e.args[1].v });
      e.args.forEach(walk);
    } else if (e.k === "un") walk(e.a);
    else if (e.k === "bin") {
      walk(e.a);
      walk(e.b);
    } else if (e.k === "cond") {
      walk(e.c);
      walk(e.a);
      walk(e.b);
    }
  };
  walk(ast);
  return out;
}

const cache = new Map<string, ParseResult>();
/** `parseExpression` remembered (the kernel asks for the same text every frame). */
export function parseCached(text: string): ParseResult {
  let hit = cache.get(text);
  if (!hit) {
    if (cache.size > 500) cache.clear();
    cache.set(text, (hit = parseExpression(text)));
  }
  return hit;
}
