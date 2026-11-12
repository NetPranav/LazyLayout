/**
 * ============================================================================
 * 3D CAMERA NAVIGATION TAPE (Phase 3D-014)
 * ============================================================================
 * Replayable deterministic sequence of camera operations:
 *   - orbit:       angular step in yaw and pitch
 *   - pan:         planar translation of target
 *   - dolly:       distance scale
 *   - view:        standard view alignment ("front", "back", "left", etc.)
 *   - frame:       bounding box framing
 *   - ortho:       orthographic / perspective mode toggle
 *
 * `runTape(cam0, tape)` runs the tape purely and immutably.
 * ============================================================================
 */

import {
  type BoundingBox3d,
  type StandardView,
  type ViewCamera,
  dolly,
  flyStep,
  frameBounds,
  orbit,
  pan,
  setStandardView,
  toggleOrtho,
  zoomToPoint,
} from "./viewCamera";

export type TapeStep =
  | { readonly kind: "orbit"; readonly dx: number; readonly dy: number }
  | {
      readonly kind: "pan";
      readonly dx: number;
      readonly dy: number;
      readonly viewportH?: number;
    }
  | { readonly kind: "dolly"; readonly delta: number }
  | { readonly kind: "view"; readonly view: StandardView }
  | {
      readonly kind: "frame";
      readonly aabb: BoundingBox3d;
      readonly aspect?: number;
      readonly margin?: number;
    }
  | { readonly kind: "ortho"; readonly ortho?: boolean }
  | {
      readonly kind: "fly";
      readonly dir: { readonly forward: number; readonly right: number; readonly up: number };
      readonly dt: number;
      readonly speed: number;
    }
  | {
      readonly kind: "zoom_to_point";
      readonly factor: number;
      readonly screenX: number;
      readonly screenY: number;
      readonly viewportW: number;
      readonly viewportH: number;
    };

/**
 * Replays an array of navigation steps sequentially from an initial ViewCamera.
 */
export function runTape(
  cam0: ViewCamera,
  tape: readonly TapeStep[]
): ViewCamera {
  let curr = cam0;

  for (const step of tape) {
    switch (step.kind) {
      case "orbit":
        curr = orbit(curr, step.dx, step.dy);
        break;

      case "pan":
        curr = pan(curr, step.dx, step.dy, step.viewportH ?? 1000);
        break;

      case "dolly":
        curr = dolly(curr, step.delta);
        break;

      case "view":
        curr = setStandardView(curr, step.view);
        break;

      case "frame":
        curr = frameBounds(curr, step.aabb, step.aspect ?? 1.0, step.margin ?? 1.25);
        break;

      case "ortho":
        if (step.ortho === undefined) {
          curr = toggleOrtho(curr);
        } else if (curr.ortho !== step.ortho) {
          curr = toggleOrtho(curr);
        }
        break;

      case "fly":
        curr = flyStep(curr, step.dir, step.dt, step.speed);
        break;

      case "zoom_to_point":
        curr = zoomToPoint(
          curr,
          step.factor,
          step.screenX,
          step.screenY,
          step.viewportW,
          step.viewportH
        );
        break;
    }
  }

  return curr;
}
