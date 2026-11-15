/**
 * ============================================================================
 * STAGE 5 · PHASE 204 — BONE TOOL & POSING
 * ============================================================================
 * Draw bone chains on the canvas, attach layers, pose with forward kinematics,
 * coalesce multi-move drags into single undo steps, reset to rest pose, and
 * toggle/hit-test the bone overlay.
 * ============================================================================
 */

import {
  type Bone2D,
  type Point2D,
  type PoseBoneTransform,
  type RigDefinition,
  type RigPoseMap,
  type RigSkinBinding,
  type WorldBoneTransform,
  createRigDefinition,
  evaluateRigWorldTransforms,
  invertAffineMatrix,
  transformPoint,
} from "./rigModel";

export interface RigHistorySnapshot {
  readonly label: string;
  readonly rig: RigDefinition;
  readonly pose: RigPoseMap;
}

export interface BoneToolSession {
  rig: RigDefinition;
  pose: RigPoseMap;
  showBoneOverlay: boolean;
  selectedBoneId: string | null;
  undoStack: RigHistorySnapshot[];
  redoStack: RigHistorySnapshot[];
  activeGesture: { label: string; beforePose: RigPoseMap } | null;
}

const RAD_TO_DEG = 180 / Math.PI;

function clonePose(pose: RigPoseMap): RigPoseMap {
  const out: RigPoseMap = {};
  for (const [k, v] of Object.entries(pose)) {
    out[k] = { ...v };
  }
  return out;
}

function pushHistory(session: BoneToolSession, snapshot: RigHistorySnapshot): void {
  session.undoStack.push(snapshot);
  session.redoStack = [];
}

/** Create an interactive Bone Tool + FK posing session. */
export function createBoneToolSession(initialRig?: RigDefinition): BoneToolSession {
  const rig =
    initialRig ??
    createRigDefinition("rig_main", "Character Rig", "layer_character", []);
  return {
    rig,
    pose: {},
    showBoneOverlay: true,
    selectedBoneId: rig.bones[rig.bones.length - 1]?.id ?? null,
    undoStack: [],
    redoStack: [],
    activeGesture: null,
  };
}

export interface DrawBoneOptions {
  readonly id?: string;
  readonly name?: string;
  readonly parentId?: string | null;
}

/**
 * Draw a new bone from `headPt` to `tailPt` in canvas world coordinates.
 * Automatically converts world coordinates into parent-local rest transform.
 */
export function drawBoneOnCanvas(
  session: BoneToolSession,
  headPt: Point2D,
  tailPt: Point2D,
  options: DrawBoneOptions = {},
): Bone2D {
  const beforeRig = session.rig;
  const beforePose = clonePose(session.pose);

  const dx = tailPt.x - headPt.x;
  const dy = tailPt.y - headPt.y;
  const length = Math.hypot(dx, dy);
  const worldRotDeg = Math.atan2(dy, dx) * RAD_TO_DEG;

  const parentId =
    options.parentId !== undefined ? options.parentId : session.selectedBoneId;
  const index = session.rig.bones.length + 1;
  const id = options.id ?? `bone_${index}`;
  const name = options.name ?? `Bone ${index}`;

  let restX = headPt.x;
  let restY = headPt.y;
  let restRotationDeg = worldRotDeg;

  if (parentId !== null) {
    const parent = session.rig.bones.find((b) => b.id === parentId);
    const worldMap = evaluateRigWorldTransforms(session.rig, session.pose);
    const parentWorld = worldMap[parentId];
    if (parent && parentWorld) {
      const localHead = transformPoint(invertAffineMatrix(parentWorld.matrix), headPt);
      restX = localHead.x - parent.length;
      restY = localHead.y;
      restRotationDeg = worldRotDeg - parentWorld.worldRotationDeg;
    }
  }

  const bone: Bone2D = {
    id,
    name,
    parentId,
    length,
    restX,
    restY,
    restRotationDeg,
  };

  session.rig = createRigDefinition(
    session.rig.id,
    session.rig.name,
    session.rig.rootLayerId,
    [...session.rig.bones, bone],
    session.rig.skins,
  );
  session.selectedBoneId = id;
  pushHistory(session, {
    label: `Draw ${name}`,
    rig: beforeRig,
    pose: beforePose,
  });

  return bone;
}

/** Attach a document layer rigidly to a bone (undoable single step). */
export function attachLayerToBoneCommand(
  session: BoneToolSession,
  layerId: string,
  boneId: string,
  offset: { offsetX?: number; offsetY?: number; offsetRotationDeg?: number } = {},
): boolean {
  if (!session.rig.bones.some((b) => b.id === boneId)) return false;
  const beforeRig = session.rig;
  const beforePose = clonePose(session.pose);

  const nextSkins: RigSkinBinding[] = [
    ...session.rig.skins.filter((s) => s.layerId !== layerId),
    {
      layerId,
      mode: "rigid",
      boneId,
      offsetX: offset.offsetX,
      offsetY: offset.offsetY,
      offsetRotationDeg: offset.offsetRotationDeg,
    },
  ];
  session.rig = createRigDefinition(
    session.rig.id,
    session.rig.name,
    session.rig.rootLayerId,
    session.rig.bones,
    nextSkins,
  );
  pushHistory(session, {
    label: `Attach ${layerId}`,
    rig: beforeRig,
    pose: beforePose,
  });
  return true;
}

/** Start a multi-pointer-move FK posing gesture coalesced into 1 undo step. */
export function beginPoseGesture(session: BoneToolSession, label = "Pose bones"): void {
  if (session.activeGesture) return;
  session.activeGesture = {
    label,
    beforePose: clonePose(session.pose),
  };
}

/** Apply an incremental FK rotation/translation delta during or outside a gesture. */
export function updatePoseBoneFK(
  session: BoneToolSession,
  boneId: string,
  delta: Partial<PoseBoneTransform>,
): boolean {
  if (!session.rig.bones.some((b) => b.id === boneId)) return false;
  if (!session.activeGesture) {
    pushHistory(session, {
      label: `Rotate ${boneId}`,
      rig: session.rig,
      pose: clonePose(session.pose),
    });
  }
  const prev = session.pose[boneId] ?? {};
  session.pose = {
    ...session.pose,
    [boneId]: {
      dx: (prev.dx ?? 0) + (delta.dx ?? 0),
      dy: (prev.dy ?? 0) + (delta.dy ?? 0),
      rotationDeg: (prev.rotationDeg ?? 0) + (delta.rotationDeg ?? 0),
      scaleX: (prev.scaleX ?? 1) * (delta.scaleX ?? 1),
      scaleY: (prev.scaleY ?? 1) * (delta.scaleY ?? 1),
    },
  };
  return true;
}

/** Finish the active posing gesture, recording exactly 1 undo step if changed. */
export function commitPoseGesture(session: BoneToolSession): boolean {
  if (!session.activeGesture) return false;
  const { label, beforePose } = session.activeGesture;
  session.activeGesture = null;
  if (JSON.stringify(beforePose) === JSON.stringify(session.pose)) {
    return false;
  }
  pushHistory(session, {
    label,
    rig: session.rig,
    pose: beforePose,
  });
  return true;
}

/** Reset selected bones (or entire rig) back to rest pose. */
export function resetRigToRestPose(
  session: BoneToolSession,
  boneIds?: readonly string[],
): void {
  pushHistory(session, {
    label: "Reset rest pose",
    rig: session.rig,
    pose: clonePose(session.pose),
  });
  if (!boneIds) {
    session.pose = {};
    return;
  }
  const remove = new Set(boneIds);
  const next: RigPoseMap = {};
  for (const [id, val] of Object.entries(session.pose)) {
    if (!remove.has(id)) next[id] = val;
  }
  session.pose = next;
}

/** Undo the previous bone draw / attach / pose gesture. */
export function undoBoneSession(session: BoneToolSession): boolean {
  const entry = session.undoStack.pop();
  if (!entry) return false;
  session.redoStack.push({
    label: entry.label,
    rig: session.rig,
    pose: clonePose(session.pose),
  });
  session.rig = entry.rig;
  session.pose = clonePose(entry.pose);
  return true;
}

/** Redo an undone bone session action. */
export function redoBoneSession(session: BoneToolSession): boolean {
  const entry = session.redoStack.pop();
  if (!entry) return false;
  session.undoStack.push({
    label: entry.label,
    rig: session.rig,
    pose: clonePose(session.pose),
  });
  session.rig = entry.rig;
  session.pose = clonePose(entry.pose);
  return true;
}

/** Toggle bone overlay visibility. */
export function setBoneOverlayVisible(session: BoneToolSession, visible: boolean): void {
  session.showBoneOverlay = visible;
}

function pointSegDist(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-10) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Hit-test the rendered bone overlay to find the closest bone within `radiusPx`. */
export function hitTestBoneOverlay(
  worldTransforms: Record<string, WorldBoneTransform>,
  point: Point2D,
  radiusPx = 14,
): string | null {
  let bestId: string | null = null;
  let bestDist = radiusPx;
  for (const wt of Object.values(worldTransforms)) {
    const d = pointSegDist(point, wt.head, wt.tail);
    if (d <= bestDist) {
      bestDist = d;
      bestId = wt.boneId;
    }
  }
  return bestId;
}
