/**
 * ROADMAP_3D 3D-003 (was Main 174): render targets, ping-pong pairs and pass stacks on a compositor context, every
 * allocation written in the memory ledger. Float targets are used only after a capability check
 * (EXT_color_buffer_float), with RGBA8 as the clean fallback.
 */
import { gpuLedger, textureBytes } from "./ledger";

export type TargetFormat = "RGBA8" | "RGBA16F" | "RGBA32F";

/** Whether this context can render into float textures (and which). Cached per context. */
const caps = new WeakMap<WebGL2RenderingContext, { float16: boolean; float32: boolean; float32Linear: boolean }>();
export function gpuCaps(gl: WebGL2RenderingContext, forceNoFloat = false) {
  if (forceNoFloat) return { float16: false, float32: false, float32Linear: false };
  let c = caps.get(gl);
  if (!c) {
    const cbf = !!gl.getExtension("EXT_color_buffer_float");
    c = { float16: cbf, float32: cbf, float32Linear: !!gl.getExtension("OES_texture_float_linear") };
    caps.set(gl, c);
  }
  return c;
}

/** The best format available for `want`: a float wish falls back to RGBA8 where float targets aren't supported. */
export function resolveFormat(gl: WebGL2RenderingContext, want: TargetFormat, forceNoFloat = false): TargetFormat {
  const c = gpuCaps(gl, forceNoFloat);
  if (want === "RGBA32F") return c.float32 ? "RGBA32F" : c.float16 ? "RGBA16F" : "RGBA8";
  if (want === "RGBA16F") return c.float16 ? "RGBA16F" : "RGBA8";
  return "RGBA8";
}

const GL_FORMAT = (gl: WebGL2RenderingContext, f: TargetFormat) =>
  f === "RGBA32F" ? { internal: gl.RGBA32F, type: gl.FLOAT } : f === "RGBA16F" ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };

export class RenderTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly depth: WebGLRenderbuffer | null;
  readonly format: TargetFormat;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly owner: string,
    readonly width: number,
    readonly height: number,
    want: TargetFormat = "RGBA8",
    withDepth = false,
    forceNoFloat = false,
  ) {
    this.format = resolveFormat(gl, want, forceNoFloat);
    const { internal, type } = GL_FORMAT(gl, this.format);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuLedger.track(this.texture, owner, "texture", textureBytes(width, height, this.format), "target colour");
    this.framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gpuLedger.track(this.framebuffer, owner, "framebuffer", 0, "target");
    this.depth = null;
    if (withDepth) {
      this.depth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.depth);
      gpuLedger.track(this.depth, owner, "renderbuffer", textureBytes(width, height, "DEPTH24_STENCIL8"), "target depth");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Makes this target the one drawn into (null: the canvas). */
  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    if (!gl.isContextLost()) {
      gl.deleteTexture(this.texture);
      gl.deleteFramebuffer(this.framebuffer);
      if (this.depth) gl.deleteRenderbuffer(this.depth);
    }
    gpuLedger.release(this.texture);
    gpuLedger.release(this.framebuffer);
    if (this.depth) gpuLedger.release(this.depth);
  }
}

/** Two targets that swap each pass: read one, write the other (blurs, feedback, simulations on the GPU). */
export class PingPong {
  private a: RenderTarget;
  private b: RenderTarget;
  constructor(gl: WebGL2RenderingContext, owner: string, width: number, height: number, want: TargetFormat = "RGBA16F", forceNoFloat = false) {
    this.a = new RenderTarget(gl, owner, width, height, want, false, forceNoFloat);
    this.b = new RenderTarget(gl, owner, width, height, want, false, forceNoFloat);
  }
  get read(): RenderTarget {
    return this.a;
  }
  get write(): RenderTarget {
    return this.b;
  }
  swap(): void {
    [this.a, this.b] = [this.b, this.a];
  }
  dispose(): void {
    this.a.dispose();
    this.b.dispose();
  }
}

export interface Pass {
  name: string;
  /** Draws from `input` (null for the first pass) into the bound target. */
  run: (gl: WebGL2RenderingContext, input: RenderTarget | null) => void;
  enabled?: boolean;
}

/**
 * An ordered list of passes. Each pass writes into a target; the last writes to `output` (null: the canvas). Passes
 * that are switched off are skipped, so a tier can drop them (3D-005).
 */
export class PassStack {
  private readonly targets: PingPong;
  constructor(private readonly gl: WebGL2RenderingContext, owner: string, readonly width: number, readonly height: number, readonly passes: Pass[] = [], want: TargetFormat = "RGBA16F") {
    this.targets = new PingPong(gl, owner, width, height, want);
  }
  run(output: RenderTarget | null = null): string[] {
    const gl = this.gl;
    const active = this.passes.filter((p) => p.enabled !== false);
    let input: RenderTarget | null = null;
    active.forEach((p, i) => {
      const last = i === active.length - 1;
      if (last) {
        if (output) output.bind();
        else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, this.width, this.height);
        }
      } else this.targets.write.bind();
      p.run(gl, input);
      if (!last) {
        this.targets.swap();
        input = this.targets.read;
      }
    });
    return active.map((p) => p.name);
  }
  dispose(): void {
    this.targets.dispose();
  }
}
