/**
 * Point tracking (Design track D17, ROADMAP_3D 3D-205): pyramidal Lucas–Kanade on grayscale frames, sub-pixel, with a confidence
 * per step. Pure: it takes pixel arrays (a worker or a test hands them in) and never reads the page. Our own code, no library.
 *
 * A frame is `{ width, height, data }` with one luminance value per pixel (0..255). A track is a list of points, one per frame;
 * a point the tracker lost is null and the track stops there (the editor lets you nudge it and go on).
 */
export interface GrayFrame {
  width: number;
  height: number;
  data: Float32Array | Uint8Array | Uint8ClampedArray;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** 0..1: how well the patch around the point still matches the first frame's. */
  confidence: number;
}

export interface TrackOptions {
  /** Half the side of the square patch matched around the point, px. */
  radius?: number;
  /** Pyramid levels (each half the size of the one below); more follows faster motion. */
  levels?: number;
  /** Lucas–Kanade iterations per level. */
  iterations?: number;
  /** Below this confidence the point is lost. */
  minConfidence?: number;
}

const DEFAULTS: Required<TrackOptions> = { radius: 7, levels: 3, iterations: 20, minConfidence: 0.6 };

/** A frame's luminance from RGBA bytes (Rec. 709 weights). */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayFrame {
  const data = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) data[i] = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2];
  return { width, height, data };
}

/** Bilinear sample, clamped at the edges. */
export function sample(f: GrayFrame, x: number, y: number): number {
  const w = f.width, h = f.height;
  const cx = Math.min(w - 1.001, Math.max(0, x));
  const cy = Math.min(h - 1.001, Math.max(0, y));
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const ax = cx - x0, ay = cy - y0;
  const i = y0 * w + x0;
  const d = f.data;
  return (d[i] * (1 - ax) + d[i + 1] * ax) * (1 - ay) + (d[i + w] * (1 - ax) + d[i + w + 1] * ax) * ay;
}

/** The next pyramid level: half size, 2x2 average. */
export function downsample(f: GrayFrame): GrayFrame {
  const w = Math.max(1, f.width >> 1), h = Math.max(1, f.height >> 1);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(f.width - 2, x * 2), sy = Math.min(f.height - 2, y * 2);
    const i = sy * f.width + sx;
    data[y * w + x] = (f.data[i] + f.data[i + 1] + f.data[i + f.width] + f.data[i + f.width + 1]) / 4;
  }
  return { width: w, height: h, data };
}

export function pyramid(f: GrayFrame, levels: number): GrayFrame[] {
  const out = [f];
  for (let i = 1; i < levels; i++) {
    const prev = out[i - 1];
    if (prev.width < 16 || prev.height < 16) break;
    out.push(downsample(prev));
  }
  return out;
}

/** Normalised cross-correlation of the patch around `a` in `fa` and around `b` in `fb`: 1 is identical, 0 unrelated. */
export function patchMatch(fa: GrayFrame, a: [number, number], fb: GrayFrame, b: [number, number], radius: number): number {
  let sa = 0, sb = 0, n = 0;
  const va: number[] = [], vb: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const p = sample(fa, a[0] + dx, a[1] + dy), q = sample(fb, b[0] + dx, b[1] + dy);
    va.push(p); vb.push(q); sa += p; sb += q; n++;
  }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const p = va[i] - ma, q = vb[i] - mb;
    num += p * q; da += p * p; db += q * q;
  }
  if (da < 1e-6 || db < 1e-6) return da < 1e-6 && db < 1e-6 ? 1 : 0;
  return Math.max(0, num / Math.sqrt(da * db));
}

/** One Lucas–Kanade step at one level: where the patch around `p` in `prev` is in `next`, starting from `guess`. Null when the patch has no texture to follow. */
function lkLevel(prev: GrayFrame, next: GrayFrame, p: [number, number], guess: [number, number], radius: number, iterations: number): [number, number] | null {
  // gradients and the structure tensor of the template patch
  let gxx = 0, gxy = 0, gyy = 0;
  const gx: number[] = [], gy: number[] = [], tpl: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = p[0] + dx, y = p[1] + dy;
    const ix = (sample(prev, x + 1, y) - sample(prev, x - 1, y)) / 2;
    const iy = (sample(prev, x, y + 1) - sample(prev, x, y - 1)) / 2;
    gx.push(ix); gy.push(iy); tpl.push(sample(prev, x, y));
    gxx += ix * ix; gxy += ix * iy; gyy += iy * iy;
  }
  const det = gxx * gyy - gxy * gxy;
  // the smaller eigenvalue of the structure tensor: a patch that is flat, or an edge in one direction only, cannot be followed
  const tr = gxx + gyy;
  const minEig = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const n = (2 * radius + 1) ** 2;
  if (minEig / n < 0.002 || det <= 0) return null;
  // zero-mean matching: a patch that got brighter or darker as a whole (light, exposure) still matches
  const mt = tpl.reduce((a, b) => a + b, 0) / tpl.length;
  let [qx, qy] = guess;
  const cur = new Array<number>(tpl.length);
  for (let it = 0; it < iterations; it++) {
    let k = 0, sum = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      cur[k] = sample(next, qx + dx, qy + dy);
      sum += cur[k++];
    }
    const mn = sum / tpl.length;
    let bx = 0, by = 0;
    for (k = 0; k < tpl.length; k++) {
      const diff = tpl[k] - mt - (cur[k] - mn);
      bx += gx[k] * diff; by += gy[k] * diff;
    }
    const ux = (gyy * bx - gxy * by) / det;
    const uy = (gxx * by - gxy * bx) / det;
    qx += ux; qy += uy;
    if (ux * ux + uy * uy < 1e-4) break;
  }
  return [qx, qy];
}

/** Where point `p` of `prev` is in `next` (pyramidal, coarse to fine), with a confidence. Null when it is lost. */
export function trackStep(prevPyr: GrayFrame[], nextPyr: GrayFrame[], p: [number, number], options: TrackOptions = {}, guess?: [number, number]): TrackPoint | null {
  const o = { ...DEFAULTS, ...options };
  const levels = Math.min(prevPyr.length, nextPyr.length);
  let g: [number, number] = guess ? [guess[0] - p[0], guess[1] - p[1]] : [0, 0]; // displacement, at full size
  let finest = false;
  for (let l = levels - 1; l >= 0; l--) {
    const s = 2 ** l;
    const at: [number, number] = [p[0] / s, p[1] / s];
    const moved = lkLevel(prevPyr[l], nextPyr[l], at, [at[0] + g[0] / s, at[1] + g[1] / s], o.radius, o.iterations);
    if (moved) g = [(moved[0] - at[0]) * s, (moved[1] - at[1]) * s];
    if (l === 0) finest = moved !== null;
  }
  if (!finest) return null; // nothing to follow at full size: lost, not guessed
  const q: [number, number] = [p[0] + g[0], p[1] + g[1]];
  const f0 = prevPyr[0], f1 = nextPyr[0];
  if (q[0] < 0 || q[1] < 0 || q[0] > f1.width - 1 || q[1] > f1.height - 1) return null;
  const confidence = patchMatch(f0, p, f1, q, o.radius);
  return confidence >= o.minConfidence ? { x: q[0], y: q[1], confidence } : null;
}

/**
 * Tracks a point through frames, forward from `start`. Each step matches against the previous frame (follows slow changes in
 * lighting) and the confidence against the first (catches drift). Returns one entry per frame; null after the point is lost.
 */
export function trackPoint(frames: readonly GrayFrame[], start: [number, number], options: TrackOptions = {}): (TrackPoint | null)[] {
  const o = { ...DEFAULTS, ...options };
  const out: (TrackPoint | null)[] = [{ x: start[0], y: start[1], confidence: 1 }];
  if (frames.length === 0) return [];
  let prevPyr = pyramid(frames[0], o.levels);
  let p: [number, number] = start;
  let velocity: [number, number] = [0, 0];
  for (let i = 1; i < frames.length; i++) {
    const nextPyr = pyramid(frames[i], o.levels);
    const step = trackStep(prevPyr, nextPyr, p, o, [p[0] + velocity[0], p[1] + velocity[1]]);
    if (!step) {
      for (let j = i; j < frames.length; j++) out.push(null);
      break;
    }
    velocity = [step.x - p[0], step.y - p[1]];
    p = [step.x, step.y];
    out.push(step);
    prevPyr = nextPyr;
  }
  return out;
}

/** Tracks backward from the last frame: the same as forward on the reversed clip. */
export function trackPointBackward(frames: readonly GrayFrame[], startAtLast: [number, number], options: TrackOptions = {}): (TrackPoint | null)[] {
  return trackPoint([...frames].reverse(), startAtLast, options).reverse();
}

/** Tracks a planar region by its four corners (each a point track); a frame where any corner is lost is null. */
export function trackPlane(frames: readonly GrayFrame[], corners: readonly [number, number][], options: TrackOptions = {}): ([number, number][] | null)[] {
  const tracks = corners.map((c) => trackPoint(frames, c, options));
  return frames.map((_, i) => {
    const pts = tracks.map((t) => t[i]);
    return pts.every((p) => p) ? pts.map((p) => [p!.x, p!.y] as [number, number]) : null;
  });
}

/** Shi–Tomasi corner score at a point: the smaller eigenvalue of the patch's structure tensor, per pixel. High is good to track. */
export function cornerScore(f: GrayFrame, p: [number, number], radius = DEFAULTS.radius): number {
  let gxx = 0, gxy = 0, gyy = 0;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = p[0] + dx, y = p[1] + dy;
    const ix = (sample(f, x + 1, y) - sample(f, x - 1, y)) / 2;
    const iy = (sample(f, x, y + 1) - sample(f, x, y - 1)) / 2;
    gxx += ix * ix; gxy += ix * iy; gyy += iy * iy;
  }
  const tr = gxx + gyy, det = gxx * gyy - gxy * gxy;
  return (tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det))) / (2 * radius + 1) ** 2;
}

/** The best point to track within `search` px of where the user clicked (as a tracker snaps its point to a feature). */
export function bestFeatureNear(f: GrayFrame, p: [number, number], search = 12, radius = DEFAULTS.radius): [number, number] {
  let best: [number, number] = p;
  let score = cornerScore(f, p, radius);
  for (let dy = -search; dy <= search; dy += 2) for (let dx = -search; dx <= search; dx += 2) {
    const q: [number, number] = [p[0] + dx, p[1] + dy];
    if (q[0] < radius + 1 || q[1] < radius + 1 || q[0] > f.width - radius - 2 || q[1] > f.height - radius - 2) continue;
    const s = cornerScore(f, q, radius);
    if (s > score) { score = s; best = q; }
  }
  return best;
}
