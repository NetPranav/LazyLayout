/** The options the engine generators take (moved from `MultiEngineAnimationRuntime`, Phase 94; that file re-exports them). */

export interface SpringConfig {
  stiffness: number; // Spring stiffness constant (k)
  damping: number;   // Damping coefficient (c)
  mass: number;      // Mass (m)
  initialVelocity?: number; // Continuous handoff velocity (v0)
}

export interface ScrollTriggerConfig {
  trigger?: string;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean | string;
  markers?: boolean;
}

export interface GsapTimelineOptions {
  componentSelector?: string;
  scrollTrigger?: ScrollTriggerConfig;
  useReactHook?: boolean;
}

export interface FramerMotionOptions {
  springConfig?: SpringConfig;
  reducedMotion?: boolean;
}

export interface CssModuleOptions {
  className?: string;
  reducedMotion?: boolean;
}
