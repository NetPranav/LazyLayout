/**
 * Surfaces: a layer's `surface.*` properties as the settings the maths and the drawing use. Pure.
 */
import { DEFAULT_LOOK, type SurfaceLook } from "./field";
import { DEFAULT_PHYSICS, type PhysicsSettings } from "./membrane";

export const SURFACE_MATERIALS = {
  /** Thin metallised film (a foil balloon): almost all reflection, very glossy. */
  foil: { f0: 0.55, gloss: 1, exposure: 1.3, diffuse: 0.04 },
  /** Glossy plastic: some colour, a clear reflection. */
  plastic: { f0: 0.05, gloss: 0.9, exposure: 1.2, diffuse: 0.75 },
  /** Satin: colour first, a soft reflection. */
  satin: { f0: 0.06, gloss: 0.4, exposure: 1.15, diffuse: 0.8 },
} as const;
export type SurfaceMaterialId = keyof typeof SURFACE_MATERIALS;

/** The studio: a softbox above, a floor below, two side panels and a little front light. */
export const STUDIO_LIGHT = { softbox: 0.75, floor: 0.012, sides: 0.03, front: 0.003 };

export interface SurfaceSettings {
  look: SurfaceLook;
  physics: PhysicsSettings;
  material: { f0: number; gloss: number; exposure: number; diffuse: number };
  light: typeof STUDIO_LIGHT;
  /** Wrinkles that gather round a press. */
  pressWrinkles: number;
  /** How much the content moves with the surface's slope, and towards a press. */
  warp: { refraction: number; pull: number };
}

type Get = (path: string) => unknown;

const num = (get: Get, path: string, dflt: number, min: number, max: number): number => {
  const v = get(path);
  const n = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : dflt;
  return Math.min(max, Math.max(min, n));
};

/** Is this layer an inflated surface? */
export function isSurface(get: Get): boolean {
  return get("surface.mode") === "inflated";
}

export function surfaceSettings(get: Get): SurfaceSettings {
  const materialId = (typeof get("surface.material") === "string" ? get("surface.material") : "foil") as string;
  const base = SURFACE_MATERIALS[(materialId in SURFACE_MATERIALS ? materialId : "foil") as SurfaceMaterialId];
  return {
    look: {
      depth: num(get, "surface.depth", DEFAULT_LOOK.depth, 0, 200),
      fullness: num(get, "surface.fullness", DEFAULT_LOOK.fullness, 0, 1),
      creases: num(get, "surface.creases", DEFAULT_LOOK.creases, 0, 1),
      creaseLength: num(get, "surface.creaseLength", DEFAULT_LOOK.creaseLength, 0, 400),
      wrinkles: num(get, "surface.wrinkles", DEFAULT_LOOK.wrinkles, 0, 1),
      wrinkleSize: num(get, "surface.wrinkleSize", DEFAULT_LOOK.wrinkleSize, 2, 100),
      wrinkleLength: num(get, "surface.wrinkleLength", DEFAULT_LOOK.wrinkleLength, 1, 200),
      crinkle: num(get, "surface.crinkle", DEFAULT_LOOK.crinkle, 0, 1),
      seed: num(get, "surface.seed", DEFAULT_LOOK.seed, 0, 1e6),
    },
    physics: {
      stiffness: num(get, "surface.stiffness", DEFAULT_PHYSICS.stiffness, 50, 3000),
      damping: num(get, "surface.damping", DEFAULT_PHYSICS.damping, 0, 1),
      dentDepth: num(get, "surface.dentDepth", DEFAULT_PHYSICS.dentDepth, 0, 200),
      dentSize: num(get, "surface.dentSize", DEFAULT_PHYSICS.dentSize, 2, 400),
      volume: num(get, "surface.volume", DEFAULT_PHYSICS.volume, 0, 1),
      give: num(get, "surface.give", DEFAULT_PHYSICS.give, 0, 0.1),
    },
    material: { ...base, gloss: num(get, "surface.gloss", base.gloss, 0, 1) },
    light: STUDIO_LIGHT,
    pressWrinkles: num(get, "surface.pressWrinkles", 0.6, 0, 1),
    warp: { refraction: num(get, "surface.contentWarp", 0.6, 0, 4), pull: num(get, "surface.contentPull", 0.35, 0, 2) },
  };
}

/** "#rrggbb" (or "#rgb") as linear RGB 0..1; black when it isn't a hex colour. */
export function linearRgb(color: unknown): [number, number, number] {
  const s = typeof color === "string" ? color.trim() : "";
  let hex = s.startsWith("#") ? s.slice(1) : "";
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}/.test(hex)) return [0.01, 0.01, 0.01];
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch(0), ch(2), ch(4)];
}

/** A key that changes when the resting surface must be solved again. */
export function lookKey(width: number, height: number, radius: number, kind: string, look: SurfaceLook): string {
  return [Math.round(width), Math.round(height), Math.round(radius), kind, look.depth, look.fullness, look.creases, look.creaseLength, look.wrinkles, look.wrinkleSize, look.wrinkleLength, look.crinkle, look.seed].join("|");
}
