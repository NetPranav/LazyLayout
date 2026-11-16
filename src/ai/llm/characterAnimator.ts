import type { MotionDocument } from "@/core/document/schema";
import {
  autoRigIllustration,
  type AutoRigArchetype,
  type AutoRigResult,
  type IllustrationLayerPart,
} from "@/core/rig/autoRigAndPoseSliders";
import { evaluateVisualSelfCheck, type VisualSelfCheckResult } from "./evals";
import type { MdmJsonPatch } from "./types";
import { applyMdmJsonPatches, type RulesValidatorFn } from "./validationLoop";

export interface CharacterKeyframeStep {
  timeMs: number;
  poseName: string;
  sliderWeights: Record<string, number>;
  lookAtTarget?: string;
}

export interface CharacterAnimationProposal {
  valid: boolean;
  rigResult: AutoRigResult;
  steps: CharacterKeyframeStep[];
  patches: MdmJsonPatch[];
  visualCheck: VisualSelfCheckResult;
  summary: string;
  errors: string[];
}

/**
 * Phase 248 Step 1: Rigs a character from an image / illustration layer breakdown
 * using `autoRigIllustration` (Phase 212).
 */
export function rigCharacterFromParts(
  parts: readonly IllustrationLayerPart[],
  archetype: AutoRigArchetype = "person",
): AutoRigResult {
  return autoRigIllustration(parts, archetype);
}

function parseActionSteps(prompt: string): CharacterKeyframeStep[] {
  const p = prompt.toLowerCase();
  const steps: CharacterKeyframeStep[] = [];
  let cursorMs = 0;

  if (/\bwave\b/.test(p)) {
    steps.push({
      timeMs: cursorMs,
      poseName: "wave",
      sliderWeights: { wave: 1, happy: /\bhapp(y|ily)\b/.test(p) ? 0.9 : 0.4 },
    });
    cursorMs += 650;
  }
  if (/\bpoint\b/.test(p)) {
    steps.push({
      timeMs: cursorMs,
      poseName: "point",
      sliderWeights: { point: 1 },
    });
    cursorMs += 550;
  }
  if (/\blook\b/.test(p)) {
    const target = /\bbutton\b/.test(p) ? "button" : /\bcard\b/.test(p) ? "card" : "target";
    steps.push({
      timeMs: cursorMs,
      poseName: "look_at",
      sliderWeights: { happy: 0.6 },
      lookAtTarget: target,
    });
    cursorMs += 500;
  }
  if (/\bnod|agree|yes\b/.test(p)) {
    steps.push({
      timeMs: cursorMs,
      poseName: "nod",
      sliderWeights: { happy: 0.7 },
    });
    cursorMs += 450;
  }
  if (/\bjump|celebrate|cheer\b/.test(p)) {
    steps.push({
      timeMs: cursorMs,
      poseName: "celebrate",
      sliderWeights: { wave: 0.85, happy: 1 },
    });
    cursorMs += 600;
  }
  if (/\bsad|sigh|shrug\b/.test(p)) {
    steps.push({
      timeMs: cursorMs,
      poseName: "sad",
      sliderWeights: { sad: 0.9 },
    });
    cursorMs += 600;
  }

  if (steps.length === 0) {
    steps.push({
      timeMs: 0,
      poseName: "idle_happy",
      sliderWeights: { happy: 0.5 },
    });
  }

  return steps;
}

/**
 * Phase 248 AI character animator:
 * Turns an action description (`"wave happily, then look at the button"`) into rig poses,
 * keyframes, and reactions as approvable `MdmJsonPatch[]` validated against `rules.validate`
 * and the Phase 244 visual self-check.
 */
export function animateCharacterFromPrompt(options: {
  doc: MotionDocument;
  parts: readonly IllustrationLayerPart[];
  prompt: string;
  targetLayerId?: string;
  validateRules: RulesValidatorFn;
  archetype?: AutoRigArchetype;
}): CharacterAnimationProposal {
  const rigResult = rigCharacterFromParts(options.parts, options.archetype ?? "person");
  const steps = parseActionSteps(options.prompt);
  const targetId = options.targetLayerId ?? Object.keys(options.doc.layers)[0];
  const patches: MdmJsonPatch[] = [];

  if (targetId && options.doc.layers[targetId]) {
    const firstStep = steps[0];
    const rotateDeg = firstStep?.poseName === "wave" ? -12 : firstStep?.poseName === "nod" ? 6 : 0;
    const liftY = firstStep?.poseName === "celebrate" ? -16 : 0;
    patches.push(
      {
        op: "add",
        path: `/layers/${targetId}/properties/transform.rotate`,
        value: rotateDeg,
      },
      {
        op: "add",
        path: `/layers/${targetId}/properties/transform.y`,
        value: liftY,
      },
    );
  }

  const applied = patches.length > 0 ? applyMdmJsonPatches(options.doc, patches) : { ok: true as const, document: options.doc };
  const errors: string[] = [];
  if (!applied.ok) {
    errors.push(applied.error);
  }
  const candidateDoc = applied.ok ? applied.document : options.doc;
  const ruleIssues = options.validateRules(candidateDoc);
  for (const r of ruleIssues) {
    errors.push(`${r.code}: ${r.message}`);
  }
  const visualCheck = evaluateVisualSelfCheck(candidateDoc);
  if (!visualCheck.passed) {
    for (const f of visualCheck.findings) {
      if (f.severity === "error") errors.push(`${f.code}: ${f.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    rigResult,
    steps,
    patches,
    visualCheck,
    summary: `Rigged ${rigResult.archetype} (${rigResult.rig.bones.length} bones) and staged ${steps.length} pose step(s): ${steps.map((s) => s.poseName).join(" -> ")}.`,
    errors,
  };
}
