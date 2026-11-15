import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer } from "../../../document/schema";
import { documentCommands } from "../../../store/useDocumentStore";
import { setDocument, getDocument } from "../../../store/documentState";
import { evaluate } from "../../../kernel/evaluate";
import { resolveRange, viewProgress } from "../../../scroll/model";
import { buildSiteExport } from "../../site";
import { buildScrollClipsSource, exportableScrollClips } from "../scrollClips";

const TOP = 1000, H = 200, VH = 800;
function setup(clip: { mode: "scrub" | "reveal"; property: string; from: number; to: number; easing?: string; start?: string; end?: string; pin?: boolean; duration?: number }) {
  const page = { ...(createLayer({ id: "p", archetype: "container", parentId: null, name: "Home", children: ["a"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 3000 } }) as Layer), page: { route: "/" } };
  const a = createLayer({ id: "a", archetype: "container", parentId: "p", name: "A", properties: { positioning: "absolute", "frame.x": 100, "frame.y": TOP, "frame.width": 200, "frame.height": H } }) as Layer;
  setDocument(createDocumentFromLayers([page, a]));
  const id = documentCommands.addClip("a", {
    name: "Scroll", type: clip.mode === "scrub" ? "scroll" : "entrance", trigger: clip.mode === "scrub" ? "scrollProgress" : "inView", duration: clip.duration ?? 1, easing: clip.easing ?? "linear", enabled: true,
    scrollTrigger: { ...(clip.start ? { start: clip.start } : {}), ...(clip.end ? { end: clip.end } : {}), ...(clip.pin ? { pin: true } : {}), ...(clip.mode === "scrub" ? { scrub: true } : {}) },
    tracks: [{ id: "t1", property: clip.property, keyframes: [{ id: "k0", time: 0, value: clip.from }, { id: "k1", time: clip.duration ?? 1, value: clip.to }] }],
  } as never, "x");
  return { doc: getDocument(), id };
}
/** Runs the exported script against a fake page and returns a function that scrolls and reads the element's style. */
function run(source: string) {
  const style: Record<string, string> = { translate: "", rotate: "", scale: "", opacity: "" };
  const el = { style, getBoundingClientRect: () => ({ top: TOP - (state.y), height: H }) };
  const state = { y: 0 };
  const frames: ((n: number) => void)[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const win: Record<string, unknown> = {
    get scrollY() { return state.y; }, innerHeight: VH, matchMedia: () => ({ matches: false }),
    addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f),
  };
  const ctx = vm.createContext({ window: win, document: { readyState: "complete", querySelector: (q: string) => (q.includes('"a"') ? el : null) }, performance: { now: () => 0 }, requestAnimationFrame: (f: (n: number) => void) => frames.push(f), Math, JSON });
  vm.runInContext(source, ctx);
  let now = 0;
  const tick = (ms: number) => { now += ms; frames.splice(0).forEach((f) => f(now)); };
  return { style, scroll: (y: number) => { state.y = y; tick(16); }, tick };
}
const ty = (s: string) => (s === "" ? 0 : Number(s.split(" ")[1].replace("px", "")));

describe("scroll animations in the export (D11)", () => {
  it("a scrubbed clip lands within a pixel of the kernel at 25 scroll positions, easing included", () => {
    const { doc, id } = setup({ mode: "scrub", property: "transform.y", from: 0, to: -300, easing: "ease-in-out" });
    const ex = exportableScrollClips(doc);
    assert.equal(ex.clips.length, 1);
    const r = run(buildScrollClipsSource(ex.clips));
    const range = resolveRange({ top: TOP, height: H }, VH);
    for (let i = 0; i <= 24; i++) {
      const y = Math.round(range.startScroll + ((range.endScroll - range.startScroll) * (i - 2)) / 20); // a little before and after the range too
      r.scroll(y);
      const want = evaluate(doc, Object.keys(doc.compositions)[0] ?? "main", "a", 0, { scrollClipTime: { [id]: viewProgress(y, range) * 1 } })["transform.y"] as number;
      assert.ok(Math.abs(ty(r.style.translate) - want) < 1.5, `scroll ${y}: ${ty(r.style.translate)} vs ${want}`);
    }
  });

  it("a custom range and opacity are honoured", () => {
    const { doc } = setup({ mode: "scrub", property: "appearance.opacity", from: 0, to: 1, start: "top 80%", end: "top 20%" });
    const r = run(buildScrollClipsSource(exportableScrollClips(doc).clips));
    const range = resolveRange({ top: TOP, height: H }, VH, "top 80%", "top 20%");
    r.scroll(range.startScroll - 50);
    assert.equal(Number(r.style.opacity), 0);
    r.scroll((range.startScroll + range.endScroll) / 2);
    assert.ok(Math.abs(Number(r.style.opacity) - 0.5) < 0.02);
    r.scroll(range.endScroll + 50);
    assert.equal(Number(r.style.opacity), 1);
  });

  it("a pinned layer is held by a translation that cancels the scroll while inside its range, then scrolls on", () => {
    const { doc } = setup({ mode: "scrub", property: "appearance.opacity", from: 1, to: 1, start: "top top", end: "bottom top", pin: true });
    const r = run(buildScrollClipsSource(exportableScrollClips(doc).clips));
    r.scroll(TOP - 100);
    assert.equal(ty(r.style.translate), 0);
    r.scroll(TOP + 120);
    assert.equal(ty(r.style.translate), 120);
    r.scroll(TOP + 900);
    assert.equal(ty(r.style.translate), H); // held for the range's length (the layer's height), then it scrolls on
  });

  it("a reveal waits at its first value, plays once when entered, and does not replay", () => {
    const { doc } = setup({ mode: "reveal", property: "appearance.opacity", from: 0, to: 1, duration: 0.5 });
    const r = run(buildScrollClipsSource(exportableScrollClips(doc).clips));
    const range = resolveRange({ top: TOP, height: H }, VH);
    r.scroll(range.startScroll - 100);
    assert.equal(Number(r.style.opacity), 0);
    r.scroll(range.startScroll + 100); // entered
    r.tick(250);
    const mid = Number(r.style.opacity);
    assert.ok(mid > 0.2 && mid < 0.8, `half way: ${mid}`);
    r.tick(400);
    assert.equal(Number(r.style.opacity), 1);
    r.scroll(range.startScroll - 100); // out again: it stays played
    assert.equal(Number(r.style.opacity), 1);
  });

  it("is shipped: the script, the mark on the element, and a warning for what it cannot carry", async () => {
    const { doc } = setup({ mode: "scrub", property: "transform.y", from: 0, to: -300 });
    documentCommands.addClip("a", { name: "Scroll colour", type: "scroll", trigger: "scrollProgress", duration: 1, easing: "linear", enabled: true, tracks: [{ id: "t2", property: "appearance.background.color", keyframes: [{ id: "k0", time: 0, value: "#ff0000" }, { id: "k1", time: 1, value: "#0000ff" }] }] } as never, "y");
    const r = await buildSiteExport(getDocument() ?? doc, { target: "html", styling: "css" });
    const html = String(r.files.find((f) => f.path === "index.html")!.content);
    assert.match(html, /data-ll-scroll="a"/);
    assert.match(html, /lazylayout-scroll\.js/);
    assert.ok(r.files.some((f) => f.path === "lazylayout-scroll.js"));
    assert.ok(r.warnings.some((w) => /appearance\.background\.color, which is not in the export yet/.test(w)));
  });
});

describe("snap points in the export (D11)", () => {
  it("a section's snap alignment is on its element and the page's snap type is on html", async () => {
    const page = { ...(createLayer({ id: "p", archetype: "container", parentId: null, name: "Home", children: ["s"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 3000, "style.custom": "scroll-snap-type: y mandatory" } }) as Layer), page: { route: "/" } };
    const s = createLayer({ id: "s", archetype: "container", parentId: "p", name: "Section", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 900, "frame.width": 1440, "frame.height": 900, "style.custom": "scroll-snap-align: start" } }) as Layer;
    const r = await buildSiteExport(createDocumentFromLayers([page, s]), { target: "html", styling: "css" });
    const css = String(r.files.find((f) => f.path === "styles.css")!.content);
    assert.match(css, /html \{\s*scroll-snap-type: y mandatory;/);
    assert.match(css, /scroll-snap-align: start/);
  });
});
