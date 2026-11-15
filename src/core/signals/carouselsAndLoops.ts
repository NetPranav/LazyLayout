/**
 * @file carouselsAndLoops.ts
 * @module core/signals/carouselsAndLoops
 * @description Phase 149: Scrollers with snapping & momentum, endless seamless
 * loops, scroll-velocity-coupled marquees, and 3D carousel poses (ring / arc / stack)
 * driven by drag, wheel, arrow keys, and autoplay.
 */

export interface SeamlessLoopItemPose {
  readonly index: number;
  /** Signed coordinate relative to the active viewport origin, wrapped cleanly with no seam pop. */
  readonly offsetPx: number;
  /** True when the item sits inside `[-viewportSpanPx, +viewportSpanPx]`. */
  readonly visible: boolean;
}

export interface SeamlessLoopResult {
  /** Normalized scroll offset in `[0, totalSpanPx)`. */
  readonly wrappedOffsetPx: number;
  readonly activeIndex: number;
  readonly totalSpanPx: number;
  readonly items: readonly SeamlessLoopItemPose[];
}

export type ScrollerInputSource = "idle" | "drag" | "wheel" | "keyboard" | "autoplay";

export interface ScrollerConfig {
  readonly itemCount: number;
  readonly itemSpanPx: number;
  readonly loop?: boolean;
  readonly snap?: boolean;
  readonly friction?: number;
  readonly snapStiffness?: number;
  readonly autoplayPxPerSec?: number;
  readonly wheelStepScale?: number;
}

export interface ScrollerSnapshot {
  readonly offsetPx: number;
  readonly velocityPxPerSec: number;
  readonly activeIndex: number;
  readonly nearestSnapPx: number;
  readonly dragging: boolean;
  readonly paused: boolean;
  readonly settled: boolean;
  readonly lastSource: ScrollerInputSource;
}

export interface ScrollerController {
  beginDrag(): ScrollerSnapshot;
  dragBy(deltaPx: number, dtSec?: number): ScrollerSnapshot;
  endDrag(releaseVelocityPxPerSec?: number): ScrollerSnapshot;
  applyWheel(deltaPx: number): ScrollerSnapshot;
  stepArrowKey(direction: -1 | 1 | "prev" | "next" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): ScrollerSnapshot;
  setPaused(paused: boolean): ScrollerSnapshot;
  step(dtSec: number): ScrollerSnapshot;
  snapshot(): ScrollerSnapshot;
  loopPoses(viewportSpanPx?: number): SeamlessLoopResult;
}

export interface MarqueeConfig {
  readonly totalSpanPx: number;
  readonly baseSpeedPxPerSec: number;
  readonly scrollVelocityFactor?: number;
  readonly reverseWithScroll?: boolean;
  readonly maxSpeedPxPerSec?: number;
}

export interface MarqueeState {
  readonly offsetPx: number;
  readonly effectiveSpeedPxPerSec: number;
  readonly wrapCount: number;
}

export type Carousel3DMode = "ring" | "arc" | "stack";

export interface Carousel3DPose {
  readonly index: number;
  readonly angleDeg: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotateYDeg: number;
  readonly scale: number;
  readonly opacity: number;
  readonly zIndex: number;
  readonly frontmost: boolean;
}

/** True mathematical modulo in `[0, span)`. */
export function positiveMod(value: number, span: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(span) || span <= 0) {
    return 0;
  }
  const rem = value % span;
  return rem < 0 ? rem + span : rem;
}

/** Shortest signed modular difference wrapped into `[-span / 2, span / 2)`. */
export function shortestSignedMod(value: number, span: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(span) || span <= 0) {
    return 0;
  }
  const half = span * 0.5;
  return positiveMod(value + half, span) - half;
}

/**
 * Computes seam-free item offsets and wrapped normalized coordinate for any item
 * count and span without cumulative floating-point drift over long runs.
 */
export function wrapSeamlessLoop(
  offsetPx: number,
  itemCount: number,
  itemSpanPx: number,
  viewportSpanPx?: number,
): SeamlessLoopResult {
  const safeCount = Math.max(1, Math.floor(Number.isFinite(itemCount) ? itemCount : 1));
  const safeSpan = Number.isFinite(itemSpanPx) && itemSpanPx > 0 ? itemSpanPx : 1;
  const totalSpanPx = safeCount * safeSpan;
  const wrappedOffsetPx = positiveMod(offsetPx, totalSpanPx);
  const rawIndex = Math.round(wrappedOffsetPx / safeSpan) % safeCount;
  const activeIndex = positiveMod(rawIndex, safeCount);
  const visibilityLimit =
    viewportSpanPx !== undefined && Number.isFinite(viewportSpanPx) && viewportSpanPx > 0
      ? viewportSpanPx
      : totalSpanPx * 0.5 + safeSpan;

  const items: SeamlessLoopItemPose[] = [];
  for (let i = 0; i < safeCount; i++) {
    const basePx = i * safeSpan;
    const itemOffset = shortestSignedMod(basePx - wrappedOffsetPx, totalSpanPx);
    items.push({
      index: i,
      offsetPx: itemOffset,
      visible: Math.abs(itemOffset) <= visibilityLimit,
    });
  }

  return {
    wrappedOffsetPx,
    activeIndex,
    totalSpanPx,
    items,
  };
}

/**
 * Creates a deterministic scroller supporting drag, wheel, arrow keys, autoplay,
 * momentum decay, and nearest-item snapping.
 */
export function createScrollerController(config: ScrollerConfig): ScrollerController {
  const itemCount = Math.max(1, Math.floor(config.itemCount));
  const itemSpanPx = Math.max(1, config.itemSpanPx);
  const totalSpanPx = itemCount * itemSpanPx;
  const loop = config.loop ?? true;
  const snap = config.snap ?? true;
  const friction = Math.max(0.1, config.friction ?? 7);
  const snapStiffness = Math.max(1, config.snapStiffness ?? 14);
  const autoplayPxPerSec = config.autoplayPxPerSec ?? 0;
  const wheelStepScale = config.wheelStepScale ?? 1;

  let offsetPx = 0;
  let velocityPxPerSec = 0;
  let dragging = false;
  let paused = false;
  let targetSnapPx: number | null = null;
  let lastSource: ScrollerInputSource = "idle";

  const clampOrWrap = (raw: number): number => {
    if (loop) {
      return positiveMod(raw, totalSpanPx);
    }
    const maxOffset = Math.max(0, (itemCount - 1) * itemSpanPx);
    return Math.min(maxOffset, Math.max(0, raw));
  };

  const resolveNearestSnap = (rawOffset: number): number => {
    if (loop) {
      const wrapped = positiveMod(rawOffset, totalSpanPx);
      const nearestStep = Math.round(wrapped / itemSpanPx) * itemSpanPx;
      return positiveMod(nearestStep, totalSpanPx);
    }
    const maxIndex = itemCount - 1;
    const clampedIdx = Math.min(maxIndex, Math.max(0, Math.round(rawOffset / itemSpanPx)));
    return clampedIdx * itemSpanPx;
  };

  const resolveActiveIndex = (): number => {
    const wrapped = clampOrWrap(offsetPx);
    const idx = Math.round(wrapped / itemSpanPx);
    return loop ? positiveMod(idx, itemCount) : Math.min(itemCount - 1, Math.max(0, idx));
  };

  const snapDistance = (from: number, to: number): number => {
    if (loop) {
      return shortestSignedMod(to - from, totalSpanPx);
    }
    return to - from;
  };

  const snapshot = (): ScrollerSnapshot => {
    const nearest = resolveNearestSnap(offsetPx);
    const dist = Math.abs(snapDistance(offsetPx, nearest));
    const settled =
      !dragging &&
      Math.abs(velocityPxPerSec) < 1 &&
      (!snap || dist < 0.25) &&
      (paused || Math.abs(autoplayPxPerSec) < 1e-3);
    return {
      offsetPx,
      velocityPxPerSec,
      activeIndex: resolveActiveIndex(),
      nearestSnapPx: nearest,
      dragging,
      paused,
      settled,
      lastSource,
    };
  };

  return {
    beginDrag(): ScrollerSnapshot {
      dragging = true;
      velocityPxPerSec = 0;
      targetSnapPx = null;
      lastSource = "drag";
      return snapshot();
    },

    dragBy(deltaPx: number, dtSec = 1 / 60): ScrollerSnapshot {
      if (!dragging) {
        dragging = true;
      }
      const safeDt = Math.max(1e-4, dtSec);
      const safeDelta = Number.isFinite(deltaPx) ? deltaPx : 0;
      offsetPx = clampOrWrap(offsetPx - safeDelta);
      velocityPxPerSec = -safeDelta / safeDt;
      lastSource = "drag";
      return snapshot();
    },

    endDrag(releaseVelocityPxPerSec?: number): ScrollerSnapshot {
      dragging = false;
      if (releaseVelocityPxPerSec !== undefined && Number.isFinite(releaseVelocityPxPerSec)) {
        velocityPxPerSec = releaseVelocityPxPerSec;
      }
      if (snap) {
        // Project coast endpoint under exponential decay (`x + v / friction`).
        const projected = offsetPx + velocityPxPerSec / friction;
        targetSnapPx = resolveNearestSnap(projected);
      }
      lastSource = "drag";
      return snapshot();
    },

    applyWheel(deltaPx: number): ScrollerSnapshot {
      const scaled = (Number.isFinite(deltaPx) ? deltaPx : 0) * wheelStepScale;
      offsetPx = clampOrWrap(offsetPx + scaled);
      velocityPxPerSec = scaled * 12;
      targetSnapPx = snap ? resolveNearestSnap(offsetPx + velocityPxPerSec / friction) : null;
      lastSource = "wheel";
      return snapshot();
    },

    stepArrowKey(direction): ScrollerSnapshot {
      const sign =
        direction === -1 || direction === "prev" || direction === "ArrowLeft" || direction === "ArrowUp"
          ? -1
          : 1;
      const currentTarget = targetSnapPx ?? resolveNearestSnap(offsetPx);
      const nextRaw = currentTarget + sign * itemSpanPx;
      targetSnapPx = clampOrWrap(nextRaw);
      velocityPxPerSec = 0;
      if (!snap) {
        offsetPx = targetSnapPx;
      }
      lastSource = "keyboard";
      return snapshot();
    },

    setPaused(nextPaused: boolean): ScrollerSnapshot {
      paused = nextPaused;
      return snapshot();
    },

    step(dtSec: number): ScrollerSnapshot {
      const dt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
      if (dt === 0 || dragging) {
        return snapshot();
      }

      if (!paused && Math.abs(autoplayPxPerSec) > 1e-6 && targetSnapPx === null && Math.abs(velocityPxPerSec) < 2) {
        offsetPx = clampOrWrap(offsetPx + autoplayPxPerSec * dt);
        lastSource = "autoplay";
        return snapshot();
      }

      if (Math.abs(velocityPxPerSec) >= 1) {
        offsetPx = clampOrWrap(offsetPx + velocityPxPerSec * dt);
        velocityPxPerSec *= Math.exp(-friction * dt);
        if (Math.abs(velocityPxPerSec) < 1) {
          velocityPxPerSec = 0;
        }
      }

      if (snap) {
        const snapGoal = targetSnapPx ?? (Math.abs(velocityPxPerSec) < 40 ? resolveNearestSnap(offsetPx) : null);
        if (snapGoal !== null) {
          const delta = snapDistance(offsetPx, snapGoal);
          if (Math.abs(delta) < 0.2 && Math.abs(velocityPxPerSec) < 1) {
            offsetPx = clampOrWrap(snapGoal);
            targetSnapPx = null;
          } else {
            const blend = 1 - Math.exp(-snapStiffness * dt);
            offsetPx = clampOrWrap(offsetPx + delta * blend);
          }
        }
      }

      if (!loop && (offsetPx <= 0 || offsetPx >= (itemCount - 1) * itemSpanPx)) {
        velocityPxPerSec = 0;
      }

      return snapshot();
    },

    snapshot,

    loopPoses(viewportSpanPx?: number): SeamlessLoopResult {
      return wrapSeamlessLoop(offsetPx, itemCount, itemSpanPx, viewportSpanPx);
    },
  };
}

/**
 * Advances a marquee by `dtSec`, coupling speed to active `scrollVelocityPxPerSec`
 * and wrapping without precision loss or seam jumps over arbitrarily long sessions.
 */
export function computeMarqueeStep(
  prevState: MarqueeState,
  config: MarqueeConfig,
  scrollVelocityPxPerSec: number,
  dtSec: number,
): MarqueeState {
  const totalSpan = Math.max(1, Number.isFinite(config.totalSpanPx) ? config.totalSpanPx : 1);
  const dt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
  const factor = config.scrollVelocityFactor ?? 0.35;
  const reverseWithScroll = config.reverseWithScroll ?? false;
  const scrollVel = Number.isFinite(scrollVelocityPxPerSec) ? scrollVelocityPxPerSec : 0;

  let speed = config.baseSpeedPxPerSec;
  if (reverseWithScroll && Math.abs(scrollVel) > 1e-3) {
    const dir = Math.sign(scrollVel);
    speed = dir * Math.abs(config.baseSpeedPxPerSec) + scrollVel * factor;
  } else {
    const baseDir = config.baseSpeedPxPerSec >= 0 ? 1 : -1;
    speed = config.baseSpeedPxPerSec + baseDir * Math.abs(scrollVel) * factor;
  }

  if (config.maxSpeedPxPerSec !== undefined && Number.isFinite(config.maxSpeedPxPerSec)) {
    const limit = Math.abs(config.maxSpeedPxPerSec);
    speed = Math.min(limit, Math.max(-limit, speed));
  }

  const rawNext = prevState.offsetPx + speed * dt;
  const wrapped = positiveMod(rawNext, totalSpan);
  const wrapsDelta = Math.abs(Math.floor(rawNext / totalSpan));

  return {
    offsetPx: wrapped,
    effectiveSpeedPxPerSec: speed,
    wrapCount: prevState.wrapCount + wrapsDelta,
  };
}

/**
 * Computes deterministic 3D carousel item poses (`ring`, `arc`, or `stack` mode)
 * suitable for CSS 3D / GPU transforms matching Stage 3 3D arrangement conventions.
 */
export function computeCarousel3DPoses(
  itemCount: number,
  activeAngleDeg: number,
  radiusPx: number,
  mode: Carousel3DMode = "ring",
): readonly Carousel3DPose[] {
  const safeCount = Math.max(1, Math.floor(itemCount));
  const safeRadius = Math.max(1, Number.isFinite(radiusPx) ? radiusPx : 240);
  const stepDeg = 360 / safeCount;

  const rawPoses: Carousel3DPose[] = [];
  let bestFrontIndex = 0;
  let maxZ = -Infinity;

  for (let i = 0; i < safeCount; i++) {
    const angleDeg = shortestSignedMod(i * stepDeg - activeAngleDeg, 360);
    const rad = (angleDeg * Math.PI) / 180;

    let x = 0;
    let y = 0;
    let z = 0;
    let rotateYDeg = 0;
    let scale = 1;
    let opacity = 1;

    if (mode === "ring") {
      x = Math.sin(rad) * safeRadius;
      z = Math.cos(rad) * safeRadius;
      rotateYDeg = angleDeg;
      const depthNorm = (z + safeRadius) / (2 * safeRadius);
      scale = 0.65 + 0.35 * depthNorm;
      opacity = 0.25 + 0.75 * depthNorm;
    } else if (mode === "arc") {
      x = Math.sin(rad) * safeRadius;
      y = (1 - Math.cos(rad)) * safeRadius * 0.18;
      z = Math.cos(rad) * safeRadius * 0.7;
      rotateYDeg = -angleDeg * 0.45;
      const depthNorm = (z + safeRadius * 0.7) / (1.4 * safeRadius);
      scale = 0.72 + 0.28 * depthNorm;
      opacity = Math.abs(angleDeg) > 110 ? 0 : 0.35 + 0.65 * depthNorm;
    } else {
      // "stack": cards fan smoothly behind the active card along negative Z.
      const cardOffset = shortestSignedMod(i - activeAngleDeg / stepDeg, safeCount);
      x = cardOffset * (safeRadius * 0.18);
      y = Math.abs(cardOffset) * 4;
      const rawZ = -Math.abs(cardOffset) * (safeRadius * 0.22);
      z = Math.abs(rawZ) < 1e-12 ? 0 : rawZ;
      rotateYDeg = -cardOffset * 8;
      scale = Math.max(0.55, 1 - Math.abs(cardOffset) * 0.1);
      opacity = Math.max(0.15, 1 - Math.abs(cardOffset) * 0.22);
    }

    if (z > maxZ) {
      maxZ = z;
      bestFrontIndex = i;
    }

    rawPoses.push({
      index: i,
      angleDeg,
      x,
      y,
      z,
      rotateYDeg,
      scale,
      opacity,
      zIndex: Math.round(z + safeRadius * 2),
      frontmost: false,
    });
  }

  return rawPoses.map((pose) => ({
    ...pose,
    frontmost: pose.index === bestFrontIndex,
  }));
}
