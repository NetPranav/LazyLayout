/**
 * ROADMAP Phase 79: transitions between states. When a layer goes from one state to another (idle to hover, hover to
 * pressed, back again) each state's share of the picture moves from 0 to 1 or back along a spring or a tween, set on
 * the layer. An interruption keeps what was already moving: a spring carries on from where it is with the speed it
 * has (so ten quick clicks never snap), and a tween starts again from where it is.
 *
 * - `transition.type`: `spring` (the default for interactions) or `tween`.
 * - `transition.duration` (seconds): how long a tween takes, or how long a spring takes to (nearly) get there.
 * - `transition.bounce` (0 to 1): how far a spring overshoots. 0 doesn't.
 * - `transition.curve`: a tween's easing.
 * - `transition.N.property` with `transition.N.type`, `.duration`, `.bounce` (N is 1 to 3): one property that moves
 *   differently from the rest (a colour that fades slowly while the size springs).
 *
 * Pure: the stage steps it with the frame's time; the same steps give the same picture.
 */
import { parseEasing } from "../document/motion";
import { sampleEasing } from "../kernel/easing";
import { evaluateSpring, perceptualToPhysical, type PhysicalSpring } from "../kernel/springs";

export const TRANSITION_TYPES = ["spring", "tween"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];
export const TRANSITION_CURVES = ["linear", "power2.out", "power2.in", "power2.inOut", "power4.out"] as const;
export const TRANSITION_OVERRIDES = 3;
export const overridePath = (slot: number, name: "property" | "type" | "duration" | "bounce"): string => `transition.${slot}.${name}`;

export interface TransitionSpec {
  type: TransitionType;
  duration: number;
  bounce: number;
  curve: string;
}
export const TRANSITION_DEFAULT: TransitionSpec = { type: "spring", duration: 0.35, bounce: 0.15, curve: "power2.out" };

type Props = Readonly<Record<string, unknown>>;
const num = (v: unknown, fallback: number, min: number, max: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const kind = (v: unknown, fallback: TransitionType): TransitionType => (v === "spring" || v === "tween" ? v : fallback);

/** The layer's own transition (every property that has no override). */
export function transitionOf(props: Props): TransitionSpec {
  return {
    type: kind(props["transition.type"], TRANSITION_DEFAULT.type),
    duration: num(props["transition.duration"], TRANSITION_DEFAULT.duration, 0.01, 10),
    bounce: num(props["transition.bounce"], TRANSITION_DEFAULT.bounce, 0, 1),
    curve: typeof props["transition.curve"] === "string" && parseEasing(props["transition.curve"] as string) ? (props["transition.curve"] as string) : TRANSITION_DEFAULT.curve,
  };
}

/** The properties that move on a transition of their own, with it. A slot with no property is skipped; a setting it leaves out is the layer's. */
export function transitionOverrides(props: Props): Map<string, TransitionSpec> {
  const out = new Map<string, TransitionSpec>();
  const base = transitionOf(props);
  for (let slot = 1; slot <= TRANSITION_OVERRIDES; slot++) {
    const property = props[overridePath(slot, "property")];
    if (typeof property !== "string" || property === "" || out.has(property)) continue;
    out.set(property, {
      type: kind(props[overridePath(slot, "type")], base.type),
      duration: num(props[overridePath(slot, "duration")], base.duration, 0.01, 10),
      bounce: num(props[overridePath(slot, "bounce")], base.bounce, 0, 1),
      curve: base.curve,
    });
  }
  return out;
}

/**
 * What the stage's drivers move a number with. `Mover` below is the kernel's own; Phase 87's `MotionMover` is the same
 * thing on Motion's spring and keyframes generators, used once that library has loaded.
 */
export interface MoverLike {
  value: number;
  velocity: number;
  target: number;
  readonly resting: boolean;
  use(spec: TransitionSpec): void;
  to(target: number): void;
  jump(target: number): void;
  /** Moves the number by `delta` at once without touching its speed or where it is going (a layout jump absorbed by a FLIP). */
  shift(delta: number): void;
  step(dt: number): number;
}
export type MoverFactory = (spec: TransitionSpec, value?: number) => MoverLike;
export const kernelMover: MoverFactory = (spec, value) => new Mover(spec, value);

export const specKey = (s: TransitionSpec): string => `${s.type}|${s.duration}|${s.bounce}|${s.curve}`;
const REST = 0.0005;

/**
 * One number moving towards a target (a state's share, 0 to 1) on a transition. `to` changes where it is going without
 * touching where it is or how fast it is moving; `step` advances it by a frame's time.
 */
export class Mover implements MoverLike {
  value: number;
  velocity = 0;
  target: number;
  private origin: number;
  private startVelocity = 0;
  private elapsed = 0;
  private spec: TransitionSpec;
  private physical: PhysicalSpring;
  private key: string;

  constructor(spec: TransitionSpec, value = 0) {
    this.value = this.target = this.origin = value;
    this.spec = spec;
    this.key = specKey(spec);
    this.physical = perceptualToPhysical(spec.bounce, spec.duration);
  }

  /** A changed setting takes effect from where the number is now. */
  use(spec: TransitionSpec): void {
    const key = specKey(spec);
    if (key === this.key) return;
    this.spec = spec;
    this.key = key;
    this.physical = perceptualToPhysical(spec.bounce, spec.duration);
    this.restart();
  }

  private restart(): void {
    this.origin = this.value;
    this.startVelocity = this.velocity;
    this.elapsed = 0;
  }

  to(target: number): void {
    if (target === this.target) return;
    this.target = target;
    this.restart();
  }

  shift(delta: number): void {
    if (delta === 0) return;
    this.value += delta;
    this.restart();
  }

  /** Puts the number at its target at once (reduced motion, or a state being edited). */
  jump(target: number): void {
    this.value = this.target = this.origin = target;
    this.velocity = this.startVelocity = this.elapsed = 0;
  }

  get resting(): boolean {
    return this.value === this.target && this.velocity === 0;
  }

  step(dt: number): number {
    if (this.resting) return this.value;
    this.elapsed += Math.max(0, dt);
    if (this.spec.type === "spring") {
      const s = evaluateSpring(this.physical, this.elapsed, this.origin, this.target, this.startVelocity);
      this.value = s.value;
      this.velocity = s.velocity;
      if (Math.abs(this.value - this.target) < REST && Math.abs(this.velocity) < REST * 20) this.jump(this.target);
    } else {
      const p = Math.min(1, this.elapsed / this.spec.duration);
      const before = this.value;
      this.value = this.origin + (this.target - this.origin) * sampleEasing(parseEasing(this.spec.curve) ?? { kind: "linear" }, p);
      this.velocity = dt > 0 ? (this.value - before) / dt : 0;
      if (p >= 1) this.jump(this.target);
    }
    return this.value;
  }
}

/** One state's share of a layer's picture: `amount` for every property, and `amounts` for the ones with a transition of their own. */
export interface StateShare {
  name: string;
  amount: number;
  amounts?: Record<string, number>;
}
