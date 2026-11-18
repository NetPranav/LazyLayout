/**
 * Per-engine code generators (ROADMAP Phase 94). They turn an animation into the source text of one engine and know nothing of
 * the editor: they take the animation and options and return a string. They were methods of `MultiEngineAnimationRuntime`
 * (Sub-Phases 5.1, 5.2 and 5.6); the code is the same, indentation aside, and that class now calls these, so what it
 * emitted before is what it emits.
 */
import { toScalarKeyframeValue, type AnimationSample } from "../../types/animations";
import { toCamelCase, toPascalCase } from "./names";
import type { GsapTimelineOptions } from "./types";

  /**
   * Translates an abstract or dot-notation property path to GSAP 3.x property name.
   */
  export function mapPropertyToGsap(propertyPath: string): string {
    switch (propertyPath) {
      // Universal Transforms
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
      case "transform.scaleX":
      case "scaleX":
        return "scaleX";
      case "transform.scaleY":
      case "scaleY":
        return "scaleY";
      case "transform.rotate":
      case "rotate":
        return "rotation";
      case "transform.rotateX":
      case "rotateX":
        return "rotationX";
      case "transform.rotateY":
      case "rotateY":
        return "rotationY";
      case "transform.skewX":
      case "skewX":
        return "skewX";
      case "transform.skewY":
      case "skewY":
        return "skewY";

      // Appearance & Filters
      case "appearance.opacity":
      case "opacity":
        return "opacity";
      case "appearance.border.color":
        return "borderColor";
      case "appearance.border.width":
        return "borderWidth";
      case "appearance.radius":
      case "borderRadius":
        return "borderRadius";
      case "appearance.background.color":
      case "backgroundColor":
        return "backgroundColor";
      case "filter.blur":
      case "filterBlur":
        return "filter";
      case "boxShadow":
        return "boxShadow";

      // Typography
      case "typography.color":
      case "color":
        return "color";
      case "typography.fontSize":
      case "fontSize":
        return "fontSize";
      case "typography.letterSpacing":
      case "letterSpacing":
        return "letterSpacing";
      case "typography.lineHeight":
      case "lineHeight":
        return "lineHeight";

      // Media Family
      case "media.scale":
        return "scale";
      case "media.clipPath":
        return "clipPath";
      case "media.filter.blur":
      case "media.filter.grayscale":
      case "media.filter.brightness":
      case "media.filter.contrast":
      case "media.filter.saturate":
        return "filter";
      case "media.overlay.opacity":
        return "opacity";
      case "svg.path":
      case "pathMorph":
        return "morphSVG";
      case "svg.strokeDashoffset":
      case "strokeDashoffset":
        return "strokeDashoffset";

      // Structural Family (Divider & Background)
      case "divider.length":
        return "scaleX";
      case "divider.thickness":
        return "scaleY";
      case "divider.strokeDashoffset":
        return "strokeDashoffset";
      case "divider.gradient.angle":
      case "background.gradient.angle":
        return "--gradient-angle";
      case "background.color":
        return "backgroundColor";
      case "background.parallax.speed":
        return "y";
      case "background.noise.opacity":
        return "opacity";
      case "background.blendMode":
        return "mixBlendMode";

      default:
        return propertyPath;
    }
  }

  /**
   * Compiles timeline tracks and ScrollTrigger into clean GSAP 3.12 executable code.
   */
  export function compileGsapTimeline(
    sample: AnimationSample,
    options: GsapTimelineOptions = {}
  ): string {
    const selector = options.componentSelector || `.${sample.id}-target`;
    const lines: string[] = [];

    lines.push(`// GSAP 3.12 Production Timeline Driver`);
    lines.push(`// Target: ${selector} | Duration: ${sample.duration}ms | Easing: ${sample.easing}`);

    let timelineInit = `const tl = gsap.timeline({`;
    const tlParams: string[] = [];

    if (sample.iterations === "infinite") {
      tlParams.push(`repeat: -1`);
      if (sample.direction === "alternate") {
        tlParams.push(`yoyo: true`);
      }
    } else if (sample.iterations > 1) {
      tlParams.push(`repeat: ${sample.iterations - 1}`);
      if (sample.direction === "alternate") {
        tlParams.push(`yoyo: true`);
      }
    }

    if (sample.delay && sample.delay > 0) {
      tlParams.push(`delay: ${(sample.delay / 1000).toFixed(2)}`);
    }

    // ScrollTrigger integration
    if (options.scrollTrigger) {
      const st = options.scrollTrigger;
      const stParts: string[] = [];
      stParts.push(`trigger: "${st.trigger || selector}"`);
      stParts.push(`start: "${st.start || "top 80%"}"`);
      stParts.push(`end: "${st.end || "bottom 20%"}"`);
      if (st.scrub !== undefined) {
        stParts.push(`scrub: ${typeof st.scrub === "number" ? st.scrub : true}`);
      }
      if (st.pin) {
        stParts.push(`pin: ${typeof st.pin === "string" ? `"${st.pin}"` : true}`);
      }
      if (st.markers) {
        stParts.push(`markers: true`);
      }
      tlParams.push(`scrollTrigger: { ${stParts.join(", ")} }`);
    }

    timelineInit += tlParams.length > 0 ? ` ${tlParams.join(", ")} ` : "";
    timelineInit += `});`;
    lines.push(timelineInit);

    // Group keyframes by time offset across tracks
    const durationSec = sample.duration / 1000;
    const offsets = new Set<number>();
    for (const track of sample.tracks) {
      for (const kf of track.keyframes) {
        offsets.add(kf.offset);
      }
    }
    const sortedOffsets = Array.from(offsets).sort((a, b) => a - b);

    for (let i = 1; i < sortedOffsets.length; i++) {
      const currOffset = sortedOffsets[i];
      const prevOffset = sortedOffsets[i - 1];
      const stepDuration = ((currOffset - prevOffset) / 100) * durationSec;
      const stepProps: Record<string, string | number> = {};

      for (const track of sample.tracks) {
        const kf = track.keyframes.find((k) => k.offset === currOffset);
        if (kf !== undefined) {
          const gsapProp = mapPropertyToGsap(track.trackId);
          stepProps[gsapProp] = toScalarKeyframeValue(kf.value);
        }
      }

      if (Object.keys(stepProps).length > 0) {
        const propsStr = Object.entries(stepProps)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`)
          .join(", ");
        lines.push(
          `tl.to("${selector}", { ${propsStr}, duration: ${stepDuration.toFixed(3)}, ease: "${sample.easing}" });`
        );
      }
    }

    if (options.useReactHook) {
      const hookName = `use${toPascalCase(sample.id)}Animation`;
      return `import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function ${hookName}(containerRef: React.RefObject<HTMLElement>) {
  useGSAP(() => {
    ${lines.join("\n    ")}
  }, { scope: containerRef });
}
`;
    }

    return lines.join("\n");
  }
