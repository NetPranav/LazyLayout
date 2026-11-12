import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportSamples, samplesFromClips } from "../clipSamples";
import type { MotionDocument } from "../../document/schema";

const doc = {
  layers: { hero: { id: "hero", name: "Hero" } },
  clips: {
    c1: {
      id: "c1", layerId: "hero", name: "Fade", type: "entrance", trigger: "mount", duration: 2, delay: 0.5, easing: "linear", enabled: true, repeat: -1,
      tracks: [
        { id: "t1", property: "appearance.opacity", keyframes: [{ id: "k1", time: 0, value: 0 }, { id: "k2", time: 1, value: 1, ease: "power2.out" }] },
        { id: "t2", property: "layout.gap", keyframes: [{ id: "k3", time: 0, value: 4 }] },
      ],
    },
    off: { id: "off", layerId: "hero", name: "Off", type: "entrance", trigger: "mount", duration: 1, easing: "linear", enabled: false, tracks: [{ id: "t3", property: "transform.x", keyframes: [{ id: "k4", time: 0, value: 0 }] }] },
  },
} as unknown as MotionDocument;

describe("Phase 68: document clips reach the exporters", () => {
  it("turns an enabled clip into a sample with its tracks, timing and keyframe offsets", () => {
    const samples = samplesFromClips(doc);
    assert.deepEqual(Object.keys(samples), ["c1"]);
    const s = samples.c1;
    assert.equal(s.duration, 2000);
    assert.equal(s.delay, 500);
    assert.equal(s.iterations, "infinite");
    assert.equal(s.trigger, "onMount");
    assert.deepEqual(s.tracks, [{ trackId: "opacity", keyframes: [{ offset: 0, value: 0 }, { offset: 50, value: 1, easing: "power2.out" }] }]);
  });
  it("keeps legacy samples, with the document winning on the same id", () => {
    const legacy = { old: { id: "old" }, c1: { id: "c1", name: "stale" } } as never;
    const merged = exportSamples(doc, legacy);
    assert.deepEqual(Object.keys(merged).sort(), ["c1", "old"]);
    assert.notEqual(merged.c1.name, "stale");
  });
});
