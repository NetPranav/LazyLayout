/**
 * ROADMAP Phase 87: the Motion engine adapter. Motion (`motion`, the library `motion/react` is built on) is loaded
 * lazily, the first time the stage's engine starts, and from then on the stage's transitions run on Motion's own
 * spring and keyframes generators: a state arriving (Phase 79), a variant switching (Phase 80), a layout change and a
 * layer entering or leaving (`LayoutDriver`). Until it has loaded, the kernel's own spring does the same job; the two
 * agree (the kernel's spring is checked against Motion's in `kernel/__tests__/springs.test.ts` and here), so the
 * hand-over is not seen.
 *
 * Motion's generators are pure functions of time. They are stepped by the editor's frame scheduler, never by a clock of
 * Motion's own, so scrubbing, deterministic capture and the tests see the same frames. An interruption builds a new
 * generator from where the number is with the speed it has, which is how Motion itself keeps velocity.
 *
 * What a layer's states and transition are in Motion's own words (variants, `whileHover`, a `transition`) is in
 * `motionConfig.ts`, which the exporters use too.
 */
import { parseEasing } from "../../document/motion";
import { sampleEasing } from "../../kernel/easing";
import { perceptualToPhysical } from "../../kernel/springs";
import { specKey, type MoverFactory, type MoverLike, type TransitionSpec } from "../../states/transitions";

interface Generator {
  next(ms: number): { done: boolean; value: number };
  velocity?(ms: number): number;
}
/** The part of Motion the adapter uses. */
export interface MotionEngine {
  spring(options: { keyframes: number[]; stiffness: number; damping: number; mass: number; velocity: number; restDelta?: number; restSpeed?: number }): Generator;
  keyframes(options: { keyframes: number[]; duration: number; ease: (p: number) => number }): Generator;
}

let engine: MotionEngine | null = null;
let loading: Promise<MotionEngine> | null = null;

/** Loads Motion once (its own chunk in the browser). Safe to call many times. */
export function loadMotion(): Promise<MotionEngine> {
  if (engine) return Promise.resolve(engine);
  loading ??= import("motion").then((m) => {
    engine = { spring: m.spring as unknown as MotionEngine["spring"], keyframes: m.keyframes as unknown as MotionEngine["keyframes"] };
    return engine;
  });
  return loading;
}
export const motionEngine = (): MotionEngine | null => engine;
/** For tests: use this engine (or none) without loading. */
export function setMotionEngine(next: MotionEngine | null): void {
  engine = next;
  loading = null;
}

const REST = 0.0005;

/** One number moving to a target on Motion's generators. The same contract as the kernel's `Mover`. */
export class MotionMover implements MoverLike {
  value: number;
  velocity = 0;
  target: number;
  private spec: TransitionSpec;
  private key: string;
  private generator: Generator | null = null;
  private elapsed = 0;

  constructor(private readonly motion: MotionEngine, spec: TransitionSpec, value = 0) {
    this.value = this.target = value;
    this.spec = spec;
    this.key = specKey(spec);
  }

  /** A generator from where the number is, with the speed it has, to the target. */
  private begin(): void {
    this.elapsed = 0;
    if (this.spec.type === "spring") {
      const physical = perceptualToPhysical(this.spec.bounce, this.spec.duration);
      this.generator = this.motion.spring({ keyframes: [this.value, this.target], ...physical, velocity: this.velocity, restDelta: REST, restSpeed: REST * 20 });
    } else {
      const easing = parseEasing(this.spec.curve) ?? { kind: "linear" as const };
      this.generator = this.motion.keyframes({ keyframes: [this.value, this.target], duration: this.spec.duration * 1000, ease: (p) => sampleEasing(easing, p) });
    }
  }

  use(spec: TransitionSpec): void {
    const key = specKey(spec);
    if (key === this.key) return;
    this.spec = spec;
    this.key = key;
    if (!this.resting) this.begin();
  }

  to(target: number): void {
    if (target === this.target) return;
    this.target = target;
    this.begin();
  }

  shift(delta: number): void {
    if (delta === 0) return;
    this.value += delta;
    this.begin();
  }

  jump(target: number): void {
    this.value = this.target = target;
    this.velocity = 0;
    this.generator = null;
  }

  get resting(): boolean {
    return this.value === this.target && this.velocity === 0;
  }

  step(dt: number): number {
    if (this.resting) return this.value;
    if (!this.generator) this.begin();
    const generator = this.generator!;
    this.elapsed += Math.max(0, dt);
    const ms = this.elapsed * 1000;
    const before = this.value;
    const state = generator.next(ms);
    this.value = state.value;
    this.velocity = generator.velocity ? generator.velocity(ms) : dt > 0 ? (this.value - before) / dt : 0;
    const settled = this.spec.type === "spring" && Math.abs(this.value - this.target) < REST && Math.abs(this.velocity) < REST * 20;
    if (state.done || settled || (this.spec.type === "tween" && this.elapsed >= this.spec.duration)) this.jump(this.target);
    return this.value;
  }
}

/** What the stage's drivers ask for a mover: Motion's when it has loaded, the kernel's until then. */
export function stageMover(fallback: MoverFactory): MoverFactory {
  return (spec, value) => (engine ? new MotionMover(engine, spec, value) : fallback(spec, value));
}
