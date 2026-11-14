/**
 * The input bus (Design track D4, engine spec §4): sampled once per frame by whoever owns the page, then read as a
 * `Frame` by the evaluator. This module is pure; the editor (or an export) supplies an `InputSource` that measures the
 * real page, and a test supplies a fake one, so the same chains give the same values everywhere.
 *
 * Signals served today: the pointer (position in px and in uv / ndc of the page, motion, speed, button), scroll
 * (position, progress, velocity, direction), time and frame dt. Signals not served yet (`view`, `device`, `audio`,
 * `hover` and the other layer-state signals, `proximity`) read as 0 and are listed by `unservedSignals`, so the editor
 * can say so instead of silently showing nothing.
 */
import type { Signal, SignalExpr } from "../document/signals";
import type { Frame, Value, Vec2 } from "./evaluate";

/** What the host measures for one frame. */
export interface InputSource {
  /** Pointer position in page px, or null when it has never been over the page. */
  pointer(): { x: number; y: number; down: boolean; coarse: boolean; pressure: number; type: "mouse" | "pen" | "touch" } | null;
  /** The page's size in px, for uv and ndc. */
  pageSize(): { width: number; height: number };
  /** Scroll of the frame: position and the largest position (content height minus viewport), in px. */
  scroll(): { y: number; max: number };
}

/** Per-frame values that depend on the last frame (motion, speed, scroll velocity); owned by the bus, not the source. */
export interface BusState {
  last: { x: number; y: number; scrollY: number } | null;
  /** Smoothed pointer speed, px/s. */
  speed: number;
  dx: number;
  dy: number;
  angle: number;
  scrollVelocity: number;
  scrollDirection: number;
}
export const newBusState = (): BusState => ({ last: null, speed: 0, dx: 0, dy: 0, angle: 0, scrollVelocity: 0, scrollDirection: 0 });

const SERVED = new Set(["pointer", "pointerIn", "scroll", "time", "frameDt", "seed", "constant"]);

/** Advance the bus by one frame and return that frame's inputs. Call once per frame, in time order. */
export function busFrame(source: InputSource, state: BusState, time: number, dt: number, seed = 0): Frame {
  const p = source.pointer();
  const size = source.pageSize();
  const sc = source.scroll();
  const x = p?.x ?? 0;
  const y = p?.y ?? 0;
  if (state.last && dt > 0) {
    state.dx = x - state.last.x;
    state.dy = y - state.last.y;
    const inst = Math.hypot(state.dx, state.dy) / dt;
    state.speed += (inst - state.speed) * (1 - Math.exp(-dt / 0.05)); // smoothed over about 3 frames, as in the spec
    if (state.dx !== 0 || state.dy !== 0) state.angle = (Math.atan2(state.dy, state.dx) * 180) / Math.PI;
    const dScroll = sc.y - state.last.scrollY;
    state.scrollVelocity += (dScroll / dt - state.scrollVelocity) * (1 - Math.exp(-dt / 0.05));
    if (dScroll !== 0) state.scrollDirection = Math.sign(dScroll);
  }
  state.last = { x, y, scrollY: sc.y };
  const u = size.width > 0 ? x / size.width : 0;
  const v = size.height > 0 ? y / size.height : 0;
  const progress = sc.max > 0 ? Math.min(1, Math.max(0, sc.y / sc.max)) : 0;

  const read = (s: Signal): Value => {
    switch (s.kind) {
      case "pointer":
        switch (s.channel) {
          case "x": return x;
          case "y": return y;
          case "dx": return state.dx;
          case "dy": return state.dy;
          case "speed": return state.speed;
          case "angle": return state.angle;
          case "velocity": return [state.dx / Math.max(dt, 1e-6), state.dy / Math.max(dt, 1e-6)] as Vec2;
          case "down": return p?.down ?? false;
          case "pressure": return p ? (p.down && p.pressure === 0 ? 0.5 : p.pressure) : 0;
          case "type": return p ? (p.type === "mouse" ? 0 : p.type === "pen" ? 1 : 2) : 0;
          case "coarse": return p?.coarse ?? false;
        }
        return 0;
      case "pointerIn":
        return s.channel === "uv" ? [u, v] : s.channel === "ndc" ? [u * 2 - 1, v * 2 - 1] : [x, y];
      case "scroll":
        return s.channel === "y" ? sc.y : s.channel === "progress" ? progress : s.channel === "velocity" ? state.scrollVelocity : state.scrollDirection;
      default:
        return 0;
    }
  };
  return { time, dt, seed, read };
}

/** Every signal an expression reads, including those inside operators that take a second expression. */
export function signalsOf(expr: SignalExpr): Signal[] {
  const out: Signal[] = [expr.signal];
  for (const op of expr.operators) {
    if (op.op === "sampleHold") out.push(...signalsOf(op.trigger));
    else if (op.op === "mix") out.push(...signalsOf(op.with));
    else if (op.op === "distance" || op.op === "angleTo") out.push(...signalsOf(op.to));
    else if (op.op === "select") out.push(...signalsOf(op.whenTrue), ...signalsOf(op.whenFalse));
  }
  return out;
}

/** The signals an expression reads that the bus does not serve (they would read 0). */
export function unservedSignals(expr: SignalExpr): Signal[] {
  return signalsOf(expr).filter((s) => !SERVED.has(s.kind));
}
