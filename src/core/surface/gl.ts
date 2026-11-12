/**
 * Surfaces (ROADMAP S2–S6, decision 0018): drawing. One WebGL2 context, on a canvas that is never in the page, draws
 * every surface; each is then copied into its own 2D canvas. The lighting is a studio environment (a softbox above,
 * a floor below, two side panels) reflected by the surface's normal, with Fresnel, so foil looks like foil.
 */

import { compositor } from "../gpu/compositor";
import { gpuLedger, textureBytes } from "../gpu/ledger";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uHeight;   // resting height, px
uniform vec2 uHeightSize;    // the height grid's size in px
uniform sampler2D uDyn;      // press displacement, px
uniform vec2 uDynSize;
uniform sampler2D uContent;  // text drawn onto the surface (premultiplied)
uniform float uHasContent;
uniform vec2 uSize;          // the box, px
uniform float uScale;        // canvas pixels per px
uniform vec4 uShape;         // width, height, radius, kind (0 rounded rect, 1 ellipse)
uniform vec3 uBase;          // the fill colour (linear)
uniform vec4 uMaterial;      // f0, gloss, exposure, diffuse
uniform vec4 uLight;         // softbox, floor, sides, front
uniform vec4 uPress;         // x, y, amount, dent size
uniform vec4 uDynWrinkle;    // strength, count, seed, give
uniform vec2 uWarp;          // content refraction, content pull
uniform sampler2D uEnv;      // the studio, as an equirectangular map (intensity / 4)
uniform float uEnvLod;       // blur of the reflection (roughness), in mip levels

float sdShape(vec2 p) {
  vec2 hs = uShape.xy * 0.5;
  if (uShape.w > 0.5) {
    vec2 q = (p - hs) / hs;
    float k0 = length(q);
    float k1 = length(q / hs);
    return k1 > 0.0 ? k0 * (k0 - 1.0) / k1 : -min(hs.x, hs.y);
  }
  float r = min(uShape.z, min(hs.x, hs.y));
  vec2 q = abs(p - hs) - (hs - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uDynWrinkle.z * 17.0) * 43758.5453); }
float vnoise(float t) {
  float i = floor(t); float f = fract(t); float s = f * f * (3.0 - 2.0 * f);
  return mix(hash(vec2(i, 3.1)), hash(vec2(i + 1.0, 3.1)), s);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 s = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

float heightAt(vec2 p) {
  float h = texture(uHeight, p / uHeightSize).r + texture(uDyn, p / uDynSize).r;
  // a press crumples the foil round it: fine creases in every direction (they catch the light), plus a few radial folds
  if (uPress.z > 0.001 && uDynWrinkle.x > 0.0) {
    vec2 d = p - uPress.xy;
    float r = length(d);
    float a = atan(d.y, d.x);
    float fall = exp(-r * r / (2.0 * uPress.w * uPress.w * 0.7));
    float crumple = (vnoise2(p / 14.0) - 0.5) + 0.5 * (vnoise2(p / 7.0 + 7.0) - 0.5);
    float ridge = 1.0 - abs(2.0 * vnoise(a * uDynWrinkle.y / 6.2831853) - 1.0);
    float folds = (ridge * ridge - 0.4) * 2.5 * smoothstep(uPress.w * 0.25, uPress.w * 0.7, r);
    h += uDynWrinkle.x * uPress.z * fall * (crumple * 3.5 + folds);
  }
  return max(h, 0.0);
}

vec3 env(vec3 r) {
  // r: x right, y up, z towards the viewer. The studio's lights are in front of the object (on the viewer's side).
  float yaw = atan(r.x, r.z);
  float pitch = asin(clamp(r.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 + yaw / 6.2831853, 0.5 - pitch / 3.1415927);
  return textureLod(uEnv, uv, uEnvLod).rgb * 4.0 * uLight.x + vec3(uLight.w);
}

void main() {
  vec2 c = uShape.xy * 0.5;
  // the whole surface gives a little under a press
  vec2 p = c + (vUv * uSize - c) / (1.0 + uDynWrinkle.w);
  float sd = sdShape(p);
  float alpha = clamp(-sd * uScale + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) { outColor = vec4(0.0); return; }

  float e = 0.75;
  float hx = heightAt(p + vec2(e, 0.0)) - heightAt(p - vec2(e, 0.0));
  float hy = heightAt(p + vec2(0.0, e)) - heightAt(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx / (2.0 * e), hy / (2.0 * e), 1.0));
  vec3 r = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);

  float f0 = uMaterial.x;
  float fres = f0 + (1.0 - f0) * pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0);
  // gloss: a sharp reflection; less gloss blurs it towards the average light
  vec3 refl = env(r);
  vec3 L = normalize(vec3(0.0, 0.55, 1.0));
  float diff = max(dot(n, L), 0.0);
  vec3 col = uBase * (0.06 + uMaterial.w * diff) + refl * fres;

  // the rim, where the surface curves away, sees less light
  float h = heightAt(p);
  col *= mix(0.6, 1.0, smoothstep(0.0, 6.0, h));

  if (uHasContent > 0.5) {
    vec2 grad = vec2(hx, hy) / (2.0 * e);
    vec2 pull = vec2(0.0);
    if (uPress.z > 0.001) {
      vec2 d = p - uPress.xy;
      float fall = exp(-dot(d, d) / (2.0 * uPress.w * uPress.w));
      pull = d * fall * uPress.z * uWarp.y;
    }
    vec4 ink = texture(uContent, (p - grad * uWarp.x + pull) / uSize);
    vec3 lit = ink.rgb * (0.85 + 0.35 * diff) + refl * fres * ink.a * 0.25;
    col = col * (1.0 - ink.a) + lit;
  }

  col = vec3(1.0) - exp(-col * uMaterial.z);
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col * alpha, alpha);
}`;

export interface SurfaceDrawInput {
  width: number;
  height: number;
  /** Canvas pixels per px. */
  scale: number;
  shape: { width: number; height: number; radius: number; kind: "roundedRect" | "ellipse" };
  base: [number, number, number];
  material: { f0: number; gloss: number; exposure: number; diffuse: number };
  light: { softbox: number; floor: number; sides: number; front: number };
  press: { x: number; y: number; amount: number; size: number };
  dynWrinkle: { strength: number; count: number; seed: number; give: number };
  warp: { refraction: number; pull: number };
}

interface Tex {
  tex: WebGLTexture;
  w: number;
  h: number;
}

/** What one surface keeps on the GPU: its height, its press displacement and its content. */
let surfaceOwnerSeq = 0;
export class SurfaceTextures {
  /** The ledger owner of this surface's textures (3D-003). */
  readonly owner = `surface:${++surfaceOwnerSeq}`;
  height: Tex | null = null;
  heightPx: [number, number] = [1, 1];
  dyn: Tex | null = null;
  dynPx: [number, number] = [1, 1];
  content: Tex | null = null;
  hasContent = false;
  dispose(gl: WebGL2RenderingContext): void {
    for (const t of [this.height, this.dyn, this.content]) if (t) gl.deleteTexture(t.tex);
    gpuLedger.releaseOwner(this.owner);
    this.height = this.dyn = this.content = null;
  }
}

class SharedSurfaceGL {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly zero: WebGLTexture;
  /** 32-bit heights when the browser can filter them (smooth reflections); else 16-bit. */
  private readonly floatLinear: boolean;

  constructor() {
    // the compositor's shared surface context (3D-002, decision 0011): surfaces never open a context of their own
    const gl = compositor.shared();
    const canvas = compositor.sharedCanvasElement();
    if (!gl || !canvas) throw new Error("WebGL2 is not available");
    this.canvas = canvas;
    this.gl = gl;
    this.floatLinear = !!gl.getExtension("OES_texture_float_linear");
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    this.program = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uHeight", "uHeightSize", "uDyn", "uDynSize", "uContent", "uHasContent", "uSize", "uScale", "uShape", "uBase", "uMaterial", "uLight", "uPress", "uDynWrinkle", "uWarp", "uEnv", "uEnvLod"])
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    this.zero = this.makeFloatTexture(new Float32Array([0]), 1, 1).tex;
    this.env = this.makeEnvTexture();
  }

  private readonly env: WebGLTexture;

  /**
   * The studio (S3): an equirectangular map of a photo studio, made in code: a large softbox above and a little to the
   * left of the viewer, a thin strip light below it, two faint vertical strips at the sides, a dark floor. Stored as
   * intensity / 4 with mipmaps, so a rough surface reflects a blurred studio.
   */
  private makeEnvTexture(): WebGLTexture {
    const gl = this.gl;
    const W = 512;
    const H = 256;
    const data = new Uint8Array(W * H * 4);
    const soft = (v: number, a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const box = (yaw: number, pitch: number, cy: number, cp: number, hw: number, hh: number, edge: number) =>
      soft(hw - Math.abs(yaw - cy), -edge, edge) * soft(hh - Math.abs(pitch - cp), -edge, edge);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const yaw = ((x + 0.5) / W - 0.5) * 360;
        const pitch = (0.5 - (y + 0.5) / H) * 180;
        let v = 0.004;
        // the key softbox: big, above, a little left; brightest at its top
        v += 2.6 * box(yaw, pitch, -14, 30, 46, 17, 9) * (0.75 + 0.25 * soft(pitch, 18, 46));
        // a thin strip light under it
        v += 1.4 * box(yaw, pitch, -4, 8, 58, 2.5, 2.5);
        // faint vertical strips at the sides
        v += 0.5 * box(yaw, pitch, -78, 10, 4, 34, 4) + 0.35 * box(yaw, pitch, 78, 10, 4, 34, 4);
        // the floor: dark, a little lighter towards the horizon
        if (pitch < 0) v += 0.03 * soft(pitch, -60, -5);
        const c = Math.min(255, Math.round((v / 4) * 255));
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = c;
        data[i + 3] = 255;
      }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuLedger.track(tex, "surface:shared", "texture", textureBytes(W, H, "RGBA8", true), "studio environment");
    return tex;
  }

  makeFloatTexture(data: Float32Array, w: number, h: number, reuse?: Tex | null, owner = "surface:shared"): Tex {
    const gl = this.gl;
    const tex = reuse && reuse.w === w && reuse.h === h ? reuse.tex : gl.createTexture()!;
    if (reuse && reuse.tex !== tex) {
      gl.deleteTexture(reuse.tex);
      gpuLedger.release(reuse.tex);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.floatLinear ? gl.R32F : gl.R16F, w, h, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuLedger.track(tex, owner, "texture", textureBytes(w, h, this.floatLinear ? "R32F" : "R16F"), "height / press field");
    return { tex, w, h };
  }

  makeImageTexture(source: TexImageSource & { width: number; height: number }, reuse?: Tex | null, owner = "surface:shared"): Tex {
    const gl = this.gl;
    const tex = reuse ? reuse.tex : gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuLedger.track(tex, owner, "texture", textureBytes(source.width, source.height, "RGBA8"), "text content");
    return { tex, w: source.width, h: source.height };
  }

  draw(t: SurfaceTextures, input: SurfaceDrawInput, target: HTMLCanvasElement): void {
    const gl = this.gl;
    const pw = Math.max(1, Math.round(input.width * input.scale));
    const ph = Math.max(1, Math.round(input.height * input.scale));
    compositor.ensureSharedSize(pw, ph);
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    const u = this.uniforms;
    const bind = (unit: number, tex: WebGLTexture, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u[name], unit);
    };
    bind(0, t.height?.tex ?? this.zero, "uHeight");
    bind(1, t.dyn?.tex ?? this.zero, "uDyn");
    bind(2, t.content?.tex ?? this.zero, "uContent");
    bind(3, this.env, "uEnv");
    // gloss 1: a sharp studio (a little blur still: real foil isn't a mirror); gloss 0: very blurred
    gl.uniform1f(u.uEnvLod, 1.2 + (1 - input.material.gloss) * 5);
    gl.uniform2f(u.uHeightSize, t.heightPx[0], t.heightPx[1]);
    gl.uniform2f(u.uDynSize, t.dynPx[0], t.dynPx[1]);
    gl.uniform1f(u.uHasContent, t.content && t.hasContent ? 1 : 0);
    gl.uniform2f(u.uSize, input.width, input.height);
    gl.uniform1f(u.uScale, input.scale);
    gl.uniform4f(u.uShape, input.shape.width, input.shape.height, input.shape.radius, input.shape.kind === "ellipse" ? 1 : 0);
    gl.uniform3f(u.uBase, ...input.base);
    gl.uniform4f(u.uMaterial, input.material.f0, input.material.gloss, input.material.exposure, input.material.diffuse);
    gl.uniform4f(u.uLight, input.light.softbox, input.light.floor, input.light.sides, input.light.front);
    gl.uniform4f(u.uPress, input.press.x, input.press.y, input.press.amount, input.press.size);
    gl.uniform4f(u.uDynWrinkle, input.dynWrinkle.strength, input.dynWrinkle.count, input.dynWrinkle.seed, input.dynWrinkle.give);
    gl.uniform2f(u.uWarp, input.warp.refraction, input.warp.pull);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // the shared canvas may be bigger than this surface: the compositor copies the bottom-left pw × ph
    compositor.present(target, pw, ph);
  }
}

let shared: SharedSurfaceGL | null = null;
let failed = false;
let generation = 0;
let listening = false;

/**
 * The surface drawer on the compositor's shared context, or null when WebGL2 isn't there. After a context loss the
 * compositor says when the context is back; the drawer is then rebuilt and `surfaceGeneration()` changes, which tells
 * every surface to upload its textures again.
 */
export function surfaceGL(): SharedSurfaceGL | null {
  if (!listening && typeof document !== "undefined") {
    listening = true;
    compositor.onSharedRestored(() => {
      shared = null;
      failed = false;
      generation++;
    });
  }
  if (shared || failed) return shared;
  if (compositor.shared()?.isContextLost()) return null;
  try {
    shared = new SharedSurfaceGL();
  } catch {
    failed = true;
  }
  return shared;
}

/** Changes each time the shared context is re-created (after a loss): surfaces holding textures upload them again. */
export function surfaceGeneration(): number {
  return generation;
}

export type { SharedSurfaceGL };
