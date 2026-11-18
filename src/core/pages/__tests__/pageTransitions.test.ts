import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { historyCommands } from "../../store/useDocumentStore";
import { usePreviewStore } from "../../store/usePreviewStore";
import { tryRunCommand } from "../../commands";
import { registerPageCommands } from "../pageCommands";
import { previewShow, previewStep } from "../previewOps";
import { nativeTransitionCss, pageTransitionOf, sampleTransition, sharedBoxAt, sharedPairs, transitionPath, viewNameOf, PAGE_TRANSITION_TYPES } from "../pageTransitions";

/** ROADMAP Phase 89: a 5-page fixture; each page says how it is entered, a hero image is shared by pages 1 and 2. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; changed?: number };
let off: () => void;
let pages: string[] = [];
let heroA = "";
let heroB = "";
beforeEach(() => {
  const b = new DocBuilder();
  pages = [0, 1, 2, 3, 4].map((i) => b.layer("container", `Page ${i + 1}`, null, {}));
  heroA = b.layer("container", "Hero", pages[0], {});
  heroB = b.layer("container", "Hero", pages[1], {});
  setDocument(b.build());
  usePreviewStore.getState().reset({ frameId: pages[0] });
  off = registerPageCommands();
});
afterEach(() => off());

describe("Phase 89: the recipe", () => {
  it("none shows the new page at once; every other type starts on the old page and ends on the new", () => {
    assert.deepEqual(sampleTransition("none", "forward", 0).in, { opacity: 1, x: 0, scale: 1 });
    for (const type of PAGE_TRANSITION_TYPES.filter((t) => t !== "none")) {
      const start = sampleTransition(type, "forward", 0);
      const end = sampleTransition(type, "forward", 1);
      assert.equal(end.in.opacity, 1, type);
      assert.equal(end.in.x, 0, type);
      assert.equal(end.in.scale, 1, type);
      assert.ok(start.in.opacity < 1 || start.in.x !== 0 || start.in.scale !== 1, `${type} starts away from the end`);
      assert.ok(end.out.opacity < 1 || Math.abs(end.out.x) > 0 || type === "slide", `${type} the old page leaves (or is covered)`);
    }
  });
  it("sampled times are monotone for a cross-fade and the half way point is half", () => {
    const at = (p: number) => sampleTransition("fade", "forward", p).in.opacity;
    assert.ok(at(0.25) < at(0.5) && at(0.5) < at(0.75));
    assert.ok(Math.abs(at(0.5) - 0.5) < 1e-6);
    assert.ok(Math.abs(sampleTransition("fade", "forward", 0.5).out.opacity - 0.5) < 1e-6);
  });
  it("going back mirrors a slide and a push", () => {
    assert.equal(sampleTransition("slide", "forward", 0).in.x, 1);
    assert.equal(sampleTransition("slide", "back", 0).in.x, -1);
    assert.equal(sampleTransition("push", "forward", 1).out.x, -1);
    assert.equal(sampleTransition("push", "back", 1).out.x, 1);
  });
  it("shared boxes travel from one to the other", () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }, b = { x: 200, y: 100, w: 300, h: 50 };
    assert.deepEqual(sharedBoxAt(a, b, 0), a);
    assert.deepEqual(sharedBoxAt(a, b, 1), b);
    const mid = sharedBoxAt(a, b, 0.5);
    assert.equal(mid.x, 100);
    assert.equal(mid.w, 200);
  });
  it("the native style sheet names the same duration and direction", () => {
    const css = nativeTransitionCss({ type: "slide", duration: 0.5 }, "forward");
    assert.match(css, /500ms/);
    assert.match(css, /translateX\(100%\)/);
    assert.match(nativeTransitionCss({ type: "slide", duration: 0.5 }, "back"), /translateX\(-100%\)/);
    assert.match(nativeTransitionCss({ type: "none", duration: 0.5 }, "forward"), /animation:none/);
    assert.equal(viewNameOf("hero image"), "ll-shared-hero_image");
  });
  it("with no document (a test run) there is no path to run, and reduced motion skips the movement", () => {
    assert.equal(transitionPath({ type: "fade", duration: 1 }), "none");
    assert.equal(transitionPath({ type: "fade", duration: 1 }, true), "none");
  });
});

describe("Phase 89: pages, shared elements and Preview", () => {
  it("page.setTransition stores the type and time on the page, and none is not stored", () => {
    assert.equal(run("page.setTransition", { frame: pages[1], type: "push", duration: 0.7 }).ok, true);
    assert.deepEqual(pageTransitionOf(getDocument().layers[pages[1]]), { type: "push", duration: 0.7 });
    run("page.setTransition", { frame: pages[1], type: "none" });
    assert.equal(getDocument().layers[pages[1]].properties["pageTransition.type"], undefined);
    assert.equal(run("page.setTransition", { frame: heroA, type: "fade" }).ok, false, "a layer inside a page is not a page");
  });
  it("undo puts it back", () => {
    run("page.setTransition", { frame: pages[2], type: "zoom" });
    historyCommands.undo();
    assert.equal(pageTransitionOf(getDocument().layers[pages[2]]).type, "none");
  });
  it("shared elements pair by name across pages", () => {
    run("layer.setSharedElement", { ids: [heroA, heroB], name: " hero " });
    assert.deepEqual(sharedPairs(getDocument(), pages[0], pages[1]), [["hero", heroA, heroB]]);
    assert.deepEqual(sharedPairs(getDocument(), pages[0], pages[2]), []);
    run("layer.setSharedElement", { ids: [heroB], name: null });
    assert.deepEqual(sharedPairs(getDocument(), pages[0], pages[1]), []);
  });
  it("a frame cannot be shared (only layers inside pages)", () => {
    assert.equal(run("layer.setSharedElement", { ids: [pages[0]], name: "x" }).changed, 0);
  });
  it("Preview walks five pages, forward and back, with every transition type (no document to draw on, so it lands at once)", () => {
    PAGE_TRANSITION_TYPES.forEach((type, i) => run("page.setTransition", { frame: pages[i], type }));
    for (let i = 1; i < 5; i++) previewShow({ frameId: pages[i] });
    assert.equal(usePreviewStore.getState().current()?.frameId, pages[4]);
    assert.equal(previewStep("back"), true);
    assert.equal(usePreviewStore.getState().current()?.frameId, pages[3]);
    assert.equal(previewStep("forward"), true);
    assert.equal(previewStep("forward"), false);
  });
});
