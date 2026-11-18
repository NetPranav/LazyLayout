"use client";

/**
 * ============================================================================
 * LAZYLAYOUT MULTI-ENGINE ANIMATION RUNTIME & EXECUTOR
 * ============================================================================
 * Architecture Ref: ROADMAP.md §Phase 5 (Sub-Phases 5.1–5.6)
 * Companion Spec: DOCS/INITIAL/ANIMATION_PROPERTIES_AND_ENGINE_SPECIFICATION.md
 * Standards: CONVENTIONS.md §4 Standard Animation Property Paths
 *
 * Implements:
 * - Sub-Phase 5.1: GSAP 3.12 Core Integration (Timeline, ScrollTrigger, universal/media/divider/bg paths)
 * - Sub-Phase 5.2: Framer Motion 11 Core Integration (RK4 / analytical spring physics, continuous v0 handoff, variants)
 * - Sub-Phase 5.3: SVG & Divider Stroke-Draw Engine (Stroke dashoffset, path morph, divider draw-in)
 * - Sub-Phase 5.4: Image Motion Engine (Ken Burns slow zoom, clip-path reveals, filter transitions, scroll parallax)
 * - Sub-Phase 5.5: Background Motion Engine (Animatable gradient angle/stop drift, parallax, blend modes, noise pulse)
 * - Sub-Phase 5.6: Native CSS Keyframe & Spring Emitter (Pure CSS @keyframes, CSS Easing Level 2 linear() spring curves)
 * ============================================================================
 */

import {
  AnimationSample,
  AnimationTrack,
  toScalarKeyframeValue,
} from "../types/animations";
import { synthesizeSingleTransformMatrix } from "./EngineAdapters";
import { toPascalCase, toCamelCase } from "../export/motion/names";
import { mapPropertyToGsap, compileGsapTimeline } from "../export/motion/gsap";
import { mapPropertyToFramer, compileFramerMotionVariants } from "../export/motion/framer";
import { generateCssLinearSpring, mapPropertyToCss, generateCssKeyframes } from "../export/motion/css";
import type { CssModuleOptions, FramerMotionOptions, GsapTimelineOptions, ScrollTriggerConfig, SpringConfig } from "../export/motion/types";

export type { CssModuleOptions, FramerMotionOptions, GsapTimelineOptions, ScrollTriggerConfig, SpringConfig };


export interface GradientStop {
  color: string;
  offset: number; // 0 to 100%
}

export interface ImageFilterConfig {
  blur?: number;       // px
  grayscale?: number;  // 0 to 1
  brightness?: number; // 0 to 2
  contrast?: number;   // 0 to 2
  saturate?: number;   // 0 to 2
}

export interface EvaluatedStylePatch {
  transform?: string;
  opacity?: string;
  filter?: string;
  backgroundColor?: string;
  color?: string;
  borderRadius?: string;
  boxShadow?: string;
  clipPath?: string;
  strokeDashoffset?: string | number;
  strokeDasharray?: string | number;
  background?: string;
  mixBlendMode?: string;
  width?: string;
  height?: string;
  [key: string]: string | number | undefined;
}

export { toPascalCase, toCamelCase };

/**
 * Universal Multi-Engine Animation Runtime
 */
export class MultiEngineAnimationRuntimeService {
  // ==========================================================================
  // SUB-PHASE 5.1: GSAP 3.12 CORE INTEGRATION
  // ==========================================================================

  /**
   * Translates an abstract or dot-notation property path to GSAP 3.x property name.
   */
  public mapPropertyToGsap(propertyPath: string): string {
    return mapPropertyToGsap(propertyPath);
  }

  /**
   * Compiles timeline tracks and ScrollTrigger into clean GSAP 3.12 executable code.
   */
  public compileGsapTimeline(sample: AnimationSample, options: GsapTimelineOptions = {}): string {
    return compileGsapTimeline(sample, options);
  }

  // ==========================================================================
  // SUB-PHASE 5.2: FRAMER MOTION 11 CORE INTEGRATION
  // ==========================================================================

  /**
   * Solves a damped harmonic oscillator with continuous initial velocity handoff:
   * d^2x/dt^2 + 2*zeta*w0 * dx/dt + w0^2 * (x - 1) = 0
   */
  public solveSpringPhysics(
    config: SpringConfig,
    timeSeconds: number,
    target = 1
  ): { position: number; velocity: number } {
    const { stiffness, damping, mass, initialVelocity = 0 } = config;
    const w0 = Math.sqrt(stiffness / mass); // undamped angular frequency
    const gamma = damping / (2 * mass);    // damping factor
    const v0 = initialVelocity;

    // Underdamped regime (typical for UI springs)
    if (w0 > gamma) {
      const wd = Math.sqrt(w0 * w0 - gamma * gamma);
      const envelope = Math.exp(-gamma * timeSeconds);
      const c1 = -target;
      const c2 = (v0 + gamma * c1) / wd;

      const position = target + envelope * (c1 * Math.cos(wd * timeSeconds) + c2 * Math.sin(wd * timeSeconds));
      const velocity =
        -gamma * envelope * (c1 * Math.cos(wd * timeSeconds) + c2 * Math.sin(wd * timeSeconds)) +
        envelope * (-c1 * wd * Math.sin(wd * timeSeconds) + c2 * wd * Math.cos(wd * timeSeconds));

      return { position, velocity };
    } else {
      // Critically damped or overdamped
      const envelope = Math.exp(-w0 * timeSeconds);
      const position = target - envelope * (target + (w0 * target - v0) * timeSeconds);
      const velocity = envelope * (v0 + (w0 * target - v0) * (1 - w0 * timeSeconds));
      return { position, velocity };
    }
  }

  /**
   * Compiles abstract AnimationSample into declarative Framer Motion 11 Variants.
   */
  public compileFramerMotionVariants(sample: AnimationSample, options: FramerMotionOptions = {}): string {
    return compileFramerMotionVariants(sample, options);
  }

  private mapPropertyToFramer(trackId: string): string {
    return mapPropertyToFramer(trackId);
  }

  // ==========================================================================
  // SUB-PHASE 5.3: SVG & DIVIDER STROKE-DRAW ENGINE
  // ==========================================================================

  /**
   * Calculates stroke-dasharray and stroke-dashoffset for animated line drawing.
   */
  public solveSvgStrokeDraw(
    totalLength: number,
    progress: number
  ): { strokeDasharray: number; strokeDashoffset: number } {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const strokeDasharray = totalLength;
    const strokeDashoffset = totalLength * (1 - clampedProgress);
    return { strokeDasharray, strokeDashoffset };
  }

  /**
   * Computes Divider draw-in properties (either via CSS scaleX or SVG stroke).
   */
  public solveDividerDrawIn(
    progress: number,
    orientation: "horizontal" | "vertical" = "horizontal",
    mode: "scale" | "stroke" = "scale",
    strokeLength = 1000
  ): { transform?: string; strokeDasharray?: number; strokeDashoffset?: number; lengthPercentage: number } {
    const clamped = Math.max(0, Math.min(1, progress));
    const lengthPercentage = clamped * 100;

    if (mode === "stroke") {
      const { strokeDasharray, strokeDashoffset } = this.solveSvgStrokeDraw(strokeLength, clamped);
      return { strokeDasharray, strokeDashoffset, lengthPercentage };
    }

    const transform =
      orientation === "horizontal"
        ? `scaleX(${clamped.toFixed(4)})`
        : `scaleY(${clamped.toFixed(4)})`;

    return { transform, lengthPercentage };
  }

  /**
   * Simple linear point interpolation between two matching SVG path strings.
   */
  public interpolateSvgPath(pathA: string, pathB: string, progress: number): string {
    const clamped = Math.max(0, Math.min(1, progress));
    if (clamped <= 0) return pathA;
    if (clamped >= 1) return pathB;

    const numsA = pathA.match(/-?\d+(\.\d+)?/g);
    const numsB = pathB.match(/-?\d+(\.\d+)?/g);

    if (!numsA || !numsB || numsA.length !== numsB.length) {
      return clamped < 0.5 ? pathA : pathB;
    }

    let i = 0;
    return pathA.replace(/-?\d+(\.\d+)?/g, () => {
      const a = parseFloat(numsA[i]);
      const b = parseFloat(numsB[i]);
      i++;
      const val = a + (b - a) * clamped;
      return val.toFixed(2);
    });
  }

  // ==========================================================================
  // SUB-PHASE 5.4: IMAGE MOTION ENGINE
  // ==========================================================================

  /**
   * Evaluates Ken Burns slow-zoom and pan coordinates at a given progress (0 to 1).
   */
  public evaluateKenBurns(
    scaleStart: number,
    scaleEnd: number,
    driftX: number,
    driftY: number,
    progress: number
  ): { transform: string; scale: number; x: number; y: number } {
    const clamped = Math.max(0, Math.min(1, progress));
    const scale = scaleStart + (scaleEnd - scaleStart) * clamped;
    const x = driftX * clamped;
    const y = driftY * clamped;
    const transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0px) scale(${scale.toFixed(3)})`;
    return { transform, scale, x, y };
  }

  /**
   * Evaluates animated clip-path reveal wipe (inset, circle).
   */
  public evaluateClipPathReveal(
    shape: "inset" | "circle",
    progress: number,
    direction: "left-to-right" | "top-to-bottom" | "center-out" = "left-to-right"
  ): string {
    const clamped = Math.max(0, Math.min(1, progress));
    const pct = clamped * 100;

    if (shape === "circle") {
      return `circle(${pct.toFixed(1)}% at 50% 50%)`;
    }

    switch (direction) {
      case "left-to-right":
        return `inset(0% ${(100 - pct).toFixed(1)}% 0% 0%)`;
      case "top-to-bottom":
        return `inset(0% 0% ${(100 - pct).toFixed(1)}% 0%)`;
      case "center-out": {
        const halfRemaining = ((100 - pct) / 2).toFixed(1);
        return `inset(${halfRemaining}% ${halfRemaining}% ${halfRemaining}% ${halfRemaining}%)`;
      }
      default:
        return `inset(0% ${(100 - pct).toFixed(1)}% 0% 0%)`;
    }
  }

  /**
   * Evaluates combined CSS filter string for an Image.
   */
  public evaluateImageFilter(filters: ImageFilterConfig): string {
    const parts: string[] = [];
    if (filters.blur !== undefined && filters.blur > 0) {
      parts.push(`blur(${filters.blur}px)`);
    }
    if (filters.grayscale !== undefined && filters.grayscale > 0) {
      parts.push(`grayscale(${filters.grayscale})`);
    }
    if (filters.brightness !== undefined && filters.brightness !== 1) {
      parts.push(`brightness(${filters.brightness})`);
    }
    if (filters.contrast !== undefined && filters.contrast !== 1) {
      parts.push(`contrast(${filters.contrast})`);
    }
    if (filters.saturate !== undefined && filters.saturate !== 1) {
      parts.push(`saturate(${filters.saturate})`);
    }
    return parts.length > 0 ? parts.join(" ") : "none";
  }

  /**
   * Calculates scroll-linked parallax translation offset.
   */
  public evaluateScrollParallax(scrollY: number, speedMultiplier: number): { transform: string; yOffset: number } {
    const yOffset = -(scrollY * speedMultiplier);
    return {
      transform: `translate3d(0px, ${yOffset.toFixed(2)}px, 0px)`,
      yOffset,
    };
  }

  // ==========================================================================
  // SUB-PHASE 5.5: BACKGROUND MOTION ENGINE
  // ==========================================================================

  /**
   * Evaluates animatable gradient angle/stop drift.
   */
  public evaluateBackgroundGradient(
    stops: GradientStop[],
    angleDeg = 135,
    angleDelta = 0,
    progress = 0
  ): { background: string; currentAngle: number } {
    const clamped = Math.max(0, Math.min(1, progress));
    const currentAngle = (angleDeg + angleDelta * clamped) % 360;

    const stopStrs = stops.map((s) => `${s.color} ${s.offset}%`).join(", ");
    const background = `linear-gradient(${currentAngle.toFixed(1)}deg, ${stopStrs})`;
    return { background, currentAngle };
  }

  /**
   * Evaluates SVG turbulence noise parameters for backdrop grain pulse.
   */
  public evaluateBackgroundNoise(
    baseOpacity = 0.05,
    pulseDelta = 0.03,
    progress = 0
  ): { noiseOpacity: number; filterId: string } {
    const clamped = Math.max(0, Math.min(1, progress));
    const noiseOpacity = baseOpacity + pulseDelta * Math.sin(clamped * Math.PI * 2);
    return {
      noiseOpacity: Math.max(0, Math.min(1, noiseOpacity)),
      filterId: "lazylayout-noise-filter",
    };
  }

  // ==========================================================================
  // SUB-PHASE 5.6: NATIVE CSS KEYFRAME & SPRING EMITTER
  // ==========================================================================

  /**
   * Numerically samples an analytical spring into a CSS Easing Level 2 linear(...) curve.
   */
  public generateCssLinearSpring(stiffness = 350, damping = 22, mass = 1, points = 24): string {
    return generateCssLinearSpring(stiffness, damping, mass, points);
  }

  /**
   * Emits a pure, zero-dependency CSS @keyframes block from tracks.
   */
  public generateCssKeyframes(name: string, tracks: AnimationTrack[]): string {
    return generateCssKeyframes(name, tracks);
  }

  private mapPropertyToCss(trackId: string): string {
    return mapPropertyToCss(trackId);
  }

  // ==========================================================================
  // UNIFIED RUNTIME EVALUATION GATE (SANDBOX & STAGE HOT-PATCHING)
  // ==========================================================================

  /**
   * Interpolates an element's active tracks at time T (0..duration) and produces
   * an authoritative, single-transform-synthesized style patch.
   */
  public evaluateElementStyles(
    sample: AnimationSample,
    timeMs: number
  ): EvaluatedStylePatch {
    const duration = sample.duration || 1000;
    const progress = Math.max(0, Math.min(1, timeMs / duration));
    const patch: EvaluatedStylePatch = {};

    const transformParts: {
      x?: string;
      y?: string;
      z?: string;
      scale?: number;
      scaleX?: number;
      scaleY?: number;
      rotate?: number;
      rotateX?: number;
      rotateY?: number;
      skewX?: number;
      skewY?: number;
    } = {};

    for (const track of sample.tracks) {
      const val = this.interpolateTrackValue(track, progress);
      // TODO(P7): this evaluator serves both `AnimationSample` track ids (`translateX`) and
      // MDM v2 dot-paths (`transform.x`); Phase 7 folds AnimationSample into the document.
      const trackId: string = track.trackId;

      switch (trackId) {
        case "translateX":
        case "transform.x":
          transformParts.x = typeof val === "number" ? `${val}px` : String(val);
          break;
        case "translateY":
        case "transform.y":
          transformParts.y = typeof val === "number" ? `${val}px` : String(val);
          break;
        case "translateZ":
        case "transform.z":
          transformParts.z = typeof val === "number" ? `${val}px` : String(val);
          break;
        case "scale":
        case "transform.scale":
        case "media.scale":
          transformParts.scale = typeof val === "number" ? val : parseFloat(String(val)) || 1;
          break;
        case "scaleX":
        case "transform.scaleX":
        case "divider.length":
          transformParts.scaleX = typeof val === "number" ? val : parseFloat(String(val)) || 1;
          break;
        case "scaleY":
        case "transform.scaleY":
        case "divider.thickness":
          transformParts.scaleY = typeof val === "number" ? val : parseFloat(String(val)) || 1;
          break;
        case "rotate":
        case "transform.rotate":
          transformParts.rotate = typeof val === "number" ? val : parseFloat(String(val)) || 0;
          break;
        case "rotateX":
        case "transform.rotateX":
          transformParts.rotateX = typeof val === "number" ? val : parseFloat(String(val)) || 0;
          break;
        case "rotateY":
        case "transform.rotateY":
          transformParts.rotateY = typeof val === "number" ? val : parseFloat(String(val)) || 0;
          break;

        case "opacity":
        case "appearance.opacity":
        case "media.overlay.opacity":
        case "background.noise.opacity":
          patch.opacity = String(val);
          break;
        case "backgroundColor":
        case "appearance.background.color":
        case "background.color":
          patch.backgroundColor = String(val);
          break;
        case "borderRadius":
        case "appearance.radius":
          patch.borderRadius = typeof val === "number" ? `${val}px` : String(val);
          break;
        case "boxShadow":
          patch.boxShadow = String(val);
          break;
        case "color":
        case "typography.color":
          patch.color = String(val);
          break;
        case "filterBlur":
        case "filter.blur":
        case "media.filter.blur":
          patch.filter = `blur(${val}px)`;
          break;
        case "media.clipPath":
          patch.clipPath = String(val);
          break;
        case "strokeDashoffset":
        case "svg.strokeDashoffset":
        case "divider.strokeDashoffset":
          patch.strokeDashoffset = val;
          break;
        case "background.blendMode":
          patch.mixBlendMode = String(val);
          break;
        default:
          break;
      }
    }

    // Synthesize single transform authority string
    const synthesizedTransform = synthesizeSingleTransformMatrix(transformParts);
    if (synthesizedTransform !== "none") {
      patch.transform = synthesizedTransform;
    }

    return patch;
  }

  private interpolateTrackValue(track: AnimationTrack, progress: number): number | string {
    if (!track.keyframes || track.keyframes.length === 0) return 0;
    if (track.keyframes.length === 1) return toScalarKeyframeValue(track.keyframes[0].value);

    const sorted = [...track.keyframes].sort((a, b) => a.offset - b.offset);

    if (progress <= sorted[0].offset / 100) return toScalarKeyframeValue(sorted[0].value);
    if (progress >= sorted[sorted.length - 1].offset / 100) return toScalarKeyframeValue(sorted[sorted.length - 1].value);

    // Find bounding keyframes
    let kfA = sorted[0];
    let kfB = sorted[1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (progress >= sorted[i].offset / 100 && progress <= sorted[i + 1].offset / 100) {
        kfA = sorted[i];
        kfB = sorted[i + 1];
        break;
      }
    }

    const range = (kfB.offset - kfA.offset) / 100;
    const localProgress = range > 0 ? (progress - kfA.offset / 100) / range : 0;

    const numA = typeof kfA.value === "number" ? kfA.value : parseFloat(String(kfA.value));
    const numB = typeof kfB.value === "number" ? kfB.value : parseFloat(String(kfB.value));

    if (!isNaN(numA) && !isNaN(numB)) {
      const interpolated = numA + (numB - numA) * localProgress;
      return interpolated;
    }

    return toScalarKeyframeValue(localProgress < 0.5 ? kfA.value : kfB.value);
  }
}

export const multiEngineAnimationRuntime = new MultiEngineAnimationRuntimeService();
