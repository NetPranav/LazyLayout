/**
 * ============================================================================
 * 3D UNITS, CONVENTIONS & CAMERA PROJECTION
 * ============================================================================
 * Pure TypeScript implementation for coordinate system conventions, unit
 * scaling (metres <-> pixels), angle formatting, and 2D-to-3D projection.
 *
 * glTF 2.0 Document Conventions:
 *   - Coordinate System: Right-handed
 *   - Up Axis:           +Y is up
 *   - Forward Axis:      -Z is forward (into the screen / camera look direction)
 *   - Right Axis:        +X is right
 *   - Distance Unit:     Metres (SI units)
 *   - Angle Unit:        Radians for document storage; Degrees for UI display
 * ============================================================================
 */

import type { Scene3d, Transform3d } from "../document/scene3d";
import {
  type Mat4,
  compose,
  invertAffine,
  transformPoint,
} from "./math";

// ---------------------------------------------------------------------------
// Document Conventions & Constants
// ---------------------------------------------------------------------------

/**
 * Canonical document conventions conforming to the glTF 2.0 specification.
 */
export const COORDINATE_SYSTEM = {
  up: "+Y",
  forward: "-Z",
  right: "+X",
  handedness: "right",
  unit: "metres",
  angleUnit: "radians",
} as const;

export const UP_AXIS = "Y" as const;
export const FORWARD_AXIS = "-Z" as const;
export const RIGHT_AXIS = "+X" as const;
export const HANDEDNESS = "right" as const;
export const DISTANCE_UNIT = "metres" as const;
export const STORAGE_ANGLE_UNIT = "radians" as const;
export const UI_ANGLE_UNIT = "degrees" as const;

/**
 * Default pixel density in 3D: 100 pixels per metre.
 * 1 metre = 100 screen pixels; 1 pixel = 0.01 metres (1 cm).
 */
export const DEFAULT_PX_PER_METRE = 100;
export const PX_PER_METRE = DEFAULT_PX_PER_METRE;

// ---------------------------------------------------------------------------
// Unit Conversions: Pixels <-> Metres
// ---------------------------------------------------------------------------

/**
 * Resolves the effective pixels-per-metre density from a scene or optional override.
 */
export function getPxPerMetre(sceneOrPpm?: Scene3d | number | null): number {
  if (typeof sceneOrPpm === "number" && sceneOrPpm > 0) {
    return sceneOrPpm;
  }
  if (typeof sceneOrPpm === "object" && sceneOrPpm !== null) {
    return sceneOrPpm.settings?.pxPerMetre ?? DEFAULT_PX_PER_METRE;
  }
  return DEFAULT_PX_PER_METRE;
}

/**
 * Converts screen/canvas pixels to document metres.
 */
export function pxToMetres(px: number, pxPerMetre?: Scene3d | number | null): number {
  const ppm = getPxPerMetre(pxPerMetre);
  return px / ppm;
}

/**
 * Converts document metres to screen/canvas pixels.
 */
export function metresToPx(metres: number, pxPerMetre?: Scene3d | number | null): number {
  const ppm = getPxPerMetre(pxPerMetre);
  return metres * ppm;
}

// ---------------------------------------------------------------------------
// Angle Conversions: Radians (Storage) <-> Degrees (UI)
// ---------------------------------------------------------------------------

const DEG_TO_RAD_FACTOR = Math.PI / 180;
const RAD_TO_DEG_FACTOR = 180 / Math.PI;

/**
 * Converts degrees to radians for internal document storage.
 */
export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD_FACTOR;
}

/**
 * Converts radians to degrees for UI presentation.
 */
export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG_FACTOR;
}

export interface FormatAngleOptions {
  decimals?: number;
  unit?: boolean;
}

/**
 * Formats an angle stored in radians for UI display in degrees (e.g. "90°", "45.5°").
 *
 * @param radians Angle in radians
 * @param optionsOrDecimals Optional decimal precision or options object
 */
export function formatAngle(
  radians: number,
  optionsOrDecimals?: number | FormatAngleOptions
): string {
  let decimals: number | undefined = undefined;
  let unit = true;

  if (typeof optionsOrDecimals === "number") {
    decimals = optionsOrDecimals;
  } else if (typeof optionsOrDecimals === "object" && optionsOrDecimals !== null) {
    decimals = optionsOrDecimals.decimals;
    if (optionsOrDecimals.unit !== undefined) {
      unit = optionsOrDecimals.unit;
    }
  }

  const deg = radToDeg(radians);

  let numStr: string;
  if (decimals !== undefined) {
    const fixed = deg.toFixed(decimals);
    numStr = Object.is(Number(fixed), -0) ? (0).toFixed(decimals) : fixed;
  } else {
    // Default: clean rounding up to 2 decimal places, trimming trailing zeroes
    const rounded = Math.round(deg * 100) / 100;
    numStr = `${Object.is(rounded, -0) ? 0 : rounded}`;
  }

  return unit ? `${numStr}°` : numStr;
}

// ---------------------------------------------------------------------------
// 2D Frame to 3D Conversion & Camera Setup
// ---------------------------------------------------------------------------

export interface PlaneSize3D {
  width: number;
  height: number;
  [Symbol.iterator](): Iterator<number>;
}

/**
 * Computes the 3D plane dimensions in metres for a 2D frame sized in pixels.
 */
export function frameTo3D(
  width: number,
  height: number,
  pxPerMetre: Scene3d | number = DEFAULT_PX_PER_METRE
): PlaneSize3D {
  const w = pxToMetres(width, pxPerMetre);
  const h = pxToMetres(height, pxPerMetre);
  return {
    width: w,
    height: h,
    *[Symbol.iterator]() {
      yield w;
      yield h;
    },
  };
}

export interface PerspectiveCameraInfo {
  id: string;
  name?: string;
  type: "perspective";
  fov: number; // in degrees, conforming to Camera3d schema
  fovY: number; // in radians, for mathematical projection
  fovRad: number; // alias for fovY
  near: number;
  far: number;
  position: [number, number, number];
  rotationQuat: [number, number, number, number];
  distance: number;
  transform: Transform3d;
  planeSize: { width: number; height: number };
}

/**
 * Creates a default perspective camera situated on +Z looking at -Z towards (0,0,0)
 * at the exact distance where a plane of (width x height) pixels placed at z=0
 * projects to exactly (width x height) pixels on a viewport of that size.
 *
 * Math:
 *   Plane height in metres: H = height / pxPerMetre
 *   Visible height at distance d: H = 2 * d * tan(fovY / 2)
 *   Solving for distance: d = H / (2 * tan(fovY / 2))
 *
 * @param width Viewport and frame width in pixels
 * @param height Viewport and frame height in pixels
 * @param pxPerMetre Pixel density (default 100)
 * @param fovY Vertical field of view (in radians if <= PI, in degrees if > PI, defaults to 50°)
 */
export function defaultCameraFor(
  width: number,
  height: number,
  pxPerMetre: Scene3d | number = DEFAULT_PX_PER_METRE,
  fovY: number = 50
): PerspectiveCameraInfo {
  const ppm = getPxPerMetre(pxPerMetre);
  const plane = frameTo3D(width, height, ppm);

  // Normalize fovY: if <= PI, treat as radians; if > PI, treat as degrees
  let fovRad: number;
  let fovDeg: number;
  if (fovY <= Math.PI) {
    fovRad = fovY;
    fovDeg = radToDeg(fovY);
  } else {
    fovDeg = fovY;
    fovRad = degToRad(fovY);
  }

  // Camera distance required for plane height to match viewport height
  const distance = plane.height / (2 * Math.tan(fovRad / 2));

  const position: [number, number, number] = [0, 0, distance];
  const rotationQuat: [number, number, number, number] = [0, 0, 0, 1];

  return {
    id: "camera_default",
    name: "Default Camera",
    type: "perspective",
    fov: fovDeg,
    fovY: fovRad,
    fovRad,
    near: 0.1,
    far: 1000,
    position,
    rotationQuat,
    distance,
    transform: {
      location: position,
      rotationQuat,
      scale: [1, 1, 1],
    },
    planeSize: {
      width: plane.width,
      height: plane.height,
    },
  };
}

export interface ScreenPoint {
  x: number;
  y: number;
  z: number;
  [Symbol.iterator](): Iterator<number>;
}

export interface CameraLike {
  fov?: number;
  fovY?: number;
  fovRad?: number;
  near?: number;
  far?: number;
  position?: ArrayLike<number>;
  rotationQuat?: ArrayLike<number>;
  location?: ArrayLike<number>;
  transform?: {
    location?: ArrayLike<number>;
    rotationQuat?: ArrayLike<number>;
    scale?: ArrayLike<number>;
  };
  viewMatrix?: Mat4;
}

/**
 * Projects a 3D world coordinate point onto 2D screen/viewport pixels.
 *
 * Top-left of the viewport is (0, 0), and bottom-right is (viewportW, viewportH).
 * Returns { x, y, z } where x and y are in pixels, and z is the NDC depth.
 */
export function projectToScreen(
  camera: CameraLike,
  viewportW: number,
  viewportH: number,
  point: ArrayLike<number>
): ScreenPoint {
  // 1. Determine view matrix
  let viewM: Mat4;
  if (camera.viewMatrix) {
    viewM = camera.viewMatrix;
  } else {
    const loc =
      camera.position ??
      camera.transform?.location ??
      camera.location ??
      [0, 0, 0];
    const rot =
      camera.rotationQuat ??
      camera.transform?.rotationQuat ??
      [0, 0, 0, 1];
    const camWorld = compose(loc, rot, [1, 1, 1]);
    viewM = invertAffine(camWorld);
  }

  // 2. Transform point to camera coordinates
  const pCam = transformPoint(viewM, point);

  // 3. Perspective projection
  let fovRad = camera.fovY ?? camera.fovRad;
  if (fovRad === undefined) {
    if (camera.fov !== undefined) {
      fovRad = camera.fov <= Math.PI ? camera.fov : degToRad(camera.fov);
    } else {
      fovRad = degToRad(50);
    }
  }

  const aspect = viewportW / viewportH;
  // Depth in front of camera (-Z in camera space)
  const depth = -pCam[2];
  const safeDepth = Math.abs(depth) < 1e-12 ? (depth < 0 ? -1e-12 : 1e-12) : depth;

  const tanHalfFov = Math.tan(fovRad / 2);
  const xNdc = pCam[0] / (safeDepth * aspect * tanHalfFov);
  const yNdc = pCam[1] / (safeDepth * tanHalfFov);

  // Depth in NDC coordinates [-1, 1]
  const near = camera.near ?? 0.1;
  const far = camera.far ?? 1000;
  const zNdc = (-(far + near) * safeDepth + 2 * far * near) / ((far - near) * safeDepth);

  // 4. Map NDC [-1, 1] to screen pixel coordinates [0, viewport]
  const screenX = (xNdc + 1) * (viewportW / 2);
  const screenY = (1 - yNdc) * (viewportH / 2);

  return {
    x: screenX,
    y: screenY,
    z: zNdc,
    *[Symbol.iterator]() {
      yield screenX;
      yield screenY;
    },
  };
}
