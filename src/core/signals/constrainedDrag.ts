export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface DragBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ConstrainedDragConfig {
  readonly axis?: "both" | "x" | "y";
  readonly home?: Point2;
  readonly bounds?: DragBounds;
  readonly path?: readonly Point2[];
  /** 0 = hard clamp at bounds, >0 (e.g. 0.55) = rubber-band overscroll resistance. */
  readonly rubberBand?: number;
  readonly rubberBandDimension?: number;
  readonly snapPoints?: readonly Point2[];
  readonly friction?: number;
  readonly returnHome?: boolean;
  /** Spring rate back home or toward snap target. */
  readonly settleSpeed?: number;
}

export interface ConstrainedDragState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly dragging: boolean;
  /** 0..1 normalized progress across bounds or polyline path. */
  readonly progress: number;
  readonly snappedIndex: number;
}

export function applyRubberBand(value: number, min: number, max: number, dim = 200, coeff = 0.55): number {
  if (value >= min && value <= max) return value;
  if (coeff <= 0) return Math.max(min, Math.min(max, value));
  const excess = value < min ? min - value : value - max;
  const damped = (excess * coeff * dim) / (dim + coeff * excess);
  return value < min ? min - damped : max + damped;
}

export function projectPointOnPolyline(point: Point2, path: readonly Point2[]): {
  readonly x: number;
  readonly y: number;
  readonly progress: number;
} {
  if (path.length === 0) return { x: point.x, y: point.y, progress: 0 };
  if (path.length === 1) return { x: path[0]!.x, y: path[0]!.y, progress: 0 };

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const len = Math.hypot(path[i + 1]!.x - path[i]!.x, path[i + 1]!.y - path[i]!.y);
    segLens.push(len);
    totalLen += len;
  }

  let bestDist = Infinity;
  let bestX = path[0]!.x;
  let bestY = path[0]!.y;
  let bestProgress = 0;
  let accLen = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 1e-9 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq)) : 0;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = Math.hypot(point.x - px, point.y - py);
    if (d < bestDist) {
      bestDist = d;
      bestX = px;
      bestY = py;
      bestProgress = totalLen > 0 ? (accLen + segLens[i]! * t) / totalLen : 0;
    }
    accLen += segLens[i]!;
  }

  return { x: bestX, y: bestY, progress: Math.max(0, Math.min(1, bestProgress)) };
}

/**
 * Stateful constrained drag controller with axis locks, bounds, rubber-banding,
 * polyline path projection, snap points, momentum friction, return-home spring,
 * progress signal output, and keyboard nudge parity.
 */
export function createConstrainedDragController(config: ConstrainedDragConfig = {}): {
  stepPointer(down: boolean, pointerX: number, pointerY: number, dt: number): ConstrainedDragState;
  nudgeByKey(direction: "left" | "right" | "up" | "down", stepPx?: number): ConstrainedDragState;
  readonly state: ConstrainedDragState;
  reset(): void;
} {
  const axis = config.axis ?? "both";
  const home = config.home ?? { x: config.bounds?.minX ?? 0, y: config.bounds?.minY ?? 0 };
  const friction = config.friction ?? 6;
  const settleSpeed = config.settleSpeed ?? 14;
  const rubberCoeff = config.rubberBand ?? 0;
  const rubberDim = config.rubberBandDimension ?? 200;

  let x = home.x;
  let y = home.y;
  let vx = 0;
  let vy = 0;
  let dragging = false;
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let prevX = x;
  let prevY = y;
  let targetX = home.x;
  let targetY = home.y;
  let snappedIndex = -1;

  const computeProgress = (cx: number, cy: number): number => {
    if (config.path && config.path.length >= 2) {
      return projectPointOnPolyline({ x: cx, y: cy }, config.path).progress;
    }
    if (config.bounds) {
      const spanX = config.bounds.maxX - config.bounds.minX;
      const spanY = config.bounds.maxY - config.bounds.minY;
      if (axis === "y" || (spanX <= 1e-6 && spanY > 1e-6)) {
        return spanY > 0 ? Math.max(0, Math.min(1, (cy - config.bounds.minY) / spanY)) : 0;
      }
      return spanX > 0 ? Math.max(0, Math.min(1, (cx - config.bounds.minX) / spanX)) : 0;
    }
    return 0;
  };

  const constrain = (rawX: number, rawY: number, allowRubberBand: boolean): Point2 => {
    let cx = axis === "y" ? home.x : rawX;
    let cy = axis === "x" ? home.y : rawY;
    if (config.path && config.path.length >= 2) {
      return projectPointOnPolyline({ x: cx, y: cy }, config.path);
    }
    if (config.bounds) {
      const coeff = allowRubberBand ? rubberCoeff : 0;
      cx = applyRubberBand(cx, config.bounds.minX, config.bounds.maxX, rubberDim, coeff);
      cy = applyRubberBand(cy, config.bounds.minY, config.bounds.maxY, rubberDim, coeff);
    }
    return { x: cx, y: cy };
  };

  const pickReleaseTarget = (cx: number, cy: number): void => {
    if (config.snapPoints && config.snapPoints.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      config.snapPoints.forEach((pt, idx) => {
        const d = Math.hypot(pt.x - cx, pt.y - cy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      snappedIndex = bestIdx;
      targetX = config.snapPoints[bestIdx]!.x;
      targetY = config.snapPoints[bestIdx]!.y;
      return;
    }
    snappedIndex = -1;
    if (config.returnHome) {
      targetX = home.x;
      targetY = home.y;
    }
  };

  const snapshot = (): ConstrainedDragState => ({
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    vx: Number(vx.toFixed(4)),
    vy: Number(vy.toFixed(4)),
    dragging,
    progress: Number(computeProgress(x, y).toFixed(4)),
    snappedIndex,
  });

  return {
    get state() {
      return snapshot();
    },
    reset() {
      x = home.x;
      y = home.y;
      vx = 0;
      vy = 0;
      dragging = false;
      snappedIndex = -1;
    },
    stepPointer(down, pointerX, pointerY, dt) {
      const safeDt = Math.max(1 / 240, Math.min(dt, 1 / 15));
      if (down && !dragging) {
        dragging = true;
        grabOffsetX = pointerX - x;
        grabOffsetY = pointerY - y;
        prevX = x;
        prevY = y;
        snappedIndex = -1;
      } else if (down && dragging) {
        const next = constrain(pointerX - grabOffsetX, pointerY - grabOffsetY, true);
        vx = (next.x - prevX) / safeDt;
        vy = (next.y - prevY) / safeDt;
        prevX = next.x;
        prevY = next.y;
        x = next.x;
        y = next.y;
      } else {
        if (dragging) {
          dragging = false;
          // Keep the velocity of the last drag frames: in a browser, pointerup arrives at the last pointermove's
          // position, so "did it move on release" was almost always false and zeroed every fling.
          const releasePt = constrain(pointerX - grabOffsetX, pointerY - grabOffsetY, true);
          if (Math.hypot(releasePt.x - x, releasePt.y - y) > 1e-4) {
            vx = (releasePt.x - prevX) / safeDt;
            vy = (releasePt.y - prevY) / safeDt;
            x = releasePt.x;
            y = releasePt.y;
          }
          pickReleaseTarget(x + vx * 0.08, y + vy * 0.08);
        }
        if ((config.snapPoints && config.snapPoints.length > 0) || config.returnHome) {
          const k = 1 - Math.exp(-settleSpeed * safeDt);
          x += (targetX - x) * k;
          y += (targetY - y) * k;
          vx *= Math.exp(-friction * safeDt);
          vy *= Math.exp(-friction * safeDt);
        } else {
          const decay = Math.exp(-friction * safeDt);
          const b = config.bounds;
          const outside = !!b && (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY);
          if (b && outside && rubberCoeff > 0) {
            // Rubber-banded past the edge: spring back to the bound (it used to snap back in one frame).
            const k = 1 - Math.exp(-settleSpeed * safeDt);
            x += (Math.max(b.minX, Math.min(b.maxX, x)) - x) * k;
            y += (Math.max(b.minY, Math.min(b.maxY, y)) - y) * k;
            vx = 0;
            vy = 0;
          } else {
            const next = constrain(x + vx * safeDt, y + vy * safeDt, false);
            if (b) {
              if (next.x === b.minX || next.x === b.maxX) vx = 0;
              if (next.y === b.minY || next.y === b.maxY) vy = 0;
            }
            x = next.x;
            y = next.y;
            vx *= decay;
            vy *= decay;
          }
        }
      }
      return snapshot();
    },
    nudgeByKey(direction, stepPx = 16) {
      const dx = direction === "right" ? stepPx : direction === "left" ? -stepPx : 0;
      const dy = direction === "down" ? stepPx : direction === "up" ? -stepPx : 0;
      const next = constrain(x + dx, y + dy, false);
      x = next.x;
      y = next.y;
      pickReleaseTarget(x, y);
      if (snappedIndex >= 0) {
        targetX = config.snapPoints![snappedIndex]!.x;
        targetY = config.snapPoints![snappedIndex]!.y;
      }
      return snapshot();
    },
  };
}
