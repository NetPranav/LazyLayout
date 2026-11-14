/**
 * Speed effects (Design track D18): squash and stretch along the motion, lean into turns, and a blur that follows how fast a
 * layer moves. Pure: the kernel gives it the layer's world velocity (the same half-frame measure the motion blur uses) and it
 * answers with what to add, so scrubbing shows the same as playing and a layer at rest gets exactly what it had.
 *
 * The amount follows the speed linearly up to a reference speed (`speed.ref`, px per second), then stays: at half the reference
 * speed a stretch of 1 is 1.5x along the motion; at the reference it is 2x; faster does not stretch more. Across the motion
 * the layer is squashed by 1 / sqrt(along), so its area is kept (a squash that stays the same size looks like rubber).
 */
export const DEFAULT_REFERENCE_SPEED = 1200;
/** Below this speed (px per second) a layer counts as at rest and is left alone. */
export const REST_SPEED = 2;

export interface SpeedSettings {
  /** Extra length along the motion at the reference speed: 1 is 2x long. */
  stretch: number;
  /** Degrees a layer leans toward the side it is moving, at the reference speed. */
  lean: number;
  /** Seconds of smear: the blur is as long as the layer travels in this time (a deviation of 0.2887 times that, as the motion blur). */
  blur: number;
  ref: number;
}

export interface SpeedEffect {
  /** 0..1: how fast, as a share of the reference speed. */
  amount: number;
  /** The direction of motion, degrees from right, turning clockwise (page y grows down). */
  direction: number;
  /** Scale along the direction of motion, and across it. */
  along: number;
  across: number;
  /** Degrees to lean. */
  lean: number;
  /** Blur deviations across and down, px. */
  blurX: number;
  blurY: number;
}

const finite = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** The settings a layer has, or null when no speed effect is switched on (the kernel then does no work for it). */
export function readSpeedSettings(get: (path: string) => unknown): SpeedSettings | null {
  const stretch = Math.max(0, finite(get("speed.stretch"), 0));
  const lean = finite(get("speed.lean"), 0);
  const blur = Math.max(0, finite(get("speed.blur"), 0));
  if (stretch === 0 && lean === 0 && blur === 0) return null;
  return { stretch, lean, blur, ref: Math.max(1, finite(get("speed.ref"), DEFAULT_REFERENCE_SPEED)) };
}

/** What the speed does to the layer, or null at rest. */
export function speedEffect(s: SpeedSettings, velocity: { x: number; y: number }): SpeedEffect | null {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!(speed >= REST_SPEED)) return null;
  const amount = clamp(speed / s.ref, 0, 1);
  const along = 1 + s.stretch * amount;
  return {
    amount: r4(amount),
    direction: r4((Math.atan2(velocity.y, velocity.x) * 180) / Math.PI),
    along: r4(along),
    across: r4(1 / Math.sqrt(along)),
    lean: r4(s.lean * clamp(velocity.x / s.ref, -1, 1)),
    blurX: r4(Math.abs(velocity.x) * s.blur * 0.2887),
    blurY: r4(Math.abs(velocity.y) * s.blur * 0.2887),
  };
}

/**
 * The CSS to add after a layer's own transform. `rotation` is how far the layer is turned on the page (degrees), so the stretch
 * runs along the motion on the page and not along the layer's own axes.
 */
export function speedTransform(e: SpeedEffect, rotation: number): string {
  const parts: string[] = [];
  if (e.along !== 1) {
    const local = r4(e.direction - rotation);
    parts.push(`rotate(${local}deg) scale(${e.along}, ${e.across}) rotate(${r4(-local)}deg)`);
  }
  if (e.lean !== 0) parts.push(`rotate(${e.lean}deg)`);
  return parts.join(" ");
}

/** Whether a layer has a speed effect on (for the engine to know it must be drawn every frame). */
export const speedEffectsOn = (props: Readonly<Record<string, unknown>>): boolean => readSpeedSettings((p) => props[p]) !== null;
