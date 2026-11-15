/**
 * ============================================================================
 * STAGE 5 · PHASE 209 — PUPPET PINS
 * ============================================================================
 * After Effects-style free-form puppet pins on meshes/layers without bones,
 * supporting stiff zones, triangle overlap draw ordering, and keyframed pins.
 * ============================================================================
 */

import { type Point2D } from "./rigModel";
import { type DeformableMesh2D } from "./meshWeightsAndSkinning";

export interface PuppetPin {
  readonly id: string;
  readonly name: string;
  readonly restX: number;
  readonly restY: number;
  readonly x: number;
  readonly y: number;
  readonly rotationDeg?: number;
  /** Stiffness >= 1 tightens falloff so surrounding region stays rigid. */
  readonly stiffness?: number;
  /** Draw-order overlap depth for triangle sorting (higher renders on top). */
  readonly overlapZ?: number;
}

export interface PuppetPinKeyframe {
  readonly timeSec: number;
  readonly x: number;
  readonly y: number;
  readonly rotationDeg?: number;
}

export interface PuppetPinTrack {
  readonly pinId: string;
  readonly keyframes: readonly PuppetPinKeyframe[];
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute smooth normalized inverse-distance weights from vertices to puppet pins.
 */
export function computePuppetPinWeights(
  vertices: readonly Point2D[],
  pins: readonly PuppetPin[],
): number[][] {
  if (pins.length === 0) return vertices.map(() => []);
  return vertices.map((v) => {
    const raw = pins.map((pin) => {
      const dx = v.x - pin.restX;
      const dy = v.y - pin.restY;
      const dSq = dx * dx + dy * dy;
      if (dSq < 1e-6) return 1e9;
      const stiff = Math.max(0.25, pin.stiffness ?? 1);
      return Math.pow(stiff, 1.5) / (dSq + 100 / stiff);
    });
    const sum = raw.reduce((s, w) => s + w, 0);
    return sum > 0 ? raw.map((w) => w / sum) : raw.map(() => 1 / pins.length);
  });
}

/** Deform mesh vertices directly from puppet pin offsets + pin local rotations. */
export function deformMeshWithPuppetPins(
  mesh: DeformableMesh2D,
  pins: readonly PuppetPin[],
): Point2D[] {
  if (pins.length === 0) return [...mesh.vertices];
  const weights = computePuppetPinWeights(mesh.vertices, pins);

  return mesh.vertices.map((v, vi) => {
    let outX = 0;
    let outY = 0;
    const wRow = weights[vi];
    for (let pi = 0; pi < pins.length; pi++) {
      const w = wRow[pi];
      if (w <= 1e-8) continue;
      const pin = pins[pi];
      const rx = v.x - pin.restX;
      const ry = v.y - pin.restY;
      const rad = (pin.rotationDeg ?? 0) * DEG_TO_RAD;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const px = pin.x + (rx * cos - ry * sin);
      const py = pin.y + (rx * sin + ry * cos);
      outX += px * w;
      outY += py * w;
    }
    return { x: outX, y: outY };
  });
}

/** Sort triangles back-to-front using weighted puppet pin `overlapZ` values. */
export function orderTrianglesByPuppetOverlap(
  mesh: DeformableMesh2D,
  pins: readonly PuppetPin[],
): [number, number, number][] {
  if (pins.length === 0) return [...mesh.triangles];
  const weights = computePuppetPinWeights(mesh.vertices, pins);
  const vertZ = weights.map((wRow) =>
    wRow.reduce((sum, w, pi) => sum + w * (pins[pi].overlapZ ?? 0), 0),
  );
  return [...mesh.triangles].sort((t1, t2) => {
    const z1 = ((vertZ[t1[0]] ?? 0) + (vertZ[t1[1]] ?? 0) + (vertZ[t1[2]] ?? 0)) / 3;
    const z2 = ((vertZ[t2[0]] ?? 0) + (vertZ[t2[1]] ?? 0) + (vertZ[t2[2]] ?? 0)) / 3;
    return z1 - z2;
  });
}

/** Evaluate animated puppet pins at time `tSec` using keyframed tracks. */
export function evaluatePuppetPinsAtTime(
  restPins: readonly PuppetPin[],
  tracks: readonly PuppetPinTrack[],
  tSec: number,
): PuppetPin[] {
  const byId = new Map(tracks.map((tr) => [tr.pinId, tr.keyframes] as const));
  return restPins.map((pin) => {
    const kfs = byId.get(pin.id);
    if (!kfs || kfs.length === 0) return pin;
    const sorted = [...kfs].sort((a, b) => a.timeSec - b.timeSec);
    if (tSec <= sorted[0].timeSec) {
      return { ...pin, x: sorted[0].x, y: sorted[0].y, rotationDeg: sorted[0].rotationDeg ?? pin.rotationDeg };
    }
    const last = sorted[sorted.length - 1];
    if (tSec >= last.timeSec) {
      return { ...pin, x: last.x, y: last.y, rotationDeg: last.rotationDeg ?? pin.rotationDeg };
    }
    for (let i = 1; i < sorted.length; i++) {
      const k0 = sorted[i - 1];
      const k1 = sorted[i];
      if (tSec <= k1.timeSec) {
        const u = k1.timeSec === k0.timeSec ? 1 : (tSec - k0.timeSec) / (k1.timeSec - k0.timeSec);
        return {
          ...pin,
          x: k0.x + (k1.x - k0.x) * u,
          y: k0.y + (k1.y - k0.y) * u,
          rotationDeg:
            (k0.rotationDeg ?? pin.rotationDeg ?? 0) +
            ((k1.rotationDeg ?? pin.rotationDeg ?? 0) - (k0.rotationDeg ?? pin.rotationDeg ?? 0)) * u,
        };
      }
    }
    return pin;
  });
}
