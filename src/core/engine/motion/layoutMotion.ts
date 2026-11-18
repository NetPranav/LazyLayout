/**
 * ROADMAP Phase 87: layout motion and presence, the settings. A layer can ask for its layout changes to be animated
 * (it moved because a sibling grew, the order changed, the stack turned from a row into a column), and for a way to
 * appear and to disappear.
 *
 * - `layoutMotion.on`: when the layer's place in its parent changes at once, it travels there on its transition.
 * - `presence.enter`, `presence.exit`: `none`, `fade`, `scale` (fades and grows from 85 %) or `rise` (fades and comes up 16 px).
 *
 * The transition is the layer's own (`transition.*`, Phase 79). Pure; the stage's side is `stage/LayoutDriver.ts`.
 */
export const PRESENCE_KINDS = ["none", "fade", "scale", "rise"] as const;
export type PresenceKind = (typeof PRESENCE_KINDS)[number];

/** Where a layer is when it is fully absent, for each way of appearing. Present is opacity 1, scale 1, y 0. */
export const PRESENCE_POSES: Record<PresenceKind, { opacity: number; scale: number; y: number }> = {
  none: { opacity: 1, scale: 1, y: 0 },
  fade: { opacity: 0, scale: 1, y: 0 },
  scale: { opacity: 0, scale: 0.85, y: 0 },
  rise: { opacity: 0, scale: 1, y: 16 },
};

export interface LayoutMotion {
  on: boolean;
  enter: PresenceKind;
  exit: PresenceKind;
}
const kind = (v: unknown): PresenceKind => ((PRESENCE_KINDS as readonly unknown[]).includes(v) ? (v as PresenceKind) : "none");

export function layoutMotionOf(props: Readonly<Record<string, unknown>>): LayoutMotion {
  return { on: props["layoutMotion.on"] === true, enter: kind(props["presence.enter"]), exit: kind(props["presence.exit"]) };
}
export const hasLayoutMotion = (props: Readonly<Record<string, unknown>>): boolean => {
  const m = layoutMotionOf(props);
  return m.on || m.enter !== "none" || m.exit !== "none";
};

/** The pose `amount` of the way from absent (0) to present (1). */
export function presencePose(kindOf: PresenceKind, amount: number): { opacity: number; scale: number; y: number } {
  const from = PRESENCE_POSES[kindOf];
  return { opacity: Math.min(1, Math.max(0, from.opacity + (1 - from.opacity) * amount)), scale: from.scale + (1 - from.scale) * amount, y: from.y * (1 - amount) };
}

/**
 * A jump in a series of positions: the part of this frame's move that the last frame's move doesn't explain. A layer
 * carried along by something animating moves a little each frame, and about as much as the frame before; a layout
 * change moves it all at once. Returns 0 for a move that looks continuous.
 */
export function layoutJump(previous: number, last: number, now: number, tolerance = 3): number {
  const unexplained = now - last - (last - previous);
  return Math.abs(unexplained) > tolerance ? unexplained : 0;
}
