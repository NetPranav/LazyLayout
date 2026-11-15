/**
 * Tracks as keyframes (Design track D17, ROADMAP_3D 3D-206): a track is a list of points per frame; in the document it is ordinary
 * keyframes (editable, smoothable), and in the export it is a small delta-compressed string (no tracker ships).
 *
 * Encoding: positions in 1/8 px, the first absolute and the rest as differences, zig-zag varints, base64url. A 10-second track at
 * 30 fps of a smoothly moving point is a few hundred bytes.
 */
export interface Pt {
  x: number;
  y: number;
}

const Q = 8; // 1/8 px

function pushVarint(out: number[], n: number): void {
  let z = n >= 0 ? n * 2 : -n * 2 - 1;
  while (z >= 0x80) {
    out.push((z & 0x7f) | 0x80);
    z = Math.floor(z / 128);
  }
  out.push(z);
}

function readVarint(bytes: Uint8Array, at: { i: number }): number {
  let z = 0, shift = 1;
  for (;;) {
    const b = bytes[at.i++];
    z += (b & 0x7f) * shift;
    if (b < 0x80) break;
    shift *= 128;
  }
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function toB64(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "") + (i + 2 < bytes.length ? B64[n & 63] : "");
  }
  return s;
}
function fromB64(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0));
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255);
    if (i + 2 < s.length) out.push((n >> 8) & 255);
    if (i + 3 < s.length) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

/** A track as a compact string (frames with no point are not allowed: trim the track to where it was found first). */
export function encodeTrack(points: readonly Pt[]): string {
  const bytes: number[] = [];
  pushVarint(bytes, points.length);
  let px = 0, py = 0;
  for (const p of points) {
    const qx = Math.round(p.x * Q), qy = Math.round(p.y * Q);
    pushVarint(bytes, qx - px);
    pushVarint(bytes, qy - py);
    px = qx; py = qy;
  }
  return toB64(bytes);
}

export function decodeTrack(text: string): Pt[] {
  const bytes = fromB64(text);
  const at = { i: 0 };
  const n = readVarint(bytes, at);
  const out: Pt[] = [];
  let px = 0, py = 0;
  for (let k = 0; k < n; k++) {
    px += readVarint(bytes, at);
    py += readVarint(bytes, at);
    out.push({ x: px / Q, y: py / Q });
  }
  return out;
}

/** Keyframes for a track (one per frame), as offsets from the first point: what a helper layer's `transform.x/y` take, so a layer parented to it rides along. */
export function trackKeyframes(points: readonly (Pt | null)[], fps: number): { x: { time: number; value: number }[]; y: { time: number; value: number }[] } {
  const first = points.find((p): p is Pt => !!p);
  const x: { time: number; value: number }[] = [];
  const y: { time: number; value: number }[] = [];
  if (!first) return { x, y };
  points.forEach((p, i) => {
    if (!p) return;
    const t = Math.round((i / fps) * 1e6) / 1e6;
    x.push({ time: t, value: Math.round((p.x - first.x) * 100) / 100 });
    y.push({ time: t, value: Math.round((p.y - first.y) * 100) / 100 });
  });
  return { x, y };
}

/** Moving-average smoothing of a track (radius in frames), keeping the ends in place. */
export function smoothTrack(points: readonly Pt[], radius: number): Pt[] {
  if (radius <= 0) return points.map((p) => ({ ...p }));
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return { ...p };
    let sx = 0, sy = 0, n = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(points.length - 1, i + radius); k++) {
      sx += points[k].x; sy += points[k].y; n++;
    }
    return { x: sx / n, y: sy / n };
  });
}
