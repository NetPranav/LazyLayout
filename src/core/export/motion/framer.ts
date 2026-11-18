/**
 * Per-engine code generators (ROADMAP Phase 94). They turn an animation into the source text of one engine and know nothing of
 * the editor: they take the animation and options and return a string. They were methods of `MultiEngineAnimationRuntime`
 * (Sub-Phases 5.1, 5.2 and 5.6); the code is the same, indentation aside, and that class now calls these, so what it
 * emitted before is what it emits.
 */
import { toScalarKeyframeValue, type AnimationSample } from "../../types/animations";
import { toCamelCase, toPascalCase } from "./names";
import type { FramerMotionOptions } from "./types";

  export function mapPropertyToFramer(trackId: string): string {
    switch (trackId) {
      case "transform.x":
      case "translateX":
        return "x";
      case "transform.y":
      case "translateY":
        return "y";
      case "transform.z":
      case "translateZ":
        return "z";
      case "transform.scale":
      case "scale":
        return "scale";
      case "transform.rotate":
      case "rotate":
        return "rotate";
      case "appearance.opacity":
      case "opacity":
        return "opacity";
      case "appearance.background.color":
      case "backgroundColor":
        return "backgroundColor";
      case "appearance.radius":
      case "borderRadius":
        return "borderRadius";
      default:
        return trackId;
    }
  }

  /**
   * Compiles abstract AnimationSample into declarative Framer Motion 11 Variants.
   */
  export function compileFramerMotionVariants(
    sample: AnimationSample,
    options: FramerMotionOptions = {}
  ): string {
    const spring = options.springConfig || { stiffness: 350, damping: 22, mass: 1 };
    const springStr = `transition: { type: "spring", stiffness: ${spring.stiffness}, damping: ${spring.damping}, mass: ${spring.mass} }`;

    const initialProps: Record<string, string | number> = {};
    const animateProps: Record<string, string | number> = {};

    for (const track of sample.tracks) {
      const firstKf = track.keyframes[0];
      const lastKf = track.keyframes[track.keyframes.length - 1];
      const propName = mapPropertyToFramer(track.trackId);

      if (firstKf !== undefined) {
        initialProps[propName] = toScalarKeyframeValue(firstKf.value);
      }
      if (lastKf !== undefined) {
        animateProps[propName] = toScalarKeyframeValue(lastKf.value);
      }
    }

    const fmtProps = (props: Record<string, string | number>): string =>
      Object.entries(props)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`)
        .join(", ");

    const varName = `${toCamelCase(sample.id)}Variants`;

    return `import { motion, type Variants } from "framer-motion";

export const ${varName}: Variants = {
  initial: {
    ${fmtProps(initialProps)}
  },
  animate: {
    ${fmtProps(animateProps)},
    ${springStr}
  },
  hover: {
    scale: 1.04,
    ${springStr}
  },
  tap: {
    scale: 0.96,
    transition: { type: "spring", stiffness: 500, damping: 28 }
  }
};
`;
  }
