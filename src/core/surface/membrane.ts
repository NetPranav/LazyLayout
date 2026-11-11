/**
 * Surfaces (ROADMAP S6): press physics. A damped membrane on the surface's grid: a press pushes it in at the pointer,
 * releasing lets it spring back with a ripple, and the rest of the surface rises a little (the air goes somewhere).
 * Fixed time steps, so the same presses give the same frames (the comparison harness replays them). Pure.
 */
import { gridFor, rasterMask, type Grid, type SurfaceShape } from "./field";

export interface PhysicsSettings {
  /** How fast the surface springs back (a wave speed in px/s). */
  stiffness: number;
  /** 0: rings for a long time; 1: no ripple. */
  damping: number;
  /** How deep a press pushes in, px. */
  dentDepth: number;
  /** Radius of the press, px. */
  dentSize: number;
  /** How much of the pushed-in volume comes back up elsewhere, 0..1. */
  volume: number;
  /** How much the whole surface gives under a press (scale), 0..0.1. */
  give: number;
}

export const DEFAULT_PHYSICS: PhysicsSettings = { stiffness: 520, damping: 0.35, dentDepth: 14, dentSize: 34, volume: 0.6, give: 0.02 };

export class MembraneSim {
  readonly grid: Grid;
  /** Displacement in px (negative: pushed in). */
  readonly u: Float32Array;
  private readonly vel: Float32Array;
  private readonly lap: Float32Array;
  private readonly mask: Uint8Array;
  private readonly inside: number;
  private press: { x: number; y: number; amount: number; down: boolean } = { x: 0, y: 0, amount: 0, down: false };
  /** The whole surface's give (scale offset, negative while pressed) and its speed. */
  give = 0;
  private giveVel = 0;
  settings: PhysicsSettings;

  constructor(shape: SurfaceShape, settings: PhysicsSettings = DEFAULT_PHYSICS, cell = 3) {
    this.grid = gridFor(shape.width, shape.height, cell);
    this.mask = rasterMask(shape, this.grid);
    this.u = new Float32Array(this.grid.w * this.grid.h);
    this.vel = new Float32Array(this.u.length);
    this.lap = new Float32Array(this.u.length);
    let n = 0;
    for (let i = 0; i < this.mask.length; i++) n += this.mask[i];
    this.inside = Math.max(1, n);
    this.settings = settings;
  }

  /** The pointer went down at (x, y) in the surface's own px. */
  pressAt(x: number, y: number): void {
    this.press = { x, y, amount: this.press.amount, down: true };
  }
  /** The pointer moved while down. */
  moveTo(x: number, y: number): void {
    if (this.press.down) this.press = { ...this.press, x, y };
  }
  release(): void {
    this.press = { ...this.press, down: false };
  }
  /** Where the press is and how far in (0..1): the shader gathers wrinkles round it. */
  get pressPoint(): { x: number; y: number; amount: number } {
    return { x: this.press.x, y: this.press.y, amount: this.press.amount };
  }

  /** Nothing is moving: the surface can stop being redrawn. */
  get settled(): boolean {
    if (this.press.down || this.press.amount > 0.002 || Math.abs(this.give) > 1e-4 || Math.abs(this.giveVel) > 1e-4) return false;
    for (let i = 0; i < this.u.length; i++) if (Math.abs(this.u[i]) > 0.02 || Math.abs(this.vel[i]) > 0.2) return false;
    return true;
  }

  /** Advances by `dt` seconds in fixed sub-steps. */
  step(dt: number): void {
    const sub = 1 / 480;
    let left = Math.min(dt, 0.1);
    while (left > 1e-9) {
      const h = Math.min(sub, left);
      this.substep(h);
      left -= h;
    }
  }

  private substep(dt: number): void {
    const { w, h, cell } = this.grid;
    const s = this.settings;
    // the press eases in and out (a finger isn't instant)
    const target = this.press.down ? 1 : 0;
    this.press.amount += (target - this.press.amount) * Math.min(1, dt * (this.press.down ? 28 : 40));
    const c2 = s.stiffness * s.stiffness;
    const zeta = 2 + 60 * s.damping;
    const k = 30;
    const sigma = Math.max(2, s.dentSize / 2);
    const amount = this.press.amount;
    // the Laplacian
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!this.mask[i]) continue;
        const l = x > 0 && this.mask[i - 1] ? this.u[i - 1] : 0;
        const r = x < w - 1 && this.mask[i + 1] ? this.u[i + 1] : 0;
        const t = y > 0 && this.mask[i - w] ? this.u[i - w] : 0;
        const b = y < h - 1 && this.mask[i + w] ? this.u[i + w] : 0;
        this.lap[i] = (l + r + t + b - 4 * this.u[i]) / (cell * cell);
      }
    let mean = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!this.mask[i]) continue;
        let a = c2 * this.lap[i] - k * this.u[i] - zeta * this.vel[i];
        if (amount > 1e-4) {
          // the finger: drives the surface towards -dentDepth under a Gaussian round the press
          const dx = (x + 0.5) * cell - this.press.x;
          const dy = (y + 0.5) * cell - this.press.y;
          const g = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
          a += 4000 * g * amount * (-s.dentDepth - this.u[i]);
        }
        this.vel[i] += a * dt;
        this.u[i] += this.vel[i] * dt;
        mean += this.u[i];
      }
    // the air goes somewhere: the pushed-in volume lifts the rest a little
    mean /= this.inside;
    if (s.volume > 0 && mean < 0) {
      const lift = -mean * s.volume * dt * 30;
      for (let i = 0; i < this.u.length; i++) if (this.mask[i]) this.u[i] += lift;
    }
    // the whole surface gives a little under a press, and springs back
    const giveTarget = -s.give * amount;
    const ga = 900 * (giveTarget - this.give) - 30 * this.giveVel;
    this.giveVel += ga * dt;
    this.give += this.giveVel * dt;
  }
}
