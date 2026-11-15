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

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/\b(while|do)\b\s*[\({]/.test(line)) {
      diagnostics.push({
        line: lineNum,
        severity: "error",
        message: "Unbounded `while`/`do` loops are prohibited in WebGL/WebGPU shaders.",
      });
    }

    const forMatch = line.match(/\bfor\s*\(([^;]*);([^;]*);([^)]*)\)/);
    if (forMatch) {
      const cond = forMatch[2]!.trim();
      const constBound = cond.match(/^[A-Za-z_][A-Za-z0-9_]*\s*(?:<|<=)\s*(\d+)$/);
      if (!constBound) {
        diagnostics.push({
          line: lineNum,
          severity: "error",
          message: `Loop condition "${cond}" must use a constant integer upper bound (e.g., i < 16).`,
        });
      } else {
        const boundVal = Number.parseInt(constBound[1]!, 10);
        maxDetected = Math.max(maxDetected, boundVal);
        if (boundVal > maxLoop) {
          diagnostics.push({
            line: lineNum,
            severity: "error",
            message: `Constant loop bound (${boundVal}) exceeds safety limit (${maxLoop}).`,
          });
        }
      }
    }
  });

  const texMatches = glslSource.match(/\b(texture|texture2D|texelFetch)\s*\(/g) ?? [];
  const textureFetches = texMatches.length;
  if (textureFetches > maxTex) {
    diagnostics.push({
      line: 1,
      severity: "error",
      message: `Texture fetch count (${textureFetches}) exceeds budget (${maxTex}).`,
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
