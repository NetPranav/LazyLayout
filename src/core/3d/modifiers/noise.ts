/**
 * ============================================================================
 * PROCEDURAL VALUE NOISE (Phase 3D-030)
 * ============================================================================
 * Deterministic, pure 3D value noise with quintic interpolation.
 * Bounded strictly within [0, 1].
 * ============================================================================
 */

function hash3D(ix: number, iy: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + iz * 127412617 + (seed | 0) * 999999937) | 0;
  h = Math.imul(h ^ (h >>> 13), 127412617);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Evaluates 3D value noise at (x, y, z) with a given integer seed.
 * Returns value in [0, 1].
 */
export function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);

  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;

  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);

  const c000 = hash3D(x0, y0, z0, seed);
  const c100 = hash3D(x0 + 1, y0, z0, seed);
  const c010 = hash3D(x0, y0 + 1, z0, seed);
  const c110 = hash3D(x0 + 1, y0 + 1, z0, seed);
  const c001 = hash3D(x0, y0, z0 + 1, seed);
  const c101 = hash3D(x0 + 1, y0, z0 + 1, seed);
  const c011 = hash3D(x0, y0 + 1, z0 + 1, seed);
  const c111 = hash3D(x0 + 1, y0 + 1, z0 + 1, seed);

  const x00 = c000 + u * (c100 - c000);
  const x10 = c010 + u * (c110 - c010);
  const x01 = c001 + u * (c101 - c001);
  const x11 = c011 + u * (c111 - c011);

  const y0_val = x00 + v * (x10 - x00);
  const y1_val = x01 + v * (x11 - x01);

  return y0_val + w * (y1_val - y0_val);
}
