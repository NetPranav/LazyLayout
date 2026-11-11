import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { recordCommit, bindCommitCountersSeam } from "../../diagnostics/commitCounter";
import {
  applyStagePlaybackDirectDom,
  clearStagePlaybackOverrides,
  installStagePlaybackDirectDom,
} from "../directDomApply";
import { frameScheduler } from "@/core/time/scheduler";
import { transport, transportStore } from "@/core/time/transport";
import { installTransportDriver } from "@/core/time/transportDriver";
import { documentStore } from "@/core/store/documentState";
import {
  createDocumentFromLayers,
  createLayer,
  attachClip,
  hydrateClip,
  createTrack,
} from "@/core/document/factories";


/** A minimal inline style: what the playback adapter reads and writes (kebab-case names, like the browser's). */
function mockStyle(initial: Record<string, string> = {}) {
  const values: Record<string, string> = { ...initial };
  const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const style = {
    getPropertyValue: (k: string) => values[camel(k)] ?? "",
    setProperty: (k: string, v: string) => { values[camel(k)] = v; },
    removeProperty: (k: string) => { delete values[camel(k)]; },
  };
  return new Proxy(style, { get: (t, k: string) => (k in t ? t[k as keyof typeof t] : values[k] ?? "") }) as typeof style & Record<string, string>;
}

describe("playback optimization (ROADMAP Phase 56)", () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origDoc = (globalThis as unknown as { document?: unknown }).document;

  beforeEach(() => {
    transport.reset();
    frameScheduler.setDeterministic(true);
  });

  afterEach(() => {
    clearStagePlaybackOverrides();
    transport.reset();
    frameScheduler.setDeterministic(false);
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { document?: unknown }).document = origDoc;
  });

  it("recordCommit tracks timeline and artboard commits with test seam reset", () => {
    // Window test seam setup
    const mockWindow: { __LL_TEST__?: boolean; __LL_COMMITS__?: { timeline: number; artboard: number; reset: () => void } } = {
      __LL_TEST__: true,
    };
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    // the seam binds to the window it is given (the module bound the real one, absent under node, at load)
    bindCommitCountersSeam(mockWindow as unknown as Window);
    recordCommit("timeline");
    recordCommit("timeline");
    recordCommit("artboard");

    // Test seam exposes the counters under __LL_TEST__
    const commits = (globalThis as unknown as { window: { __LL_COMMITS__: { timeline: number; artboard: number; reset: () => void } } }).window.__LL_COMMITS__;
    assert.ok(commits, "window.__LL_COMMITS__ must be exposed under window.__LL_TEST__");
    assert.ok(commits.timeline >= 2, "timeline counter recorded commits");
    assert.ok(commits.artboard >= 1, "artboard counter recorded commits");

    commits.reset();
    assert.equal(commits.timeline, 0, "reset clears timeline counter");
    assert.equal(commits.artboard, 0, "reset clears artboard counter");
  });

  it("applyStagePlaybackDirectDom updates stage element inline styles during playback and clears on pause", () => {
    // Create test document with an animated clip on layer_test
    const layer = createLayer({
      id: "layer_test",
      archetype: "text",
      name: "Test Layer",
      properties: {
        "content.text": "Animated headline",
        "appearance.opacity": 0,
      },
    });

    const track = createTrack("appearance.opacity", [
      { id: "kf1", time: 0, value: 0, ease: "linear" },
      { id: "kf2", time: 1, value: 1, ease: "linear" },
    ]);

    const clip = attachClip(
      hydrateClip({
        name: "TestClip",
        type: "entrance",
        duration: 2,
        trigger: "mount",
        easing: "linear",
        tracks: [track],
      }),
      "layer_test"
    );

    const doc = createDocumentFromLayers([layer], [clip]);
    documentStore.setState({ document: doc });

    // Mock DOM elements
    const pageAttrs: Record<string, string> = {};
    const mockPage = {
      setAttribute(name: string, val: string) {
        pageAttrs[name] = val;
      },
      getAttribute(name: string) {
        return pageAttrs[name];
      },
    };

    const targetStyle = mockStyle();
    const mockTarget = {
      style: targetStyle,
    };

    (globalThis as unknown as { document: unknown }).document = {
      querySelector(selector: string) {
        if (selector === '[data-testid="stage-page"]') return mockPage;
        if (selector.includes('data-element-id="layer_test"')) return mockTarget;
        return null;
      },
    };

    // Apply at time 0.5s -> opacity should evaluate to 0.5
    applyStagePlaybackDirectDom(0.5);
    assert.equal(targetStyle.opacity, "0.5", "Direct DOM applies evaluated opacity at 0.5s");
    assert.equal(pageAttrs["data-frame"], "30", "Page data-frame updated to frame 30");

    // Apply at time 1.0s -> opacity should evaluate to 1.0
    applyStagePlaybackDirectDom(1.0);
    assert.equal(targetStyle.opacity, "1", "Direct DOM applies evaluated opacity at 1.0s");
    assert.equal(pageAttrs["data-frame"], "60", "Page data-frame updated to frame 60");

    // Clear overrides -> all inline styles must be restored to empty string
    clearStagePlaybackOverrides();
    assert.equal(targetStyle.opacity, "", "clearStagePlaybackOverrides removes direct opacity override");
    assert.equal(targetStyle.transform, "", "clearStagePlaybackOverrides removes direct transform override");
  });

  it("installStagePlaybackDirectDom runs in apply phase while playing and cleans up on pause", () => {
    const layer = createLayer({
      id: "layer_live",
      archetype: "text",
      name: "Live Layer",
      properties: {
        "appearance.opacity": 0,
      },
    });

    const track = createTrack("appearance.opacity", [
      { id: "kf1", time: 0, value: 0, ease: "linear" },
      { id: "kf2", time: 1, value: 1, ease: "linear" },
    ]);

    const clip = attachClip(
      hydrateClip({
        name: "LiveClip",
        type: "entrance",
        duration: 2,
        trigger: "mount",
        easing: "linear",
        tracks: [track],
      }),
      "layer_live"
    );

    const doc = createDocumentFromLayers([layer], [clip]);
    documentStore.setState({ document: doc });

    const targetStyle = mockStyle();
    const liveEl = { style: targetStyle };
    (globalThis as unknown as { document: unknown }).document = {
      querySelector(selector: string) {
        // the same element every time, as a page gives
        if (selector.includes('data-element-id="layer_live"')) return liveEl;
        return null;
      },
    };

    // the clock only advances on scheduler steps through the transport driver: install it here, so the test does not
    // depend on another test file having installed it
    const uninstallDriver = installTransportDriver();
    const uninstall = installStagePlaybackDirectDom();

    // Start playback
    transport.play();
    assert.equal(transportStore.getState().playing, true);

    // Step scheduler by 30 frames (0.5s)
    for (let i = 0; i < 30; i++) {
      frameScheduler.step(1 / 60);
    }

    assert.ok(
      Math.abs(Number(targetStyle.opacity) - 0.5) < 0.05,
      `targetStyle.opacity (${targetStyle.opacity}) should be ~0.5 after 30 frames`
    );

    // Pause playback
    transport.pause();
    assert.equal(targetStyle.opacity, "", "Pausing clears direct DOM overrides immediately");

    uninstall();
    uninstallDriver();
  });
});

describe("playback restores what it overrode", () => {
  it("a layer's static background and its React transform are exactly as before, after play and pause", () => {
    const layer = createLayer({ id: "layer_bg", archetype: "container", name: "Card", properties: { "appearance.background.color": "#ff0000", "appearance.opacity": 1 } });
    const track = createTrack("appearance.opacity", [
      { id: "a", time: 0, value: 0, ease: "linear" },
      { id: "b", time: 1, value: 1, ease: "linear" },
    ]);
    const clip = attachClip(hydrateClip({ name: "Fade", type: "entrance", duration: 1, trigger: "mount", easing: "linear", tracks: [track] }), "layer_bg");
    documentStore.setState({ document: createDocumentFromLayers([layer], [clip]) });
    // what React drew before playback
    const style = mockStyle({ opacity: "1", backgroundColor: "rgb(255, 0, 0)", transform: "rotate(5deg)" });
    (globalThis as unknown as { document: unknown }).document = {
      querySelector: (sel: string) => (sel.includes('data-element-id="layer_bg"') ? { style } : null),
    };
    applyStagePlaybackDirectDom(0.25);
    assert.equal(style.opacity, "0.25", "the animated opacity is written");
    assert.equal(style.backgroundColor, "rgb(255, 0, 0)", "a background no clip animates is never written");
    assert.equal(style.transform, "rotate(5deg)", "a transform no clip animates is never written");
    clearStagePlaybackOverrides();
    assert.equal(style.opacity, "1", "pausing puts React's opacity back, not a blank");
    assert.equal(style.backgroundColor, "rgb(255, 0, 0)");
  });
});
