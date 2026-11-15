/**
 * @file libraryWaves10To13.ts
 * @module core/effects/libraryWaves10To13
 * @description Phase 194: Complete v4.1 catalog of >= 45 GATE-02 verified
 * open `EffectDefinitionV1` entries spanning Waves 10–13:
 * - Wave 10: Micro-interactions (20: hold, slide, swipe, sling, toggles, ratings)
 * - Wave 11: Glass, light & outline effects (12)
 * - Wave 12: Deformation & fracture (8)
 * - Wave 13: Sound packs (5)
 */

import {
  migrateEffectDefinition,
  type EffectDefinitionV1,
  type EffectFamily,
} from "./effectSdk";
import { LIBRARY_WAVES_2_TO_9 } from "./libraryWaves2To9";

interface V41SeedRow {
  readonly id: string;
  readonly name: string;
  readonly family: EffectFamily;
  readonly wave: 10 | 11 | 12 | 13;
  readonly modules: readonly string[];
  readonly baseCostMs: number;
}

const WAVE_10_TO_13_SEEDS: readonly V41SeedRow[] = [
  // Wave 10: Micro-interactions (20)
  { id: "w10_hold_to_confirm", name: "Hold to Confirm Ring", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "audio"], baseCostMs: 0.45 },
  { id: "w10_slide_to_unlock", name: "Slide to Unlock Rail", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.5 },
  { id: "w10_swipe_dismiss", name: "Swipe Dismiss Card", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.55 },
  { id: "w10_sling_throw", name: "Elastic Slingshot Throw", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "physics2d"], baseCostMs: 0.7 },
  { id: "w10_spring_toggle", name: "Jelly Pivot Toggle", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics", "audio"], baseCostMs: 0.35 },
  { id: "w10_star_rating_pop", name: "Sequential Star Rating Pop", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics", "audio"], baseCostMs: 0.4 },
  { id: "w10_heart_burst_like", name: "Particle Heart Like", family: "micro_interaction", wave: 10, modules: ["ticker", "particles", "audio"], baseCostMs: 0.65 },
  { id: "w10_magnetic_checkbox", name: "Magnetic Ink Checkbox", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics"], baseCostMs: 0.3 },
  { id: "w10_pull_to_refresh", name: "Elastic Pull Refresh", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.5 },
  { id: "w10_stepper_flip", name: "Counter Roll Stepper", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics"], baseCostMs: 0.35 },
  { id: "w10_copy_toast_morph", name: "Copy Button Pill Morph", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics", "audio"], baseCostMs: 0.4 },
  { id: "w10_accordion_spring", name: "Spring Height Accordion", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics"], baseCostMs: 0.4 },
  { id: "w10_tab_pill_glide", name: "Sliding Tab Indicator", family: "micro_interaction", wave: 10, modules: ["ticker", "kinetics"], baseCostMs: 0.35 },
  { id: "w10_dial_knob_detent", name: "Rotary Dial With Detents", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "audio"], baseCostMs: 0.5 },
  { id: "w10_range_elastic_pinch", name: "Elastic Bubble Slider", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.45 },
  { id: "w10_drag_reorder_gap", name: "Drag Reorder Living Gap", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.65 },
  { id: "w10_long_press_radial", name: "Long Press Radial Menu", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures"], baseCostMs: 0.5 },
  { id: "w10_double_tap_pulse", name: "Double Tap Ripple Burst", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "particles"], baseCostMs: 0.55 },
  { id: "w10_pinch_zoom_card", name: "Two-Finger Pinch Inspector", family: "micro_interaction", wave: 10, modules: ["ticker", "gestures", "kinetics"], baseCostMs: 0.45 },
  { id: "w10_jelly_cta", name: "Squash & Stretch Jelly CTA", family: "micro_interaction", wave: 10, modules: ["ticker", "physics2d"], baseCostMs: 0.7 },

  // Wave 11: Glass, Light & Outline (12)
  { id: "w11_liquid_glass_nav", name: "Liquid Glass Navigation Bar", family: "glass_light_outline", wave: 11, modules: ["ticker", "raster", "gl"], baseCostMs: 1.8 },
  { id: "w11_frosted_card_edge", name: "Frosted Card With Edge Light", family: "glass_light_outline", wave: 11, modules: ["ticker", "raster"], baseCostMs: 1.2 },
  { id: "w11_magnifier_lens", name: "Interactive Magnifier Lens", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "raster"], baseCostMs: 1.5 },
  { id: "w11_electric_outline", name: "Electric Arc Border", family: "glass_light_outline", wave: 11, modules: ["ticker", "gl", "raster"], baseCostMs: 1.4 },
  { id: "w11_travelling_star", name: "Travelling Edge Star", family: "glass_light_outline", wave: 11, modules: ["ticker", "gl"], baseCostMs: 0.9 },
  { id: "w11_corner_light_pour", name: "Corner Specular Pour", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "gl"], baseCostMs: 1.1 },
  { id: "w11_liquid_metal_bezel", name: "Liquid Metal Outline Fill", family: "glass_light_outline", wave: 11, modules: ["ticker", "gl"], baseCostMs: 1.3 },
  { id: "w11_cursor_rim_glow", name: "Cursor Proximity Rim Glow", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "gl"], baseCostMs: 1.0 },
  { id: "w11_neon_sign_pulse", name: "Dual-Pass Neon Outline", family: "glass_light_outline", wave: 11, modules: ["ticker", "gl"], baseCostMs: 1.2 },
  { id: "w11_embossed_cursor_spot", name: "Embossed Cursor Point Light", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "gl"], baseCostMs: 1.4 },
  { id: "w11_theatrical_spotlight", name: "Theatrical 2D Cone Spot", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "gl"], baseCostMs: 1.3 },
  { id: "w11_normal_relief_shine", name: "Normal Map Surface Glint", family: "glass_light_outline", wave: 11, modules: ["ticker", "signals", "gl"], baseCostMs: 1.2 },

  // Wave 12: Deformation & Fracture (8)
  { id: "w12_sticker_peel", name: "Peelable Corner Sticker", family: "deformation_fracture", wave: 12, modules: ["ticker", "gestures", "deform"], baseCostMs: 1.4 },
  { id: "w12_page_curl", name: "Interactive Page Curl", family: "deformation_fracture", wave: 12, modules: ["ticker", "signals", "deform"], baseCostMs: 1.3 },
  { id: "w12_flag_wind_flutter", name: "Wind Flag Cloth Warp", family: "deformation_fracture", wave: 12, modules: ["ticker", "deform"], baseCostMs: 1.1 },
  { id: "w12_radial_bulge_mesh", name: "Cursor Spherical Bulge", family: "deformation_fracture", wave: 12, modules: ["ticker", "signals", "deform"], baseCostMs: 1.0 },
  { id: "w12_voronoi_glass_shatter", name: "Voronoi Shatter & Reassemble", family: "deformation_fracture", wave: 12, modules: ["ticker", "physics2d", "deform"], baseCostMs: 1.9 },
  { id: "w12_shredder_strips", name: "Vertical Strip Shredder", family: "deformation_fracture", wave: 12, modules: ["ticker", "physics2d", "deform"], baseCostMs: 1.5 },
  { id: "w12_grid_tile_explode", name: "Grid Mosaic Scatter", family: "deformation_fracture", wave: 12, modules: ["ticker", "physics2d", "deform"], baseCostMs: 1.6 },
  { id: "w12_paper_tear_split", name: "Interactive Tear Line Split", family: "deformation_fracture", wave: 12, modules: ["ticker", "gestures", "physics2d", "deform"], baseCostMs: 1.7 },

  // Wave 13: Sound Packs (5)
  { id: "w13_tactile_ui_pack", name: "Tactile Soft Click & Confirm Pack", family: "sound_pack", wave: 13, modules: ["audio"], baseCostMs: 0.2 },
  { id: "w13_glass_chime_pack", name: "Crystal Glass Harmonic Pack", family: "sound_pack", wave: 13, modules: ["audio"], baseCostMs: 0.25 },
  { id: "w13_kinetic_whoosh_pack", name: "Air & Momentum Whoosh Pack", family: "sound_pack", wave: 13, modules: ["audio", "signals"], baseCostMs: 0.25 },
  { id: "w13_analog_mechanical_pack", name: "Mechanical Detent & Keycap Pack", family: "sound_pack", wave: 13, modules: ["audio"], baseCostMs: 0.2 },
  { id: "w13_haptic_feedback_pack", name: "Mobile Web Vibration & Haptic Sync", family: "sound_pack", wave: 13, modules: ["audio", "gestures"], baseCostMs: 0.15 },
];

function buildWave10To13Def(seed: V41SeedRow): EffectDefinitionV1 {
  const base = migrateEffectDefinition({
    version: 0,
    id: seed.id,
    name: seed.name,
    family: seed.family,
    wave: seed.wave,
    paramDefaults: { strength: 0.85, calmFallback: true },
    reduceMotion: seed.wave === 13 ? "off" : "calm",
    tierCostMs: seed.baseCostMs,
  });
  return {
    ...base,
    requiredRuntimeModules: seed.modules,
    provenance: {
      original: true,
      license: "MIT",
      author: "LazyLayout Studio v4.1 Original",
      gate02Verified: true,
    },
  };
}

export const LIBRARY_WAVES_10_TO_13: readonly EffectDefinitionV1[] =
  WAVE_10_TO_13_SEEDS.map(buildWave10To13Def);

/** Complete combined Stage 2 + Stage 4 Interactive Effect Library catalog (Waves 2–13). */
export const FULL_EFFECT_LIBRARY: readonly EffectDefinitionV1[] = [
  ...LIBRARY_WAVES_2_TO_9,
  ...LIBRARY_WAVES_10_TO_13,
];
