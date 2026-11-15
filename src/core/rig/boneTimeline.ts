/**
 * ============================================================================
 * STAGE 5 · PHASE 205 — BONES ON THE TIMELINE
 * ============================================================================
 * Keyframed poses with shortest-arc angle interpolation, pose onion skinning,
 * pose copy & left/right mirroring, and named pose library blending.
 * ============================================================================
 */

import {
  type PoseBoneTransform,
  type RigDefinition,
  type RigPoseMap,
  type WorldBoneTransform,
  evaluateRigWorldTransforms,
} from "./rigModel";

export interface PoseKeyframe {
  readonly timeSec: number;
  readonly pose: RigPoseMap;
  readonly easing?: "linear" | "easeInOut";
}

export type BonePoseTrack = readonly PoseKeyframe[];

export interface OnionSkinGhost {
  readonly offsetFrames: number;
  readonly timeSec: number;
  readonly opacity: number;
  readonly tint: "past" | "future";
  readonly worldTransforms: Record<string, WorldBoneTransform>;
}

export interface PoseLibraryEntry {
  readonly id: string;
  readonly name: string;
  readonly pose: RigPoseMap;
}

/** Shortest-arc angular linear interpolation in degrees. */
export function lerpAngleShortestDeg(aDeg: number, bDeg: number, t: number): number {
  const diff = ((((bDeg - aDeg) % 360) + 540) % 360) - 180;
  return aDeg + diff * t;
}

function applyEase(t: number, easing: "linear" | "easeInOut" = "linear"): number {
  const u = Math.max(0, Math.min(1, t));
  if (easing === "easeInOut") {
    return u * u * (3 - 2 * u);
  }
  return u;
}

/** Blend two bone poses at parameter `t` in `[0, 1]`. */
export function blendBonePoses(a: RigPoseMap, b: RigPoseMap, t: number): RigPoseMap {
  const boneIds = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: RigPoseMap = {};
  for (const id of boneIds) {
    const pa = a[id] ?? {};
    const pb = b[id] ?? {};
    out[id] = {
      dx: (pa.dx ?? 0) + ((pb.dx ?? 0) - (pa.dx ?? 0)) * t,
      dy: (pa.dy ?? 0) + ((pb.dy ?? 0) - (pa.dy ?? 0)) * t,
      rotationDeg: lerpAngleShortestDeg(pa.rotationDeg ?? 0, pb.rotationDeg ?? 0, t),
      scaleX: (pa.scaleX ?? 1) + ((pb.scaleX ?? 1) - (pa.scaleX ?? 1)) * t,
      scaleY: (pa.scaleY ?? 1) + ((pb.scaleY ?? 1) - (pa.scaleY ?? 1)) * t,
    };
  }
  return out;
}

/** Sample a keyframed bone pose track at `timeSec`. */
export function evaluatePoseTrackAtTime(
  track: BonePoseTrack,
  timeSec: number,
): RigPoseMap {
  if (track.length === 0) return {};
  const sorted = [...track].sort((k1, k2) => k1.timeSec - k2.timeSec);
  if (timeSec <= sorted[0].timeSec) return sorted[0].pose;
  const last = sorted[sorted.length - 1];
  if (timeSec >= last.timeSec) return last.pose;

  for (let i = 1; i < sorted.length; i++) {
    const k0 = sorted[i - 1];
    const k1 = sorted[i];
    if (timeSec <= k1.timeSec) {
      const span = k1.timeSec - k0.timeSec;
      const rawT = span <= 1e-9 ? 1 : (timeSec - k0.timeSec) / span;
      const easedT = applyEase(rawT, k0.easing);
      return blendBonePoses(k0.pose, k1.pose, easedT);
    }
  }
  return last.pose;
}

/** Generate onion-skin ghost skeletons before and after `currentTimeSec`. */
export function computePoseOnionSkins(
  rig: RigDefinition,
  track: BonePoseTrack,
  currentTimeSec: number,
  pastCount = 2,
  futureCount = 2,
  stepSec = 1 / 24,
): OnionSkinGhost[] {
  const ghosts: OnionSkinGhost[] = [];
  for (let i = pastCount; i >= 1; i--) {
    const t = Math.max(0, currentTimeSec - i * stepSec);
    const pose = evaluatePoseTrackAtTime(track, t);
    ghosts.push({
      offsetFrames: -i,
      timeSec: t,
      opacity: Math.max(0.12, 0.55 - i * 0.16),
      tint: "past",
      worldTransforms: evaluateRigWorldTransforms(rig, pose),
    });
  }
  for (let i = 1; i <= futureCount; i++) {
    const t = currentTimeSec + i * stepSec;
    const pose = evaluatePoseTrackAtTime(track, t);
    ghosts.push({
      offsetFrames: i,
      timeSec: t,
      opacity: Math.max(0.12, 0.55 - i * 0.16),
      tint: "future",
      worldTransforms: evaluateRigWorldTransforms(rig, pose),
    });
  }
  return ghosts;
}

/** Deep-copy a pose map. */
export function copyPoseSnapshot(pose: RigPoseMap): RigPoseMap {
  const copy: RigPoseMap = {};
  for (const [k, v] of Object.entries(pose)) {
    copy[k] = { ...v };
  }
  return copy;
}

function swapMirrorBoneId(boneId: string): string {
  if (boneId.endsWith(".L")) return boneId.slice(0, -2) + ".R";
  if (boneId.endsWith(".R")) return boneId.slice(0, -2) + ".L";
  if (boneId.endsWith("_L")) return boneId.slice(0, -2) + "_R";
  if (boneId.endsWith("_R")) return boneId.slice(0, -2) + "_L";
  if (boneId.endsWith("_l")) return boneId.slice(0, -2) + "_r";
  if (boneId.endsWith("_r")) return boneId.slice(0, -2) + "_l";
  if (boneId.startsWith("left_")) return "right_" + boneId.slice(5);
  if (boneId.startsWith("right_")) return "left_" + boneId.slice(6);
  return boneId;
}

/** Mirror pose horizontally across center axis, swapping `.L`/`.R` (`_L`/`_R`) bones. */
export function mirrorPoseLeftRight(pose: RigPoseMap): RigPoseMap {
  const mirrored: RigPoseMap = {};
  for (const [boneId, xform] of Object.entries(pose)) {
    const targetId = swapMirrorBoneId(boneId);
    const nextTransform: PoseBoneTransform = {
      dx: xform.dx !== undefined ? -xform.dx : undefined,
      dy: xform.dy,
      rotationDeg: xform.rotationDeg !== undefined ? -xform.rotationDeg : undefined,
      scaleX: xform.scaleX,
      scaleY: xform.scaleY,
    };
    mirrored[targetId] = nextTransform;
  }
  return mirrored;
}

export class PoseLibrary {
  private readonly entries = new Map<string, PoseLibraryEntry>();

  save(id: string, name: string, pose: RigPoseMap): PoseLibraryEntry {
    const entry: PoseLibraryEntry = { id, name, pose: copyPoseSnapshot(pose) };
    this.entries.set(id, entry);
    return entry;
  }

  get(id: string): PoseLibraryEntry | undefined {
    return this.entries.get(id);
  }

  list(): PoseLibraryEntry[] {
    return Array.from(this.entries.values());
  }

  apply(id: string, currentPose: RigPoseMap = {}, blendWeight = 1): RigPoseMap {
    const entry = this.entries.get(id);
    if (!entry) return copyPoseSnapshot(currentPose);
    return blendBonePoses(currentPose, entry.pose, Math.max(0, Math.min(1, blendWeight)));
  }
}
