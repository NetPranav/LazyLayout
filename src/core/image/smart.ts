/**
 * The smart parts of the cutout, on the device and with no model.
 *
 * `snapToEdges` is what a phone's smart select does: you draw a rough shape and it settles onto the object's real edge.
 * Pixels well inside the shape are taken as sure foreground and pixels well outside as sure background; a colour model of
 * each, and the picture's own edges, decide the thin band in between (a geodesic walk from both sides: a pixel belongs to
 * whichever side can reach it more cheaply, and an edge or a colour that looks like the other side is expensive to cross).
 * The edge is then softened along the picture's own edges with a guided filter, not with a blur.
 *
 * `estimateDepth` guesses how far away each pixel is from one picture: haze (the dark channel method, since distant things
 * look washed out), how low a pixel sits in the frame, and how much detail it has. It is a good guide for landscapes and
 * hazy scenes, not true 3D, and says so wherever it is shown. It makes depth layers possible: stacked, aligned copies of the
 * picture where each shows only what is nearer than a depth, so something can be put between them.
 *
 * Nothing here touches the DOM, so it is tested directly.
 */

import type { Mask, Pixels } from "./cutout";

const INF = 1e9;

/** Distance in pixels from each pixel to the nearest one for which `isTarget` holds (zero for those). Two-pass chamfer. */
export function distanceTransform(width: number, height: number, isTarget: (i: number) => boolean): Float32Array {
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = isTarget(i) ? 0 : INF;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - width] + 1);
        if (x > 0) v = Math.min(v, d[i - width - 1] + Math.SQRT2);
        if (x < width - 1) v = Math.min(v, d[i - width + 1] + Math.SQRT2);
      }
      d[i] = v;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let v = d[i];
      if (x < width - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < height - 1) {
        v = Math.min(v, d[i + width] + 1);
        if (x < width - 1) v = Math.min(v, d[i + width + 1] + Math.SQRT2);
        if (x > 0) v = Math.min(v, d[i + width - 1] + Math.SQRT2);
      }
      d[i] = v;
    }
  }
  return d;
}

/** A binary min-heap of (key, value) pairs; `pop` returns the value and leaves its key in `lastKey`. */
class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  lastKey = 0;
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    let i = this.keys.length;
    this.keys.push(key);
    this.vals.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.vals[i] = this.vals[p];
      i = p;
    }
    this.keys[i] = key;
    this.vals[i] = val;
  }
  pop(): number {
    const topVal = this.vals[0];
    this.lastKey = this.keys[0];
    const key = this.keys.pop() as number;
    const val = this.vals.pop() as number;
    const n = this.keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= key) break;
        this.keys[i] = this.keys[c];
        this.vals[i] = this.vals[c];
        i = c;
      }
      this.keys[i] = key;
      this.vals[i] = val;
    }
    return topVal;
  }
}

/** Mean over a (2r+1) square window, edges clamped to the pixels that exist. Separable running sums, so the cost does not grow with r. */
function boxMean(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const prefix = new Float64Array(Math.max(width, height) + 1);
  for (let y = 0; y < height; y++) {
    prefix[0] = 0;
    for (let x = 0; x < width; x++) prefix[x + 1] = prefix[x] + src[y * width + x];
    for (let x = 0; x < width; x++) {
      const a = Math.max(0, x - r);
      const b = Math.min(width, x + r + 1);
      tmp[y * width + x] = (prefix[b] - prefix[a]) / (b - a);
    }
  }
  for (let x = 0; x < width; x++) {
    prefix[0] = 0;
    for (let y = 0; y < height; y++) prefix[y + 1] = prefix[y] + tmp[y * width + x];
    for (let y = 0; y < height; y++) {
      const a = Math.max(0, y - r);
      const b = Math.min(height, y + r + 1);
      out[y * width + x] = (prefix[b] - prefix[a]) / (b - a);
    }
  }
  return out;
}

/** The brightness of every pixel, 0 to 1. */
export function luminance(img: Pixels): Float32Array {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = (0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]) / 255;
  return out;
}

/**
 * Edge-preserving smoothing (He et al.'s guided filter): `src` is smoothed, but not across the edges of `guide`. Used to
 * soften a mask along the picture's own edges, and to make an estimated depth follow the objects in the picture.
 */
export function guidedFilter(guide: Float32Array, src: Float32Array, width: number, height: number, r: number, eps: number): Float32Array {
  const n = src.length;
  const gg = new Float32Array(n);
  const gs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gg[i] = guide[i] * guide[i];
    gs[i] = guide[i] * src[i];
  }
  const meanI = boxMean(guide, width, height, r);
  const meanP = boxMean(src, width, height, r);
  const corrI = boxMean(gg, width, height, r);
  const corrIP = boxMean(gs, width, height, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const cov = corrIP[i] - meanI[i] * meanP[i];
    a[i] = cov / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxMean(a, width, height, r);
  const meanB = boxMean(b, width, height, r);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  return q;
}

export interface SnapOptions {
  /** How far from the drawn line, in pixels, the real edge may be. Pixels farther in or out than this are taken as they are. */
  reach?: number;
}

const NEIGHBOURS: ReadonlyArray<[number, number, number]> = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
];

/**
 * Settles a roughly drawn region onto the edge of the object it is around. `rough` is 255 inside the drawn shape; the result
 * is a mask whose edge follows the picture, with a soft edge only where the picture itself is soft.
 */
export function snapToEdges(img: Pixels, rough: Mask, options: SnapOptions = {}): Mask {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const reach = Math.max(1, options.reach ?? 14);
  const inside = (i: number) => rough[i] >= 128;
  const depthIn = distanceTransform(w, h, (i) => !inside(i)); // for inside pixels: how deep they are
  const depthOut = distanceTransform(w, h, inside); // for outside pixels: how far from the shape
  let maxIn = 0;
  let maxOut = 0;
  for (let i = 0; i < n; i++) {
    if (inside(i)) maxIn = Math.max(maxIn, depthIn[i]);
    else if (depthOut[i] < INF) maxOut = Math.max(maxOut, depthOut[i]);
  }
  if (maxIn === 0 || maxOut === 0) return rough; // all of it or none of it: nothing to settle
  const reachIn = Math.min(reach, maxIn * 0.5); // a shape thinner than the reach still has a sure core
  const reachOut = Math.min(reach, maxOut * 0.5);

  // 0 = in the band (to decide), 1 = sure foreground, 2 = sure background
  const state = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (inside(i)) {
      if (depthIn[i] > reachIn) state[i] = 1;
    } else if (depthOut[i] > reachOut) state[i] = 2;
  }

  // how much each colour looks like the foreground: 16 levels a channel, from the sure pixels of each side
  const bin = (i: number) => ((data[i * 4] >> 4) << 8) | ((data[i * 4 + 1] >> 4) << 4) | (data[i * 4 + 2] >> 4);
  const hist = [new Float32Array(4096), new Float32Array(4096)];
  const count = [0, 0];
  for (let i = 0; i < n; i++) {
    if (state[i] === 0) continue;
    const side = state[i] === 1 ? 0 : 1;
    hist[side][bin(i)]++;
    count[side]++;
  }
  const smoothing = 0.2;
  const likeForeground = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (state[i] !== 0) continue;
    const b = bin(i);
    const pf = (hist[0][b] + smoothing) / (count[0] + smoothing * 4096);
    const pb = (hist[1][b] + smoothing) / (count[1] + smoothing * 4096);
    likeForeground[i] = pf / (pf + pb);
  }

  const colourStep = (p: number, q: number) =>
    (Math.abs(data[p * 4] - data[q * 4]) + Math.abs(data[p * 4 + 1] - data[q * 4 + 1]) + Math.abs(data[p * 4 + 2] - data[q * 4 + 2])) / 765;

  /** Cheapest way to reach each band pixel from a side: crossing an edge, or pixels that look like the other side, costs. */
  const walk = (side: 1 | 2): Float64Array => {
    // 64-bit: a 32-bit distance rounds below the value queued for it, which would make every pixel look already settled
    const dist = new Float64Array(n).fill(INF);
    const heap = new MinHeap();
    for (let i = 0; i < n; i++) {
      if (state[i] !== 0) continue;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of NEIGHBOURS) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (state[j] === side && dist[j] === INF) {
          dist[j] = 0;
          heap.push(0, j);
        }
      }
    }
    while (heap.size > 0) {
      const p = heap.pop();
      const dp = heap.lastKey;
      if (dp > dist[p]) continue;
      const x = p % w;
      const y = (p / w) | 0;
      for (const [dx, dy, len] of NEIGHBOURS) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (state[q] !== 0) continue;
        const looksOther = side === 1 ? 1 - likeForeground[q] : likeForeground[q];
        const next = dp + len * (0.03 + 4 * colourStep(p, q) + 0.8 * looksOther);
        if (next < dist[q]) {
          dist[q] = next;
          heap.push(next, q);
        }
      }
    }
    return dist;
  };
  const fromForeground = walk(1);
  const fromBackground = walk(2);

  const hard = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (state[i] === 1) hard[i] = 255;
    else if (state[i] === 0) {
      const f = fromForeground[i];
      const b = fromBackground[i];
      hard[i] = f === INF && b === INF ? rough[i] : f < b ? 255 : 0;
    }
  }

  // soften along the picture's own edges, only in the band
  const r = Math.max(2, Math.round(reach * 0.25));
  const asFloat = new Float32Array(n);
  for (let i = 0; i < n; i++) asFloat[i] = hard[i] / 255;
  const soft = guidedFilter(luminance(img), asFloat, w, h, r, 0.01);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = state[i] === 0 ? Math.round(soft[i] * 255) : hard[i];
  return out;
}

/** The pixels of `mask` (127 and up) connected to (x, y), as a new mask. Empty when (x, y) is not in it. */
export function connectedFrom(mask: Mask, width: number, height: number, x: number, y: number): Mask {
  const out = new Uint8Array(mask.length);
  const sx = Math.round(x);
  const sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height || mask[sy * width + sx] < 128) return out;
  const stack = [sy * width + sx];
  out[stack[0]] = 255;
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const px = p % width;
    const py = (p / width) | 0;
    for (const [dx, dy] of NEIGHBOURS.slice(0, 4)) {
      const xx = px + dx;
      const yy = py + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const q = yy * width + xx;
      if (out[q] === 0 && mask[q] >= 128) {
        out[q] = 255;
        stack.push(q);
      }
    }
  }
  return out;
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

function stretch(values: Float32Array, lo = 0.02, hi = 0.98): Float32Array {
  const a = percentile(values, lo);
  const b = percentile(values, hi);
  const out = new Float32Array(values.length);
  const span = b - a < 1e-6 ? 1 : b - a;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (values[i] - a) / span));
  return out;
}

/** Smallest value in each (2r+1) square window. */
function minFilter(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = INF;
      for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) m = Math.min(m, src[y * width + k]);
      tmp[y * width + x] = m;
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = INF;
      for (let k = Math.max(0, y - r); k <= Math.min(height - 1, y + r); k++) m = Math.min(m, tmp[k * width + x]);
      out[y * width + x] = m;
    }
  }
  return out;
}

function resizeFloat(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      out[y * dw + x] = (src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx) * (1 - ty) + (src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx) * ty;
    }
  }
  return out;
}

/**
 * A guess at how near each pixel is, 0 (far) to 1 (near), from one picture. Distant things look washed out (the dark channel
 * prior turns that into a distance), things lower in the frame are usually nearer, and nearer things show more detail. The
 * guess is then made to follow the edges of the picture. Good for landscapes and hazy scenes; not true depth.
 */
export function estimateDepth(img: Pixels): Float32Array {
  const longest = Math.max(img.width, img.height);
  const k = Math.min(1, 480 / longest);
  const sw = Math.max(1, Math.round(img.width * k));
  const sh = Math.max(1, Math.round(img.height * k));
  const n = sw * sh;
  // a small copy (box average), as floats 0 to 1
  const rgb = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let y = 0; y < sh; y++) {
    const y0 = Math.floor((y * img.height) / sh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / sh));
    for (let x = 0; x < sw; x++) {
      const x0 = Math.floor((x * img.width) / sw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / sw));
      let r = 0, g = 0, b = 0, c = 0;
      for (let yy = y0; yy < Math.min(img.height, y1); yy++) {
        for (let xx = x0; xx < Math.min(img.width, x1); xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; c++;
        }
      }
      const o = y * sw + x;
      rgb[0][o] = r / c / 255; rgb[1][o] = g / c / 255; rgb[2][o] = b / c / 255;
    }
  }
  const patch = Math.max(2, Math.round(Math.max(sw, sh) * 0.012));

  // haze: the dark channel, the light of the sky (the brightest of the haziest pixels), then how much of each pixel is haze
  const minChannel = new Float32Array(n);
  for (let i = 0; i < n; i++) minChannel[i] = Math.min(rgb[0][i], rgb[1][i], rgb[2][i]);
  const dark = minFilter(minChannel, sw, sh, patch);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => dark[b] - dark[a]);
  const top = order.slice(0, Math.max(1, Math.round(n * 0.002)));
  let air = top[0];
  for (const i of top) if (rgb[0][i] + rgb[1][i] + rgb[2][i] > rgb[0][air] + rgb[1][air] + rgb[2][air]) air = i;
  const light = rgb.map((c) => Math.max(0.15, c[air]));
  const scaled = new Float32Array(n);
  for (let i = 0; i < n; i++) scaled[i] = Math.min(rgb[0][i] / light[0], rgb[1][i] / light[1], rgb[2][i] / light[2]);
  const darkScaled = minFilter(scaled, sw, sh, patch);
  const haze = new Float32Array(n);
  for (let i = 0; i < n; i++) haze[i] = -Math.log(Math.min(1, Math.max(0.1, 1 - 0.95 * darkScaled[i])));
  const hazeFar = stretch(haze);

  // detail: the strength of edges around each pixel
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = 0.299 * rgb[0][i] + 0.587 * rgb[1][i] + 0.114 * rgb[2][i];
  const grad = new Float32Array(n);
  for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) grad[y * sw + x] = Math.abs(luma[y * sw + x + 1] - luma[y * sw + x - 1]) + Math.abs(luma[(y + 1) * sw + x] - luma[(y - 1) * sw + x]);
  const detail = stretch(boxMean(grad, sw, sh, patch * 2));

  const near = new Float32Array(n);
  for (let y = 0; y < sh; y++) {
    const lowInFrame = sh > 1 ? y / (sh - 1) : 0; // 0 at the top, 1 at the bottom
    for (let x = 0; x < sw; x++) {
      const i = y * sw + x;
      near[i] = 0.5 * (1 - hazeFar[i]) + 0.3 * lowInFrame + 0.2 * detail[i];
    }
  }
  const smooth = stretch(boxMean(near, sw, sh, patch));

  // back to full size, then onto the picture's own edges
  const full = resizeFloat(smooth, sw, sh, img.width, img.height);
  const guided = guidedFilter(luminance(img), full, img.width, img.height, Math.max(3, Math.round(longest / 200)), 0.02);
  return stretch(guided, 0.01, 0.99);
}

/** The pixels whose depth is within `range` of `depth` (soft at its edges), as a mask. */
export function depthBand(map: Float32Array, depth: number, range: number): Mask {
  const out = new Uint8Array(map.length);
  const soft = Math.max(0.01, range * 0.25);
  for (let i = 0; i < map.length; i++) {
    const away = Math.abs(map[i] - depth);
    out[i] = away <= range ? 255 : away >= range + soft ? 0 : Math.round(255 * (1 - (away - range) / soft));
  }
  return out;
}

/** The typical depth around (x, y): the median of a small window, so one odd pixel does not decide. */
export function depthAt(map: Float32Array, width: number, height: number, x: number, y: number, radius = 3): number {
  const values: number[] = [];
  for (let yy = Math.max(0, Math.round(y) - radius); yy <= Math.min(height - 1, Math.round(y) + radius); yy++) {
    for (let xx = Math.max(0, Math.round(x) - radius); xx <= Math.min(width - 1, Math.round(x) + radius); xx++) values.push(map[yy * width + xx]);
  }
  values.sort((a, b) => a - b);
  return values[values.length >> 1] ?? 0;
}

/**
 * Masks for stacking `count` copies of a picture from far to near. The first shows everything; each next one shows only what
 * is nearer than a depth that splits the picture's pixels evenly, softly. Because every layer lies over a layer that already
 * has what it hides, no gap shows at the edges, and something placed between two layers is hidden by the nearer one.
 */
export function depthLayerMasks(map: Float32Array, count: number): Mask[] {
  const n = Math.max(1, Math.round(count));
  const sorted = Float32Array.from(map).sort();
  const masks: Mask[] = [new Uint8Array(map.length).fill(255)];
  const soft = 0.02;
  for (let k = 1; k < n; k++) {
    const t = sorted[Math.min(sorted.length - 1, Math.round((k / n) * (sorted.length - 1)))];
    const m = new Uint8Array(map.length);
    for (let i = 0; i < map.length; i++) {
      const u = Math.min(1, Math.max(0, (map[i] - (t - soft)) / (2 * soft)));
      m[i] = Math.round(255 * u * u * (3 - 2 * u));
    }
    masks.push(m);
  }
  return masks;
}
