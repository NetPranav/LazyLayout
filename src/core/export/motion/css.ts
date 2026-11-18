/**
 * Per-engine code generators (ROADMAP Phase 94). They turn an animation into the source text of one engine and know nothing of
 * the editor: they take the animation and options and return a string. They were methods of `MultiEngineAnimationRuntime`
 * (Sub-Phases 5.1, 5.2 and 5.6); the code is the same, indentation aside, and that class now calls these, so what it
 * emitted before is what it emits.
 */
import { toScalarKeyframeValue, type AnimationTrack } from "../../types/animations";

  /**
   * Numerically samples an analytical spring into a CSS Easing Level 2 linear(...) curve.
   */
  export function generateCssLinearSpring(
    stiffness = 350,
    damping = 22,
    mass = 1,
    points = 24
  ): string {
    const w0 = Math.sqrt(stiffness / mass);
    const gamma = damping / (2 * mass);
    const wd = Math.sqrt(Math.max(0.001, w0 * w0 - gamma * gamma));

    const settlingTime = Math.min(2.0, Math.max(0.3, 4.5 / gamma));
    const samples: string[] = [];

    for (let i = 0; i <= points; i++) {
      if (i === 0) {
        samples.push("0.000");
      } else if (i === points) {
        samples.push("1.000");
      } else {
        const t = (i / points) * settlingTime;
        const envelope = Math.exp(-gamma * t);
        const val = 1 - envelope * (Math.cos(wd * t) + (gamma / wd) * Math.sin(wd * t));
        samples.push(val.toFixed(3));
      }
    }

    return `linear(${samples.join(", ")})`;
  }

  export function mapPropertyToCss(trackId: string): string {
    switch (trackId) {
      case "transform.x":
      case "translateX":
        return "transform";
      case "transform.y":
      case "translateY":
        return "transform";
      case "appearance.opacity":
      case "opacity":
        return "opacity";
      case "appearance.background.color":
      case "backgroundColor":
        return "background-color";
      case "appearance.radius":
      case "borderRadius":
        return "border-radius";
      case "filter.blur":
      case "filterBlur":
        return "filter";
      default:
        return trackId;
    }
  }

  /**
   * Emits a pure, zero-dependency CSS @keyframes block from tracks.
   */
  export function generateCssKeyframes(name: string, tracks: AnimationTrack[]): string {
    const keyframeMap: Record<number, Record<string, string | number>> = {};

    for (const track of tracks) {
      for (const kf of track.keyframes) {
        if (!keyframeMap[kf.offset]) {
          keyframeMap[kf.offset] = {};
        }
        const cssProp = mapPropertyToCss(track.trackId);
        keyframeMap[kf.offset][cssProp] = toScalarKeyframeValue(kf.value);
      }
    }

    const sortedOffsets = Object.keys(keyframeMap)
      .map(Number)
      .sort((a, b) => a - b);

    const steps = sortedOffsets.map((offset) => {
      const props = keyframeMap[offset];
      const declarations = Object.entries(props)
        .map(([k, v]) => `    ${k}: ${v};`)
        .join("\n");
      return `  ${offset}% {\n${declarations}\n  }`;
    });

    return `@keyframes ${name} {\n${steps.join("\n")}\n}`;
  }
