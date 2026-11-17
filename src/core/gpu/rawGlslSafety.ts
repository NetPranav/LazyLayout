/**
 * @file rawGlslSafety.ts
 * @module core/gpu/rawGlslSafety
 * @description Phase 178: Pro raw GLSL editor validator, line-mapped compiler log
 * parser, automatic uniform-to-inspector-prop extractor, constant loop-bound &
 * texture-fetch static safety verifier, and 2-strike context-loss session circuit breaker.
 */

export interface GlslLineDiagnostic {
  readonly line: number;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface InferredShaderProp {
  readonly uniformName: string;
  readonly propName: string;
  readonly glslType: "float" | "int" | "vec2" | "vec3" | "vec4" | "sampler2D";
  readonly controlKind: "number" | "vec2" | "color" | "texture";
}

export interface GlslSafetyReport {
  readonly ok: boolean;
  readonly diagnostics: readonly GlslLineDiagnostic[];
  readonly textureFetches: number;
  readonly maxLoopIterationsDetected: number;
  readonly uniformProps: readonly InferredShaderProp[];
}

const RESERVED_UNIFORMS = new Set(["uTime", "uResolution", "uSeed", "uPointer"]);

/** Parse standard WebGL/GLSL `ERROR: col:line: message` logs into 1-based line diagnostics. */
export function parseGlslInfoLog(infoLog: string): readonly GlslLineDiagnostic[] {
  const out: GlslLineDiagnostic[] = [];
  for (const rawLine of infoLog.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(ERROR|WARNING):\s*\d+:(\d+):\s*(.+)$/i);
    if (match) {
      out.push({
        severity: match[1]!.toUpperCase() === "WARNING" ? "warning" : "error",
        line: Number.parseInt(match[2]!, 10),
        message: match[3]!.trim(),
      });
    } else {
      out.push({ severity: "error", line: 1, message: trimmed });
    }
  }
  return out;
}

/** Extract custom shader uniforms so they become inspector controls automatically. */
export function extractUniformProps(glslSource: string): readonly InferredShaderProp[] {
  const props: InferredShaderProp[] = [];
  const regex = /^\s*uniform\s+(float|int|vec2|vec3|vec4|sampler2D)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(glslSource)) !== null) {
    const glslType = m[1]! as InferredShaderProp["glslType"];
    const uniformName = m[2]!;
    if (RESERVED_UNIFORMS.has(uniformName)) continue;
    const controlKind =
      glslType === "sampler2D"
        ? "texture"
        : glslType === "vec3" || glslType === "vec4"
          ? "color"
          : glslType === "vec2"
            ? "vec2"
            : "number";
    props.push({
      uniformName,
      propName: uniformName.replace(/^u_?/, ""),
      glslType,
      controlKind,
    });
  }
  return props;
}

/**
 * Static shader safety check executed before async GL compile:
 * 1. Refuses `while` and `do ... while` loops unconditionally.
 * 2. Requires `for (...)` loops to compare an index variable to an integer literal constant <= maxLoopIterations.
 * 3. Refuses texture fetches exceeding `maxTextureFetches`.
 */
/**
 * A static lint for raw GLSL before it is compiled. It is a first line of defence, not a sandbox: the GPU watchdog
 * and the 2-strike circuit breaker below still apply. It checks:
 * - no `while` / `do` loops, and no `#define` (macros can hide loop bounds);
 * - every `for` header on one line, with a constant `< N` / `<= N` bound and a step that moves toward it
 *   (`i++`, `++i`, `i += k` with k > 0);
 * - the loop counter isn't assigned inside the body;
 * - the TOTAL iterations of nested loops (bounds multiplied) stay within `maxLoopIterations`;
 * - texture fetches, counted once per iteration of the loops around them, stay within `maxTextureFetches`.
 * Review 2026-11-17: before, each loop was checked alone (three nested `i < 128` loops = 2M iterations passed), the
 * step wasn't checked (`i += 0` passed), a header split over lines or a #define bypassed it, and a fetch inside a
 * loop counted once.
 */
export function validateRawGlslSafety(
  glslSource: string,
  options?: {
    readonly maxLoopIterations?: number;
    readonly maxTextureFetches?: number;
  }
): GlslSafetyReport {
  const maxLoop = options?.maxLoopIterations ?? 128;
  const maxTex = options?.maxTextureFetches ?? 16;
  const diagnostics: GlslLineDiagnostic[] = [];
  const lines = glslSource.split(/\r?\n/);
  let maxDetected = 0;
  let textureFetches = 0;

  // Open loops: the brace depth their body starts at, their bound, their counter, and the product of bounds so far.
  const loops: { depth: number; bound: number; counter: string; product: number }[] = [];
  let depth = 0;
  let pendingLoop: { bound: number; counter: string } | null = null;
  const currentProduct = () => (loops.length ? loops[loops.length - 1]!.product : 1);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const code = line.replace(/\/\/.*$/, "");
    const err = (message: string) => diagnostics.push({ line: lineNum, severity: "error", message });

    if (/^\s*#\s*define\b/.test(code)) err("`#define` is not allowed in raw shaders (macros can hide loop bounds).");
    if (/\b(while|do)\b\s*[({]/.test(code)) err("Unbounded `while`/`do` loops are prohibited in WebGL/WebGPU shaders.");

    if (/\bfor\s*\(/.test(code)) {
      const forMatch = code.match(/\bfor\s*\(([^;]*);([^;]*);([^)]*)\)/);
      if (!forMatch) {
        err("Keep a `for` header on one line: `for (int i = 0; i < 16; i++)`.");
      } else {
        const init = forMatch[1]!.trim();
        const cond = forMatch[2]!.trim();
        const step = forMatch[3]!.trim();
        const counter = (init.match(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*0\s*$/) ?? [])[1];
        const constBound = cond.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(<|<=)\s*(\d+)$/);
        if (!constBound || !counter || constBound[1] !== counter) {
          err(`Loop "${cond}" must start its counter at 0 and use a constant integer upper bound (e.g. i < 16).`);
        } else {
          const bound = Number.parseInt(constBound[3]!, 10) + (constBound[2] === "<=" ? 1 : 0);
          const stepOk =
            new RegExp(`^(?:${counter}\\s*\\+\\+|\\+\\+\\s*${counter})$`).test(step) ||
            (() => {
              const m = step.match(new RegExp(`^${counter}\\s*\\+=\\s*(\\d+)$`));
              return !!m && Number(m[1]) > 0;
            })();
          if (!stepOk) err(`Loop step "${step}" must move the counter up (${counter}++ or ${counter} += k with k > 0).`);
          if (bound > maxLoop) err(`Constant loop bound (${bound}) exceeds safety limit (${maxLoop}).`);
          pendingLoop = { bound, counter };
        }
      }
    }

    // Assigning the counter inside its loop can make it run forever.
    for (const l of loops) {
      if (new RegExp(`\\b${l.counter}\\s*(?:[-+*/]?=(?!=)|--|\\+\\+)`).test(code) && !/\bfor\s*\(/.test(code)) {
        err(`The loop counter "${l.counter}" is changed inside the loop body.`);
      }
    }

    const fetches = (code.match(/\b(texture|texture2D|texelFetch)\s*\(/g) ?? []).length;
    textureFetches += fetches * (pendingLoop ? currentProduct() * pendingLoop.bound : currentProduct());

    for (const ch of code) {
      if (ch === "{") {
        depth += 1;
        if (pendingLoop) {
          const product = currentProduct() * pendingLoop.bound;
          loops.push({ depth, bound: pendingLoop.bound, counter: pendingLoop.counter, product });
          maxDetected = Math.max(maxDetected, product);
          if (product > maxLoop && loops.length > 1) {
            err(`Nested loops run ${product} iterations in total, over the safety limit (${maxLoop}).`);
          }
          pendingLoop = null;
        }
      } else if (ch === "}") {
        if (loops.length && loops[loops.length - 1]!.depth === depth) loops.pop();
        depth = Math.max(0, depth - 1);
      }
    }
    // A loop without braces covers just the next statement; count it once and move on.
    if (pendingLoop && /;\s*$/.test(code.replace(/\bfor\s*\([^)]*\)/, ""))) {
      maxDetected = Math.max(maxDetected, currentProduct() * pendingLoop.bound);
      pendingLoop = null;
    }
  });

  if (textureFetches > maxTex) {
    diagnostics.push({
      line: 1,
      severity: "error",
      message: `Texture fetch count (${textureFetches}, counting loop iterations) exceeds budget (${maxTex}).`,
    });
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    textureFetches,
    maxLoopIterationsDetected: maxDetected,
    uniformProps: extractUniformProps(glslSource),
  };
}

export interface ShaderSafetyCircuitBreaker {
  recordContextLoss(programId: string): { readonly lossCount: number; readonly disabled: boolean };
  isProgramDisabled(programId: string): boolean;
  resetSession(): void;
}

/** Disables a shader program for the rest of the session if it causes 2 context losses. */
export function createShaderSafetyCircuitBreaker(strikeLimit = 2): ShaderSafetyCircuitBreaker {
  const counts = new Map<string, number>();

  return {
    recordContextLoss(programId): { readonly lossCount: number; readonly disabled: boolean } {
      const next = (counts.get(programId) ?? 0) + 1;
      counts.set(programId, next);
      return { lossCount: next, disabled: next >= strikeLimit };
    },

    isProgramDisabled(programId): boolean {
      return (counts.get(programId) ?? 0) >= strikeLimit;
    },

    resetSession(): void {
      counts.clear();
    },
  };
}
