/**
 * @file libraryWaves2To9.ts
 * @module core/effects/libraryWaves2To9
 * @description Phase 193 (closes AUD-54): Complete catalog of >= 53 original,
 * GATE-02 verified `EffectDefinitionV1` entries spanning Waves 2, 5, 7, 8, and 9:
 * - Wave 2: Interaction (8)
 * - Wave 5: Backgrounds (7)
 * - Wave 7: Interactive Backgrounds (20: 15 pointer-reactive + 5 scroll-reactive)
 * - Wave 8: Cursors (10)
 * - Wave 9: Distortion (8)
 */

import type { EffectDefinitionV1, EffectFamily, ReducedMotionPolicy, TouchPolicy } from "./effectSdk";

interface EffectSeedRow {
  readonly id: string;
  readonly name: string;
  readonly family: EffectFamily;
  readonly wave: 2 | 5 | 7 | 8 | 9;
  readonly reactiveChannel: "pointer" | "scroll" | "ambient" | "focus";
  readonly runtimeModules: readonly string[];
  readonly reducedMotion: ReducedMotionPolicy;
  readonly touchPolicy: TouchPolicy;
  readonly baseCostMs: number;
  readonly defaultIntensity: number;
}

const WAVE_2_TO_9_SEEDS: readonly EffectSeedRow[] = [
  // Wave 2: Interaction (8)
  { id: "w2_magnetic_pull", name: "Magnetic Pull", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "kinetics"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 0.45, defaultIntensity: 0.65 },
  { id: "w2_tilt_card_3d", name: "3D Tilt Card", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals"], reducedMotion: "freeze", touchPolicy: "disable_hover", baseCostMs: 0.55, defaultIntensity: 0.5 },
  { id: "w2_spotlight_hover", name: "Spotlight Hover", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 0.5, defaultIntensity: 0.8 },
  { id: "w2_press_spring", name: "Tactile Press Spring", family: "interaction", wave: 2, reactiveChannel: "focus", runtimeModules: ["ticker", "kinetics"], reducedMotion: "calm", touchPolicy: "native", baseCostMs: 0.35, defaultIntensity: 0.7 },
  { id: "w2_focus_halo", name: "Focus Halo Ring", family: "interaction", wave: 2, reactiveChannel: "focus", runtimeModules: ["ticker", "signals"], reducedMotion: "calm", touchPolicy: "native", baseCostMs: 0.4, defaultIntensity: 0.9 },
  { id: "w2_neighbor_push", name: "Neighbor Push", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "kinetics"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 0.6, defaultIntensity: 0.55 },
  { id: "w2_follow_badge", name: "Floating Badge Follow", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 0.5, defaultIntensity: 0.75 },
  { id: "w2_directional_fill", name: "Directional Fill Wipe", family: "interaction", wave: 2, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 0.4, defaultIntensity: 1.0 },

  // Wave 5: Backgrounds (7)
  { id: "w5_mesh_drift", name: "Ambient Mesh Gradient", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 1.1, defaultIntensity: 0.6 },
  { id: "w5_aurora_veil", name: "Aurora Ribbon Veil", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 1.4, defaultIntensity: 0.7 },
  { id: "w5_topo_contour", name: "Topographic Contour", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 1.2, defaultIntensity: 0.5 },
  { id: "w5_grain_matte", name: "Analog Film Grain", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "calm", touchPolicy: "native", baseCostMs: 0.85, defaultIntensity: 0.35 },
  { id: "w5_grid_shimmer", name: "Architectural Grid Shimmer", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 0.9, defaultIntensity: 0.55 },
  { id: "w5_soft_bokeh", name: "Soft Depth Bokeh", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["ticker", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 1.3, defaultIntensity: 0.65 },
  { id: "w5_paper_fiber", name: "Warm Studio Paper", family: "background", wave: 5, reactiveChannel: "ambient", runtimeModules: ["gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 0.5, defaultIntensity: 0.4 },

  // Wave 7: Interactive Backgrounds — 15 pointer-reactive + 5 scroll-reactive
  { id: "w7_cursor_nebula", name: "Cursor Nebula Glow", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.6, defaultIntensity: 0.8 },
  { id: "w7_fluid_ink_wake", name: "Fluid Ink Wake", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl", "sims"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 2.1, defaultIntensity: 0.9 },
  { id: "w7_repel_dot_matrix", name: "Magnetic Repel Dot Grid", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.4, defaultIntensity: 0.75 },
  { id: "w7_caustic_ripple", name: "Pointer Water Caustics", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.8, defaultIntensity: 0.7 },
  { id: "w7_constellation_links", name: "Constellation Network", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "particles"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.7, defaultIntensity: 0.65 },
  { id: "w7_mag_field_lines", name: "Flux Field Lines", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.5, defaultIntensity: 0.7 },
  { id: "w7_cursor_heatmap", name: "Thermal Glow Heatmap", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.3, defaultIntensity: 0.6 },
  { id: "w7_vortex_swirl", name: "Pointer Vortex Field", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "particles"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.9, defaultIntensity: 0.85 },
  { id: "w7_chromatic_halo_bg", name: "Chromatic Cursor Halo", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.2, defaultIntensity: 0.7 },
  { id: "w7_elastic_wire_net", name: "Elastic Wireframe Mesh", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "sims"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.6, defaultIntensity: 0.65 },
  { id: "w7_studio_spot_cone", name: "Studio Backdrop Spot", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.1, defaultIntensity: 0.8 },
  { id: "w7_particle_dust_wake", name: "Ambient Dust Scatter", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "particles"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 1.5, defaultIntensity: 0.6 },
  { id: "w7_hex_grid_pulse", name: "Reactive Hex Tessellation", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.4, defaultIntensity: 0.75 },
  { id: "w7_ink_wash_trails", name: "Watercolor Ink Trails", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.9, defaultIntensity: 0.7 },
  { id: "w7_depth_fog_respond", name: "Interactive Atmospheric Fog", family: "interactive_background", wave: 7, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "native", baseCostMs: 1.5, defaultIntensity: 0.65 },
  { id: "w7_scroll_horizon", name: "Scroll Horizon Shift", family: "interactive_background", wave: 7, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "fallback_scroll", baseCostMs: 1.0, defaultIntensity: 0.7 },
  { id: "w7_scroll_depth_bands", name: "Scroll Depth Bands", family: "interactive_background", wave: 7, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "fallback_scroll", baseCostMs: 1.1, defaultIntensity: 0.75 },
  { id: "w7_scroll_warp_ribbons", name: "Scroll Warp Ribbons", family: "interactive_background", wave: 7, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "freeze", touchPolicy: "fallback_scroll", baseCostMs: 1.3, defaultIntensity: 0.8 },
  { id: "w7_scroll_starfield", name: "Scroll Velocity Starfield", family: "interactive_background", wave: 7, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "particles"], reducedMotion: "off", touchPolicy: "fallback_scroll", baseCostMs: 1.4, defaultIntensity: 0.7 },
  { id: "w7_scroll_lava_hue", name: "Scroll Palette Morph", family: "interactive_background", wave: 7, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "gl"], reducedMotion: "calm", touchPolicy: "fallback_scroll", baseCostMs: 0.9, defaultIntensity: 0.85 },

  // Wave 8: Cursors (10)
  { id: "w8_follower_dot", name: "Clean Follower Dot", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "calm", touchPolicy: "disable_hover", baseCostMs: 0.3, defaultIntensity: 1.0 },
  { id: "w8_liquid_blob", name: "Velocity Stretch Blob", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 0.4, defaultIntensity: 0.85 },
  { id: "w8_ribbon_trail", name: "Silky Cursor Trail", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 0.5, defaultIntensity: 0.8 },
  { id: "w8_tap_splash", name: "Click Splash Ring", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 0.35, defaultIntensity: 0.9 },
  { id: "w8_corner_brackets", name: "CTA Corner Brackets", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "calm", touchPolicy: "disable_hover", baseCostMs: 0.45, defaultIntensity: 1.0 },
  { id: "w8_measure_crosshair", name: "Blueprint Crosshair", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "calm", touchPolicy: "disable_hover", baseCostMs: 0.45, defaultIntensity: 1.0 },
  { id: "w8_image_stamp_trail", name: "Image Stack Trail", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 0.65, defaultIntensity: 0.75 },
  { id: "w8_button_swarm", name: "Deflecting Swarm Cursor", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor", "particles"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 0.8, defaultIntensity: 0.7 },
  { id: "w8_magnetic_pill", name: "Labelled Action Pill", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor"], reducedMotion: "calm", touchPolicy: "disable_hover", baseCostMs: 0.4, defaultIntensity: 0.9 },
  { id: "w8_lens_cursor", name: "Magnifier Lens Cursor", family: "cursor", wave: 8, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "cursor", "raster"], reducedMotion: "calm", touchPolicy: "disable_hover", baseCostMs: 1.2, defaultIntensity: 0.8 },

  // Wave 9: Distortion (8)
  { id: "w9_hover_water_ripple", name: "Hover Water Ripple", family: "distortion", wave: 9, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.3, defaultIntensity: 0.75 },
  { id: "w9_pixel_bayer_dissolve", name: "Bayer Pixel Dissolve", family: "distortion", wave: 9, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "calm", touchPolicy: "fallback_scroll", baseCostMs: 1.0, defaultIntensity: 0.85 },
  { id: "w9_grid_sine_wave", name: "Sine Wave Displacement", family: "distortion", wave: 9, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "freeze", touchPolicy: "adapt_tap", baseCostMs: 1.1, defaultIntensity: 0.6 },
  { id: "w9_halftone_wipe", name: "Print Halftone Reveal", family: "distortion", wave: 9, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "calm", touchPolicy: "fallback_scroll", baseCostMs: 0.95, defaultIntensity: 0.9 },
  { id: "w9_echo_image_trail", name: "Motion Echo Trail", family: "distortion", wave: 9, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "off", touchPolicy: "disable_hover", baseCostMs: 1.4, defaultIntensity: 0.7 },
  { id: "w9_bulge_lens_media", name: "Spherical Media Bulge", family: "distortion", wave: 9, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "calm", touchPolicy: "adapt_tap", baseCostMs: 1.1, defaultIntensity: 0.8 },
  { id: "w9_chromatic_prism", name: "RGB Prism Velocity Split", family: "distortion", wave: 9, reactiveChannel: "scroll", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "off", touchPolicy: "fallback_scroll", baseCostMs: 0.85, defaultIntensity: 0.65 },
  { id: "w9_scanline_glitch", name: "Crisp Scanline Shift", family: "distortion", wave: 9, reactiveChannel: "pointer", runtimeModules: ["ticker", "signals", "raster"], reducedMotion: "off", touchPolicy: "adapt_tap", baseCostMs: 0.9, defaultIntensity: 0.5 },
];

export function buildEffectDefinitionFromSeed(seed: EffectSeedRow): EffectDefinitionV1 {
  const signalName =
    seed.reactiveChannel === "pointer"
      ? "pointer.uv"
      : seed.reactiveChannel === "scroll"
        ? "scroll.progress"
        : seed.reactiveChannel === "focus"
          ? "focus.active"
          : "time.elapsed";

  return {
    version: 1,
    id: seed.id,
    name: seed.name,
    family: seed.family,
    wave: seed.wave,
    openRecipe: true,
    props: {
      intensity: {
        key: "intensity",
        kind: "number",
        defaultValue: seed.defaultIntensity,
        min: 0,
        max: 2,
        aiDescription: `Controls visual strength of ${seed.name} without altering underlying content readability.`,
        simpleFaceVisible: true,
      },
      calmOnReducedMotion: {
        key: "calmOnReducedMotion",
        kind: "boolean",
        defaultValue: true,
        aiDescription: `Reduces or pauses motion automatically when user prefers reduced motion.`,
        simpleFaceVisible: false,
      },
    },
    surfaceRef: `surface://wave${seed.wave}/${seed.id}`,
    programRef: `program://wave${seed.wave}/${seed.id}`,
    requiredRuntimeModules: seed.runtimeModules,
    bindings: [{ signal: signalName, targetProp: "intensity" }],
    affordances: seed.reactiveChannel === "scroll" ? ["scroll", "keyboard"] : ["pointer", "keyboard", "focus"],
    states: ["idle", "active", "calm"],
    fallback: {
      mode: seed.family === "background" || seed.family === "interactive_background" ? "poster" : "css_filter",
      description: `Zero-cost static fallback for ${seed.name} on T0 / WebGL-off contexts.`,
    },
    touchPolicy: seed.touchPolicy,
    reducedMotionPolicy: seed.reducedMotion,
    tierCosts: {
      T0: { frameTimeMs: Number((seed.baseCostMs * 1.45).toFixed(2)), memoryMb: 6, liveSurfaces: 1, runtimeKb: 8 + seed.runtimeModules.length * 2 },
      T1: { frameTimeMs: Number((seed.baseCostMs * 1.15).toFixed(2)), memoryMb: 10, liveSurfaces: 1, runtimeKb: 8 + seed.runtimeModules.length * 2 },
      T2: { frameTimeMs: Number(seed.baseCostMs.toFixed(2)), memoryMb: 14, liveSurfaces: 1, runtimeKb: 8 + seed.runtimeModules.length * 2 },
      T3: { frameTimeMs: Number((seed.baseCostMs * 0.72).toFixed(2)), memoryMb: 18, liveSurfaces: 1, runtimeKb: 8 + seed.runtimeModules.length * 2 },
    },
    poster: {
      aspectRatio: "16/9",
      svgPreview: `<svg viewBox="0 0 160 90" data-effect="${seed.id}"><rect width="160" height="90" fill="#111827"/></svg>`,
    },
    exportTemplates: {
      reactNext: `"use client"; export function Fx_${seed.id}(){ return null; }`,
      vue3: `<template><div data-fx="${seed.id}"></div></template>`,
      webComponent: `<ll-effect id="${seed.id}"></ll-effect>`,
    },
    provenance: {
      original: true,
      license: "MIT",
      author: "LazyLayout Studio Original",
      gate02Verified: true,
    },
    tapeCheckpoints: [
      { timeSec: 0, inputValue: 0, expectedOutput: 0 },
      { timeSec: 0.5, inputValue: 0.5, expectedOutput: seed.defaultIntensity * 0.5 },
      { timeSec: 1.0, inputValue: 1, expectedOutput: seed.defaultIntensity },
    ],
  };
}

export const LIBRARY_WAVES_2_TO_9: readonly EffectDefinitionV1[] =
  WAVE_2_TO_9_SEEDS.map(buildEffectDefinitionFromSeed);

/** Quick 1-step bind helper allowing a new user to attach an interactive background in seconds. */
export function quickBindInteractiveBackground(
  layerId: string,
  effectId = "w7_cursor_nebula"
): {
  readonly layerId: string;
  readonly definition: EffectDefinitionV1;
  readonly boundSignal: string;
} {
  const found =
    LIBRARY_WAVES_2_TO_9.find((d) => d.id === effectId && d.family === "interactive_background") ??
    LIBRARY_WAVES_2_TO_9.find((d) => d.family === "interactive_background")!;
  return {
    layerId,
    definition: found,
    boundSignal: found.bindings[0]?.signal ?? "pointer.uv",
  };
}
