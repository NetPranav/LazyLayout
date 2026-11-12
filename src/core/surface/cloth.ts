/**
 * Surfaces (ROADMAP S4b): the resting shape by cloth simulation. A sheet of material that barely stretches (foil,
 * vinyl), sealed along the shape's edge, is inflated by air pressure. Because it can't stretch, it can only rise by
 * pulling material in from the edge, and the material that runs short buckles: the corners pinch into creases and the
 * edges crinkle into wrinkles, as on a real foil balloon. Position-based dynamics (distance constraints for stretch and
 * shear, a weak bend, pressure along the normal), run once when the shape or settings change, then drawn into a
 * height field the renderer lights. Pure: no DOM.
 */

export interface ClothSettings {
  /** Particle spacing in px: smaller is finer wrinkles and slower. */
  spacing: number;
  /** How hard the air pushes (0..1). */
  pressure: number;
  /** How much the sheet may stretch (0: not at all, foil; 0.1: rubbery). */
  stretch: number;
  /** Resistance to bending (0..1): higher is fewer, broader wrinkles. */
  bend: number;
  /** Simulation steps. */
  steps: number;
  /** Constraint passes per step: more keeps the sheet from stretching (and lets it buckle). */
  iterations: number;
  /** Extra material: the sheet is this much larger than its outline (0.06: 6%), and the extra crumples. */
  slack: number;
  /** The seam stays where it is (a clean outline), or slides inwards as the air pulls it (a real foil pillow). */
  seam: "fixed" | "free";
  seed: number;
}

export const DEFAULT_CLOTH: ClothSettings = { spacing: 4, pressure: 0.7, stretch: 0.01, bend: 0.12, steps: 260, iterations: 20, slack: 0.06, seam: "fixed", seed: 1 };

export interface ClothResult {
  /** Particles across and down. */
  nx: number;
  ny: number;
  /** Positions (x, y, z) per particle, px; z up (out of the page). NaN for particles outside the shape. */
  pos: Float32Array;
  /** 1 where a particle is part of the sheet. */
  active: Uint8Array;
  /** Mean stretch of the sheet at rest (0: none): how inextensible the result is. */
  strain: number;
}

function rand(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Inflates a sheet cut to `inside` (a test in the shape's own px) over a `width` × `height` box.
 * Particles on the shape's edge are the seam: they stay in the seam's plane (z = 0) but may slide inwards.
 */
export function inflateCloth(width: number, height: number, inside: (x: number, y: number) => boolean, settings: ClothSettings = DEFAULT_CLOTH, onProgress?: (progress: number) => void): ClothResult {
  const sp = Math.max(1.5, settings.spacing);
  const nx = Math.max(3, Math.round(width / sp) + 1);
  const ny = Math.max(3, Math.round(height / sp) + 1);
  const dx = width / (nx - 1);
  const dy = height / (ny - 1);
  const n = nx * ny;
  const pos = new Float32Array(n * 3);
  const prev = new Float32Array(n * 3);
  const active = new Uint8Array(n);
  const pinned = new Uint8Array(n);
  const rnd = rand(settings.seed + 11);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = i * dx;
      const y = j * dy;
      // a particle belongs to the sheet when it is inside, or on the edge (inside within half a spacing)
      const inn = inside(x, y) || inside(Math.min(width, x + dx * 0.5), y) || inside(Math.max(0, x - dx * 0.5), y) || inside(x, Math.min(height, y + dy * 0.5)) || inside(x, Math.max(0, y - dy * 0.5));
      active[k] = inn ? 1 : 0;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      // a tiny random lift breaks the symmetry, so the sheet buckles one way or the other (as real foil does)
      pos[k * 3 + 2] = (rnd() - 0.5) * 0.02 * sp;
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!active[k]) continue;
      const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || !active[k - 1] || !active[k + 1] || !active[k - nx] || !active[k + nx];
      if (edge) {
        pinned[k] = 1;
        pos[k * 3 + 2] = 0;
      }
    }
  prev.set(pos);

  const fixedSeam = settings.seam !== "free";
  // constraints: structural, shear and bend, as (a, b, rest, stiffness)
  const ca: number[] = [];
  const cb: number[] = [];
  const cr: number[] = [];
  const ck: number[] = [];
  const stretchK = 1 - Math.min(0.5, Math.max(0, settings.stretch)) * 2;
  const add = (a: number, b: number, k: number) => {
    if (!active[a] || !active[b] || (fixedSeam && pinned[a] && pinned[b])) return;
    const ddx = pos[a * 3] - pos[b * 3];
    const ddy = pos[a * 3 + 1] - pos[b * 3 + 1];
    ca.push(a);
    cb.push(b);
    // the extra material isn't spread perfectly evenly (no real sheet is): ±40% of it, seeded
    cr.push(Math.hypot(ddx, ddy) * (1 + Math.max(0, settings.slack) * (0.6 + 0.8 * rnd())));
    ck.push(k);
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (i + 1 < nx) add(k, k + 1, stretchK);
      if (j + 1 < ny) add(k, k + nx, stretchK);
      if (i + 1 < nx && j + 1 < ny) add(k, k + nx + 1, stretchK * 0.9);
      if (i > 0 && j + 1 < ny) add(k, k + nx - 1, stretchK * 0.9);
      if (i + 2 < nx) add(k, k + 2, settings.bend);
      if (j + 2 < ny) add(k, k + 2 * nx, settings.bend);
    }
  const m = ca.length;
  const A = Int32Array.from(ca);
  const B = Int32Array.from(cb);
  const R = Float32Array.from(cr);
  const K = Float32Array.from(ck);

  const normal = new Float32Array(n * 3);
  const force = settings.pressure * 0.06 * sp;
  const damping = 0.96;
  const iterations = Math.max(1, Math.round(settings.iterations));
  for (let step = 0; step < settings.steps; step++) {
    if (onProgress && step % 10 === 0) onProgress(step / settings.steps);
    // normals from the neighbours (area weighted), for the pressure
    normal.fill(0);
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        if (!active[a] || !active[b] || !active[c] || !active[d]) continue;
        const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
        // y grows downwards on the page, so u × v points into the page: flip to point up (out of the page)
        const nxv = -(uy * vz - uz * vy);
        const nyv = -(uz * vx - ux * vz);
        const nzv = -(ux * vy - uy * vx);
        for (const p of [a, b, c, d]) {
          normal[p * 3] += nxv;
          normal[p * 3 + 1] += nyv;
          normal[p * 3 + 2] += nzv;
        }
      }
    // integrate (Verlet) with pressure along the normal
    for (let k = 0; k < n; k++) {
      if (!active[k] || (fixedSeam && pinned[k])) continue;
      const o = k * 3;
      let nlx = normal[o], nly = normal[o + 1], nlz = normal[o + 2];
      const len = Math.hypot(nlx, nly, nlz) || 1;
      nlx /= len;
      nly /= len;
      nlz /= len;
      if (nlz < 0) {
        nlx = -nlx;
        nly = -nly;
        nlz = -nlz;
      }
      for (let c = 0; c < 3; c++) {
        const p = pos[o + c];
        const v = (p - prev[o + c]) * damping;
        prev[o + c] = p;
        pos[o + c] = p + v + force * (c === 0 ? nlx : c === 1 ? nly : nlz);
      }
    }
    // satisfy the constraints
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < m; c++) {
        const a = A[c] * 3;
        const b = B[c] * 3;
        const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
        const d = Math.hypot(ex, ey, ez);
        if (d < 1e-6) continue;
        const rest = R[c];
        // a bend constraint only resists folding (being pushed closer), never pulls
        const diff = (d - rest) / d;
        const k = K[c];
        if (k < 0.5 && diff > 0) continue;
        const wa = fixedSeam && pinned[A[c]] ? 0 : 1;
        const wb = fixedSeam && pinned[B[c]] ? 0 : 1;
        const w = wa + wb;
        if (w === 0) continue;
        const s = (k * diff) / w;
        pos[a] += ex * s * wa;
        pos[a + 1] += ey * s * wa;
        pos[a + 2] += ez * s * wa;
        pos[b] -= ex * s * wb;
        pos[b + 1] -= ey * s * wb;
        pos[b + 2] -= ez * s * wb;
      }
      // the sheet stays on its side of the seam, and the seam stays on the seam's plane (it may slide inwards:
      // that is what makes a real foil balloon's edge crumple)
      for (let k = 0; k < n; k++) if (active[k] && (pinned[k] || pos[k * 3 + 2] < 0)) pos[k * 3 + 2] = 0;
    }
  }
  let strain = 0;
  let counted = 0;
  for (let c = 0; c < m; c++) {
    if (K[c] < 0.5) continue;
    const a = A[c] * 3, b = B[c] * 3;
    strain += Math.abs(Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]) - R[c]) / R[c];
    counted++;
  }
  return { nx, ny, pos, active, strain: counted ? strain / counted : 0 };
}

/**
 * Draws the simulated sheet into a height field of `w` × `h` cells of `cell` px (the renderer's grid): each quad as two
 * triangles at their simulated (x, y), with z interpolated. Cells the sheet doesn't cover are 0.
 */
export function clothHeightField(cloth: ClothResult, w: number, h: number, cell: number): Float32Array {
  const out = new Float32Array(w * h);
  const { nx, ny, pos, active } = cloth;
  const tri = (a: number, b: number, c: number) => {
    const ax = pos[a * 3] / cell - 0.5, ay = pos[a * 3 + 1] / cell - 0.5, az = pos[a * 3 + 2];
    const bx = pos[b * 3] / cell - 0.5, by = pos[b * 3 + 1] / cell - 0.5, bz = pos[b * 3 + 2];
    const cx = pos[c * 3] / cell - 0.5, cy = pos[c * 3 + 1] / cell - 0.5, cz = pos[c * 3 + 2];
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const z = l1 * az + l2 * bz + l3 * cz;
        const i = y * w + x;
        if (z > out[i]) out[i] = z;
      }
  };
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      if (active[a] && active[b] && active[c]) tri(a, b, c);
      if (active[b] && active[c] && active[d]) tri(b, d, c);
    }
  return out;
}

/** A smooth pass over a height field (a 3×3 average, `passes` times), keeping 0 where the sheet isn't. */
function smoothField(f: Float32Array, w: number, h: number, passes: number): Float32Array {
  let cur = f;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(cur.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i] <= 0) continue;
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const wgt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            s += cur[yy * w + xx] * wgt;
            n += wgt;
          }
        next[i] = s / n;
      }
    cur = next;
  }
  return cur;
}

export interface ClothSurfaceRequest {
  width: number;
  height: number;
  /** Is (x, y) inside the shape (the shape's own px)? */
  inside: (x: number, y: number) => boolean;
  /** Height of the highest point, px (the simulated sheet is scaled to it). */
  depth: number;
  cloth: ClothSettings;
  /** Grid cell of the result, px. */
  cell: number;
  onProgress?: (progress: number) => void;
}

/** The resting height by cloth simulation, on the renderer's grid, smoothed and scaled to `depth`. */
export function clothSurface(req: ClothSurfaceRequest): { height: Float32Array; w: number; h: number } {
  const w = Math.max(2, Math.ceil(req.width / req.cell));
  const h = Math.max(2, Math.ceil(req.height / req.cell));
  const sim = inflateCloth(req.width, req.height, req.inside, req.cloth, req.onProgress);
  const raw = clothHeightField(sim, w, h, req.cell);
  const smooth = smoothField(raw, w, h, Math.max(1, Math.round(req.cloth.spacing / req.cell / 1.5)));
  let max = 0;
  for (let i = 0; i < smooth.length; i++) if (smooth[i] > max) max = smooth[i];
  const k = max > 0 ? req.depth / max : 0;
  for (let i = 0; i < smooth.length; i++) {
    const cx = ((i % w) + 0.5) * req.cell;
    const cy = (Math.floor(i / w) + 0.5) * req.cell;
    smooth[i] = req.inside(cx, cy) ? smooth[i] * k : 0;
  }
  return { height: smooth, w, h };
}
