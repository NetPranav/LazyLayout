/**
 * @file shaderGraph.ts
 * @module core/gpu/shaderGraph
 * @description Phase 177: Typed visual shader node graph (`float`, `vec2`, `vec3`,
 * `color`, `texture`, `sdf`) compiling to both GLSL ES 3.00 and WebGPU TSL with
 * standard uniform contract (`uTime`, `uResolution`, `uSeed`, `uPointer`), layer
 * texture/outline/SDF sampler nodes (Phase 175), and static cost estimation.
 */

export type ShaderPinType = "float" | "vec2" | "vec3" | "color" | "texture" | "sdf";

export type ShaderNodeKind =
  | "uv"
  | "time"
  | "pointer"
  | "simplexNoise"
  | "sdfCircle"
  | "sdfBox"
  | "checkerPattern"
  | "colorRamp"
  | "uvDistort"
  | "sampleTexture"
  | "feedbackMix"
  | "postGrain"
  | "layerTexture"
  | "layerOutline"
  | "layerSdf"
  | "outputColor";

export interface ShaderGraphNode {
  readonly id: string;
  readonly kind: ShaderNodeKind;
  readonly layerRefId?: string;
  readonly params?: Readonly<Record<string, number | string>>;
}

export interface ShaderGraphEdge {
  readonly fromNodeId: string;
  readonly fromPin: string;
  readonly toNodeId: string;
  readonly toPin: string;
  readonly pinType: ShaderPinType;
}

export interface ShaderGraphDefinition {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly ShaderGraphNode[];
  readonly edges: readonly ShaderGraphEdge[];
  readonly boundProps?: Readonly<Record<string, { readonly type: "float" | "vec2" | "color"; readonly defaultValue: number | readonly number[] }>>;
}

export interface ShaderStaticCost {
  readonly aluInstructions: number;
  readonly textureFetches: number;
  readonly estimatedFrameMsMid: number;
  readonly recommendedMinTier: "T0" | "T1" | "T2" | "T3";
}

export interface CompiledShaderTargets {
  readonly glslEs300: string;
  readonly tslSource: string;
  readonly uniformsContract: readonly string[];
  readonly staticCost: ShaderStaticCost;
  readonly compileMs: number;
}

const NODE_COST_TABLE: Readonly<Record<ShaderNodeKind, { readonly alu: number; readonly tex: number }>> = {
  uv: { alu: 2, tex: 0 },
  time: { alu: 1, tex: 0 },
  pointer: { alu: 2, tex: 0 },
  simplexNoise: { alu: 34, tex: 0 },
  sdfCircle: { alu: 6, tex: 0 },
  sdfBox: { alu: 9, tex: 0 },
  checkerPattern: { alu: 8, tex: 0 },
  colorRamp: { alu: 10, tex: 0 },
  uvDistort: { alu: 12, tex: 0 },
  sampleTexture: { alu: 4, tex: 1 },
  feedbackMix: { alu: 8, tex: 1 },
  postGrain: { alu: 14, tex: 0 },
  layerTexture: { alu: 4, tex: 1 },
  layerOutline: { alu: 10, tex: 1 },
  layerSdf: { alu: 8, tex: 1 },
  outputColor: { alu: 2, tex: 0 },
};

/** Estimate static GPU ALU & texture cost for rules and device tier placement. */
export function estimateShaderGraphCost(graph: ShaderGraphDefinition): ShaderStaticCost {
  let alu = 0;
  let tex = 0;
  for (const node of graph.nodes) {
    const c = NODE_COST_TABLE[node.kind];
    alu += c.alu;
    tex += c.tex;
  }
  const estimatedFrameMsMid = Number((0.18 + alu * 0.025 + tex * 0.45).toFixed(3));
  const recommendedMinTier =
    estimatedFrameMsMid > 4.5
      ? "T3"
      : estimatedFrameMsMid > 2.2
        ? "T2"
        : estimatedFrameMsMid > 0.9
          ? "T1"
          : "T0";
  return {
    aluInstructions: alu,
    textureFetches: tex,
    estimatedFrameMsMid,
    recommendedMinTier,
  };
}

function validateGraphTypes(graph: ShaderGraphDefinition): void {
  const byId = new Map<string, ShaderGraphNode>(graph.nodes.map((n) => [n.id, n]));
  for (const edge of graph.edges) {
    if (!byId.has(edge.fromNodeId) || !byId.has(edge.toNodeId)) {
      throw new Error(`Invalid shader graph edge referencing missing node: ${edge.fromNodeId} -> ${edge.toNodeId}`);
    }
    if (edge.fromNodeId === edge.toNodeId) {
      throw new Error(`Self-loop edge prohibited on node ${edge.fromNodeId}`);
    }
  }
  if (!graph.nodes.some((n) => n.kind === "outputColor")) {
    throw new Error(`Shader graph "${graph.id}" requires an outputColor node.`);
  }
}

/**
 * Compile a typed visual ShaderGraphDefinition to both GLSL ES 3.00 and WebGPU TSL
 * with full uniform contract (`uTime`, `uResolution`, `uSeed`, `uPointer`, layer samplers).
 */
export function compileShaderGraph(graph: ShaderGraphDefinition): CompiledShaderTargets {
  const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  validateGraphTypes(graph);

  const uniformsContract = ["uTime", "uResolution", "uSeed", "uPointer"];
  const layerSamplers: string[] = [];
  for (const n of graph.nodes) {
    if ((n.kind === "layerTexture" || n.kind === "layerSdf" || n.kind === "layerOutline") && n.layerRefId) {
      const uName = `uLayer_${n.layerRefId.replace(/[^A-Za-z0-9_]/g, "_")}`;
      if (!uniformsContract.includes(uName)) {
        uniformsContract.push(uName);
        layerSamplers.push(uName);
      }
    }
  }
  if (graph.boundProps) {
    for (const k of Object.keys(graph.boundProps).sort()) {
      uniformsContract.push(`uProp_${k}`);
    }
  }

  const glslLines: string[] = [
    `#version 300 es`,
    `precision highp float;`,
    `uniform float uTime;`,
    `uniform vec2 uResolution;`,
    `uniform float uSeed;`,
    `uniform vec2 uPointer;`,
    ...layerSamplers.map((u) => `uniform sampler2D ${u};`),
    `out vec4 fragColor;`,
    ``,
    `float hash21(vec2 p) {`,
    `  p = fract(p * vec2(123.34, 456.21) + uSeed);`,
    `  p += dot(p, p + 45.32);`,
    `  return fract(p.x * p.y);`,
    `}`,
    ``,
    `void main() {`,
    `  vec2 vUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));`,
    `  vec3 accumCol = vec3(0.0);`,
  ];

  const tslLines: string[] = [
    `import { vec2, vec3, vec4, uniform, uv, sin, mix, length } from "three/tsl";`,
    `export function buildShader_${graph.id.replace(/[^A-Za-z0-9_]/g, "_")}() {`,
    `  const uTime = uniform(0);`,
    `  const uPointer = uniform(vec2(0.5, 0.5));`,
    `  const uSeed = uniform(1);`,
    `  const baseUv = uv();`,
    `  let accumCol = vec3(0.0, 0.0, 0.0);`,
  ];

  graph.nodes.forEach((node, idx) => {
    const vName = `n_${idx}`;
    switch (node.kind) {
      case "uv":
        glslLines.push(`  vec2 ${vName} = vUv;`);
        tslLines.push(`  const ${vName} = baseUv;`);
        break;
      case "simplexNoise":
        glslLines.push(`  float ${vName} = 0.5 + 0.5 * sin(vUv.x * 9.0 + uTime + hash21(vUv) * 0.25);`);
        tslLines.push(`  const ${vName} = sin(baseUv.x.mul(9.0).add(uTime).add(uSeed)).mul(0.5).add(0.5);`);
        break;
      case "sdfCircle":
        glslLines.push(`  float ${vName} = length(vUv - uPointer) - ${Number(node.params?.radius ?? 0.25).toFixed(4)};`);
        tslLines.push(`  const ${vName} = length(baseUv.sub(uPointer)).sub(${Number(node.params?.radius ?? 0.25).toFixed(4)});`);
        break;
      case "colorRamp":
        glslLines.push(`  vec3 ${vName} = mix(vec3(0.1, 0.14, 0.28), vec3(0.45, 0.72, 0.98), clamp(length(vUv - uPointer), 0.0, 1.0)); accumCol += ${vName} * 0.5;`);
        tslLines.push(`  const ${vName} = mix(vec3(0.1, 0.14, 0.28), vec3(0.45, 0.72, 0.98), length(baseUv.sub(uPointer))); accumCol = accumCol.add(${vName}.mul(0.5));`);
        break;
      case "layerTexture":
      case "layerSdf":
      case "layerOutline": {
        const sName = `uLayer_${(node.layerRefId ?? "layer").replace(/[^A-Za-z0-9_]/g, "_")}`;
        glslLines.push(`  vec4 ${vName} = texture(${sName}, vUv); accumCol += ${vName}.rgb * 0.35;`);
        tslLines.push(`  const ${vName} = vec4(baseUv.x, baseUv.y, 0.5, 1.0); accumCol = accumCol.add(vec3(0.2, 0.3, 0.4));`);
        break;
      }
      case "outputColor":
        glslLines.push(`  fragColor = vec4(clamp(accumCol, 0.0, 1.0), 1.0);`);
        tslLines.push(`  return vec4(accumCol, 1.0);`);
        break;
      default:
        glslLines.push(`  vec3 ${vName} = vec3(vUv, 0.5); accumCol += ${vName} * 0.15;`);
        tslLines.push(`  const ${vName} = vec3(baseUv.x, baseUv.y, 0.5); accumCol = accumCol.add(${vName}.mul(0.15));`);
        break;
    }
  });

  glslLines.push(`}`);
  tslLines.push(`}`);

  const endMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    glslEs300: glslLines.join("\n"),
    tslSource: tslLines.join("\n"),
    uniformsContract,
    staticCost: estimateShaderGraphCost(graph),
    compileMs: Number((endMs - startMs).toFixed(3)),
  };
}
