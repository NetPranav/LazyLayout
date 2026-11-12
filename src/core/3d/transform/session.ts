/**
 * ============================================================================
 * 3D TRANSFORM SESSION (Phase 3D-016)
 * ============================================================================
 * Modal interactive transform session kernel (G = translate, R = rotate,
 * S = scale). Pure TypeScript, zero DOM.
 *
 * Implements Blender-compatible mouse interaction, axis/plane locking with
 * global/local toggling, typed numeric buffers, and parent-inverse preservation.
 * ============================================================================
 */

import {
  type Mat4,
  type Quat,
  type Vec3,
  compose,
  decompose,
  identity,
  invert,
  mat4From,
  multiply,
  quat,
  quatFrom,
  quatNormalize,
  transformPoint,
  vec3,
  vec3From,
} from "../math";
import type { TransformAxis, TransformMode } from "./typed";

export interface TransformSessionLocalTransform {
  location: Vec3 | ArrayLike<number>;
  rotationQuat: Quat | ArrayLike<number>;
  scale: Vec3 | ArrayLike<number>;
}

export interface TransformSessionObject {
  id: string;
  worldMatrix: Mat4 | ArrayLike<number>;
  parentWorldMatrix?: Mat4 | ArrayLike<number>;
  parentInverse?: Mat4 | ArrayLike<number>;
  local: TransformSessionLocalTransform;
}

export interface ViewCameraInfo {
  viewMatrix: Mat4 | ArrayLike<number>;
  projectionMatrix: Mat4 | ArrayLike<number>;
  viewport: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

export type TransformOrientationKind = "global" | "local" | "view";

export interface TransformSessionOptions {
  mode: TransformMode;
  objects: TransformSessionObject[];
  viewCamera: ViewCameraInfo;
  pivot: Vec3 | ArrayLike<number>;
  orientation?: TransformOrientationKind | Mat4 | ArrayLike<number>;
}

export interface CommittedTransform {
  id: string;
  location: Vec3;
  rotationQuat: Quat;
  scale: Vec3;
}

/**
 * Manages an active modal transform gesture (translate, rotate, or scale).
 */
export class TransformSession {
  readonly mode: TransformMode;
  readonly objects: TransformSessionObject[];
  readonly viewCamera: ViewCameraInfo;
  readonly pivot: Vec3;

  private _axis: TransformAxis | null = null;
  private _plane = false;
  private _space: "global" | "local" = "global";

  private _numericString = "";
  private _hasNumericInput = false;

  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;
  private _initialRadiusPx = 100;

  constructor(options: TransformSessionOptions) {
    this.mode = options.mode;
    this.objects = options.objects;
    this.viewCamera = options.viewCamera;
    this.pivot = vec3From(options.pivot);

    if (typeof options.orientation === "string") {
      this._space = options.orientation === "local" ? "local" : "global";
    }
  }

  get currentAxis(): TransformAxis | null {
    return this._axis;
  }

  get isPlaneLocked(): boolean {
    return this._plane;
  }

  get currentSpace(): "global" | "local" {
    return this._space;
  }

  /**
   * Locks transformation to a coordinate axis or its orthogonal plane.
   * Pressing the same axis again toggles between global and local orientation.
   */
  setAxis(axis: TransformAxis, options?: { plane?: boolean }): this {
    const isPlane = options?.plane ?? false;
    if (this._axis === axis && this._plane === isPlane) {
      // Toggle between global and local space on repeated press
      this._space = this._space === "global" ? "local" : "global";
    } else {
      this._axis = axis;
      this._plane = isPlane;
      this._space = "global";
    }
    return this;
  }

  /**
   * Updates mouse delta in screen pixels relative to session start.
   */
  moveMouse(dxPx: number, dyPx: number): this {
    this._mouseDeltaX = dxPx;
    this._mouseDeltaY = dyPx;
    return this;
  }

  /**
   * Appends a character ('0'-'9', '.', or '-') to the numeric buffer.
   */
  typeChar(c: string): this {
    if (c >= "0" && c <= "9") {
      this._numericString += c;
      this._hasNumericInput = true;
    } else if (c === ".") {
      if (!this._numericString.includes(".")) {
        if (this._numericString === "" || this._numericString === "-") {
          this._numericString += "0.";
        } else {
          this._numericString += ".";
        }
        this._hasNumericInput = true;
      }
    } else if (c === "-") {
      this.negate();
    }
    return this;
  }

  /**
   * Deletes the last character in the numeric input buffer.
   */
  backspace(): this {
    if (this._numericString.length > 0) {
      this._numericString = this._numericString.slice(0, -1);
      if (this._numericString === "" || this._numericString === "-") {
        this._numericString = "";
        this._hasNumericInput = false;
      }
    }
    return this;
  }

  /**
   * Toggles the sign of the numeric input buffer.
   */
  negate(): this {
    if (this._numericString.startsWith("-")) {
      this._numericString = this._numericString.slice(1);
    } else {
      this._numericString = `-${this._numericString}`;
    }
    this._hasNumericInput = this._numericString !== "" && this._numericString !== "-";
    return this;
  }

  /**
   * Returns the current typed value (e.g. 2, -1.5, 90) or mouse-driven value.
   */
  value(): number {
    if (this._hasNumericInput && this._numericString !== "" && this._numericString !== "-") {
      return parseFloat(this._numericString);
    }

    // Compute value from mouse movement
    if (this.mode === "translate") {
      const v = this.computeTranslationVector();
      return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }
    if (this.mode === "rotate") {
      return this.computeRotationAngle();
    }
    if (this.mode === "scale") {
      return this.computeScaleFactor();
    }
    return 0;
  }

  /**
   * Returns the stored numeric value (radians for rotate, metres for translate, scale ratio).
   */
  storedValue(): number {
    const val = this.value();
    if (this.mode === "rotate" && this._hasNumericInput) {
      return (val * Math.PI) / 180;
    }
    return val;
  }

  /**
   * Computes committed local transforms for all objects, converting world
   * changes through each object's parent inverse and parent world matrices.
   */
  commit(): CommittedTransform[] {
    const results: CommittedTransform[] = [];

    for (const obj of this.objects) {
      const wOld = mat4From(obj.worldMatrix);

      // Compute new world matrix for this object
      const wNew = this.computeNewWorldMatrix(obj, wOld);

      // Convert back through parent hierarchy:
      // W_obj = W_parent * parentInverse * M_local
      // => M_local = (W_parent * parentInverse)^(-1) * W_new
      let parentEff = identity();
      if (obj.parentWorldMatrix) {
        parentEff = mat4From(obj.parentWorldMatrix);
      }
      if (obj.parentInverse) {
        parentEff = multiply(parentEff, mat4From(obj.parentInverse));
      }

      const invParentEff = invert(parentEff);
      const mLocalNew = multiply(invParentEff, wNew);
      const decomp = decompose(mLocalNew);

      results.push({
        id: obj.id,
        location: decomp.location,
        rotationQuat: decomp.quat,
        scale: decomp.scale,
      });
    }

    return results;
  }

  /**
   * Cancels the session, returning the original local transforms unmodified.
   */
  cancel(): CommittedTransform[] {
    return this.objects.map((obj) => ({
      id: obj.id,
      location: vec3From(obj.local.location),
      rotationQuat: quatFrom(obj.local.rotationQuat),
      scale: vec3From(obj.local.scale),
    }));
  }

  // -------------------------------------------------------------------------
  // Internal Transform Mathematics
  // -------------------------------------------------------------------------

  private computeNewWorldMatrix(obj: TransformSessionObject, wOld: Mat4): Mat4 {
    if (this.mode === "translate") {
      const t = this.computeTranslationVector(obj);
      // Translation matrix * wOld
      const tMat = identity();
      tMat[12] = t[0];
      tMat[13] = t[1];
      tMat[14] = t[2];
      return multiply(tMat, wOld);
    }

    if (this.mode === "rotate") {
      const q = this.computeRotationQuaternion(obj);
      // Rotation around pivot: T(pivot) * R(q) * T(-pivot) * wOld
      const rMat = compose(vec3(0, 0, 0), q, vec3(1, 1, 1));
      const tPivot = identity();
      tPivot[12] = this.pivot[0];
      tPivot[13] = this.pivot[1];
      tPivot[14] = this.pivot[2];

      const tPivotNeg = identity();
      tPivotNeg[12] = -this.pivot[0];
      tPivotNeg[13] = -this.pivot[1];
      tPivotNeg[14] = -this.pivot[2];

      const step1 = multiply(tPivotNeg, wOld);
      const step2 = multiply(rMat, step1);
      return multiply(tPivot, step2);
    }

    if (this.mode === "scale") {
      const s = this.computeScaleVector(obj);
      // Scaling around pivot: T(pivot) * S * T(-pivot) * wOld
      const sMat = this.computeScaleMatrix(s, obj);
      const tPivot = identity();
      tPivot[12] = this.pivot[0];
      tPivot[13] = this.pivot[1];
      tPivot[14] = this.pivot[2];

      const tPivotNeg = identity();
      tPivotNeg[12] = -this.pivot[0];
      tPivotNeg[13] = -this.pivot[1];
      tPivotNeg[14] = -this.pivot[2];

      const step1 = multiply(tPivotNeg, wOld);
      const step2 = multiply(sMat, step1);
      return multiply(tPivot, step2);
    }

    return wOld;
  }

  /**
   * Computes translation vector in world units (metres).
   */
  private computeTranslationVector(obj?: TransformSessionObject): Vec3 {
    if (this._hasNumericInput) {
      const distance = parseFloat(this._numericString);
      if (this._axis) {
        const axisDir = this.getAxisDirection(this._axis, obj);
        if (!this._plane) {
          // Locked along single axis
          return vec3(axisDir[0] * distance, axisDir[1] * distance, axisDir[2] * distance);
        }
        // Plane lock (e.g. Shift+Z): normal is axisDir
        // If mouse moved, project mouse vector to plane and scale to magnitude;
        // else translate along first in-plane axis
        const inPlaneDir = this.getPlaneFirstAxis(this._axis, obj);
        return vec3(inPlaneDir[0] * distance, inPlaneDir[1] * distance, inPlaneDir[2] * distance);
      }
      // No axis locked: translate along camera right axis by typed distance
      const camRight = this.getCameraRight();
      return vec3(camRight[0] * distance, camRight[1] * distance, camRight[2] * distance);
    }

    // From mouse movement:
    const worldMotion = this.screenPixelsToWorld(this._mouseDeltaX, this._mouseDeltaY);
    if (!this._axis) {
      return worldMotion;
    }

    const axisDir = this.getAxisDirection(this._axis, obj);
    if (!this._plane) {
      // Project onto axis line
      const dot = worldMotion[0] * axisDir[0] + worldMotion[1] * axisDir[1] + worldMotion[2] * axisDir[2];
      return vec3(axisDir[0] * dot, axisDir[1] * dot, axisDir[2] * dot);
    }

    // Project onto plane (remove component along normal)
    const dotNormal = worldMotion[0] * axisDir[0] + worldMotion[1] * axisDir[1] + worldMotion[2] * axisDir[2];
    return vec3(
      worldMotion[0] - dotNormal * axisDir[0],
      worldMotion[1] - dotNormal * axisDir[1],
      worldMotion[2] - dotNormal * axisDir[2]
    );
  }

  /**
   * Computes rotation angle in radians around active axis or view forward.
   */
  private computeRotationAngle(): number {
    if (this._hasNumericInput) {
      const degrees = parseFloat(this._numericString);
      return (degrees * Math.PI) / 180;
    }

    // Angle from initial screen vector to current screen vector
    const v0x = this._initialRadiusPx;
    const v0y = 0;
    const v1x = this._initialRadiusPx + this._mouseDeltaX;
    const v1y = this._mouseDeltaY;

    const angle0 = Math.atan2(v0y, v0x);
    const angle1 = Math.atan2(v1y, v1x);
    return angle1 - angle0;
  }

  private computeRotationQuaternion(obj?: TransformSessionObject): Quat {
    const angle = this.computeRotationAngle();
    let axisDir: Vec3;

    if (this._axis) {
      axisDir = this.getAxisDirection(this._axis, obj);
    } else {
      // Default: rotate around camera forward vector facing the view
      axisDir = this.getCameraForward();
    }

    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    const q = quat(axisDir[0] * s, axisDir[1] * s, axisDir[2] * s, Math.cos(halfAngle));
    return quatNormalize(q);
  }

  private computeScaleFactor(): number {
    if (this._hasNumericInput) {
      return parseFloat(this._numericString);
    }

    const v0x = this._initialRadiusPx;
    const v0y = 0;
    const v1x = this._initialRadiusPx + this._mouseDeltaX;
    const v1y = this._mouseDeltaY;

    const dist0 = Math.sqrt(v0x * v0x + v0y * v0y);
    const dist1 = Math.sqrt(v1x * v1x + v1y * v1y);
    return dist0 > 0 ? dist1 / dist0 : 1;
  }

  private computeScaleVector(_obj?: TransformSessionObject): Vec3 {
    const factor = this.computeScaleFactor();

    if (!this._axis) {
      // Uniform scale
      return vec3(factor, factor, factor);
    }

    if (!this._plane) {
      // Axis-constrained scale
      if (this._axis === "X") return vec3(factor, 1, 1);
      if (this._axis === "Y") return vec3(1, factor, 1);
      return vec3(1, 1, factor);
    }

    // Plane-constrained scale: scale on the two plane axes
    if (this._axis === "X") return vec3(1, factor, factor);
    if (this._axis === "Y") return vec3(factor, 1, factor);
    return vec3(factor, factor, 1);
  }

  private computeScaleMatrix(s: Vec3, obj?: TransformSessionObject): Mat4 {
    if (this._space === "local" && this._axis) {
      // Rotate scale into object orientation
      const rot = this.getObjectRotationMatrix(obj);
      const invRot = invert(rot);
      const diag = identity();
      diag[0] = s[0];
      diag[5] = s[1];
      diag[10] = s[2];
      return multiply(multiply(rot, diag), invRot);
    }

    const diag = identity();
    diag[0] = s[0];
    diag[5] = s[1];
    diag[10] = s[2];
    return diag;
  }

  // -------------------------------------------------------------------------
  // Camera & Coordinate Helper Methods
  // -------------------------------------------------------------------------

  private getCameraRight(): Vec3 {
    const vInv = invert(mat4From(this.viewCamera.viewMatrix));
    const r = vec3(vInv[0], vInv[1], vInv[2]);
    const len = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
    return len > 0 ? vec3(r[0] / len, r[1] / len, r[2] / len) : vec3(1, 0, 0);
  }

  private getCameraUp(): Vec3 {
    const vInv = invert(mat4From(this.viewCamera.viewMatrix));
    const u = vec3(vInv[4], vInv[5], vInv[6]);
    const len = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    return len > 0 ? vec3(u[0] / len, u[1] / len, u[2] / len) : vec3(0, 1, 0);
  }

  private getCameraForward(): Vec3 {
    const vInv = invert(mat4From(this.viewCamera.viewMatrix));
    const f = vec3(-vInv[8], -vInv[9], -vInv[10]);
    const len = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    return len > 0 ? vec3(f[0] / len, f[1] / len, f[2] / len) : vec3(0, 0, -1);
  }

  private screenPixelsToWorld(dxPx: number, dyPx: number): Vec3 {
    const vMat = mat4From(this.viewCamera.viewMatrix);
    const pMat = mat4From(this.viewCamera.projectionMatrix);

    // Pivot depth in camera coordinates
    const pView = transformPoint(vMat, this.pivot);
    const depth = Math.abs(pView[2]);

    const vpW = Math.max(this.viewCamera.viewport.width, 1);
    const vpH = Math.max(this.viewCamera.viewport.height, 1);

    // Compute units per pixel from projection matrix
    const projY = pMat[5] !== 0 ? Math.abs(pMat[5]) : 1;
    const projX = pMat[0] !== 0 ? Math.abs(pMat[0]) : 1;

    // Perspective vs Orthographic check: pMat[15] === 0 indicates perspective
    const isPerspective = pMat[15] === 0;
    const unitsPerPixelY = isPerspective ? (2 * depth) / (projY * vpH) : 2 / (projY * vpH);
    const unitsPerPixelX = isPerspective ? (2 * depth) / (projX * vpW) : 2 / (projX * vpW);

    const r = this.getCameraRight();
    const u = this.getCameraUp();

    return vec3(
      dxPx * unitsPerPixelX * r[0] + dyPx * unitsPerPixelY * u[0],
      dxPx * unitsPerPixelX * r[1] + dyPx * unitsPerPixelY * u[1],
      dxPx * unitsPerPixelX * r[2] + dyPx * unitsPerPixelY * u[2]
    );
  }

  private getAxisDirection(axis: TransformAxis, obj?: TransformSessionObject): Vec3 {
    const targetObj = obj ?? this.objects[0];

    if (this._space === "local" && targetObj) {
      const wMat = mat4From(targetObj.worldMatrix);
      let dir: Vec3;
      if (axis === "X") dir = vec3(wMat[0], wMat[1], wMat[2]);
      else if (axis === "Y") dir = vec3(wMat[4], wMat[5], wMat[6]);
      else dir = vec3(wMat[8], wMat[9], wMat[10]);

      const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
      return len > 0 ? vec3(dir[0] / len, dir[1] / len, dir[2] / len) : vec3(1, 0, 0);
    }

    // Global axis
    if (axis === "X") return vec3(1, 0, 0);
    if (axis === "Y") return vec3(0, 1, 0);
    return vec3(0, 0, 1);
  }

  private getPlaneFirstAxis(axis: TransformAxis, obj?: TransformSessionObject): Vec3 {
    // For Shift+Z (XY plane), first axis is X
    // For Shift+Y (XZ plane), first axis is X
    // For Shift+X (YZ plane), first axis is Y
    if (axis === "Z") return this.getAxisDirection("X", obj);
    if (axis === "Y") return this.getAxisDirection("X", obj);
    return this.getAxisDirection("Y", obj);
  }

  private getObjectRotationMatrix(obj?: TransformSessionObject): Mat4 {
    const target = obj ?? this.objects[0];
    if (!target) return identity();
    const w = mat4From(target.worldMatrix);
    const d = decompose(w);
    return compose(vec3(0, 0, 0), d.quat, vec3(1, 1, 1));
  }
}

/**
 * Convenience factory for TransformSession.
 */
export function createTransformSession(options: TransformSessionOptions): TransformSession {
  return new TransformSession(options);
}
