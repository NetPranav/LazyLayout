/**
 * Surfaces: one surface on the page. It solves the resting height when its settings or size change, runs the press
 * physics while something moves, draws its text content onto itself, and redraws only when needed. The editor and the
 * exported site's runtime both use this; they differ only in the `Ticker` (the frame scheduler, or the page's own frames).
 */
import { restingSurface, type SurfaceShape } from "./field";
import { MembraneSim } from "./membrane";
import { surfaceGL, SurfaceTextures, type SurfaceDrawInput } from "./gl";
import { lookKey, type SurfaceSettings } from "./settings";

/** Runs `task` every frame with the seconds since the last one; returns the stop function. */
export type Ticker = (task: (dt: number) => void) => () => void;

export interface SurfaceGeometry {
  width: number;
  height: number;
  radius: number;
  kind: "roundedRect" | "ellipse";
}

export class SurfaceController {
  private readonly tex = new SurfaceTextures();
  private geometry: SurfaceGeometry | null = null;
  private settings: SurfaceSettings | null = null;
  private base: [number, number, number] = [0.01, 0.01, 0.01];
  private restKey = "";
  private sim: MembraneSim | null = null;
  private simKey = "";
  private stopTicker: (() => void) | null = null;
  private scale = 1;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ticker: Ticker) {}

  /** The surface's shape, colour and settings; solves again only what changed. */
  update(geometry: SurfaceGeometry, settings: SurfaceSettings, base: [number, number, number], scale: number): void {
    this.geometry = geometry;
    this.settings = settings;
    this.base = base;
    this.scale = Math.max(0.25, Math.min(4, scale));
    const gl = surfaceGL();
    if (!gl) return;
    const shape: SurfaceShape = geometry.kind === "ellipse" ? { kind: "ellipse", width: geometry.width, height: geometry.height } : { kind: "roundedRect", width: geometry.width, height: geometry.height, radius: geometry.radius };
    const key = lookKey(geometry.width, geometry.height, geometry.radius, geometry.kind, settings.look);
    if (key !== this.restKey) {
      this.restKey = key;
      const cell = geometry.width * geometry.height > 600_000 ? 2 : 1;
      const rest = restingSurface(shape, settings.look, cell);
      this.tex.height = gl.makeFloatTexture(rest.height, rest.grid.w, rest.grid.h, this.tex.height);
      this.tex.heightPx = [rest.grid.w * rest.grid.cell, rest.grid.h * rest.grid.cell];
    }
    const simKey = [Math.round(geometry.width), Math.round(geometry.height), Math.round(geometry.radius), geometry.kind].join("|");
    if (simKey !== this.simKey || !this.sim) {
      this.simKey = simKey;
      this.sim = new MembraneSim(shape, settings.physics, 3);
      this.uploadDyn();
    }
    this.sim.settings = settings.physics;
    this.draw();
  }

  /** Text drawn onto the surface (a canvas the size of the box × scale), or null for none. */
  setContent(source: HTMLCanvasElement | null): void {
    const gl = surfaceGL();
    if (!gl) return;
    if (!source) {
      this.tex.hasContent = false;
    } else {
      this.tex.content = gl.makeImageTexture(source, this.tex.content);
      this.tex.hasContent = true;
    }
    this.draw();
  }

  /** A press at (x, y) in the surface's own px. */
  press(x: number, y: number): void {
    this.sim?.pressAt(x, y);
    this.run();
  }
  move(x: number, y: number): void {
    this.sim?.moveTo(x, y);
  }
  release(): void {
    this.sim?.release();
    this.run();
  }

  /** Is the press physics still moving? */
  get moving(): boolean {
    return this.stopTicker !== null;
  }

  private run(): void {
    if (this.stopTicker || this.disposed) return;
    this.stopTicker = this.ticker((dt) => {
      if (!this.sim) return;
      this.sim.step(dt);
      this.uploadDyn();
      this.draw();
      if (this.sim.settled) {
        this.stopTicker?.();
        this.stopTicker = null;
      }
    });
  }

  private uploadDyn(): void {
    const gl = surfaceGL();
    if (!gl || !this.sim) return;
    this.tex.dyn = gl.makeFloatTexture(this.sim.u, this.sim.grid.w, this.sim.grid.h, this.tex.dyn);
    this.tex.dynPx = [this.sim.grid.w * this.sim.grid.cell, this.sim.grid.h * this.sim.grid.cell];
  }

  draw(): void {
    const gl = surfaceGL();
    if (!gl || !this.geometry || !this.settings || this.disposed) return;
    const g = this.geometry;
    const s = this.settings;
    const press = this.sim?.pressPoint ?? { x: 0, y: 0, amount: 0 };
    const input: SurfaceDrawInput = {
      width: g.width,
      height: g.height,
      scale: this.scale,
      shape: { width: g.width, height: g.height, radius: g.radius, kind: g.kind },
      base: this.base,
      material: s.material,
      light: s.light,
      press: { x: press.x, y: press.y, amount: press.amount, size: s.physics.dentSize },
      dynWrinkle: { strength: s.pressWrinkles, count: 14, seed: s.look.seed, give: this.sim?.give ?? 0 },
      warp: s.warp,
    };
    gl.draw(this.tex, input, this.canvas);
  }

  dispose(): void {
    this.disposed = true;
    this.stopTicker?.();
    this.stopTicker = null;
    const gl = surfaceGL();
    if (gl) this.tex.dispose(gl.gl);
  }
}

/**
 * Draws the text elements inside `host` onto a canvas the size of `host` × `scale`, word by word at their laid-out
 * places, so a surface can print them on itself. Returns null when there is no text.
 */
export function rasterizeText(host: HTMLElement, scale: number): HTMLCanvasElement | null {
  const texts = Array.from(host.querySelectorAll<HTMLElement>('[data-archetype="text"]'));
  if (texts.length === 0) return null;
  const doc = host.ownerDocument;
  const hostRect = host.getBoundingClientRect();
  const zoom = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 1;
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(host.offsetWidth * scale));
  canvas.height = Math.max(1, Math.round(host.offsetHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  let drew = false;
  for (const el of texts) {
    const cs = doc.defaultView!.getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    const spacing = cs.letterSpacing && cs.letterSpacing !== "normal" ? cs.letterSpacing : "0px";
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = spacing;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      const re = /\S+/g;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        const range = doc.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rects = Array.from(range.getClientRects());
        if (rects.length === 0) continue;
        const r = rects[0];
        const metrics = ctx.measureText(m[0]);
        const asc = metrics.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
        const desc = metrics.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
        const x = (r.left - hostRect.left) / zoom;
        const top = (r.top - hostRect.top) / zoom;
        const hgt = r.height / zoom;
        const baseline = top + (hgt - (asc + desc)) / 2 + asc;
        ctx.fillText(m[0], x, baseline);
        drew = true;
      }
    }
  }
  return drew ? canvas : null;
}
