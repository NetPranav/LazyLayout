/**
 * Surfaces (ROADMAP S2–S6, decision 0018): drawing. One WebGL2 context, on a canvas that is never in the page, draws
 * every surface; each is then copied into its own 2D canvas. The lighting is a studio environment (a softbox above,
 * a floor below, two side panels) reflected by the surface's normal, with Fresnel, so foil looks like foil.
 */

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
  // a broad softbox above, in front and a little to the left: what faces backwards (r.z < 0) can't see it
  float front = smoothstep(-0.15, 0.3, r.z);
  float soft = smoothstep(0.05, 0.5, r.y) * (1.0 - smoothstep(0.7, 0.98, r.y)) * (1.0 - smoothstep(0.35, 0.95, abs(r.x + 0.32))) * front;
  // the floor, seen only by the steepest lower flank
  float floorL = smoothstep(-0.8, -0.99, r.y);
  float sides = smoothstep(0.5, 0.9, abs(r.x)) * (1.0 - smoothstep(0.15, 0.6, abs(r.y)));
  return vec3(uLight.x * soft + uLight.y * floorL + uLight.z * sides + uLight.w);
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
  vec3 refl = mix(vec3(0.5 * (uLight.x + uLight.y) * 0.35 + uLight.w), env(r), uMaterial.y);
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
    vec3 lit = ink.rgb * (0.55 + 0.55 * diff) + refl * fres * ink.a * 0.35;
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
export class SurfaceTextures {
  height: Tex | null = null;
  heightPx: [number, number] = [1, 1];
  dyn: Tex | null = null;
  dynPx: [number, number] = [1, 1];
  content: Tex | null = null;
  hasContent = false;
  dispose(gl: WebGL2RenderingContext): void {
    for (const t of [this.height, this.dyn, this.content]) if (t) gl.deleteTexture(t.tex);
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
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is not available");
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
    for (const name of ["uHeight", "uHeightSize", "uDyn", "uDynSize", "uContent", "uHasContent", "uSize", "uScale", "uShape", "uBase", "uMaterial", "uLight", "uPress", "uDynWrinkle", "uWarp"])
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    this.zero = this.makeFloatTexture(new Float32Array([0]), 1, 1).tex;
  }

  makeFloatTexture(data: Float32Array, w: number, h: number, reuse?: Tex | null): Tex {
    const gl = this.gl;
    const tex = reuse && reuse.w === w && reuse.h === h ? reuse.tex : gl.createTexture()!;
    if (reuse && reuse.tex !== tex) gl.deleteTexture(reuse.tex);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.floatLinear ? gl.R32F : gl.R16F, w, h, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex, w, h };
  }

  makeImageTexture(source: TexImageSource & { width: number; height: number }, reuse?: Tex | null): Tex {
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
    return { tex, w: source.width, h: source.height };
  }

  draw(t: SurfaceTextures, input: SurfaceDrawInput, target: HTMLCanvasElement): void {
    const gl = this.gl;
    const pw = Math.max(1, Math.round(input.width * input.scale));
    const ph = Math.max(1, Math.round(input.height * input.scale));
    if (this.canvas.width < pw) this.canvas.width = pw;
    if (this.canvas.height < ph) this.canvas.height = ph;
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
    if (target.width !== pw) target.width = pw;
    if (target.height !== ph) target.height = ph;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, pw, ph);
    // the GL canvas may be bigger than this surface: copy the bottom-left pw × ph (GL's origin is bottom left)
    ctx.drawImage(this.canvas, 0, this.canvas.height - ph, pw, ph, 0, 0, pw, ph);
  }
}

let shared: SharedSurfaceGL | null = null;
let failed = false;

/** The one context every surface draws with (decision 0018), or null when WebGL2 isn't there. */
export function surfaceGL(): SharedSurfaceGL | null {
  if (shared || failed) return shared;
  try {
    shared = new SharedSurfaceGL();
  } catch {
    failed = true;
  }
  return shared;
}

/** How many WebGL contexts surfaces have opened (the budget test reads this: never more than one). */
export function surfaceContextCount(): number {
  return shared ? 1 : 0;
}

export type { SharedSurfaceGL };
