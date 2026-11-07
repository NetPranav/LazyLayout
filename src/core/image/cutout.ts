/**
 * Cutting a subject out of a picture, on the device and with no model: what a designer does with a magic wand.
 *
 * All of this works on a mask: one byte per pixel, 255 where the pixel is kept and 0 where it is cut away. A click picks
 * the pixels that look like the one under it (a flood fill that grows while the colour stays within a tolerance), "keep
 * the subject" turns a selection of the background around, the edge can be shrunk, grown and softened, and the mask is
 * written into the picture's alpha channel. Nothing here touches the DOM, so it is tested directly.
 */

export interface Pixels {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

export type Mask = Uint8Array;

export const newMask = (width: number, height: number, value = 0): Mask => new Uint8Array(width * height).fill(value);

/** How far apart two pixels are, 0 to 441 (the longest distance in RGB space), with transparent pixels counted as far from everything. */
function distance(d: Uint8ClampedArray, a: number, b: number): number {
  const aa = d[a + 3];
  const ba = d[b + 3];
  if (aa < 8 || ba < 8) return aa < 8 && ba < 8 ? 0 : 441;
  const dr = d[a] - d[b];
  const dg = d[a + 1] - d[b + 1];
  const db = d[a + 2] - d[b + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Selects the pixels connected to `seeds` whose colour is within `tolerance` (0 to 100) of the seed's. The comparison is
 * against the seed pixel itself, not the pixel next to it, so a slow gradient does not creep across the whole picture.
 * `contiguous: false` selects every such pixel in the picture, not only the ones touching the seed.
 */
export function wandSelect(img: Pixels, seeds: ReadonlyArray<{ x: number; y: number }>, tolerance: number, contiguous = true, into?: Mask): Mask {
  const { data, width, height } = img;
  const mask = into ?? newMask(width, height);
  const limit = (Math.max(0, Math.min(100, tolerance)) / 100) * 441;
  // one visited list for all seeds, marked with the seed's number: a border scan has hundreds of seeds on a big picture
  const seen = new Int32Array(width * height);
  let generation = 0;
  const stack: number[] = [];
  for (const seed of seeds) {
    const sx = Math.max(0, Math.min(width - 1, Math.round(seed.x)));
    const sy = Math.max(0, Math.min(height - 1, Math.round(seed.y)));
    const ref = (sy * width + sx) * 4;
    if (!contiguous) {
      for (let i = 0; i < width * height; i++) if (distance(data, ref, i * 4) <= limit) mask[i] = 255;
      continue;
    }
    generation++;
    stack.length = 0;
    stack.push(sy * width + sx);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      if (seen[p] === generation) continue;
      seen[p] = generation;
      if (distance(data, ref, p * 4) > limit) continue;
      mask[p] = 255;
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) stack.push(p - 1);
      if (x < width - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - width);
      if (y < height - 1) stack.push(p + width);
    }
  }
  return mask;
}

/**
 * The background, found without a click: the edge of the picture is almost always background, so the wand starts from
 * points all along it. Returns what it reached; "keep the subject" is the inverse of this.
 */
export function selectBorderBackground(img: Pixels, tolerance: number, sides: "all" | "top" = "all", stepAtLeast = 8): Mask {
  const { width, height } = img;
  // about the same number of seeds at any size: each one is a whole fill
  const step = Math.max(stepAtLeast, Math.ceil((2 * (width + height)) / 64));
  const seeds: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < width; x += step) {
    seeds.push({ x, y: 0 });
    if (sides === "all") seeds.push({ x, y: height - 1 });
  }
  // "top" is for a subject that stands on the bottom of the picture (a mountain, a person): the sky is the top edge and the upper sides
  const downTo = sides === "all" ? height : Math.round(height * 0.35);
  for (let y = 0; y < downTo; y += step) seeds.push({ x: 0, y }, { x: width - 1, y });
  return wandSelect(img, seeds, tolerance, true);
}

/**
 * Finds the subject without a click. It samples the whole edge first; when that leaves almost nothing or almost everything
 * (the subject touches the edge), it samples only the top, where the sky is.
 */
export function autoSubject(img: Pixels, tolerance: number): { mask: Mask; sides: "all" | "top"; tolerance: number } {
  // The search is done on a small copy; only the answer is computed at full size, so a big photo takes a moment and not minutes.
  const small = shrink(img, 360);
  const total = small.width * small.height;
  const background = (sides: "all" | "top", tol: number) => selectBorderBackground(small, tol, sides);
  const plausible = (m: Mask) => {
    const kept = total - maskArea(m);
    return kept > total * 0.04 && kept < total * 0.96;
  };
  // Which edges are sky: all of them, unless that leaves almost nothing or almost everything (the subject touches the edge)
  let sides: "all" | "top" = "all";
  const probe = background("all", Math.min(tolerance, 14));
  if (!plausible(probe)) sides = "top";
  // The tolerance is a ceiling. Grow it step by step and stop just before the fill leaks out of the sky into the subject,
  // which shows as the background suddenly taking a large extra share of the picture.
  const steps = [6, 10, 14, 18, 22, 26, 30, 36, 42].filter((t) => t < tolerance);
  steps.push(tolerance);
  let bestTol = steps[0];
  let bestArea = maskArea(background(sides, steps[0]));
  for (const t of steps.slice(1)) {
    const area = maskArea(background(sides, t));
    if (area - bestArea > total * 0.15) break; // a leak: stay with the last good one
    bestTol = t;
    bestArea = area;
  }
  return { mask: invertMask(selectBorderBackground(img, bestTol, sides)), sides, tolerance: bestTol };
}

/** A smaller copy of a picture (nearest pixel), for searching. */
function shrink(img: Pixels, longest: number): Pixels {
  const k = Math.min(1, longest / Math.max(img.width, img.height));
  if (k === 1) return img;
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / k));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / k));
      const from = (sy * img.width + sx) * 4;
      const to = (y * w + x) * 4;
      data[to] = img.data[from];
      data[to + 1] = img.data[from + 1];
      data[to + 2] = img.data[from + 2];
      data[to + 3] = img.data[from + 3];
    }
  }
  return { data, width: w, height: h };
}

/** A closed shape drawn by hand (a lasso), as a mask: 255 inside. `points` are in the picture's own pixels. */
export function polygonMask(points: ReadonlyArray<{ x: number; y: number }>, width: number, height: number): Mask {
  const mask = newMask(width, height);
  if (points.length < 3) return mask;
  const crossings: number[] = [];
  for (let y = 0; y < height; y++) {
    const sy = y + 0.5;
    crossings.length = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.y <= sy !== b.y <= sy) crossings.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const to = Math.min(width - 1, Math.floor(crossings[k + 1] - 0.5));
      if (to >= from) mask.fill(255, y * width + from, y * width + to + 1);
    }
  }
  return mask;
}

export function invertMask(mask: Mask): Mask {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = 255 - mask[i];
  return out;
}

export function unionMask(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.max(a[i], b[i]);
  return out;
}

export function subtractMask(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = b[i] > 127 ? 0 : a[i];
  return out;
}

/** How many pixels a mask keeps. */
export function maskArea(mask: Mask): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 127) n++;
  return n;
}

/** Grows (positive `px`) or shrinks (negative) the kept area by that many pixels, as a square brush: it closes pinholes and trims fringes. */
export function growMask(mask: Mask, width: number, height: number, px: number): Mask {
  const r = Math.round(Math.abs(px));
  if (r === 0) return mask;
  const grow = px > 0;
  const pass = (src: Mask, horizontal: boolean): Mask => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let best = grow ? 0 : 255;
        for (let k = -r; k <= r; k++) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;
          const v = xx < 0 || yy < 0 || xx >= width || yy >= height ? (grow ? 0 : 255) : src[yy * width + xx];
          best = grow ? Math.max(best, v) : Math.min(best, v);
        }
        out[y * width + x] = best;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** Softens the edge with a box blur of that radius (twice, so it is close to a Gaussian). */
export function featherMask(mask: Mask, width: number, height: number, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) return mask;
  const blur = (src: Mask, horizontal: boolean): Mask => {
    const out = new Uint8Array(src.length);
    const n = horizontal ? width : height;
    const lines = horizontal ? height : width;
    for (let l = 0; l < lines; l++) {
      let sum = 0;
      const at = (i: number) => src[horizontal ? l * width + Math.min(n - 1, Math.max(0, i)) : Math.min(n - 1, Math.max(0, i)) * width + l];
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < n; i++) {
        out[horizontal ? l * width + i : i * width + l] = Math.round(sum / (2 * r + 1));
        sum += at(i + r + 1) - at(i - r);
      }
    }
    return out;
  };
  return blur(blur(blur(blur(mask, true), false), true), false);
}

/** Drops specks: keeps only kept regions of at least `minPixels`, so the cutout does not leave dust behind. */
export function removeSpecks(mask: Mask, width: number, height: number, minPixels: number): Mask {
  const out = new Uint8Array(mask.length);
  const seen = new Uint8Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || mask[start] <= 127) continue;
    const region: number[] = [];
    const stack = [start];
    while (stack.length > 0) {
      const p = stack.pop() as number;
      if (seen[p] || mask[p] <= 127) continue;
      seen[p] = 1;
      region.push(p);
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) stack.push(p - 1);
      if (x < width - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - width);
      if (y < height - 1) stack.push(p + width);
    }
    if (region.length >= minPixels) for (const p of region) out[p] = mask[p];
  }
  return out;
}

/** Fills holes: kept regions fully enclosed by cut-away pixels that are too small to be real gaps (`maxHole` pixels) are kept again. */
export function fillHoles(mask: Mask, width: number, height: number, maxHole: number): Mask {
  const inverse = invertMask(mask);
  const big = removeSpecks(inverse, width, height, maxHole + 1); // cut regions larger than maxHole are real gaps and stay cut
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] > 127 ? mask[i] : inverse[i] > 127 && big[i] <= 127 ? 255 : 0;
  return out;
}

/** The bounding box of what a mask keeps, or null when it keeps nothing. */
export function maskBounds(mask: Mask, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Writes the mask into the picture: a pixel's alpha is its own alpha times the mask. Returns a new RGBA buffer. */
export function applyMask(img: Pixels, mask: Mask, crop?: { x: number; y: number; width: number; height: number }): Pixels {
  const box = crop ?? { x: 0, y: 0, width: img.width, height: img.height };
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const src = (box.y + y) * img.width + (box.x + x);
      const o = (y * box.width + x) * 4;
      out[o] = img.data[src * 4];
      out[o + 1] = img.data[src * 4 + 1];
      out[o + 2] = img.data[src * 4 + 2];
      out[o + 3] = Math.round((img.data[src * 4 + 3] * mask[src]) / 255);
    }
  }
  return { data: out, width: box.width, height: box.height };
}

/** How a picture is drawn in its box: CSS object-fit words, or a paint's crop (fractions of the picture that show). */
export type PictureFit = "cover" | "contain" | "fill" | "none" | "scale-down" | { x: number; y: number; w: number; h: number };

/**
 * Where a picture is really drawn inside a box of `boxW` by `boxH`, centred the way CSS centres it. A cover picture runs
 * past the box. A piece cut from the picture only lines up with the original if it is placed by this.
 */
export function pictureBox(fit: PictureFit, boxW: number, boxH: number, picW: number, picH: number): { x: number; y: number; width: number; height: number } {
  if (typeof fit === "object") {
    const width = boxW / fit.w;
    const height = boxH / fit.h;
    return { x: 0 - fit.x * width, y: 0 - fit.y * height, width, height };
  }
  if (fit === "fill") return { x: 0, y: 0, width: boxW, height: boxH };
  const cover = Math.max(boxW / picW, boxH / picH);
  const contain = Math.min(boxW / picW, boxH / picH);
  const k = fit === "cover" ? cover : fit === "contain" ? contain : fit === "none" ? 1 : Math.min(1, contain);
  const width = picW * k;
  const height = picH * k;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

/** The part of a picture (in its own pixels) that shows in the box, given where `pictureBox` drew it. */
export function visibleWindow(drawn: { x: number; y: number; width: number; height: number }, boxW: number, boxH: number, picW: number, picH: number): { x: number; y: number; width: number; height: number } {
  const sx = picW / drawn.width;
  const sy = picH / drawn.height;
  const x0 = Math.max(0, Math.floor(-drawn.x * sx));
  const y0 = Math.max(0, Math.floor(-drawn.y * sy));
  const x1 = Math.min(picW, Math.ceil((boxW - drawn.x) * sx));
  const y1 = Math.min(picH, Math.ceil((boxH - drawn.y) * sy));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}
