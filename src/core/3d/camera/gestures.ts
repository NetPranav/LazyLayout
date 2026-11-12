/**
 * ============================================================================
 * 3D VIEWPORT GESTURES & INPUT MAPPING (Phase 3D-014)
 * ============================================================================
 * Pure TypeScript gesture mapping for 3D viewport navigation:
 *   - Mouse:
 *       Middle drag:             Orbit
 *       Shift + Middle drag:     Pan
 *       Ctrl + Middle drag:      Dolly
 *       Wheel:                   Dolly
 *   - Trackpad:
 *       Two-finger scroll:       Orbit
 *       Shift + Two-finger:      Pan
 *       Ctrl + Two-finger:       Dolly
 *       Pinch:                   Dolly
 *   - Touch:
 *       One-finger drag:         Orbit
 *       Two-finger drag:         Pan
 *       Two-finger pinch:        Dolly (or combined Pan + Pinch)
 *
 * Core purity: operates on abstract input events with zero DOM or React coupling.
 * ============================================================================
 */

export interface MouseGestureEvent {
  readonly device: "mouse";
  readonly button: number; // 0: left, 1: middle, 2: right
  readonly dx: number;
  readonly dy: number;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
}

export interface WheelGestureEvent {
  readonly device: "wheel";
  readonly deltaX?: number;
  readonly deltaY: number;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
}

export interface TrackpadGestureEvent {
  readonly device: "trackpad";
  readonly deltaX: number;
  readonly deltaY: number;
  readonly pinch?: boolean;
  readonly scale?: number; // >1 zoom out, <1 zoom in
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
}

export interface TouchPoint {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface TouchGestureEvent {
  readonly device: "touch";
  readonly touches: readonly TouchPoint[];
  readonly prevTouches?: readonly TouchPoint[];
  readonly dx?: number;
  readonly dy?: number;
  readonly pinchDelta?: number;
}

export type GestureEvent =
  | MouseGestureEvent
  | WheelGestureEvent
  | TrackpadGestureEvent
  | TouchGestureEvent;

export type NavigationActionType = "orbit" | "pan" | "dolly" | "pan_pinch" | "none";

export interface NavigationDelta {
  readonly action: NavigationActionType;
  readonly dx: number;
  readonly dy: number;
  readonly dollyDelta: number;
}

export interface GestureSensitivity {
  readonly orbit: number;
  readonly pan: number;
  readonly wheelDolly: number;
  readonly mouseDolly: number;
  readonly pinchDolly: number;
}

export const DEFAULT_SENSITIVITY: GestureSensitivity = Object.freeze({
  orbit: 0.005,
  pan: 1.0,
  wheelDolly: 0.0015,
  mouseDolly: 0.005,
  pinchDolly: 1.0,
});

/**
 * Maps an input gesture event to a viewport navigation delta.
 */
export function navigationFromGesture(
  event: GestureEvent,
  sensitivity: GestureSensitivity = DEFAULT_SENSITIVITY
): NavigationDelta {
  switch (event.device) {
    case "mouse": {
      // Middle button is button 1
      if (event.button !== 1) {
        return { action: "none", dx: 0, dy: 0, dollyDelta: 0 };
      }

      if (event.shiftKey) {
        // Shift + Middle: Pan
        return {
          action: "pan",
          dx: event.dx * sensitivity.pan,
          dy: event.dy * sensitivity.pan,
          dollyDelta: 0,
        };
      }

      if (event.ctrlKey) {
        // Ctrl + Middle: Dolly (vertical motion drives distance)
        return {
          action: "dolly",
          dx: 0,
          dy: 0,
          dollyDelta: event.dy * sensitivity.mouseDolly,
        };
      }

      // Middle alone: Orbit (dx -> yaw, dy -> pitch)
      return {
        action: "orbit",
        dx: event.dx * sensitivity.orbit,
        dy: event.dy * sensitivity.orbit,
        dollyDelta: 0,
      };
    }

    case "wheel": {
      // Wheel: Dolly
      return {
        action: "dolly",
        dx: 0,
        dy: 0,
        dollyDelta: event.deltaY * sensitivity.wheelDolly,
      };
    }

    case "trackpad": {
      if (event.pinch) {
        // Trackpad pinch: Dolly
        const scale = event.scale ?? 1.0;
        return {
          action: "dolly",
          dx: 0,
          dy: 0,
          dollyDelta: Math.log(Math.max(1e-4, scale)) * sensitivity.pinchDolly,
        };
      }

      if (event.shiftKey) {
        // Shift + Trackpad scroll: Pan
        return {
          action: "pan",
          dx: event.deltaX * sensitivity.pan,
          dy: event.deltaY * sensitivity.pan,
          dollyDelta: 0,
        };
      }

      if (event.ctrlKey) {
        // Ctrl + Trackpad scroll: Dolly
        return {
          action: "dolly",
          dx: 0,
          dy: 0,
          dollyDelta: event.deltaY * sensitivity.wheelDolly,
        };
      }

      // Trackpad two-finger scroll: Orbit
      return {
        action: "orbit",
        dx: event.deltaX * sensitivity.orbit,
        dy: event.deltaY * sensitivity.orbit,
        dollyDelta: 0,
      };
    }

    case "touch": {
      const touches = event.touches;

      if (touches.length === 1) {
        // Single touch: Orbit
        let dx = event.dx ?? 0;
        let dy = event.dy ?? 0;

        if (event.prevTouches && event.prevTouches.length >= 1) {
          dx = touches[0].x - event.prevTouches[0].x;
          dy = touches[0].y - event.prevTouches[0].y;
        }

        return {
          action: "orbit",
          dx: dx * sensitivity.orbit,
          dy: dy * sensitivity.orbit,
          dollyDelta: 0,
        };
      }

      if (touches.length >= 2) {
        // Two touches: Pan + Pinch
        let midDx = event.dx ?? 0;
        let midDy = event.dy ?? 0;
        let dollyDelta = 0;

        if (event.prevTouches && event.prevTouches.length >= 2) {
          const t0 = touches[0];
          const t1 = touches[1];
          const p0 = event.prevTouches[0];
          const p1 = event.prevTouches[1];

          const currMidX = (t0.x + t1.x) * 0.5;
          const currMidY = (t0.y + t1.y) * 0.5;
          const prevMidX = (p0.x + p1.x) * 0.5;
          const prevMidY = (p0.y + p1.y) * 0.5;

          midDx = currMidX - prevMidX;
          midDy = currMidY - prevMidY;

          const currDist = Math.hypot(t0.x - t1.x, t0.y - t1.y);
          const prevDist = Math.hypot(p0.x - p1.x, p0.y - p1.y);

          if (prevDist > 1e-4) {
            // Distance ratio: if distance increases (spread fingers), currDist/prevDist > 1 (zoom in => dolly < 0)
            dollyDelta = -Math.log(currDist / prevDist) * sensitivity.pinchDolly;
          }
        } else if (event.pinchDelta !== undefined) {
          dollyDelta = event.pinchDelta * sensitivity.pinchDolly;
        }

        // If significant pan motion or pinch
        const hasPan = Math.abs(midDx) > 1e-4 || Math.abs(midDy) > 1e-4;
        const hasPinch = Math.abs(dollyDelta) > 1e-4;

        if (hasPan && hasPinch) {
          return {
            action: "pan_pinch",
            dx: midDx * sensitivity.pan,
            dy: midDy * sensitivity.pan,
            dollyDelta,
          };
        } else if (hasPinch) {
          return {
            action: "dolly",
            dx: 0,
            dy: 0,
            dollyDelta,
          };
        } else {
          return {
            action: "pan",
            dx: midDx * sensitivity.pan,
            dy: midDy * sensitivity.pan,
            dollyDelta: 0,
          };
        }
      }

      return { action: "none", dx: 0, dy: 0, dollyDelta: 0 };
    }
  }
}
