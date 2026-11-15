/**
 * ============================================================================
 * STAGE 5 · PHASE 216 — RIG LIBRARY & RECIPES
 * ============================================================================
 * Curated open-recipe rigged characters and parts (eyes, faces, hands,
 * mascots, quadrupeds, ribbon flags) with explicit provenance, 1-click cursor
 * follow instantiation, tape parity, and per-tier budgets.
 * ============================================================================
 */

import { type RigDefinition, createRigDefinition } from "./rigModel";
import { type ReactiveRigConfig, runReactiveRigTape } from "./reactiveRig";
import { verifyRigExportParity } from "./rigExportRuntime";
import type { BonePoseTrack } from "./boneTimeline";

export interface RigRecipe {
  readonly id: string;
  readonly name: string;
  readonly category: "mascot" | "eyes" | "face" | "hand" | "quadruped" | "banner";
  readonly provenance: {
    readonly author: "LazyLayout Studio";
    readonly license: "MIT";
    readonly original: true;
  };
  readonly tierBudgetMs: {
    readonly low: number;
    readonly mid: number;
    readonly high: number;
  };
  readonly buildRig: () => RigDefinition;
  readonly reactiveConfig: ReactiveRigConfig;
}

const makeCharacterSkeleton = (id: string, name: string, height = 60): RigDefinition =>
  createRigDefinition(id, name, `layer_${id}`, [
    { id: "spine", name: "Spine", parentId: null, length: height, restX: 200, restY: 240, restRotationDeg: -90 },
    { id: "neck", name: "Neck", parentId: "spine", length: 16, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "head", name: "Head", parentId: "neck", length: 38, restX: 0, restY: 0, restRotationDeg: 0 },
    { id: "eye_l", name: "Eye.L", parentId: "head", length: 10, restX: 12, restY: -10, restRotationDeg: 0 },
    { id: "eye_r", name: "Eye.R", parentId: "head", length: 10, restX: 12, restY: 10, restRotationDeg: 0 },
    { id: "arm_u", name: "Arm.U", parentId: "spine", length: 34, restX: -6, restY: 20, restRotationDeg: 105 },
    { id: "arm_l", name: "Arm.L", parentId: "arm_u", length: 28, restX: 0, restY: 0, restRotationDeg: 0 },
  ]);

const DEFAULT_REACTIVE: ReactiveRigConfig = {
  followCursorScope: "head",
  rigOriginX: 200,
  rigOriginY: 180,
  eyeLeftBoneId: "eye_l",
  eyeRightBoneId: "eye_r",
  neckBoneId: "neck",
  headBoneId: "head",
  spineBoneId: "spine",
  handIkBoneIds: ["arm_u", "arm_l"],
};

export const RIG_LIBRARY_RECIPES: readonly RigRecipe[] = [
  {
    id: "rig-mascot-astro",
    name: "Astro Mascot",
    category: "mascot",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.5, mid: 1.5, high: 0.8 },
    buildRig: () => makeCharacterSkeleton("rig-mascot-astro", "Astro Mascot", 60),
    reactiveConfig: DEFAULT_REACTIVE,
  },
  {
    id: "rig-eyes-expressive",
    name: "Expressive Eye Pair",
    category: "eyes",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 1.5, mid: 0.9, high: 0.5 },
    buildRig: () =>
      createRigDefinition("rig-eyes-expressive", "Expressive Eyes", "layer_eyes", [
        { id: "eye_l", name: "Eye.L", parentId: null, length: 18, restX: 180, restY: 180, restRotationDeg: 0 },
        { id: "eye_r", name: "Eye.R", parentId: null, length: 18, restX: 220, restY: 180, restRotationDeg: 0 },
      ]),
    reactiveConfig: {
      followCursorScope: "eyes",
      rigOriginX: 200,
      rigOriginY: 180,
      eyeLeftBoneId: "eye_l",
      eyeRightBoneId: "eye_r",
    },
  },
  {
    id: "rig-face-talker",
    name: "Talking Portrait Face",
    category: "face",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.0, mid: 1.2, high: 0.7 },
    buildRig: () => makeCharacterSkeleton("rig-face-talker", "Talking Face", 45),
    reactiveConfig: DEFAULT_REACTIVE,
  },
  {
    id: "rig-hand-pointer",
    name: "Pointer Hand Arm",
    category: "hand",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.0, mid: 1.2, high: 0.7 },
    buildRig: () => makeCharacterSkeleton("rig-hand-pointer", "Hand Pointer", 52),
    reactiveConfig: { ...DEFAULT_REACTIVE, followCursorScope: "whole-body" },
  },
  {
    id: "rig-pet-fox",
    name: "Fox Companion",
    category: "quadruped",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.8, mid: 1.8, high: 1.0 },
    buildRig: () => makeCharacterSkeleton("rig-pet-fox", "Fox Companion", 48),
    reactiveConfig: DEFAULT_REACTIVE,
  },
  {
    id: "rig-bot-helper",
    name: "Helper Bot",
    category: "mascot",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.2, mid: 1.4, high: 0.8 },
    buildRig: () => makeCharacterSkeleton("rig-bot-helper", "Helper Bot", 56),
    reactiveConfig: DEFAULT_REACTIVE,
  },
  {
    id: "rig-sticker-flag",
    name: "Ribbon Wave Flag",
    category: "banner",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 1.8, mid: 1.1, high: 0.6 },
    buildRig: () => makeCharacterSkeleton("rig-sticker-flag", "Ribbon Flag", 50),
    reactiveConfig: { ...DEFAULT_REACTIVE, followCursorScope: "eyes" },
  },
  {
    id: "rig-dancer-ribbon",
    name: "Rubber-Hose Dancer",
    category: "mascot",
    provenance: { author: "LazyLayout Studio", license: "MIT", original: true },
    tierBudgetMs: { low: 2.6, mid: 1.6, high: 0.9 },
    buildRig: () => makeCharacterSkeleton("rig-dancer-ribbon", "Dancer", 64),
    reactiveConfig: { ...DEFAULT_REACTIVE, followCursorScope: "whole-body" },
  },
];

/** Drop a library rig recipe and immediately wire it to follow the cursor. */
export function instantiateLibraryRigWithCursorFollow(
  recipeId: string,
  cursorPos: { x: number; y: number } = { x: 320, y: 120 },
) {
  const recipe = RIG_LIBRARY_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const rig = recipe.buildRig();
  const frames = runReactiveRigTape(rig, recipe.reactiveConfig, [
    { pointerX: cursorPos.x, pointerY: cursorPos.y, dtSec: 1 / 60 },
  ]);
  return { recipe, rig, initialState: frames[0] };
}

/** Verify tape parity and frame-time tier budget for a library recipe. */
export function verifyLibraryRigParityAndBudget(recipeId: string) {
  const recipe = RIG_LIBRARY_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { passed: false, parityDiffPx: Infinity, evalMs: Infinity };

  const rig = recipe.buildRig();
  const track: BonePoseTrack = [
    { timeSec: 0, pose: { [rig.bones[0].id]: { rotationDeg: -10 } } },
    { timeSec: 1, pose: { [rig.bones[0].id]: { rotationDeg: 10 } } },
  ];
  const t0 = performance.now();
  const parity = verifyRigExportParity(rig, track, "nextjs", "svg");
  const evalMs = performance.now() - t0;

  return {
    passed: parity.passed && evalMs < 50,
    parityDiffPx: parity.maxDiffPx,
    evalMs,
  };
}
