import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bestFeatureNear, cornerScore, pyramid, trackPlane, trackPoint, trackPointBackward, type GrayFrame } from "../lucasKanade";
import { decodeTrack, encodeTrack, smoothTrack, trackKeyframes } from "../trackCodec";

/** A textured scene (blobs of different sizes on a soft gradient), seeded, drawn with its content moved by (dx, dy). Sub-pixel exact. */
function scene(seed: number) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const blobs = Array.from({ length: 60 }, () => ({ x: rnd() * 400, y: rnd() * 300, r: 3 + rnd() * 9, v: 40 + rnd() * 200 }));
  return (dx: number, dy: number, w = 320, h = 240, light = 1): GrayFrame => {
    const data = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x - dx, Y = y - dy;
      let v = 60 + 0.08 * X + 0.05 * Y;
      for (const b of blobs) {
        const d2 = (X - b.x) ** 2 + (Y - b.y) ** 2;
        if (d2 < 9 * b.r * b.r) v += b.v * Math.exp(-d2 / (2 * b.r * b.r));
      }
      data[y * w + x] = Math.min(255, v) * light;
    }
    return { width: w, height: h, data };
  };
}

/** A smooth path: a drift plus a wobble, like a handheld camera. */
const path = (i: number, k: number): [number, number] => [i * 1.7 + 6 * Math.sin(i / (6 + k)), i * 0.6 + 4 * Math.cos(i / (9 + k))];

describe("point tracking (D17)", () => {
  it("on 10 synthetic clips the point stays within 1.5 px of the truth on at least 95% of frames", () => {
    let within = 0, total = 0;
    for (let k = 0; k < 10; k++) {
      const draw = scene(k + 1);
      const frames = Array.from({ length: 30 }, (_, i) => draw(...path(i, k)));
      // the point the user clicks, snapped to the best feature near it (as a tracker does)
      const start = bestFeatureNear(frames[0], [120 + k * 4, 100 + k * 3]);
      const track = trackPoint(frames, start);
      track.forEach((p, i) => {
        const [dx, dy] = path(i, k);
        const [x0, y0] = path(0, k);
        total++;
        if (p && Math.hypot(p.x - (start[0] + dx - x0), p.y - (start[1] + dy - y0)) <= 1.5) within++;
      });
    }
    assert.ok(within / total >= 0.95, `${within} of ${total} frames within 1.5 px`);
  });

  it("follows a fast jump with the pyramid, and survives a slow change of light", () => {
    const draw = scene(42);
    const frames = [draw(0, 0), draw(9, -6, 320, 240, 0.97), draw(18, -12, 320, 240, 0.94)];
    const t = trackPoint(frames, [150, 120]);
    assert.ok(t[2] && Math.hypot(t[2].x - 168, t[2].y - 108) < 1, JSON.stringify(t[2]));
  });

  it("a point on a flat area is lost, not invented", () => {
    const flat: GrayFrame = { width: 64, height: 64, data: new Float32Array(64 * 64).fill(120) };
    const t = trackPoint([flat, flat, flat], [32, 32]);
    assert.equal(t[1], null);
    assert.equal(t[2], null);
  });

  it("tracks backward the same as forward", () => {
    const draw = scene(7);
    const frames = Array.from({ length: 12 }, (_, i) => draw(i * 2, i));
    const back = trackPointBackward(frames, [150 + 22, 120 + 11]);
    assert.ok(back[0] && Math.hypot(back[0].x - 150, back[0].y - 120) < 1, JSON.stringify(back[0]));
  });

  it("a plane is tracked by its four corners", () => {
    const draw = scene(3);
    const frames = Array.from({ length: 10 }, (_, i) => draw(i * 1.5, i * 0.5));
    const corners: [number, number][] = ([[100, 80], [200, 80], [200, 160], [100, 160]] as [number, number][]).map((c) => bestFeatureNear(frames[0], c));
    const plane = trackPlane(frames, corners);
    const last = plane[9]!;
    corners.forEach((c, j) => assert.ok(Math.hypot(last[j][0] - (c[0] + 13.5), last[j][1] - (c[1] + 4.5)) < 1.5, `corner ${j}`));
  });

  it("snapping picks a textured point over a flat one", () => {
    const f = scene(9)(0, 0);
    const snapped = bestFeatureNear(f, [160, 120]);
    assert.ok(cornerScore(f, snapped) >= cornerScore(f, [160, 120]));
  });

  it("pyramid levels halve the size", () => {
    const p = pyramid(scene(1)(0, 0), 3);
    assert.deepEqual(p.map((f) => [f.width, f.height]), [[320, 240], [160, 120], [80, 60]]);
  });
});

describe("tracks as keyframes and in the export (D17)", () => {
  it("a 10-second track at 30 fps encodes under 4 KB and decodes to within 1/16 px", () => {
    const pts = Array.from({ length: 300 }, (_, i) => ({ x: 400 + i * 1.3 + 25 * Math.sin(i / 11), y: 300 + 18 * Math.cos(i / 7) - i * 0.4 }));
    const text = encodeTrack(pts);
    assert.ok(text.length < 4096, `${text.length} bytes`);
    const back = decodeTrack(text);
    assert.equal(back.length, 300);
    back.forEach((p, i) => assert.ok(Math.abs(p.x - pts[i].x) <= 1 / 16 && Math.abs(p.y - pts[i].y) <= 1 / 16));
  });

  it("keyframes are offsets from the first point, timed by the frame rate, skipping lost frames", () => {
    const k = trackKeyframes([{ x: 10, y: 20 }, { x: 12, y: 21 }, null, { x: 15, y: 19 }], 30);
    assert.deepEqual(k.x.map((f) => [f.time, f.value]), [[0, 0], [1 / 30, 2], [0.1, 5]].map(([t, v]) => [Math.round(t * 1e6) / 1e6, v]));
    assert.deepEqual(k.y.map((f) => f.value), [0, 1, -1]);
  });

  it("smoothing keeps the ends and evens out jitter", () => {
    const noisy = Array.from({ length: 21 }, (_, i) => ({ x: i + (i % 2 ? 0.5 : -0.5), y: 0 }));
    const s = smoothTrack(noisy, 2);
    assert.deepEqual(s[0], noisy[0]);
    assert.deepEqual(s[20], noisy[20]);
    assert.ok(Math.abs(s[10].x - 10) < 0.15);
  });
});
