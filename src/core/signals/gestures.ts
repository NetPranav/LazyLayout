export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export interface GestureFrameInput {
  readonly time: number;
  readonly down: boolean;
  readonly x: number;
  readonly y: number;
  /** Optional two-finger contact points for pinch and two-finger rotate. */
  readonly touches?: readonly [TouchPoint, TouchPoint];
  /** Keyboard equivalent input for accessibility parity (Phase 146). */
  readonly keyAction?: "holdKey" | "swipeLeft" | "swipeRight" | "swipeUp" | "swipeDown" | "zoomIn" | "zoomOut" | "rotateCW" | "rotateCCW" | "doubleActivate";
}

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface GestureOutput {
  readonly holdProgress: number;
  readonly longPressFired: boolean;
  readonly doubleTapFired: boolean;
  readonly swipe: { readonly direction: SwipeDirection; readonly distancePx: number } | null;
  readonly fling: { readonly vx: number; readonly vy: number; readonly speedPxPerSec: number } | null;
  readonly slingshot: {
    readonly pullX: number;
    readonly pullY: number;
    readonly tension: number;
    readonly launched: boolean;
    readonly launchVx: number;
    readonly launchVy: number;
  };
  readonly pinchScale: number;
  readonly twoFingerRotateDeg: number;
}

export interface GestureConfig {
  readonly holdDurationSec?: number;
  readonly doubleTapWindowSec?: number;
  readonly doubleTapMaxDistPx?: number;
  readonly swipeMinDistPx?: number;
  readonly flingMinSpeedPxPerSec?: number;
  readonly maxPullPx?: number;
}

/**
 * Deterministic multi-gesture recognizer emitting hold progress, long press,
 * double tap, swipe, fling, slingshot pull-and-release, pinch scale, and
 * two-finger rotation (with keyboard parity).
 */
export function createGestureRecognizer(config: GestureConfig = {}): {
  step(input: GestureFrameInput): GestureOutput;
  reset(): void;
} {
  const holdDur = Math.max(0.05, config.holdDurationSec ?? 0.6);
  const dblWindow = config.doubleTapWindowSec ?? 0.35;
  const dblDist = config.doubleTapMaxDistPx ?? 24;
  const swipeMin = config.swipeMinDistPx ?? 40;
  const flingMin = config.flingMinSpeedPxPerSec ?? 450;
  const maxPull = Math.max(10, config.maxPullPx ?? 120);

  let isDown = false;
  let downTime = 0;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;
  let prevTime = 0;
  let lastVx = 0;
  let lastVy = 0;
  let longPressEmitted = false;
  let lastTapTime = -999;
  let lastTapX = 0;
  let lastTapY = 0;

  let baseTouchDist: number | null = null;
  let baseTouchAngle: number | null = null;
  let pinchScale = 1;
  let twoFingerRotateDeg = 0;
  let keyHoldProgress = 0;

  const reset = () => {
    isDown = false;
    downTime = 0;
    longPressEmitted = false;
    lastTapTime = -999;
    baseTouchDist = null;
    baseTouchAngle = null;
    pinchScale = 1;
    twoFingerRotateDeg = 0;
    keyHoldProgress = 0;
  };

  const step = (input: GestureFrameInput): GestureOutput => {
    let longPressFired = false;
    let doubleTapFired = false;
    let swipe: GestureOutput["swipe"] = null;
    let fling: GestureOutput["fling"] = null;
    let launched = false;
    let launchVx = 0;
    let launchVy = 0;
    let pullX = 0;
    let pullY = 0;
    let tension = 0;

    // Dual-touch pinch & rotate
    if (input.touches) {
      const [a, b] = input.touches;
      const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (baseTouchDist === null || baseTouchAngle === null) {
        baseTouchDist = dist;
        baseTouchAngle = angle;
      } else {
        pinchScale = Number((dist / baseTouchDist).toFixed(4));
        twoFingerRotateDeg = Number((angle - baseTouchAngle).toFixed(3));
      }
    } else {
      baseTouchDist = null;
      baseTouchAngle = null;
    }

    // Keyboard equivalents (grammar 6.11)
    if (input.keyAction) {
      switch (input.keyAction) {
        case "holdKey":
          keyHoldProgress = Math.min(1, keyHoldProgress + Math.max(0.01, input.time - prevTime) / holdDur);
          if (keyHoldProgress >= 1 && !longPressEmitted) {
            longPressEmitted = true;
            longPressFired = true;
          }
          break;
        case "swipeLeft":
          swipe = { direction: "left", distancePx: swipeMin };
          break;
        case "swipeRight":
          swipe = { direction: "right", distancePx: swipeMin };
          break;
        case "swipeUp":
          swipe = { direction: "up", distancePx: swipeMin };
          break;
        case "swipeDown":
          swipe = { direction: "down", distancePx: swipeMin };
          break;
        case "zoomIn":
          pinchScale = Number((pinchScale * 1.1).toFixed(4));
          break;
        case "zoomOut":
          pinchScale = Number((pinchScale / 1.1).toFixed(4));
          break;
        case "rotateCW":
          twoFingerRotateDeg += 15;
          break;
        case "rotateCCW":
          twoFingerRotateDeg -= 15;
          break;
        case "doubleActivate":
          doubleTapFired = true;
          break;
      }
    } else if (!input.down) {
      keyHoldProgress = 0;
    }

    let holdProgress = keyHoldProgress;

    if (input.down && !isDown) {
      isDown = true;
      downTime = input.time;
      startX = input.x;
      startY = input.y;
      prevX = input.x;
      prevY = input.y;
      lastVx = 0;
      lastVy = 0;
      longPressEmitted = false;
    } else if (input.down && isDown) {
      const dt = Math.max(1 / 240, input.time - prevTime);
      lastVx = (input.x - prevX) / dt;
      lastVy = (input.y - prevY) / dt;
      prevX = input.x;
      prevY = input.y;

      const heldFor = Math.max(0, input.time - downTime);
      holdProgress = Math.min(1, heldFor / holdDur);
      if (holdProgress >= 1 && !longPressEmitted) {
        longPressEmitted = true;
        longPressFired = true;
      }

      pullX = input.x - startX;
      pullY = input.y - startY;
      tension = Math.min(1, Math.hypot(pullX, pullY) / maxPull);
    } else if (!input.down && isDown) {
      isDown = false;
      const dx = input.x - startX;
      const dy = input.y - startY;
      const dist = Math.hypot(dx, dy);
      const speed = Math.hypot(lastVx, lastVy);

      // A press that became a long press is not a tap, so it can't be half of a double-tap.
      const wasTap = dist < dblDist && !longPressEmitted;
      if (wasTap && input.time - lastTapTime <= dblWindow && Math.hypot(input.x - lastTapX, input.y - lastTapY) < dblDist) {
        doubleTapFired = true;
        lastTapTime = -999;
      } else if (wasTap) {
        lastTapTime = input.time;
        lastTapX = input.x;
        lastTapY = input.y;
      }

      if (dist >= swipeMin) {
        const direction: SwipeDirection =
          Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up";
        swipe = { direction, distancePx: dist };
      }

      if (speed >= flingMin) {
        fling = { vx: lastVx, vy: lastVy, speedPxPerSec: speed };
      }

      const relTension = Math.min(1, dist / maxPull);
      if (relTension > 0.15) {
        launched = true;
        launchVx = -dx * 6;
        launchVy = -dy * 6;
      }
      longPressEmitted = false;
    }

    prevTime = input.time;

    return {
      holdProgress,
      longPressFired,
      doubleTapFired,
      swipe,
      fling,
      slingshot: { pullX, pullY, tension, launched, launchVx, launchVy },
      pinchScale,
      twoFingerRotateDeg,
    };
  };

  return { step, reset };
}
