/**
 * ROADMAP_3D 3D-004 (was Main 137): picture comparison for GPU output, in pure code. Two metrics, because each alone is
 * wrong for some images:
 *
 * - **SSIM** (structural similarity on luma, 8 × 8 windows): good at "does it look the same", but a 1 px shift of a
 *   hard edge drops it a lot.
 * - **Neighbourhood error**: for each pixel, the smallest difference to any pixel within `radius` px in the other
 *   image. A shift of up to `radius` px costs nothing; a wrong colour or a missing shape still does.
 *
 * `compare` passes when the neighbourhood error is small everywhere that matters (the share of bad pixels is under
 * `maxBadFraction`) AND the mean SSIM is above `minSsim`. A software GPU (CI) and a real one differ by a few percent
 * in shading, so the defaults are loose enough for that and tight enough to catch a changed colour or shape.
 */

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel, row-major. */
  data: Uint8Array | Uint8ClampedArray;
}

export interface CompareOptions {
  /** A pixel is "bad" when its neighbourhood error (largest channel difference, 0-255) is above this. */
  channelTolerance: number;
  /** Neighbourhood radius in px. */
  radius: number;
  /** The share of bad pixels allowed. */
  maxBadFraction: number;
  /** The lowest mean SSIM allowed. */
  minSsim: number;
}

export const DEFAULT_COMPARE: CompareOptions = { channelTolerance: 12, radius: 1, maxBadFraction: 0.002, minSsim: 0.9 };

export interface CompareResult {
  pass: boolean;
  ssim: number;
  badFraction: number;
  /** Largest neighbourhood error found, 0-255. */
  maxError: number;
  /** A diff picture: red where bad, faint grey elsewhere (for the review page). */
  diff: Rgba;
}

const luma = (img: Rgba, i: number): number => 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];

/** Mean SSIM of the luma over non-overlapping 8 × 8 windows (the standard constants for 8-bit images). */
export function ssim(a: Rgba, b: Rgba): number {
  if (a.width !== b.width || a.height !== b.height) return 0;
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const W = 8;
  let sum = 0;
  let n = 0;
  for (let y0 = 0; y0 + W <= a.height; y0 += W / 2) {
    for (let x0 = 0; x0 + W <= a.width; x0 += W / 2) {
      let ma = 0, mb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) {
          const i = ((y0 + y) * a.width + x0 + x) * 4;
          const la = luma(a, i);
          const lb = luma(b, i);
          ma += la;
          mb += lb;
          saa += la * la;
          sbb += lb * lb;
          sab += la * lb;
        }
      const N = W * W;
      ma /= N;
      mb /= N;
      const va = saa / N - ma * ma;
      const vb = sbb / N - mb * mb;
      const cov = sab / N - ma * mb;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  }
  return n ? sum / n : 1;
}

/** The smallest largest-channel difference between pixel (x, y) of `a` and any pixel within `r` px of it in `b`. */
function neighbourhoodError(a: Rgba, b: Rgba, x: number, y: number, r: number): number {
  const ai = (y * a.width + x) * 4;
  let best = 255;
  for (let dy = -r; dy <= r; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= b.height) continue;
    for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= b.width) continue;
      const bi = (yy * b.width + xx) * 4;
      const d = Math.max(Math.abs(a.data[ai] - b.data[bi]), Math.abs(a.data[ai + 1] - b.data[bi + 1]), Math.abs(a.data[ai + 2] - b.data[bi + 2]), Math.abs(a.data[ai + 3] - b.data[bi + 3]));
      if (d < best) best = d;
    }
  }
  return best;
}

export function compare(actual: Rgba, golden: Rgba, options: Partial<CompareOptions> = {}): CompareResult {
  const o = { ...DEFAULT_COMPARE, ...options };
  const diff: Rgba = { width: actual.width, height: actual.height, data: new Uint8Array(actual.width * actual.height * 4) };
  if (actual.width !== golden.width || actual.height !== golden.height) return { pass: false, ssim: 0, badFraction: 1, maxError: 255, diff };
  let bad = 0;
  let maxError = 0;
  for (let y = 0; y < actual.height; y++)
    for (let x = 0; x < actual.width; x++) {
      // symmetric: a pixel is bad only if it is bad both ways (a shifted edge is matched either way, a new shape isn't)
      const e = Math.max(neighbourhoodError(actual, golden, x, y, o.radius), neighbourhoodError(golden, actual, x, y, o.radius));
      const i = (y * actual.width + x) * 4;
      if (e > maxError) maxError = e;
      if (e > o.channelTolerance) {
        bad++;
        diff.data[i] = 255;
        diff.data[i + 3] = 255;
      } else {
        const g = Math.round(luma(actual, i) * 0.25 + 190);
        diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = g;
        diff.data[i + 3] = 255;
      }
    }
  const badFraction = bad / (actual.width * actual.height);
  const s = ssim(actual, golden);
  return { pass: badFraction <= o.maxBadFraction && s >= o.minSsim, ssim: s, badFraction, maxError, diff };
}
