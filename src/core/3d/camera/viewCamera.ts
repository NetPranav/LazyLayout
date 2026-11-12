/**
 * ============================================================================
 * 3D VIEWPORT CAMERA & NAVIGATION KERNEL (Phase 3D-014)
 * ============================================================================
 * Pure TypeScript implementation of an immutable viewport camera model:
 *   - glTF 2.0 / WebGL conventions: +Y Up, -Z Forward, +X Right (right-handed)
 *   - Orbit, pan, dolly, flyStep, zoomToPoint
 *   - View and projection matrices (perspective and orthographic)
 *   - Blender numpad standard views ("front", "back", "left", "right", "top", "bottom")
 *   - Frame bounds / all, and align to active object camera
 *
 * All operations are pure and return new immutable ViewCamera instances.
 * ============================================================================
 */

import type { MotionDocument, Object3d } from "../../document/schema";
import { worldMatrix } from "../hierarchy";
import { type Mat4, type Vec3, mat4, vec3 } from "../math";
import { degToRad } from "../units";

// ---------------------------------------------------------------------------
// Types & Defaults
// ---------------------------------------------------------------------------

export interface ViewCamera {
  readonly target: Vec3;
  readonly distance: number;
  readonly yaw: number; // Azimuth in radians (0 = looking along -Z from +Z)
  readonly pitch: number; // Elevation in radians (0 = horizontal, >0 = above target looking down)
  readonly fovY: number; // Vertical field of view in radians (perspective mode)
  readonly ortho: boolean; // True if orthographic projection is active
  readonly orthoSize: number; // Vertical view height in world units (metres)
  readonly near: number; // Near clipping plane distance
  readonly far: number; // Far clipping plane distance
}

export type StandardView =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

/** Canonical 3D view command IDs (Phase 3D-014, DOCS/3D/tasks/B2-ids.md) */
export const VIEW_COMMANDS = {
  front: "3d.view.front",
  back: "3d.view.back",
  left: "3d.view.left",
  right: "3d.view.right",
  top: "3d.view.top",
  bottom: "3d.view.bottom",
  toggleOrtho: "3d.view.toggle_ortho",
  frameSelected: "3d.view.frame_selected",
  frameAll: "3d.view.frame_all",
  camera: "3d.view.camera",
} as const;

export interface BoundingBox3d {
  readonly min: Vec3 | readonly [number, number, number] | ArrayLike<number>;
  readonly max: Vec3 | readonly [number, number, number] | ArrayLike<number>;
}

export const PITCH_LIMIT = Math.PI / 2 - 1e-4;
export const MIN_DISTANCE = 1e-3;
export const MAX_DISTANCE = 1e6;
export const MIN_ORTHO_SIZE = 1e-3;
export const MAX_ORTHO_SIZE = 1e6;

export const DEFAULT_VIEW_CAMERA: ViewCamera = Object.freeze({
  target: vec3(0, 0, 0),
  distance: 5.0,
  yaw: 0.0,
  pitch: 0.0,
  fovY: degToRad(50.0),
  ortho: false,
  orthoSize: 5.0,
  near: 0.1,
  far: 1000.0,
});

/**
 * Creates an immutable ViewCamera instance with default values overridden by options.
 */
export function createViewCamera(options?: Partial<ViewCamera>): ViewCamera {
  const target = options?.target
    ? vec3(options.target[0], options.target[1], options.target[2])
    : vec3(
        DEFAULT_VIEW_CAMERA.target[0],
        DEFAULT_VIEW_CAMERA.target[1],
        DEFAULT_VIEW_CAMERA.target[2]
      );

  const pitch = options?.pitch ?? DEFAULT_VIEW_CAMERA.pitch;
  const clampedPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));

  const distance = Math.max(
    MIN_DISTANCE,
    Math.min(MAX_DISTANCE, options?.distance ?? DEFAULT_VIEW_CAMERA.distance)
  );

  const orthoSize = Math.max(
    MIN_ORTHO_SIZE,
    Math.min(MAX_ORTHO_SIZE, options?.orthoSize ?? DEFAULT_VIEW_CAMERA.orthoSize)
  );

  return Object.freeze({
    target,
    distance,
    yaw: options?.yaw ?? DEFAULT_VIEW_CAMERA.yaw,
    pitch: clampedPitch,
    fovY: options?.fovY ?? DEFAULT_VIEW_CAMERA.fovY,
    ortho: options?.ortho ?? DEFAULT_VIEW_CAMERA.ortho,
    orthoSize,
    near: options?.near ?? DEFAULT_VIEW_CAMERA.near,
    far: options?.far ?? DEFAULT_VIEW_CAMERA.far,
  });
}

// ---------------------------------------------------------------------------
// Camera Position & Basis Vectors
// ---------------------------------------------------------------------------

/**
 * Computes the 3D eye position of the camera in world coordinates.
 * In glTF right-handed coordinates (+Y up, -Z forward):
 * At yaw=0, pitch=0, eye is at target + (0, 0, distance), looking along -Z.
 */
export function cameraPosition(cam: ViewCamera): Vec3 {
  const cosPitch = Math.cos(cam.pitch);
  const sinPitch = Math.sin(cam.pitch);
  const sinYaw = Math.sin(cam.yaw);
  const cosYaw = Math.cos(cam.yaw);

  const dx = cam.distance * sinYaw * cosPitch;
  const dy = cam.distance * sinPitch;
  const dz = cam.distance * cosYaw * cosPitch;

  return vec3(cam.target[0] + dx, cam.target[1] + dy, cam.target[2] + dz);
}

/**
 * Computes camera basis vectors:
 *   - forward (F): normalized vector from camera eye towards target (-Z in camera space)
 *   - right (R): normalized horizontal vector (+X in camera space)
 *   - up (U): normalized vertical vector (+Y in camera space)
 */
export function cameraBasis(cam: ViewCamera): {
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
} {
  const cosPitch = Math.cos(cam.pitch);
  const sinPitch = Math.sin(cam.pitch);
  const sinYaw = Math.sin(cam.yaw);
  const cosYaw = Math.cos(cam.yaw);

  // Vector from eye to target:
  // eye - target = (sinYaw * cosPitch, sinPitch, cosYaw * cosPitch)
  // target - eye = (-sinYaw * cosPitch, -sinPitch, -cosYaw * cosPitch)
  const fx = -sinYaw * cosPitch;
  const fy = -sinPitch;
  const fz = -cosYaw * cosPitch;
  const forward = vec3(fx, fy, fz);

  // Right vector = normalize(cross(F, [0, 1, 0])) = (cosYaw, 0, -sinYaw)
  const rx = cosYaw;
  const ry = 0;
  const rz = -sinYaw;
  const right = vec3(rx, ry, rz);

  // Up vector = cross(right, forward)
  // Since R is unit and F is unit and orthogonal, U is unit.
  const ux = ry * fz - rz * fy; // - (-sinYaw) * (-sinPitch) = -sinYaw * sinPitch
  const uy = rz * fx - rx * fz; // (-sinYaw)*(-sinYaw*cosPitch) - cosYaw*(-cosYaw*cosPitch) = cosPitch
  const uz = rx * fy - ry * fx; // cosYaw * (-sinPitch) = -cosYaw * sinPitch
  const up = vec3(ux, uy, uz);

  return { forward, right, up };
}

// ---------------------------------------------------------------------------
// View & Projection Matrices
// ---------------------------------------------------------------------------

/**
 * Computes the 4x4 column-major view matrix transforming world space into camera space.
 */
export function viewMatrix(cam: ViewCamera): Mat4 {
  const eye = cameraPosition(cam);
  const { forward, right, up } = cameraBasis(cam);

  // In camera space:
  // X_cam = right
  // Y_cam = up
  // Z_cam = -forward
  // Translation = -dot(basis, eye)
  const m = mat4();

  // Column 0
  m[0] = right[0];
  m[1] = up[0];
  m[2] = -forward[0];
  m[3] = 0;

  // Column 1
  m[4] = right[1];
  m[5] = up[1];
  m[6] = -forward[1];
  m[7] = 0;

  // Column 2
  m[8] = right[2];
  m[9] = up[2];
  m[10] = -forward[2];
  m[11] = 0;

  // Column 3
  m[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
  m[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
  m[14] = -(-forward[0] * eye[0] - forward[1] * eye[1] - forward[2] * eye[2]);
  m[15] = 1;

  return m;
}

/**
 * Computes the 4x4 column-major projection matrix for perspective or orthographic mode.
 */
export function projectionMatrix(cam: ViewCamera, aspect: number): Mat4 {
  const m = mat4();
  const near = cam.near;
  const far = cam.far;

  if (cam.ortho) {
    const top = cam.orthoSize / 2;
    const right = top * aspect;
    const dNearFar = far - near;

    m[0] = 1 / right;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;

    m[4] = 0;
    m[5] = 1 / top;
    m[6] = 0;
    m[7] = 0;

    m[8] = 0;
    m[9] = 0;
    m[10] = -2 / dNearFar;
    m[11] = 0;

    m[12] = 0;
    m[13] = 0;
    m[14] = -(far + near) / dNearFar;
    m[15] = 1;
  } else {
    const f = 1.0 / Math.tan(cam.fovY / 2);
    const dNearFar = far - near;

    m[0] = f / aspect;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;

    m[4] = 0;
    m[5] = f;
    m[6] = 0;
    m[7] = 0;

    m[8] = 0;
    m[9] = 0;
    m[10] = -(far + near) / dNearFar;
    m[11] = -1;

    m[12] = 0;
    m[13] = 0;
    m[14] = -(2 * far * near) / dNearFar;
    m[15] = 0;
  }

  return m;
}

// ---------------------------------------------------------------------------
// Camera Navigation Operations
// ---------------------------------------------------------------------------

/**
 * Rotates the camera around the target point by angular offsets dx (yaw) and dy (pitch).
 * Pitch is strictly clamped within [-PITCH_LIMIT, PITCH_LIMIT] to avoid gimbal flip.
 */
export function orbit(cam: ViewCamera, dx: number, dy: number): ViewCamera {
  const newYaw = cam.yaw + dx;
  const newPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.pitch + dy));

  return Object.freeze({
    ...cam,
    yaw: newYaw,
    pitch: newPitch,
  });
}

/**
 * Pans the camera target across the view plane so the scene moves synchronously with the cursor.
 * In screen coordinates: dx is rightwards, dy is downwards.
 */
export function pan(
  cam: ViewCamera,
  dx: number,
  dy: number,
  viewportH: number
): ViewCamera {
  if (viewportH <= 0) return cam;

  const scale = cam.ortho
    ? cam.orthoSize / viewportH
    : (2 * cam.distance * Math.tan(cam.fovY / 2)) / viewportH;

  const { right, up } = cameraBasis(cam);

  // Moving cursor right (+dx) moves target left (-R) so world under cursor moves right (+R).
  // Moving cursor down (+dy) moves target up (+U) so world under cursor moves down (-U).
  const deltaX = -dx * scale * right[0] + dy * scale * up[0];
  const deltaY = -dx * scale * right[1] + dy * scale * up[1];
  const deltaZ = -dx * scale * right[2] + dy * scale * up[2];

  const newTarget = vec3(
    cam.target[0] + deltaX,
    cam.target[1] + deltaY,
    cam.target[2] + deltaZ
  );

  return Object.freeze({
    ...cam,
    target: newTarget,
  });
}

/**
 * Dollys the camera closer to or further from the target exponentially.
 * delta > 0 increases distance / orthoSize; delta < 0 zooms in.
 */
export function dolly(cam: ViewCamera, delta: number): ViewCamera {
  const factor = Math.exp(delta);

  const newDistance = Math.max(
    MIN_DISTANCE,
    Math.min(MAX_DISTANCE, cam.distance * factor)
  );

  const newOrthoSize = Math.max(
    MIN_ORTHO_SIZE,
    Math.min(MAX_ORTHO_SIZE, cam.orthoSize * factor)
  );

  return Object.freeze({
    ...cam,
    distance: newDistance,
    orthoSize: newOrthoSize,
  });
}

/**
 * Zooms in/out towards a specific screen pixel (screenX, screenY), keeping the 3D point
 * under that pixel stationary on screen.
 *
 * @param zoomFactor Factor by which distance/orthoSize changes (e.g. 0.9 = zoom in by 10%, 1.1 = zoom out)
 */
export function zoomToPoint(
  cam: ViewCamera,
  zoomFactor: number,
  screenX: number,
  screenY: number,
  viewportW: number,
  viewportH: number
): ViewCamera {
  if (viewportW <= 0 || viewportH <= 0 || zoomFactor <= 0) return cam;

  // Normalized Device Coordinates (-1 to 1)
  const ndcX = (screenX / viewportW) * 2 - 1;
  const ndcY = 1 - (screenY / viewportH) * 2;
  const aspect = viewportW / viewportH;

  const { right, up } = cameraBasis(cam);

  // Offset in the view plane from target to the ray passing through (screenX, screenY)
  let viewPlaneX: number;
  let viewPlaneY: number;

  if (cam.ortho) {
    const halfH = cam.orthoSize / 2;
    viewPlaneX = ndcX * halfH * aspect;
    viewPlaneY = ndcY * halfH;
  } else {
    const tanHalf = Math.tan(cam.fovY / 2);
    viewPlaneX = ndcX * cam.distance * tanHalf * aspect;
    viewPlaneY = ndcY * cam.distance * tanHalf;
  }

  // To keep the world point stationary, target shifts by (1 - zoomFactor) * viewPlaneOffset
  const shiftFactor = 1 - zoomFactor;
  const shiftX = shiftFactor * (viewPlaneX * right[0] + viewPlaneY * up[0]);
  const shiftY = shiftFactor * (viewPlaneX * right[1] + viewPlaneY * up[1]);
  const shiftZ = shiftFactor * (viewPlaneX * right[2] + viewPlaneY * up[2]);

  const newTarget = vec3(
    cam.target[0] + shiftX,
    cam.target[1] + shiftY,
    cam.target[2] + shiftZ
  );

  const newDistance = Math.max(
    MIN_DISTANCE,
    Math.min(MAX_DISTANCE, cam.distance * zoomFactor)
  );

  const newOrthoSize = Math.max(
    MIN_ORTHO_SIZE,
    Math.min(MAX_ORTHO_SIZE, cam.orthoSize * zoomFactor)
  );

  return Object.freeze({
    ...cam,
    target: newTarget,
    distance: newDistance,
    orthoSize: newOrthoSize,
  });
}

/**
 * Translates camera target along local view coordinates in fly mode.
 */
export function flyStep(
  cam: ViewCamera,
  dir: { forward: number; right: number; up: number },
  dt: number,
  speed: number
): ViewCamera {
  const step = dt * speed;
  const { forward, right, up } = cameraBasis(cam);

  const dx = (dir.forward * forward[0] + dir.right * right[0] + dir.up * up[0]) * step;
  const dy = (dir.forward * forward[1] + dir.right * right[1] + dir.up * up[1]) * step;
  const dz = (dir.forward * forward[2] + dir.right * right[2] + dir.up * up[2]) * step;

  return Object.freeze({
    ...cam,
    target: vec3(cam.target[0] + dx, cam.target[1] + dy, cam.target[2] + dz),
  });
}

// ---------------------------------------------------------------------------
// Standard Views & Framing
// ---------------------------------------------------------------------------

/**
 * Aligns the camera to canonical orthographic / perspective views matching Blender numpad
 * conventions mapped to glTF (+Y up, -Z forward, +X right):
 *   - "front":  Looking along -Z (camera at +Z). Yaw=0, Pitch=0.
 *   - "back":   Looking along +Z (camera at -Z). Yaw=PI, Pitch=0.
 *   - "right":  Looking along -X (camera at +X). Yaw=PI/2, Pitch=0.
 *   - "left":   Looking along +X (camera at -X). Yaw=-PI/2, Pitch=0.
 *   - "top":    Looking along -Y (camera at +Y). Yaw=0, Pitch=PITCH_LIMIT.
 *   - "bottom": Looking along +Y (camera at -Y). Yaw=0, Pitch=-PITCH_LIMIT.
 */
export function setStandardView(cam: ViewCamera, view: StandardView): ViewCamera {
  let yaw = 0;
  let pitch = 0;

  switch (view) {
    case "front":
      yaw = 0;
      pitch = 0;
      break;
    case "back":
      yaw = Math.PI;
      pitch = 0;
      break;
    case "right":
      yaw = Math.PI / 2;
      pitch = 0;
      break;
    case "left":
      yaw = -Math.PI / 2;
      pitch = 0;
      break;
    case "top":
      yaw = 0;
      pitch = PITCH_LIMIT;
      break;
    case "bottom":
      yaw = 0;
      pitch = -PITCH_LIMIT;
      break;
  }

  return Object.freeze({
    ...cam,
    yaw,
    pitch,
  });
}

/**
 * Toggles between perspective and orthographic mode, scaling distance / orthoSize
 * so the apparent size of the scene at the target point remains continuous.
 */
export function toggleOrtho(cam: ViewCamera): ViewCamera {
  if (cam.ortho) {
    // Switch to perspective: calculate distance giving equivalent visible height
    const newDistance = cam.orthoSize / (2 * Math.tan(cam.fovY / 2));
    return Object.freeze({
      ...cam,
      ortho: false,
      distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, newDistance)),
    });
  } else {
    // Switch to ortho: calculate orthoSize matching current perspective target plane
    const newOrthoSize = 2 * cam.distance * Math.tan(cam.fovY / 2);
    return Object.freeze({
      ...cam,
      ortho: true,
      orthoSize: Math.max(MIN_ORTHO_SIZE, Math.min(MAX_ORTHO_SIZE, newOrthoSize)),
    });
  }
}

/**
 * Adjusts camera target and distance/orthoSize to cleanly fit an axis-aligned bounding box.
 *
 * @param aabb Axis-aligned bounding box { min, max }
 * @param aspect Viewport aspect ratio (width / height)
 * @param margin Framing margin factor (default 1.25 for comfortable margin)
 */
export function frameBounds(
  cam: ViewCamera,
  aabb: BoundingBox3d,
  aspect = 1.0,
  margin = 1.25
): ViewCamera {
  const minX = aabb.min[0], minY = aabb.min[1], minZ = aabb.min[2];
  const maxX = aabb.max[0], maxY = aabb.max[1], maxZ = aabb.max[2];

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const sizeX = Math.max(1e-4, Math.abs(maxX - minX));
  const sizeY = Math.max(1e-4, Math.abs(maxY - minY));
  const sizeZ = Math.max(1e-4, Math.abs(maxZ - minZ));

  // Radius of bounding sphere around box
  const radius = Math.hypot(sizeX, sizeY, sizeZ) * 0.5;

  const effectiveAspect = Math.max(1e-4, aspect);
  const tanHalfFov = Math.tan(cam.fovY / 2);

  // Distance required to enclose bounding sphere in perspective
  const distY = radius / tanHalfFov;
  const distX = radius / (tanHalfFov * effectiveAspect);
  const fitDistance = Math.max(distX, distY) * margin;

  // Ortho size required to enclose bounding sphere in orthographic
  const fitOrthoSize = Math.max(sizeY, sizeX / effectiveAspect, radius * 2) * margin;

  return Object.freeze({
    ...cam,
    target: vec3(centerX, centerY, centerZ),
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, fitDistance)),
    orthoSize: Math.max(MIN_ORTHO_SIZE, Math.min(MAX_ORTHO_SIZE, fitOrthoSize)),
  });
}

/**
 * Frames the union bounding box of multiple bounding boxes.
 */
export function frameAll(
  cam: ViewCamera,
  boxes: readonly BoundingBox3d[],
  aspect = 1.0,
  margin = 1.25
): ViewCamera {
  if (boxes.length === 0) return cam;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const b of boxes) {
    if (b.min[0] < minX) minX = b.min[0];
    if (b.min[1] < minY) minY = b.min[1];
    if (b.min[2] < minZ) minZ = b.min[2];
    if (b.max[0] > maxX) maxX = b.max[0];
    if (b.max[1] > maxY) maxY = b.max[1];
    if (b.max[2] > maxZ) maxZ = b.max[2];
  }

  return frameBounds(cam, { min: vec3(minX, minY, minZ), max: vec3(maxX, maxY, maxZ) }, aspect, margin);
}

/**
 * Configures the ViewCamera to look from a document Camera object (Blender "View Camera").
 */
export function viewFromObjectCamera(
  cameraObject: Object3d,
  doc: MotionDocument
): ViewCamera {
  const camData = cameraObject.dataId ? doc.cameras?.[cameraObject.dataId] : undefined;
  const worldM = worldMatrix(doc, cameraObject.id);

  // Camera eye position is the 4th column of worldMatrix
  const eyeX = worldM[12];
  const eyeY = worldM[13];
  const eyeZ = worldM[14];

  // Camera forward in local space is -Z (glTF convention):
  // world forward = -Z_cam_col = -worldM[8..10]
  const fx = -worldM[8];
  const fy = -worldM[9];
  const fz = -worldM[10];

  const lenF = Math.hypot(fx, fy, fz) || 1.0;
  const nfx = fx / lenF;
  const nfy = fy / lenF;
  const nfz = fz / lenF;

  // Target positioned along the camera forward axis at default distance
  const defaultDist = camData?.orthoScale ?? 5.0;
  const target = vec3(
    eyeX + nfx * defaultDist,
    eyeY + nfy * defaultDist,
    eyeZ + nfz * defaultDist
  );

  // Pitch: angle with horizontal plane. Since forward = (-sinYaw*cosPitch, -sinPitch, -cosYaw*cosPitch)
  // -sinPitch = nfy => sinPitch = -nfy
  const pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.asin(-nfy)));

  // Yaw: atan2(-nfx, -nfz)
  const yaw = Math.atan2(-nfx, -nfz);

  const isOrtho = camData?.type === "orthographic";
  const fovY = camData?.fov ? degToRad(camData.fov) : degToRad(50.0);
  const orthoSize = camData?.orthoScale ?? 5.0;

  return Object.freeze({
    target,
    distance: defaultDist,
    yaw,
    pitch,
    fovY,
    ortho: isOrtho,
    orthoSize,
    near: camData?.near ?? 0.1,
    far: camData?.far ?? 1000.0,
  });
}
