/** The spacing scale of the editor tokens (`--ll-spacing-*`), in px: padding and gap dragged on the canvas snap to it. */
export const SPACING_STEPS = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

const SNAP_WITHIN = 2;
const BEYOND_SCALE_STEP = 8;

/** A dragged value on the spacing scale when it is within a couple of pixels of a step, otherwise the whole pixel. `free` skips the snap. */
export function snapSpacing(value: number, free = false): number {
  const v = Math.max(0, Math.round(value));
  if (free) return v;
  const last = SPACING_STEPS[SPACING_STEPS.length - 1];
  if (v > last) {
    const step = Math.round(v / BEYOND_SCALE_STEP) * BEYOND_SCALE_STEP;
    return Math.abs(step - v) <= SNAP_WITHIN ? step : v;
  }
  let best: number = v;
  let bestD = SNAP_WITHIN + 1;
  for (const s of SPACING_STEPS) {
    const d = Math.abs(s - v);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
