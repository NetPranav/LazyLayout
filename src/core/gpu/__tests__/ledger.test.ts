import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GpuLedger, textureBytes } from "../ledger";
import { resolveFormat, PassStack, type Pass } from "../passes";

describe("3D-003: the GPU memory ledger", () => {
  it("counts what each owner holds and returns to zero when everything is released", () => {
    const l = new GpuLedger();
    const handles = Array.from({ length: 50 }, () => ({}));
    handles.forEach((h, i) => l.track(h, `scene:${i % 5}`, "texture", textureBytes(256, 256, "RGBA8")));
    assert.equal(l.count(), 50);
    assert.equal(l.totalBytes(), 50 * 256 * 256 * 4);
    assert.equal(l.byOwner().length, 5);
    assert.equal(l.byOwner()[0].count, 10);
    handles.forEach((h) => l.release(h));
    assert.equal(l.count(), 0);
    assert.equal(l.totalBytes(), 0);
  });

  it("re-tracking a handle replaces its size instead of counting it twice", () => {
    const l = new GpuLedger();
    const h = {};
    l.track(h, "a", "texture", 100);
    l.track(h, "a", "texture", 400);
    assert.equal(l.count(), 1);
    assert.equal(l.totalBytes(), 400);
  });

  it("releasing an owner (a lost context) crosses out all of its resources", () => {
    const l = new GpuLedger();
    l.track({}, "a", "texture", 10);
    l.track({}, "a", "buffer", 10);
    l.track({}, "b", "texture", 10);
    assert.equal(l.releaseOwner("a"), 2);
    assert.equal(l.totalBytes(), 10);
    assert.equal(l.totalBytes("b"), 10);
  });

  it("sizes a texture with its mip chain at a third more", () => {
    assert.equal(textureBytes(256, 256, "RGBA16F"), 256 * 256 * 8);
    assert.equal(textureBytes(256, 256, "RGBA8", true), Math.round((256 * 256 * 4 * 4) / 3));
  });

  it("notifies subscribers when it changes", () => {
    const l = new GpuLedger();
    let n = 0;
    const stop = l.subscribe(() => n++);
    const h = {};
    l.track(h, "a", "texture", 1);
    l.release(h);
    stop();
    l.track({}, "a", "texture", 1);
    assert.equal(n, 2);
  });
});

/** A context with only what the capability check reads. */
const fakeGl = (floatTargets: boolean) =>
  ({ getExtension: (n: string) => (n === "EXT_color_buffer_float" ? (floatTargets ? {} : null) : null) }) as unknown as WebGL2RenderingContext;

describe("3D-003: float targets after a capability check", () => {
  it("falls back to RGBA8 where float targets are unsupported, and keeps float where they are", () => {
    assert.equal(resolveFormat(fakeGl(false), "RGBA32F"), "RGBA8");
    assert.equal(resolveFormat(fakeGl(false), "RGBA16F"), "RGBA8");
    assert.equal(resolveFormat(fakeGl(true), "RGBA16F"), "RGBA16F");
    assert.equal(resolveFormat(fakeGl(true), "RGBA32F"), "RGBA32F");
    assert.equal(resolveFormat(fakeGl(true), "RGBA16F", true), "RGBA8", "forced off (a low tier)");
  });
});

describe("3D-003: pass stacks", () => {
  it("skips switched-off passes and runs the rest in order", () => {
    // run() needs a GL context for targets; an empty stack of enabled passes is checked without one
    const order: string[] = [];
    const passes: Pass[] = [
      { name: "a", run: () => order.push("a"), enabled: false },
      { name: "b", run: () => order.push("b"), enabled: false },
    ];
    const gl = { createTexture: () => ({}), bindTexture() {}, texImage2D() {}, texParameteri() {}, createFramebuffer: () => ({}), bindFramebuffer() {}, framebufferTexture2D() {}, getExtension: () => null, RGBA8: 0, RGBA: 0, UNSIGNED_BYTE: 0, TEXTURE_2D: 0, TEXTURE_MIN_FILTER: 0, TEXTURE_MAG_FILTER: 0, TEXTURE_WRAP_S: 0, TEXTURE_WRAP_T: 0, LINEAR: 0, CLAMP_TO_EDGE: 0, FRAMEBUFFER: 0, COLOR_ATTACHMENT0: 0, isContextLost: () => false, deleteTexture() {}, deleteFramebuffer() {}, viewport() {} } as unknown as WebGL2RenderingContext;
    const stack = new PassStack(gl, "test", 8, 8, passes, "RGBA8");
    assert.deepEqual(stack.run(), []);
    passes[1].enabled = true;
    assert.deepEqual(stack.run(), ["b"]);
    stack.dispose();
  });
});
