/**
 * @file cursorOverlay.ts
 * @module core/signals/cursorOverlay
 * @description Phase 191: Page-level custom cursor & overlay layer supporting
 * 8 presets (`follower`, `blob`, `trail`, `splash`, `target_brackets`,
 * `crosshair_measure`, `image_trail`, `button_swarm`), reading Phase 155 roles
 * and Phase 175/180 outlines, running live only in Preview/Playground while
 * keeping focus rings visible and never hiding native cursors over text inputs,
 * on touch input, or under reduced motion.
 */

export type CursorPresetKind =
  | "follower"
  | "blob"
  | "trail"
  | "splash"
  | "target_brackets"
  | "crosshair_measure"
  | "image_trail"
  | "button_swarm";

export type CursorPointerDevice = "mouse" | "pen" | "touch";
export type CursorSurfaceMode = "editor_canvas" | "preview" | "playground";

export interface CursorTargetBox {
  readonly id: string;
  readonly role: "cta_button" | "link" | "card" | "text_input" | "heading" | "media";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CursorOverlayConfig {
  readonly preset: CursorPresetKind;
  readonly surfaceMode: CursorSurfaceMode;
  readonly hideNativeCursorOptIn: boolean;
  readonly reducedMotion: boolean;
  readonly trailSize?: number;
  readonly swarmCount?: number;
}

export interface CursorFrameInput {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly pointerType: CursorPointerDevice;
  readonly tapped?: boolean;
  readonly hoveredTarget?: CursorTargetBox | null;
}

export interface CursorOverlayFrameState {
  readonly active: boolean;
  readonly preset: CursorPresetKind;
  readonly renderX: number;
  readonly renderY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationRad: number;
  readonly hideNativeCursorApplied: boolean;
  readonly focusRingsVisible: true;
  readonly ariaHidden: true;
  readonly pointerEventsNone: true;
  readonly snappedBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly measuredDimensions: { readonly width: number; readonly height: number; readonly distFromCenter: number } | null;
  readonly trailNodes: readonly { readonly x: number; readonly y: number; readonly opacity: number }[];
  readonly splashRadiusPx: number;
  readonly swarmPoints: readonly { readonly x: number; readonly y: number }[];
}

export interface CursorOverlayController {
  step(dtSec: number, input: CursorFrameInput): CursorOverlayFrameState;
  reset(): void;
}

export function resolveNativeCursorHidden(
  config: Pick<CursorOverlayConfig, "surfaceMode" | "hideNativeCursorOptIn" | "reducedMotion">,
  pointerType: CursorPointerDevice,
  hoveredTarget: CursorTargetBox | null | undefined
): boolean {
  if (config.surfaceMode === "editor_canvas") return false;
  if (!config.hideNativeCursorOptIn) return false;
  if (config.reducedMotion) return false;
  if (pointerType === "touch") return false;
  if (hoveredTarget?.role === "text_input") return false;
  return true;
}

export function createCursorOverlayController(
  config: CursorOverlayConfig
): CursorOverlayController {
  let curX = 0;
  let curY = 0;
  let splashRadius = 0;
  const trailHistory: { readonly x: number; readonly y: number }[] = [];
  const trailCap = Math.max(2, Math.min(16, config.trailSize ?? 8));
  const swarmCap = Math.max(4, Math.min(24, config.swarmCount ?? 10));

  return {
    reset() {
      curX = 0;
      curY = 0;
      splashRadius = 0;
      trailHistory.length = 0;
    },

    step(dtSec, input): CursorOverlayFrameState {
      const dt = Math.max(0.001, Math.min(0.05, dtSec));
      const isLiveSurface = config.surfaceMode === "preview" || config.surfaceMode === "playground";
      const target = input.hoveredTarget ?? null;

      if (!isLiveSurface || input.pointerType === "touch") {
        return {
          active: false,
          preset: config.preset,
          renderX: input.x,
          renderY: input.y,
          scaleX: 1,
          scaleY: 1,
          rotationRad: 0,
          hideNativeCursorApplied: false,
          focusRingsVisible: true,
          ariaHidden: true,
          pointerEventsNone: true,
          snappedBox: null,
          measuredDimensions: null,
          trailNodes: [],
          splashRadiusPx: 0,
          swarmPoints: [],
        };
      }

      const speed = Math.hypot(input.vx, input.vy);
      const alpha = config.reducedMotion ? 1 : 1 - Math.exp(-dt / 0.045);

      let goalX = input.x;
      let goalY = input.y;
      let snappedBox: CursorOverlayFrameState["snappedBox"] = null;
      let measuredDimensions: CursorOverlayFrameState["measuredDimensions"] = null;

      if (
        (config.preset === "target_brackets" || config.preset === "follower") &&
        target &&
        target.role !== "text_input"
      ) {
        const cx = target.x + target.width * 0.5;
        const cy = target.y + target.height * 0.5;
        if (config.preset === "target_brackets") {
          snappedBox = {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
          };
          goalX = cx;
          goalY = cy;
        } else {
          // Gentle magnetic attraction toward hovered interactive element
          goalX = input.x + (cx - input.x) * 0.25;
          goalY = input.y + (cy - input.y) * 0.25;
        }
      }

      if (config.preset === "crosshair_measure" && target) {
        const cx = target.x + target.width * 0.5;
        const cy = target.y + target.height * 0.5;
        measuredDimensions = {
          width: target.width,
          height: target.height,
          distFromCenter: Math.hypot(input.x - cx, input.y - cy),
        };
      }

      curX += (goalX - curX) * alpha;
      curY += (goalY - curY) * alpha;

      // Velocity stretch for blob cursor
      let scaleX = 1;
      let scaleY = 1;
      let rotationRad = 0;
      if (config.preset === "blob" && !config.reducedMotion && speed > 5) {
        const stretch = Math.min(0.45, speed / 2200);
        scaleX = 1 + stretch;
        scaleY = 1 - stretch * 0.55;
        rotationRad = Math.atan2(input.vy, input.vx);
      }

      // Trail & image_trail history
      if (config.preset === "trail" || config.preset === "image_trail") {
        trailHistory.unshift({ x: curX, y: curY });
        if (trailHistory.length > trailCap) {
          trailHistory.length = trailCap;
        }
      }

      // Splash ripple pulse on click/tap
      if (config.preset === "splash") {
        if (input.tapped) {
          splashRadius = 4;
        } else if (splashRadius > 0) {
          splashRadius = splashRadius + dt * 160;
          if (splashRadius > 54) splashRadius = 0;
        }
      }

      // Button swarm orbiting pointer while avoiding hovering button interior
      const swarmPoints: { readonly x: number; readonly y: number }[] = [];
      if (config.preset === "button_swarm") {
        for (let i = 0; i < swarmCap; i += 1) {
          const ang = (i / swarmCap) * Math.PI * 2;
          let sx = curX + Math.cos(ang) * 26;
          let sy = curY + Math.sin(ang) * 26;
          if (target && target.role === "cta_button") {
            const cx = target.x + target.width * 0.5;
            const cy = target.y + target.height * 0.5;
            const marginX = target.width * 0.5 + 8;
            const marginY = target.height * 0.5 + 8;
            if (Math.abs(sx - cx) < marginX && Math.abs(sy - cy) < marginY) {
              const dx = sx - cx || 1;
              const dy = sy - cy || 1;
              const d = Math.hypot(dx, dy);
              const pushR = Math.hypot(marginX, marginY);
              sx = cx + (dx / d) * pushR;
              sy = cy + (dy / d) * pushR;
            }
          }
          swarmPoints.push({ x: sx, y: sy });
        }
      }

      return {
        active: true,
        preset: config.preset,
        renderX: curX,
        renderY: curY,
        scaleX,
        scaleY,
        rotationRad,
        hideNativeCursorApplied: resolveNativeCursorHidden(
          config,
          input.pointerType,
          input.hoveredTarget
        ),
        focusRingsVisible: true,
        ariaHidden: true,
        pointerEventsNone: true,
        snappedBox,
        measuredDimensions,
        trailNodes: trailHistory.map((pt, i) => ({
          x: pt.x,
          y: pt.y,
          opacity: 1 - i / Math.max(1, trailCap),
        })),
        splashRadiusPx: splashRadius,
        swarmPoints,
      };
    },
  };
}
