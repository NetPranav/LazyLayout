/**
 * ROADMAP_3D 3D-002: the measurement behind decision 0011 (how surfaces share the GPU). Each strategy draws the same
 * scene: 20 small surfaces (454 × 160 at 2×) and one large (1440 × 900), every frame, for 120 frames:
 *   copy     one hidden WebGL2 context; each surface's 2D canvas copies its result (drawImage)
 *   bitmap   one OffscreenCanvas WebGL2 context; each surface takes its result as an ImageBitmap (transferToImageBitmap
 *            → a "bitmaprenderer" canvas: no copy)
 *   percanvas one WebGL2 context per surface
 * Prints the mean and p95 frame time and the renderer string (to tell a real GPU from SwiftShader).
 *
 *   npx tsx scripts/benchmarks/gpu-surfaces.ts [--gpu]
 */
import { chromium } from "@playwright/test";

const html = `<!doctype html><html><body style="margin:0;background:#fff"><div id="host"></div><script>
const SMALL = { w: 908, h: 320 }, LARGE = { w: 1440, h: 900 }, N = 20, FRAMES = 120;
const VS = "#version 300 es\\nin vec2 p; out vec2 uv; void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }";
const FS = "#version 300 es\\nprecision highp float; in vec2 uv; uniform float t; out vec4 o;" +
  "void main(){ float a=0.; for(int i=0;i<24;i++){ a += sin(uv.x*float(i)*3.1+t)*cos(uv.y*float(i)*2.3-t); } o = vec4(vec3(0.5+0.02*a), 1.); }";
function setup(gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(pr, 0, "p"); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return gl.getUniformLocation(pr, "t");
}
function draw(gl, t, uT, w, h) { gl.viewport(0, 0, w, h); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
function targets(kind) {
  const host = document.getElementById("host"); host.innerHTML = "";
  const list = [];
  for (let i = 0; i <= N; i++) { const s = i === N ? LARGE : SMALL; const c = document.createElement("canvas"); c.width = s.w; c.height = s.h; c.style.width = (s.w/2)+"px"; host.appendChild(c); list.push(c); }
  return list;
}
async function frames(run) {
  const times = [];
  for (let f = 0; f < FRAMES; f++) {
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = performance.now(); run(f); const gl = window.__gl; if (gl) gl.finish(); times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { mean: times.reduce((a, b) => a + b, 0) / times.length, p95: times[Math.floor(times.length * 0.95)] };
}
window.bench = async function () {
  const out = {};
  // copy
  { const list = targets(); const hidden = document.createElement("canvas"); hidden.width = LARGE.w; hidden.height = LARGE.h;
    const gl = hidden.getContext("webgl2", { preserveDrawingBuffer: true }); const uT = setup(gl); window.__gl = null;
    const ctxs = list.map((c) => c.getContext("2d"));
    const dbg = gl.getExtension("WEBGL_debug_renderer_info"); out.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?";
    out.copy = await frames((f) => list.forEach((c, i) => { draw(gl, f / 60 + i, uT, c.width, c.height); ctxs[i].drawImage(hidden, 0, hidden.height - c.height, c.width, c.height, 0, 0, c.width, c.height); })); }
  // bitmap: one OffscreenCanvas per surface size (resizing one canvas reallocates its buffer: measured 38 ms a frame)
  { const list = targets(); const pool = new Map(); window.__gl = null;
    const offFor = (w, h) => { const k = w + "x" + h; if (!pool.has(k)) { const off = new OffscreenCanvas(w, h); const gl = off.getContext("webgl2"); pool.set(k, { off, gl, uT: setup(gl) }); } return pool.get(k); };
    const ctxs = list.map((c) => c.getContext("bitmaprenderer"));
    out.bitmap = await frames((f) => list.forEach((c, i) => { const o = offFor(c.width, c.height); draw(o.gl, f / 60 + i, o.uT, c.width, c.height); ctxs[i].transferFromImageBitmap(o.off.transferToImageBitmap()); }));
    out.bitmapContexts = pool.size; }
  // one context per canvas
  { const list = targets(); const gls = list.map((c) => c.getContext("webgl2")); const uTs = gls.map((g) => g ? setup(g) : null); window.__gl = null;
    out.contexts = gls.filter(Boolean).length;
    out.percanvas = await frames((f) => list.forEach((c, i) => { if (gls[i]) draw(gls[i], f / 60 + i, uTs[i], c.width, c.height); })); }
  return out;
};
</script></body></html>`;

(async () => {
  const gpu = process.argv.includes("--gpu");
  const browser = await chromium.launch({ args: gpu ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.setContent(html);
  const r = await page.evaluate(() => (window as unknown as { bench: () => Promise<unknown> }).bench());
  console.log(JSON.stringify(r, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v), 1));
  await browser.close();
})();
