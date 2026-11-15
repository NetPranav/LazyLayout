/**
 * ============================================================================
 * STAGE 5 · PHASE 212 — AUTO-RIG & POSE SLIDERS
 * ============================================================================
 * One-click "Rig this character" from imported illustration layers using
 * semantic names and spatial bounding-box topology, plus blendable pose
 * expression sliders (happy, sad, wave, point).
 * ============================================================================
 */

import {
  type Bone2D,
  type RigDefinition,
  type RigPoseMap,
  type RigSkinBinding,
  createRigDefinition,
} from "./rigModel";
import { lerpAngleShortestDeg } from "./boneTimeline";

export type AutoRigArchetype = "person" | "animal" | "face" | "mascot";

export interface IllustrationLayerPart {
  readonly id: string;
  readonly name: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface PoseSliderPreset {
  readonly id: string;
  readonly name: string;
  readonly pose: RigPoseMap;
}

export interface AutoRigResult {
  readonly archetype: AutoRigArchetype;
  readonly rig: RigDefinition;
  readonly partAssignments: Record<string, string>;
  readonly poseSliders: readonly PoseSliderPreset[];
}

function centerOf(b: IllustrationLayerPart["bounds"]): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function classifyByName(name: string): string | null {
  const n = name.toLowerCase();
  if (/head|skull|face_base/.test(n)) return "head";
  if (/neck/.test(n)) return "neck";
  if (/torso|body|chest|core/.test(n)) return "spine";
  if (/hips|pelvis/.test(n)) return "hips";
  if (/tail/.test(n)) return "tail";
  if (/(arm|wing|hand).*(_l|\.l|\bleft\b)|left.*(arm|wing|hand)/.test(n)) return "arm_l";
  if (/(arm|wing|hand).*(_r|\.r|\bright\b)|right.*(arm|wing|hand)/.test(n)) return "arm_r";
  if (/(leg|foot|paw).*(_l|\.l|\bleft\b)|left.*(leg|foot|paw)/.test(n)) return "leg_l";
  if (/(leg|foot|paw).*(_r|\.r|\bright\b)|right.*(leg|foot|paw)/.test(n)) return "leg_r";
  if (/(ear|antenna).*(_l|\.l|\bleft\b)|left.*(ear|antenna)/.test(n)) return "ear_l";
  if (/(ear|antenna).*(_r|\.r|\bright\b)|right.*(ear|antenna)/.test(n)) return "ear_r";
  if (/eye.*(_l|\.l|\bleft\b)|left.*eye/.test(n)) return "eye_l";
  if (/eye.*(_r|\.r|\bright\b)|right.*eye/.test(n)) return "eye_r";
  if (/mouth|jaw/.test(n)) return "mouth";
  return null;
}

function inferArchetype(
  parts: readonly IllustrationLayerPart[],
  assigned: Map<string, string>,
  hint?: AutoRigArchetype,
): AutoRigArchetype {
  if (hint) return hint;
  const roles = new Set(assigned.values());
  if (roles.has("tail") || parts.some((p) => /paw|quad|dog|cat|fox/.test(p.name.toLowerCase()))) {
    return "animal";
  }
  if ((roles.has("eye_l") || roles.has("mouth")) && !roles.has("leg_l") && parts.length <= 6) {
    return "face";
  }
  if (roles.has("leg_l") && roles.has("leg_r") && roles.has("arm_l")) {
    return "person";
  }
  return "mascot";
}

/**
 * Automatically rig a multi-part character illustration by matching part names
 * and spatial geometry topology, generating connected bones + rigid/mesh skins
 * + 4 ready pose sliders (happy, sad, wave, point).
 */
export function autoRigIllustration(
  parts: readonly IllustrationLayerPart[],
  archetypeHint?: AutoRigArchetype,
): AutoRigResult {
  if (parts.length === 0) {
    const emptyRig = createRigDefinition("auto_empty", "Empty Rig", "layer_root", []);
    return { archetype: archetypeHint ?? "mascot", rig: emptyRig, partAssignments: {}, poseSliders: [] };
  }

  const minX = Math.min(...parts.map((p) => p.bounds.x));
  const maxX = Math.max(...parts.map((p) => p.bounds.x + p.bounds.width));
  const minY = Math.min(...parts.map((p) => p.bounds.y));
  const maxY = Math.max(...parts.map((p) => p.bounds.y + p.bounds.height));
  const midX = (minX + maxX) / 2;
  const spanY = Math.max(1, maxY - minY);

  const roleToPart = new Map<string, IllustrationLayerPart>();
  const partAssignments: Record<string, string> = {};

  for (const part of parts) {
    const role = classifyByName(part.name);
    if (role && !roleToPart.has(role)) {
      roleToPart.set(role, part);
      partAssignments[part.id] = role;
    }
  }

  // Topological geometry classification fallback for unnamed layers
  for (const part of parts) {
    if (partAssignments[part.id]) continue;
    const c = centerOf(part.bounds);
    const relY = (c.y - minY) / spanY;
    const dx = c.x - midX;
    let fallbackRole = "spine";
    if (relY < 0.3 && Math.abs(dx) < Math.max(15, (maxX - minX) * 0.25)) {
      fallbackRole = roleToPart.has("head") ? "spine" : "head";
    } else if (relY >= 0.65 && dx < -4) {
      fallbackRole = roleToPart.has("leg_l") ? "spine" : "leg_l";
    } else if (relY >= 0.65 && dx >= 4) {
      fallbackRole = roleToPart.has("leg_r") ? "spine" : "leg_r";
    } else if (relY >= 0.25 && relY < 0.7 && dx < -12) {
      fallbackRole = roleToPart.has("arm_l") ? "spine" : "arm_l";
    } else if (relY >= 0.25 && relY < 0.7 && dx >= 12) {
      fallbackRole = roleToPart.has("arm_r") ? "spine" : "arm_r";
    } else if (!roleToPart.has("spine")) {
      fallbackRole = "spine";
    } else {
      fallbackRole = `extra_${part.id}`;
    }
    if (!roleToPart.has(fallbackRole)) roleToPart.set(fallbackRole, part);
    partAssignments[part.id] = fallbackRole;
  }

  const archetype = inferArchetype(parts, new Map(Object.entries(partAssignments)), archetypeHint);
  const rootPart =
    roleToPart.get("hips") ??
    roleToPart.get("spine") ??
    roleToPart.get("head") ??
    parts[0];
  const rootCenter = centerOf(rootPart.bounds);

  const bones: Bone2D[] = [];
  const skins: RigSkinBinding[] = [];

  bones.push({
    id: "spine",
    name: "Spine",
    parentId: null,
    length: Math.max(24, rootPart.bounds.height * 0.6),
    restX: rootCenter.x,
    restY: rootCenter.y + rootPart.bounds.height * 0.25,
    restRotationDeg: -90,
  });

  const makeChildBone = (
    id: string,
    name: string,
    parentId: string,
    part: IllustrationLayerPart | undefined,
    defaultDx: number,
    defaultDy: number,
    defaultRot: number,
    defaultLen: number,
  ): void => {
    const len = part ? Math.max(12, Math.max(part.bounds.width, part.bounds.height) * 0.6) : defaultLen;
    bones.push({
      id,
      name,
      parentId,
      length: len,
      restX: defaultDx,
      restY: defaultDy,
      restRotationDeg: defaultRot,
    });
  };

  makeChildBone("head", "Head", "spine", roleToPart.get("head"), 0, 0, 0, 32);
  makeChildBone("arm_l", "Arm.L", "spine", roleToPart.get("arm_l"), -12, -18, -110, 36);
  makeChildBone("arm_r", "Arm.R", "spine", roleToPart.get("arm_r"), -12, 18, 110, 36);
  makeChildBone("leg_l", "Leg.L", "spine", roleToPart.get("leg_l"), -50, -14, 180, 42);
  makeChildBone("leg_r", "Leg.R", "spine", roleToPart.get("leg_r"), -50, 14, 180, 42);

  if (archetype === "animal") {
    makeChildBone("tail", "Tail", "spine", roleToPart.get("tail"), -48, -10, -145, 32);
  }
  if (roleToPart.has("ear_l")) makeChildBone("ear_l", "Ear.L", "head", roleToPart.get("ear_l"), -5, -12, -30, 20);
  if (roleToPart.has("ear_r")) makeChildBone("ear_r", "Ear.R", "head", roleToPart.get("ear_r"), -5, 12, 30, 20);

  for (const part of parts) {
    const role = partAssignments[part.id];
    const targetBone = bones.some((b) => b.id === role) ? role : "spine";
    skins.push({
      layerId: part.id,
      mode: "rigid",
      boneId: targetBone,
    });
  }

  const rig = createRigDefinition("auto_rig_character", `AutoRig (${archetype})`, parts[0].id, bones, skins);

  const poseSliders: PoseSliderPreset[] = [
    {
      id: "happy",
      name: "Happy",
      pose: {
        spine: { rotationDeg: -4, dy: -6 },
        head: { rotationDeg: -10 },
        arm_l: { rotationDeg: -35 },
        arm_r: { rotationDeg: 35 },
      },
    },
    {
      id: "sad",
      name: "Sad",
      pose: {
        spine: { rotationDeg: 10, dy: 4 },
        head: { rotationDeg: 18 },
        arm_l: { rotationDeg: 22 },
        arm_r: { rotationDeg: -22 },
      },
    },
    {
      id: "wave",
      name: "Wave",
      pose: {
        head: { rotationDeg: -8 },
        arm_r: { rotationDeg: -95 },
      },
    },
    {
      id: "point",
      name: "Point",
      pose: {
        spine: { rotationDeg: 8 },
        arm_r: { rotationDeg: -45 },
      },
    },
  ];

  return { archetype, rig, partAssignments, poseSliders };
}

/** Combine active pose sliders (`sliderId -> weight 0..1`) onto a base pose. */
export function evaluatePoseSliders(
  sliders: readonly PoseSliderPreset[],
  sliderValues: Record<string, number>,
  basePose: RigPoseMap = {},
): RigPoseMap {
  const out: RigPoseMap = {};
  for (const [k, v] of Object.entries(basePose)) out[k] = { ...v };

  for (const slider of sliders) {
    const weight = Math.max(0, Math.min(1, sliderValues[slider.id] ?? 0));
    if (weight <= 0) continue;
    for (const [boneId, delta] of Object.entries(slider.pose)) {
      const cur = out[boneId] ?? {};
      out[boneId] = {
        dx: (cur.dx ?? 0) + (delta.dx ?? 0) * weight,
        dy: (cur.dy ?? 0) + (delta.dy ?? 0) * weight,
        rotationDeg: lerpAngleShortestDeg(
          cur.rotationDeg ?? 0,
          (cur.rotationDeg ?? 0) + (delta.rotationDeg ?? 0),
          weight,
        ),
        scaleX: (cur.scaleX ?? 1) * (1 + ((delta.scaleX ?? 1) - 1) * weight),
        scaleY: (cur.scaleY ?? 1) * (1 + ((delta.scaleY ?? 1) - 1) * weight),
      };
    }
  }
  return out;
}
