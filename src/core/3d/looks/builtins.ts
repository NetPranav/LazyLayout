/**
 * ============================================================================
 * BUILT-IN 3D LOOKS (Phase 3D-023)
 * ============================================================================
 * Curated preset looks for materials, lights, and modifiers.
 * Each look contains property values and optional sizing rules.
 * ============================================================================
 */

import type { BuiltinLook } from "./types";

export const BUILTIN_LOOKS: Record<string, BuiltinLook> = {
  // ---------------------------------------------------------------------------
  // Materials (6)
  // ---------------------------------------------------------------------------
  "look_mat_matte": {
    id: "look_mat_matte",
    name: "Matte",
    section: "material",
    description: "Diffuse non-reflective chalky surface with high roughness",
    previewColor: "#94a3b8",
    values: {
      baseColor: "#94a3b8",
      roughness: 0.9,
      metallic: 0.0,
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 1.0,
      wireframe: false,
    },
  },

  "look_mat_glossy_plastic": {
    id: "look_mat_glossy_plastic",
    name: "Glossy plastic",
    section: "material",
    description: "Smooth polished lacquer with sharp specular highlights",
    previewColor: "#3b82f6",
    values: {
      baseColor: "#3b82f6",
      roughness: 0.1,
      metallic: 0.0,
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 1.0,
      wireframe: false,
    },
  },

  "look_mat_brushed_metal": {
    id: "look_mat_brushed_metal",
    name: "Brushed metal",
    section: "material",
    description: "Conductive metallic sheen with directional micro-scratches",
    previewColor: "#cbd5e1",
    values: {
      baseColor: "#cbd5e1",
      roughness: 0.35,
      metallic: 0.95,
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 1.0,
      wireframe: false,
    },
  },

  "look_mat_glass": {
    id: "look_mat_glass",
    name: "Glass",
    section: "material",
    description: "Translucent refractive material with low roughness",
    previewColor: "#e0f2fe",
    values: {
      baseColor: "#f0f9ff",
      roughness: 0.05,
      metallic: 0.05,
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 0.3,
      wireframe: false,
    },
  },

  "look_mat_rubber": {
    id: "look_mat_rubber",
    name: "Rubber",
    section: "material",
    description: "Dull elastomeric surface with soft light absorption",
    previewColor: "#1e293b",
    values: {
      baseColor: "#1e293b",
      roughness: 0.8,
      metallic: 0.05,
      emissive: "#000000",
      emissiveIntensity: 0,
      opacity: 1.0,
      wireframe: false,
    },
  },

  "look_mat_glow": {
    id: "look_mat_glow",
    name: "Glow",
    section: "material",
    description: "Luminescent emissive neon appearance",
    previewColor: "#38bdf8",
    values: {
      baseColor: "#ffffff",
      roughness: 0.2,
      metallic: 0.0,
      emissive: "#38bdf8",
      emissiveIntensity: 2.5,
      opacity: 1.0,
      wireframe: false,
    },
  },

  // ---------------------------------------------------------------------------
  // Light Rigs (3)
  // ---------------------------------------------------------------------------
  "look_light_three_point": {
    id: "look_light_three_point",
    name: "Studio three-point",
    section: "light",
    description: "Classic studio portrait lighting with key, fill, and rim lights",
    previewColor: "#fbbf24",
    values: {
      type: "point",
      color: "#ffffff",
      intensity: 120,
      castShadow: true,
      decay: 2,
    },
    sizing: [
      {
        property: "intensity",
        mode: "scene_size",
        factor: 25.0,
      },
    ],
  },

  "look_light_soft_top": {
    id: "look_light_soft_top",
    name: "Soft top light",
    section: "light",
    description: "Diffuse overhead illumination casting soft downward shadows",
    previewColor: "#fef08a",
    values: {
      type: "spot",
      color: "#fffbeb",
      intensity: 80,
      spotAngle: 0.85,
      spotBlend: 0.5,
      castShadow: true,
      decay: 1.5,
    },
    sizing: [
      {
        property: "intensity",
        mode: "scene_size",
        factor: 15.0,
      },
    ],
  },

  "look_light_dramatic_rim": {
    id: "look_light_dramatic_rim",
    name: "Dramatic rim",
    section: "light",
    description: "High-contrast edge silhouette accentuating contours",
    previewColor: "#818cf8",
    values: {
      type: "spot",
      color: "#60a5fa",
      intensity: 160,
      spotAngle: 0.5,
      spotBlend: 0.2,
      castShadow: true,
      decay: 2,
    },
    sizing: [
      {
        property: "intensity",
        mode: "scene_size",
        factor: 30.0,
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Modifiers (3)
  // ---------------------------------------------------------------------------
  "look_mod_mirrored": {
    id: "look_mod_mirrored",
    name: "Mirrored",
    section: "modifier",
    description: "Symmetric reflection across the X axis",
    previewColor: "#a855f7",
    values: {
      type: "mirror",
      useX: true,
      useY: false,
      useZ: false,
      mergeThreshold: 0.001,
    },
  },

  "look_mod_arrayed_row": {
    id: "look_mod_arrayed_row",
    name: "Arrayed row",
    section: "modifier",
    description: "Linear duplicate sequence of 3 elements",
    previewColor: "#ec4899",
    values: {
      type: "array",
      count: 3,
      offset: [1.5, 0, 0],
    },
  },

  "look_mod_shell": {
    id: "look_mod_shell",
    name: "Shell",
    section: "modifier",
    description: "Hollow wall thickness scaled proportionally to object depth",
    previewColor: "#10b981",
    values: {
      type: "solidify",
      thickness: 0.05,
      offset: -1,
    },
    sizing: [
      {
        property: "thickness",
        mode: "smallest_side",
        factor: 0.05,
      },
    ],
  },
};

/**
 * Returns all available looks for a section (built-ins + user looks from doc).
 */
export function getLooksForSection(
  section: string,
  userLooks?: Record<string, BuiltinLook>
): BuiltinLook[] {
  const result: BuiltinLook[] = [];

  for (const look of Object.values(BUILTIN_LOOKS)) {
    if (look.section === section) {
      result.push(look);
    }
  }

  if (userLooks) {
    for (const look of Object.values(userLooks)) {
      if (look.section === section && !BUILTIN_LOOKS[look.id]) {
        result.push(look);
      }
    }
  }

  return result;
}
