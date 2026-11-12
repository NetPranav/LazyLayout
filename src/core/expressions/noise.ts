/**
 * Seeded noise for expressions (ROADMAP Phase 77). Deterministic across runs, machines and browsers: the lattice values come
 * from integer hashing (`Math.imul`, shifts, xor), which every engine does identically, and the blend between them is plain
 * `+ - * /` on doubles, which IEEE 754 fixes. It never calls `Math.sin`, `Math.pow` or anything else an engine may round
 * differently, so `wiggle` gives the same number everywhere.
 */

/** A 32-bit integer hash of (i, seed), mixed so neighbouring integers are unrelated. */
export function hashInt(i: number, seed: number): number {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((seed | 0) + 0x165667b1, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** The lattice value at integer `i`: -1 to 1. */
export const lattice = (i: number, seed: number): number => (hashInt(i, seed) / 4294967295) * 2 - 1;

/** 1D value noise, -1 to 1, smooth (the blend is a smoothstep between lattice values), zero mean. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = lattice(i, seed);
  const b = lattice(i + 1, seed);
  return a + (b - a) * u;
}

/** A seed from text (a layer id and property path), so two layers wiggle differently but each the same every time. */
export function seedFromText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h | 0;
}
