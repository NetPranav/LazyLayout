import type { MdmJsonPatch } from "./types";

export interface ShaderGraphNode {
  id: string;
  type:
    | "UvCoord"
    | "SimplexNoise"
    | "CurlSwirl"
    | "RadialMask"
    | "ColorRamp"
    | "SpecularSheen"
    | "MixBlend"
    | "OutputSurface";
  params: Record<string, number | string | boolean>;
}

export interface ParticleStackConfig {
  id: string;
  emitterShape: "point" | "box" | "ring";
  ratePerSecond: number;
  maxParticles: number;
  lifetimeSec: number;
  blendMode: "additive" | "alpha";
}

export interface EffectSignalBinding {
  signal: "pointerX" | "pointerY" | "scrollProgress" | "time" | "hoverProgress";
  targetUniform: string;
  range: [number, number];
}

export interface RenderProbeResult {
  time: number;
  estimatedFrameMs: number;
  withinBudget: boolean;
}

export interface AuthoredEffectProposal {
  id: string;
  name: string;
  summary: string;
  usesRawGlsl: false;
  shaderNodes: ShaderGraphNode[];
  particles: ParticleStackConfig[];
  bindings: EffectSignalBinding[];
  renderProbes: RenderProbeResult[];
  withinBudget: boolean;
  valid: boolean;
  patches: MdmJsonPatch[];
}

const MAX_SHADER_NODES = 12;
const MAX_PARTICLE_EMITTERS = 4;
const FRAME_BUDGET_MS = 16.0;

function estimateFrameMs(
  nodes: readonly ShaderGraphNode[],
  particles: readonly ParticleStackConfig[],
): number {
  const nodeCost = nodes.length * 0.45;
  const particleCost = particles.reduce((acc, p) => acc + p.maxParticles * 0.015, 0);
  return Number((0.8 + nodeCost + particleCost).toFixed(2));
}

function runTapeRenderProbes(
  nodes: readonly ShaderGraphNode[],
  particles: readonly ParticleStackConfig[],
): RenderProbeResult[] {
  const baseMs = estimateFrameMs(nodes, particles);
  return [0, 0.5, 1].map((time) => {
    const estimatedFrameMs = Number((baseMs + time * 0.15).toFixed(2));
    return {
      time,
      estimatedFrameMs,
      withinBudget: estimatedFrameMs <= FRAME_BUDGET_MS,
    };
  });
}

/**
 * Phase 247 AI effect author:
 * Converts a natural-language effect prompt into a typed shader graph, particle stack,
 * and signal bindings (never free-form GLSL by default), render-probed at tape checkpoints.
 */
export function authorEffectFromPrompt(
  prompt: string,
  targetLayerId?: string,
): AuthoredEffectProposal {
  const p = prompt.toLowerCase();
  const shaderNodes: ShaderGraphNode[] = [
    { id: "uv", type: "UvCoord", params: { space: "local" } },
  ];
  const particles: ParticleStackConfig[] = [];
  const bindings: EffectSignalBinding[] = [
    { signal: "time", targetUniform: "uTime", range: [0, 1] },
  ];

  if (/\bink|water|swirl|liquid|fluid|smoke|aurora\b/.test(p)) {
    shaderNodes.push(
      { id: "noise", type: "SimplexNoise", params: { scale: 2.6, octaves: 3 } },
      { id: "swirl", type: "CurlSwirl", params: { strength: 0.42, radius: 0.35 } },
      { id: "ramp", type: "ColorRamp", params: { palette: "ink-indigo" } },
    );
  } else if (/\bsheen|metallic|foil|shimmer|holographic|glow|spotlight|halo\b/.test(p)) {
    shaderNodes.push(
      { id: "mask", type: "RadialMask", params: { softness: 0.45 } },
      { id: "sheen", type: "SpecularSheen", params: { intensity: 0.72, angleDeg: 35 } },
    );
  } else {
    shaderNodes.push(
      { id: "noise", type: "SimplexNoise", params: { scale: 1.8, octaves: 2 } },
      { id: "mix", type: "MixBlend", params: { factor: 0.5 } },
    );
  }

  shaderNodes.push({ id: "out", type: "OutputSurface", params: { premultiplied: true } });

  if (/\bcursor|pointer|mouse|hover|swirl|spotlight|repel\b/.test(p)) {
    bindings.push(
      { signal: "pointerX", targetUniform: "uPointerX", range: [0, 1] },
      { signal: "pointerY", targetUniform: "uPointerY", range: [0, 1] },
    );
  }
  if (/\bscroll\b/.test(p)) {
    bindings.push({ signal: "scrollProgress", targetUniform: "uScroll", range: [0, 1] });
  }

  if (/\bconfetti|spark|particle|starfield|dust|burst\b/.test(p)) {
    particles.push({
      id: "emitter-main",
      emitterShape: /\bring|halo|shockwave\b/.test(p) ? "ring" : "box",
      ratePerSecond: 45,
      maxParticles: 120,
      lifetimeSec: 1.4,
      blendMode: "additive",
    });
  }

  const renderProbes = runTapeRenderProbes(shaderNodes, particles);
  const withinBudget =
    shaderNodes.length <= MAX_SHADER_NODES &&
    particles.length <= MAX_PARTICLE_EMITTERS &&
    renderProbes.every((probe) => probe.withinBudget);

  const effectId = `fx_ai_${Date.now().toString(36)}`;
  const patches: MdmJsonPatch[] = [];
  if (targetLayerId) {
    patches.push({
      op: "add",
      path: `/layers/${targetLayerId}/properties/authoredEffect`,
      value: {
        id: effectId,
        shaderNodes,
        particles,
        bindings,
      },
    });
  }

  return {
    id: effectId,
    name: prompt.trim().slice(0, 48) || "Authored Effect",
    summary: `Authored ${shaderNodes.length}-node typed shader graph${particles.length ? ` + ${particles.length} particle emitter` : ""} with ${bindings.length} signal binding(s).`,
    usesRawGlsl: false,
    shaderNodes,
    particles,
    bindings,
    renderProbes,
    withinBudget,
    valid: withinBudget && shaderNodes.length >= 2,
    patches,
  };
}

/**
 * Phase 247 remix edit: updates an authored effect with new signal bindings or intensity tweaks
 * (e.g. `"react to scroll too"`).
 */
export function remixEffectAuthoring(
  existing: AuthoredEffectProposal,
  remixPrompt: string,
  targetLayerId?: string,
): AuthoredEffectProposal {
  const p = remixPrompt.toLowerCase();
  const bindings = [...existing.bindings];

  if (/\bscroll\b/.test(p) && !bindings.some((b) => b.signal === "scrollProgress")) {
    bindings.push({ signal: "scrollProgress", targetUniform: "uScroll", range: [0, 1] });
  }
  if (/\bhover\b/.test(p) && !bindings.some((b) => b.signal === "hoverProgress")) {
    bindings.push({ signal: "hoverProgress", targetUniform: "uHover", range: [0, 1] });
  }
  if (/\b(cursor|pointer)\b/.test(p) && !bindings.some((b) => b.signal === "pointerX")) {
    bindings.push(
      { signal: "pointerX", targetUniform: "uPointerX", range: [0, 1] },
      { signal: "pointerY", targetUniform: "uPointerY", range: [0, 1] },
    );
  }

  const renderProbes = runTapeRenderProbes(existing.shaderNodes, existing.particles);
  const withinBudget = renderProbes.every((probe) => probe.withinBudget);
  const patches: MdmJsonPatch[] = targetLayerId
    ? [
        {
          op: "add",
          path: `/layers/${targetLayerId}/properties/authoredEffect`,
          value: {
            id: existing.id,
            shaderNodes: existing.shaderNodes,
            particles: existing.particles,
            bindings,
          },
        },
      ]
    : [];

  return {
    ...existing,
    bindings,
    renderProbes,
    withinBudget,
    valid: withinBudget,
    summary: `Remixed effect "${existing.name}" (${bindings.length} signal bindings).`,
    patches,
  };
}
