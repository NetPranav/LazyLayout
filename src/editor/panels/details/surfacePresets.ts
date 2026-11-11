import type { PropValue } from "@/core/document/registry";

/**
 * One-click looks for the 3D panel (S2–S6). Each is only generic `surface.*` settings, sized to the layer: depth and
 * dent scale with its smaller side, so the same preset works on a small chip and a large card.
 */
export type SurfacePresetId = "flat" | "balloon" | "plastic" | "satin" | "pillow";

export const SURFACE_PRESETS: ReadonlyArray<{ id: SurfacePresetId; label: string; hint: string }> = [
  { id: "balloon", label: "Foil balloon", hint: "Black foil, over-inflated: pleats at the seam, dents when pressed" },
  { id: "pillow", label: "Pillow", hint: "The seam pulls in like a real foil pillow" },
  { id: "plastic", label: "Glossy plastic", hint: "A smooth, shiny bulge" },
  { id: "satin", label: "Soft satin", hint: "A soft cushion with a gentle sheen" },
  { id: "flat", label: "Flat", hint: "No surface: the layer's normal fill" },
];

/**
 * What a look needs around the surface, only where the layer doesn't have it yet: rounded corners, a soft shadow under
 * it, and (a frame) its content centred, as a button's label is. The balloon also turns the fill black (its look).
 */
function finishing(id: SurfacePresetId, side: number, current: (key: string) => PropValue | null, archetype: string | undefined): Record<string, PropValue | null> {
  if (id === "flat") return {};
  const out: Record<string, PropValue | null> = {};
  const radiusKey = archetype === "container" ? "appearance.radius" : "shape.cornerRadius";
  if (archetype !== "ellipse" && !(Number(current(radiusKey)) > 0)) out[radiusKey] = Math.round(side * 0.19);
  const shadows = current("paint.shadows");
  if (!(typeof shadows === "string" && shadows.length > 2)) out["paint.shadows"] = JSON.stringify([{ kind: "drop", x: 0, y: Math.round(side * 0.09), blur: Math.round(side * 0.19), spread: -4, color: "rgba(0,0,0,0.28)", visible: true }]);
  if (archetype === "container") Object.assign(out, { "layout.display": "flex", "layout.flexDirection": "row", "layout.justifyContent": "center", "layout.alignItems": "center" });
  if (id === "balloon" || id === "pillow") {
    if (archetype === "container") out["appearance.background.color"] = "#0b0b0b";
    else out["paint.fills"] = JSON.stringify([{ type: "solid", color: "#0b0b0b", opacity: 1, visible: true }]);
  }
  return out;
}

export function surfacePreset(id: SurfacePresetId, width: number, height: number, current: (key: string) => PropValue | null = () => null, archetype?: string): Record<string, PropValue | null> {
  return { ...finishing(id, Math.max(8, Math.min(width, height)), current, archetype), ...lookOf(id, width, height) };
}

function lookOf(id: SurfacePresetId, width: number, height: number): Record<string, PropValue | null> {
  const side = Math.max(8, Math.min(width, height));
  const sized = { "surface.depth": Math.round(side * 0.34), "surface.dentDepth": Math.round(side * 0.1), "surface.dentSize": Math.round(side * 0.38) };
  const press = { "surface.pressWrinkles": 1, "surface.contentPull": 0.45, "surface.contentWarp": 0.15, "surface.give": 0.03, "surface.stiffness": 520, "surface.damping": 0.35 };
  switch (id) {
    case "flat":
      return { "surface.mode": "flat" };
    case "balloon":
      return { "surface.mode": "inflated", "surface.method": "cloth", "surface.material": "foil", "surface.gloss": 0.4, "surface.fullness": 0, "surface.slack": 0.02, "surface.seam": "fixed", "surface.seed": 4, ...sized, ...press };
    case "pillow":
      return { "surface.mode": "inflated", "surface.method": "cloth", "surface.material": "foil", "surface.gloss": 0.45, "surface.fullness": 0, "surface.slack": 0.0, "surface.seam": "free", "surface.seed": 2, ...sized, ...press };
    case "plastic":
      return { "surface.mode": "inflated", "surface.method": "quick", "surface.material": "plastic", "surface.gloss": 0.85, "surface.fullness": 0.3, "surface.creases": 0, "surface.wrinkles": 0, "surface.crinkle": 0, ...sized, "surface.depth": Math.round(side * 0.22), ...press, "surface.pressWrinkles": 0 };
    case "satin":
      return { "surface.mode": "inflated", "surface.method": "quick", "surface.material": "satin", "surface.gloss": 0.35, "surface.fullness": 0.5, "surface.creases": 0.3, "surface.wrinkles": 0.2, "surface.crinkle": 0.1, ...sized, ...press, "surface.pressWrinkles": 0.3 };
  }
}
