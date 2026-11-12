/**
 * Reference comparison harness (ROADMAP S8).
 *
 *   npx tsx scripts/surface-compare.ts --base http://localhost:3003 --out ./compare [--fps 20] [--set surface.depth=24 ...]
 *
 * Replays the reference video's input track (tests/fixtures/surface-reference/track.json: the cursor path and its
 * presses) against /editor/surface-lab, one exact frame at a time, and writes:
 *   ours/fNNNN.png, ref/fNNNN.png   the frames, same times, same 720×720 framing
 *   sbs.mp4                         the reference (left) and ours (right), side by side
 *   pairs/*.png                     paired stills of the button at key moments (reference above, ours below)
 *   scores.json                     SSIM of the button region per frame, its mean, and the paired moments' scores
 *   index.html                      a page with both clips in sync, a scrubber and the paired stills
 * Needs ffmpeg on the PATH. The reference video is downloaded (it isn't stored in the repo).
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

type Track = { source: string; size: [number, number]; duration: number; button: { x: number; y: number; width: number; height: number }; cursor: Array<[number, number, number]>; presses: Array<[number, number]> };

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => a === `--${name}` && process.argv[i + 1] && out.push(process.argv[i + 1]));
  return out;
}

const base = arg("base", "http://localhost:3000")!;
const out = resolve(arg("out", "compare-out")!);
const fps = Number(arg("fps", "20"));
const sets = args("set");
const track = JSON.parse(readFileSync(resolve("tests/fixtures/surface-reference/track.json"), "utf8")) as Track;
const ff = (...a: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: ["ignore", "pipe", "pipe"] });

function cursorAt(t: number): [number, number] {
  const c = track.cursor;
  if (t <= c[0][0]) return [c[0][1], c[0][2]];
  for (let i = 1; i < c.length; i++) {
    if (t <= c[i][0]) {
      const [t0, x0, y0] = c[i - 1];
      const [t1, x1, y1] = c[i];
      const k = (t - t0) / Math.max(1e-6, t1 - t0);
      const s = k * k * (3 - 2 * k);
      return [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s];
    }
  }
  const last = c[c.length - 1];
  return [last[1], last[2]];
}
const pressed = (t: number) => track.presses.some(([a, b]) => t >= a && t < b);

async function main() {
  for (const d of ["ours", "ref", "pairs"]) {
    rmSync(join(out, d), { recursive: true, force: true });
    mkdirSync(join(out, d), { recursive: true });
  }
  const refVideo = join(out, "reference.mp4");
  if (!existsSync(refVideo)) {
    const res = await fetch(track.source);
    if (!res.ok) throw new Error(`could not download the reference (${res.status})`);
    writeFileSync(refVideo, Buffer.from(await res.arrayBuffer()));
  }
  const frames = Math.floor(track.duration * fps);

  // ours
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: track.size[0], height: track.size[1] }, deviceScaleFactor: 1 });
  const query = sets.map((s) => `s.${encodeURIComponent(s.split("=")[0])}=${encodeURIComponent(s.split("=").slice(1).join("="))}`).join("&");
  await page.goto(`${base}/editor/surface-lab${query ? `?${query}` : ""}`, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-surface-canvas]");
    // a cloth surface first shows its quick shape; wait for the simulation
    const ready = !!c && c.width > 10 && (c.dataset.surfaceState === "cloth" || (location.search.includes("surface.method=quick") && c.dataset.surfaceState === "quick"));
    return ready && !!(window as unknown as { __LL_SURFACE_LAB__?: unknown }).__LL_SURFACE_LAB__;
  }, undefined, { timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as unknown as { __LL_SURFACE_LAB__: { deterministic: (on: boolean) => void } }).__LL_SURFACE_LAB__.deterministic(true));
  let down = false;
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    const [x, y] = cursorAt(t);
    await page.mouse.move(x, y);
    const want = pressed(t);
    if (want && !down) await page.mouse.down();
    if (!want && down) await page.mouse.up();
    down = want;
    await page.evaluate((dt) => (window as unknown as { __LL_SURFACE_LAB__: { step: (dt: number) => void } }).__LL_SURFACE_LAB__.step(dt), 1 / fps);
    await page.screenshot({ path: join(out, "ours", `f${String(i + 1).padStart(4, "0")}.png`), clip: { x: 0, y: 0, width: track.size[0], height: track.size[1] } });
  }
  await browser.close();

  // the reference at the same times
  ff("-i", refVideo, "-vf", `fps=${fps}`, "-frames:v", String(frames), join(out, "ref", "f%04d.png"));
  ff("-framerate", String(fps), "-i", join(out, "ref", "f%04d.png"), "-pix_fmt", "yuv420p", join(out, "ref.mp4"));
  ff("-framerate", String(fps), "-i", join(out, "ours", "f%04d.png"), "-pix_fmt", "yuv420p", join(out, "ours.mp4"));
  ff("-i", join(out, "ref.mp4"), "-i", join(out, "ours.mp4"), "-filter_complex", "[0][1]hstack=inputs=2", "-pix_fmt", "yuv420p", join(out, "sbs.mp4"));

  // similarity of the button region, per frame
  const b = track.button;
  const crop = `crop=${b.width + 40}:${b.height + 60}:${b.x - 20}:${b.y - 20}`;
  const ssimLog = join(out, "ssim.log");
  ff("-i", join(out, "ref.mp4"), "-i", join(out, "ours.mp4"), "-lavfi", `[0]${crop},format=gray[a];[1]${crop},format=gray[b];[a][b]ssim=stats_file=${ssimLog}`, "-f", "null", "-");
  const perFrame = readFileSync(ssimLog, "utf8").trim().split("\n").map((l) => Number(/All:([\d.]+)/.exec(l)?.[1] ?? 0));
  const mean = perFrame.reduce((a, v) => a + v, 0) / Math.max(1, perFrame.length);

  // paired stills at key moments
  const moments: Array<[string, number]> = [["rest", 0.5], ["press 1", 1.9], ["release 1", 2.15], ["press 2", 4.1], ["press 3", 6.2], ["release 3", 6.45], ["press 4", 8.4], ["after", 9.5]];
  const pairs: Array<{ name: string; t: number; file: string; ssim: number }> = [];
  for (const [name, t] of moments) {
    const n = String(Math.min(frames, Math.round(t * fps) + 1)).padStart(4, "0");
    const file = `${name.replace(/\s+/g, "-")}.png`;
    ff("-i", join(out, "ref", `f${n}.png`), "-i", join(out, "ours", `f${n}.png`), "-filter_complex", `[0]${crop}[a];[1]${crop}[b];[a][b]vstack=inputs=2`, join(out, "pairs", file));
    pairs.push({ name, t, file, ssim: perFrame[Number(n) - 1] ?? 0 });
  }
  writeFileSync(join(out, "scores.json"), JSON.stringify({ fps, frames, mean, sets, pairs, perFrame }, null, 2));
  writeFileSync(join(out, "index.html"), page_(mean, pairs, sets));
  console.log(`[surface-compare] ${frames} frames, mean SSIM of the button region ${mean.toFixed(4)}; ${out}`);
}

function page_(mean: number, pairs: Array<{ name: string; t: number; file: string; ssim: number }>, sets: string[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Surface comparison</title>
<style>:root{--bg:#f6f6f4;--fg:#1a1a1a;--muted:#6b6b6b;--line:#dddcd8}@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#9a9a9a;--line:#2c2c2c}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:0 auto;padding:24px 16px}
h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}video{width:100%;border:1px solid var(--line);border-radius:6px;background:#fff}
.lab{font-weight:600;margin:6px 0}.ctl{display:flex;gap:8px;align-items:center;margin:12px 0}input[type=range]{flex:1}.pairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:16px}
figure{margin:0;border:1px solid var(--line);border-radius:6px;padding:8px;background:var(--bg)}figure img{width:100%;display:block}figcaption{color:var(--muted);font-size:12px;margin-top:4px}
@media (max-width:700px){.row{grid-template-columns:1fr}}</style></head><body><main>
<h1>Reference vs ours</h1><p>Same presses, same times, same framing. Button similarity (SSIM, 1 = identical): mean ${mean.toFixed(3)}.${sets.length ? " Settings: " + sets.join(", ") : ""}</p>
<div class="row"><div><div class="lab">Reference</div><video id="a" src="ref.mp4" muted playsinline></video></div><div><div class="lab">Ours</div><video id="b" src="ours.mp4" muted playsinline></video></div></div>
<div class="ctl"><button id="play">Play</button><button id="prev">◀ frame</button><button id="next">frame ▶</button><input id="seek" type="range" min="0" max="1000" value="0"><span id="time">0.00 s</span></div>
<div class="pairs">${pairs.map((p) => `<figure><img src="pairs/${p.file}" alt="${p.name}: reference above, ours below"><figcaption>${p.name} · ${p.t.toFixed(2)} s · SSIM ${p.ssim.toFixed(3)} · reference above, ours below</figcaption></figure>`).join("")}</div>
<script>const a=document.getElementById('a'),b=document.getElementById('b'),seek=document.getElementById('seek'),time=document.getElementById('time');const f=1/${fpsOut()};
function sync(t){a.currentTime=t;b.currentTime=t;time.textContent=t.toFixed(2)+' s';seek.value=Math.round(t/(a.duration||1)*1000)}
document.getElementById('play').onclick=()=>{if(a.paused){b.currentTime=a.currentTime;a.play();b.play()}else{a.pause();b.pause()}};
document.getElementById('prev').onclick=()=>{a.pause();b.pause();sync(Math.max(0,a.currentTime-f))};document.getElementById('next').onclick=()=>{a.pause();b.pause();sync(a.currentTime+f)};
seek.oninput=()=>{a.pause();b.pause();sync(seek.value/1000*(a.duration||0))};a.ontimeupdate=()=>{if(!a.paused){time.textContent=a.currentTime.toFixed(2)+' s';seek.value=Math.round(a.currentTime/(a.duration||1)*1000);if(Math.abs(b.currentTime-a.currentTime)>0.08)b.currentTime=a.currentTime}};</script>
</main></body></html>`;
}
function fpsOut() {
  return fps;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
