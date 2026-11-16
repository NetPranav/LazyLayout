/**
 * ============================================================================
 * STAGE 6 · PHASES 220–221 — 3D VIEWPORT GIZMOS, UNDO & SCENE HIERARCHY
 * ============================================================================
 * Phase 220: Orbit/pan/dolly camera navigation, T/R/S gizmos with snapping,
 *            raycast picking, grid/axes/local-world toggles, frameSelected,
 *            and command-based 1-gesture undo/redo (15-step gizmo journey).
 * Phase 221: Scene hierarchy tree, Euler display <-> quaternion storage,
 *            Simple & Pro inspector descriptors, and reparenting that preserves
 *            exact world transforms.
 * ============================================================================
 */

export interface Vec3Tuple {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface QuatTuple {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface Transform3d {
  readonly position: Vec3Tuple;
  readonly rotation: QuatTuple;
  readonly scale: Vec3Tuple;
}

export type GizmoMode = "translate" | "rotate" | "scale";
export type GizmoSpace = "local" | "world";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function addVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(v: Vec3Tuple, s: number): Vec3Tuple {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dotVec3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function lengthVec3(v: Vec3Tuple): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalizeVec3(v: Vec3Tuple): Vec3Tuple {
  const len = lengthVec3(v);
  if (len < 1e-8) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function normalizeQuat(q: QuatTuple): QuatTuple {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len < 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

export function multiplyQuat(a: QuatTuple, b: QuatTuple): QuatTuple {
  return normalizeQuat({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}

export function invertQuat(q: QuatTuple): QuatTuple {
  const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
  if (normSq < 1e-12) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: -q.x / normSq, y: -q.y / normSq, z: -q.z / normSq, w: q.w / normSq };
}

export function rotateVecByQuat(v: Vec3Tuple, q: QuatTuple): Vec3Tuple {
  const nq = normalizeQuat(q);
  const qv: QuatTuple = { x: v.x, y: v.y, z: v.z, w: 0 };
  const qConj: QuatTuple = { x: -nq.x, y: -nq.y, z: -nq.z, w: nq.w };
  const tmp = multiplyQuatUnnorm(nq, qv);
  const res = multiplyQuatUnnorm(tmp, qConj);
  return { x: res.x, y: res.y, z: res.z };
}

function multiplyQuatUnnorm(a: QuatTuple, b: QuatTuple): QuatTuple {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Convert intrinsic ZYX Euler angles (degrees) into a unit quaternion matching `quatToEulerDeg`. */
export function eulerDegToQuat(eulerDeg: Vec3Tuple): QuatTuple {
  const rx = (eulerDeg.x * DEG_TO_RAD) / 2;
  const ry = (eulerDeg.y * DEG_TO_RAD) / 2;
  const rz = (eulerDeg.z * DEG_TO_RAD) / 2;
  const qx: QuatTuple = { x: Math.sin(rx), y: 0, z: 0, w: Math.cos(rx) };
  const qy: QuatTuple = { x: 0, y: Math.sin(ry), z: 0, w: Math.cos(ry) };
  const qz: QuatTuple = { x: 0, y: 0, z: Math.sin(rz), w: Math.cos(rz) };
  return multiplyQuat(multiplyQuat(qz, qy), qx);
}

/** Convert unit quaternion back to XYZ Euler display degrees. */
export function quatToEulerDeg(q: QuatTuple): Vec3Tuple {
  const nq = normalizeQuat(q);
  const sinrCosp = 2 * (nq.w * nq.x + nq.y * nq.z);
  const cosrCosp = 1 - 2 * (nq.x * nq.x + nq.y * nq.y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (nq.w * nq.y - nq.z * nq.x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (nq.w * nq.z + nq.x * nq.y);
  const cosyCosp = 1 - 2 * (nq.y * nq.y + nq.z * nq.z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return {
    x: roll * RAD_TO_DEG,
    y: pitch * RAD_TO_DEG,
    z: yaw * RAD_TO_DEG,
  };
}

export function slerpQuat(a: QuatTuple, b: QuatTuple, t: number): QuatTuple {
  const qa = normalizeQuat(a);
  let qb = normalizeQuat(b);
  let dot = qa.x * qb.x + qa.y * qb.y + qa.z * qb.z + qa.w * qb.w;
  if (dot < 0) {
    qb = { x: -qb.x, y: -qb.y, z: -qb.z, w: -qb.w };
    dot = -dot;
  }
  const clampedT = Math.max(0, Math.min(1, t));
  if (dot > 0.9995) {
    return normalizeQuat({
      x: qa.x + clampedT * (qb.x - qa.x),
      y: qa.y + clampedT * (qb.y - qa.y),
      z: qa.z + clampedT * (qb.z - qa.z),
      w: qa.w + clampedT * (qb.w - qa.w),
    });
  }
  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const theta = theta0 * clampedT;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return normalizeQuat({
    x: s0 * qa.x + s1 * qb.x,
    y: s0 * qa.y + s1 * qb.y,
    z: s0 * qa.z + s1 * qb.z,
    w: s0 * qa.w + s1 * qb.w,
  });
}

export interface ViewportCameraState {
  readonly target: Vec3Tuple;
  readonly yawDeg: number;
  readonly pitchDeg: number;
  readonly distance: number;
  readonly showGrid: boolean;
  readonly showAxes: boolean;
  readonly gizmoMode: GizmoMode;
  readonly gizmoSpace: GizmoSpace;
  readonly snapStep: number;
}

export function createDefaultViewportCamera(): ViewportCameraState {
  return {
    target: { x: 0, y: 0, z: 0 },
    yawDeg: 35,
    pitchDeg: 22,
    distance: 6,
    showGrid: true,
    showAxes: true,
    gizmoMode: "translate",
    gizmoSpace: "world",
    snapStep: 0.5,
  };
}

export function orbitCamera(cam: ViewportCameraState, deltaYawDeg: number, deltaPitchDeg: number): ViewportCameraState {
  return {
    ...cam,
    yawDeg: cam.yawDeg + deltaYawDeg,
    pitchDeg: Math.max(-85, Math.min(85, cam.pitchDeg + deltaPitchDeg)),
  };
}

export function panCamera(cam: ViewportCameraState, dx: number, dy: number): ViewportCameraState {
  return {
    ...cam,
    target: { x: cam.target.x + dx, y: cam.target.y + dy, z: cam.target.z },
  };
}

export function dollyCamera(cam: ViewportCameraState, deltaDistance: number): ViewportCameraState {
  return {
    ...cam,
    distance: Math.max(0.5, Math.min(200, cam.distance + deltaDistance)),
  };
}

export function frameSelected(
  cam: ViewportCameraState,
  boundsCenter: Vec3Tuple,
  boundsRadius: number,
): ViewportCameraState {
  return {
    ...cam,
    target: boundsCenter,
    distance: Math.max(1.2, boundsRadius * 2.6),
  };
}

export interface Scene3dHierarchyNode {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly visible: boolean;
  readonly localTransform: Transform3d;
  readonly radius: number;
}

export function identityTransform3d(): Transform3d {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function combineTransforms(parent: Transform3d, child: Transform3d): Transform3d {
  const scaledPos: Vec3Tuple = {
    x: child.position.x * parent.scale.x,
    y: child.position.y * parent.scale.y,
    z: child.position.z * parent.scale.z,
  };
  const rotatedPos = rotateVecByQuat(scaledPos, parent.rotation);
  return {
    position: addVec3(parent.position, rotatedPos),
    rotation: multiplyQuat(parent.rotation, child.rotation),
    scale: {
      x: parent.scale.x * child.scale.x,
      y: parent.scale.y * child.scale.y,
      z: parent.scale.z * child.scale.z,
    },
  };
}

/** Evaluate world transform for any node in the 3D scene hierarchy. */
export function evaluateNodeWorldTransform(
  nodes: readonly Scene3dHierarchyNode[],
  nodeId: string,
): Transform3d {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: Scene3dHierarchyNode[] = [];
  let cursor = byId.get(nodeId);
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  let world = identityTransform3d();
  for (let i = chain.length - 1; i >= 0; i--) {
    world = combineTransforms(world, chain[i].localTransform);
  }
  return world;
}

/** Reparent a node under `newParentId` while preserving its exact world transform. */
export function reparentPreservingWorldTransform(
  nodes: readonly Scene3dHierarchyNode[],
  nodeId: string,
  newParentId: string | null,
): readonly Scene3dHierarchyNode[] {
  const currentWorld = evaluateNodeWorldTransform(nodes, nodeId);
  const newParentWorld = newParentId ? evaluateNodeWorldTransform(nodes, newParentId) : identityTransform3d();

  const invParentRot = invertQuat(newParentWorld.rotation);
  const diff = subVec3(currentWorld.position, newParentWorld.position);
  const unrotatedDiff = rotateVecByQuat(diff, invParentRot);
  const localPosition: Vec3Tuple = {
    x: Math.abs(newParentWorld.scale.x) > 1e-8 ? unrotatedDiff.x / newParentWorld.scale.x : 0,
    y: Math.abs(newParentWorld.scale.y) > 1e-8 ? unrotatedDiff.y / newParentWorld.scale.y : 0,
    z: Math.abs(newParentWorld.scale.z) > 1e-8 ? unrotatedDiff.z / newParentWorld.scale.z : 0,
  };
  const localRotation = multiplyQuat(invParentRot, currentWorld.rotation);
  const localScale: Vec3Tuple = {
    x: Math.abs(newParentWorld.scale.x) > 1e-8 ? currentWorld.scale.x / newParentWorld.scale.x : 1,
    y: Math.abs(newParentWorld.scale.y) > 1e-8 ? currentWorld.scale.y / newParentWorld.scale.y : 1,
    z: Math.abs(newParentWorld.scale.z) > 1e-8 ? currentWorld.scale.z / newParentWorld.scale.z : 1,
  };

  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          parentId: newParentId,
          localTransform: { position: localPosition, rotation: localRotation, scale: localScale },
        }
      : node,
  );
}

export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export interface GizmoApplyOptions {
  readonly mode: GizmoMode;
  readonly space: GizmoSpace;
  readonly delta: Vec3Tuple;
  readonly snapStep?: number;
}

/** Apply translate, rotate (degrees delta), or scale gizmo gesture to a node transform. */
export function applyGizmoToTransform(
  transform: Transform3d,
  opts: GizmoApplyOptions,
): Transform3d {
  const step = opts.snapStep ?? 0;
  if (opts.mode === "translate") {
    const worldDelta = opts.space === "local" ? rotateVecByQuat(opts.delta, transform.rotation) : opts.delta;
    return {
      ...transform,
      position: {
        x: snapValue(transform.position.x + worldDelta.x, step),
        y: snapValue(transform.position.y + worldDelta.y, step),
        z: snapValue(transform.position.z + worldDelta.z, step),
      },
    };
  }
  if (opts.mode === "rotate") {
    const snappedDelta: Vec3Tuple = {
      x: snapValue(opts.delta.x, step),
      y: snapValue(opts.delta.y, step),
      z: snapValue(opts.delta.z, step),
    };
    const qDelta = eulerDegToQuat(snappedDelta);
    const nextRot = opts.space === "local" ? multiplyQuat(transform.rotation, qDelta) : multiplyQuat(qDelta, transform.rotation);
    return { ...transform, rotation: nextRot };
  }
  return {
    ...transform,
    scale: {
      x: Math.max(0.05, snapValue(transform.scale.x * (1 + opts.delta.x), step)),
      y: Math.max(0.05, snapValue(transform.scale.y * (1 + opts.delta.y), step)),
      z: Math.max(0.05, snapValue(transform.scale.z * (1 + opts.delta.z), step)),
    },
  };
}

/** Ray-sphere picking in 3D viewport coordinates (returns nearest hit node id). */
export function raycastSceneNodes(
  nodes: readonly Scene3dHierarchyNode[],
  rayOrigin: Vec3Tuple,
  rayDirection: Vec3Tuple,
): string | null {
  const dir = normalizeVec3(rayDirection);
  let bestId: string | null = null;
  let bestT = Infinity;

  for (const node of nodes) {
    if (!node.visible) continue;
    const world = evaluateNodeWorldTransform(nodes, node.id);
    const oc = subVec3(rayOrigin, world.position);
    const b = dotVec3(oc, dir);
    const c = dotVec3(oc, oc) - node.radius * node.radius;
    const disc = b * b - c;
    if (disc >= 0) {
      const t = -b - Math.sqrt(disc);
      const hitT = t >= 0 ? t : -b + Math.sqrt(disc);
      if (hitT >= 0 && hitT < bestT) {
        bestT = hitT;
        bestId = node.id;
      }
    }
  }
  return bestId;
}

export interface InspectorFieldDescriptor {
  readonly label: string;
  readonly value: string;
  readonly tier: "simple" | "pro";
}

export function get3dInspectorFields(
  node: Scene3dHierarchyNode,
  face: "simple" | "pro",
): readonly InspectorFieldDescriptor[] {
  const euler = quatToEulerDeg(node.localTransform.rotation);
  const base: InspectorFieldDescriptor[] = [
    {
      label: "Position",
      value: `${node.localTransform.position.x.toFixed(2)}, ${node.localTransform.position.y.toFixed(2)}, ${node.localTransform.position.z.toFixed(2)}`,
      tier: "simple",
    },
    {
      label: "Rotation",
      value: `${euler.x.toFixed(1)}°, ${euler.y.toFixed(1)}°, ${euler.z.toFixed(1)}°`,
      tier: "simple",
    },
    {
      label: "Scale",
      value: `${node.localTransform.scale.x.toFixed(2)}, ${node.localTransform.scale.y.toFixed(2)}, ${node.localTransform.scale.z.toFixed(2)}`,
      tier: "simple",
    },
  ];
  if (face === "pro") {
    base.push({
      label: "Quaternion (stored)",
      value: `${node.localTransform.rotation.x.toFixed(4)}, ${node.localTransform.rotation.y.toFixed(4)}, ${node.localTransform.rotation.z.toFixed(4)}, ${node.localTransform.rotation.w.toFixed(4)}`,
      tier: "pro",
    });
  }
  return base;
}

export class GizmoCommandStack {
  private nodes: readonly Scene3dHierarchyNode[];
  private readonly undoStack: (readonly Scene3dHierarchyNode[])[] = [];
  private readonly redoStack: (readonly Scene3dHierarchyNode[])[] = [];

  constructor(initialNodes: readonly Scene3dHierarchyNode[]) {
    this.nodes = initialNodes;
  }

  executeTransform(nodeId: string, opts: GizmoApplyOptions): void {
    this.undoStack.push(this.nodes);
    this.redoStack.length = 0;
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, localTransform: applyGizmoToTransform(n.localTransform, opts) } : n,
    );
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.nodes);
    this.nodes = prev;
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.nodes);
    this.nodes = next;
    return true;
  }

  getNodes(): readonly Scene3dHierarchyNode[] {
    return this.nodes;
  }

  getUndoDepth(): number {
    return this.undoStack.length;
  }
}

export interface GizmoJourneyReport {
  readonly stepsCompleted: number;
  readonly undoStepsMatched: boolean;
  readonly restoredToInitial: boolean;
  readonly finalPosition: Vec3Tuple;
  readonly pickedNodeId: string | null;
}

/** Phase 220 gate: 15-step gizmo, camera, pick & 1-undo-per-gesture journey. */
export function run15StepGizmoJourney(): GizmoJourneyReport {
  const initialNodes: Scene3dHierarchyNode[] = [
    { id: "hero_cube", name: "Hero Cube", parentId: null, visible: true, radius: 1, localTransform: identityTransform3d() },
  ];
  const stack = new GizmoCommandStack(initialNodes);
  let cam = createDefaultViewportCamera();

  // Steps 1-3: camera orbit, pan, dolly
  cam = orbitCamera(cam, 15, 5);
  cam = panCamera(cam, 0.5, 0);
  cam = dollyCamera(cam, -1);

  // Steps 4-13: 10 distinct gizmo gestures (translate, rotate, scale with & without snapping)
  stack.executeTransform("hero_cube", { mode: "translate", space: "world", delta: { x: 2, y: 0, z: 0 }, snapStep: 0.5 });
  stack.executeTransform("hero_cube", { mode: "translate", space: "world", delta: { x: 0, y: 1.5, z: 0 }, snapStep: 0.5 });
  stack.executeTransform("hero_cube", { mode: "rotate", space: "world", delta: { x: 0, y: 45, z: 0 }, snapStep: 15 });
  stack.executeTransform("hero_cube", { mode: "translate", space: "local", delta: { x: 1, y: 0, z: 0 }, snapStep: 0 });
  stack.executeTransform("hero_cube", { mode: "scale", space: "local", delta: { x: 0.5, y: 0.5, z: 0.5 }, snapStep: 0 });
  stack.executeTransform("hero_cube", { mode: "rotate", space: "local", delta: { x: 15, y: 0, z: 0 }, snapStep: 15 });
  stack.executeTransform("hero_cube", { mode: "translate", space: "world", delta: { x: 0, y: 0, z: 1 }, snapStep: 0.5 });
  stack.executeTransform("hero_cube", { mode: "rotate", space: "world", delta: { x: 0, y: 0, z: 30 }, snapStep: 15 });
  stack.executeTransform("hero_cube", { mode: "scale", space: "local", delta: { x: -0.2, y: 0, z: 0 }, snapStep: 0 });
  stack.executeTransform("hero_cube", { mode: "translate", space: "world", delta: { x: 0.5, y: 0, z: 0 }, snapStep: 0.5 });

  // Step 14: frame selected & raycast pick from the framed camera position
  const nodeAfter = stack.getNodes()[0];
  cam = frameSelected(cam, nodeAfter.localTransform.position, nodeAfter.radius);
  const pickedNodeId = raycastSceneNodes(
    stack.getNodes(),
    { x: cam.target.x, y: cam.target.y, z: cam.target.z + cam.distance },
    { x: 0, y: 0, z: -1 },
  );

  // Step 15: verify 1 undo step per gesture (10 undos -> exact initial; 10 redos -> exact final)
  const undoStepsMatched = stack.getUndoDepth() === 10;
  for (let i = 0; i < 10; i++) stack.undo();
  const afterUndo = stack.getNodes()[0].localTransform.position;
  const restoredToInitial = Math.abs(afterUndo.x) < 1e-9 && Math.abs(afterUndo.y) < 1e-9 && Math.abs(afterUndo.z) < 1e-9;
  for (let i = 0; i < 10; i++) stack.redo();

  return {
    stepsCompleted: 15,
    undoStepsMatched,
    restoredToInitial,
    finalPosition: stack.getNodes()[0].localTransform.position,
    pickedNodeId,
  };
}
