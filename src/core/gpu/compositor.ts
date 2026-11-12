/**
 * ROADMAP_3D 3D-002 (was Main 173), decision 0011: the GPU compositor. It owns every WebGL context the editor and the
 * exported site open (Law 13), in two roles:
 *
 * - **surface**: many small drawings (2.5D surfaces, effects) share ONE hidden context and copy their result into
 *   their own 2D canvas, so they keep their place among the page's layers and never multiply contexts.
 * - **scene**: each 3D scene draws into its own canvas with its own context, within a budget (`sceneBudget`). A scene
 *   that is off screen sleeps: it gives its context back and shows its last frame. When the budget is full, the
 *   longest-asleep scene is evicted first; a scene that can't get a context shows its poster until one is free.
 *
 * Context loss is recovered: listeners re-create what they own when the compositor says the context is back.
 * Everything here touches the DOM, so it lives outside the pure core folders.
 */

export type ContextRole = "surface" | "scene";

export interface CompositorStats {
  /** Live WebGL contexts (shared surface context included). */
  contexts: number;
  scenes: number;
  awake: number;
  asleep: number;
  /** Scenes waiting for a context because the budget is full. */
  waiting: number;
  losses: number;
  restores: number;
}

export interface SceneSlot {
  readonly id: number;
  readonly canvas: HTMLCanvasElement;
  /** The context while awake; null while asleep or waiting. */
  gl: WebGL2RenderingContext | null;
  /** Visible on screen (the caller reports it, e.g. from an IntersectionObserver). */
  visible: boolean;
  lastAwake: number;
}

type SceneCallbacks = {
  /** A context is ready (first time, after waking, or after a loss): create GPU resources and draw. */
  onReady: (gl: WebGL2RenderingContext) => void;
  /**
   * The context is going away (sleep, eviction or loss): forget GPU resources. A lost context clears its canvas, so on
   * sleep and eviction the compositor first copies the last frame into `poster` (a 2D canvas) for the scene to show.
   */
  onRelease?: (poster: HTMLCanvasElement | null) => void;
};

/**
 * `getExtension()` returns null once a context is lost, so the lose-context extension is kept from when the context
 * was created: it is the only way to ask for a lost context back.
 */
const loseExt = new WeakMap<WebGL2RenderingContext, WEBGL_lose_context>();
function keepLoseExt(gl: WebGL2RenderingContext): void {
  if (loseExt.has(gl)) return;
  const ext = gl.getExtension("WEBGL_lose_context");
  if (ext) loseExt.set(gl, ext);
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class GpuCompositor {
  /** How many scene contexts may be live at once (3 on the low tier, 6 by default). */
  sceneBudget = 6;
  private sharedCanvas: HTMLCanvasElement | null = null;
  private sharedGl: WebGL2RenderingContext | null = null;
  private sharedFailed = false;
  private readonly restoreListeners = new Set<() => void>();
  private readonly slots = new Map<number, SceneSlot & SceneCallbacks>();
  private nextId = 1;
  private losses = 0;
  private restores = 0;

  // ---------------------------------------------------------------------------------------------- the shared surface context

  /** The one context surfaces share, or null where WebGL2 isn't available. */
  shared(): WebGL2RenderingContext | null {
    if (this.sharedGl || this.sharedFailed) return this.sharedGl;
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) {
      this.sharedFailed = true;
      return null;
    }
    keepLoseExt(gl);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); // ask the browser to give it back
      this.losses++;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.restores++;
      for (const listener of [...this.restoreListeners]) listener();
    });
    this.sharedCanvas = canvas;
    this.sharedGl = gl;
    return gl;
  }

  /** The shared context's canvas (surfaces copy from it). */
  sharedCanvasElement(): HTMLCanvasElement | null {
    this.shared();
    return this.sharedCanvas;
  }

  /** Grows the shared canvas to at least w × h (it never shrinks: reallocating costs more than a few spare pixels). */
  ensureSharedSize(w: number, h: number): void {
    const c = this.sharedCanvasElement();
    if (!c) return;
    if (c.width < w) c.width = w;
    if (c.height < h) c.height = h;
  }

  /** Copies the bottom-left w × h of the shared canvas (GL's origin) into `target`. */
  present(target: HTMLCanvasElement, w: number, h: number): void {
    const src = this.sharedCanvas;
    if (!src) return;
    if (target.width !== w) target.width = w;
    if (target.height !== h) target.height = h;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, 0, src.height - h, w, h, 0, 0, w, h);
  }

  /** Called after the shared context comes back from a loss: re-create programs and textures. Returns the stop function. */
  onSharedRestored(listener: () => void): () => void {
    this.restoreListeners.add(listener);
    return () => void this.restoreListeners.delete(listener);
  }

  // ---------------------------------------------------------------------------------------------- scene contexts

  /** Registers a scene's canvas. It gets a context when visible and the budget allows. */
  registerScene(canvas: HTMLCanvasElement, callbacks: SceneCallbacks): SceneSlot {
    const slot: SceneSlot & SceneCallbacks = { id: this.nextId++, canvas, gl: null, visible: false, lastAwake: 0, ...callbacks };
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.losses++;
      slot.onRelease?.(null);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.restores++;
      if (slot.gl) slot.onReady(slot.gl);
    });
    this.slots.set(slot.id, slot);
    return slot;
  }

  /** The scene came into view or left it. */
  setVisible(slot: SceneSlot, visible: boolean): void {
    const s = this.slots.get(slot.id);
    if (!s) return;
    s.visible = visible;
    if (visible) this.wake(s);
    else this.sleep(s);
    this.schedule();
  }

  unregisterScene(slot: SceneSlot): void {
    const s = this.slots.get(slot.id);
    if (!s) return;
    this.sleep(s);
    this.slots.delete(slot.id);
    this.schedule();
  }

  private awakeCount(): number {
    let n = 0;
    for (const s of this.slots.values()) if (s.gl) n++;
    return n;
  }

  private wake(s: SceneSlot & SceneCallbacks): void {
    if (s.gl) return;
    if (this.awakeCount() >= this.sceneBudget) {
      // evict the longest-awake scene that isn't visible; if all are visible, this one waits
      const evictable = [...this.slots.values()].filter((o) => o.gl && !o.visible).sort((a, b) => a.lastAwake - b.lastAwake);
      if (evictable.length === 0) return;
      this.sleep(evictable[0]);
    }
    // a canvas keeps the same context object for its whole life; after a release it is restored by the browser
    const gl = s.canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) return;
    if (gl.isContextLost()) {
      loseExt.get(gl)?.restoreContext();
      s.gl = gl;
      s.lastAwake = now();
      return; // onReady comes with the restore event
    }
    keepLoseExt(gl);
    s.gl = gl;
    s.lastAwake = now();
    s.onReady(gl);
  }

  private sleep(s: SceneSlot & SceneCallbacks): void {
    if (!s.gl) return;
    // the last frame, kept as a 2D poster (losing the context clears the canvas)
    let poster: HTMLCanvasElement | null = null;
    if (typeof document !== "undefined" && s.canvas.width > 0 && s.canvas.height > 0) {
      poster = document.createElement("canvas");
      poster.width = s.canvas.width;
      poster.height = s.canvas.height;
      poster.getContext("2d")?.drawImage(s.canvas, 0, 0);
    }
    s.onRelease?.(poster);
    keepLoseExt(s.gl);
    loseExt.get(s.gl)?.loseContext();
    s.gl = null;
  }

  /** Visible scenes still waiting get a context as soon as one is free. */
  private schedule(): void {
    for (const s of this.slots.values()) if (s.visible && !s.gl) this.wake(s);
  }

  stats(): CompositorStats {
    const all = [...this.slots.values()];
    const awake = all.filter((s) => s.gl).length;
    return {
      contexts: (this.sharedGl && !this.sharedGl.isContextLost() ? 1 : 0) + awake,
      scenes: all.length,
      awake,
      asleep: all.filter((s) => !s.gl && !s.visible).length,
      waiting: all.filter((s) => !s.gl && s.visible).length,
      losses: this.losses,
      restores: this.restores,
    };
  }

  /** Test seam: loses the shared context now (the browser gives it back when asked). */
  loseSharedForTest(): void {
    if (this.sharedGl) loseExt.get(this.sharedGl)?.loseContext();
  }
  /** Test seam: asks for the shared context back. */
  restoreSharedForTest(): void {
    if (this.sharedGl) loseExt.get(this.sharedGl)?.restoreContext();
  }
}

/** The one compositor for the page. */
export const compositor = new GpuCompositor();

if (typeof window !== "undefined") {
  const w = window as unknown as {
    __LL_GPU__?: {
      stats: () => CompositorStats;
      loseShared: () => void;
      restoreShared: () => void;
    };
  };
  if (!w.__LL_GPU__) {
    Object.defineProperty(w, "__LL_GPU__", {
      configurable: true,
      get: () => ({
        stats: () => compositor.stats(),
        loseShared: () => compositor.loseSharedForTest(),
        restoreShared: () => compositor.restoreSharedForTest(),
      }),
    });
  }
}
