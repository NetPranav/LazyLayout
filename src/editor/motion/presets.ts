// Spring engine presets and constants ported from Nook (the owner's own product) & prototype

export type MotionPresetKey = "smooth" | "lively" | "bouncy";

export interface MotionPreset {
  shape: [number, number];
  hl: [number, number];
  rows: [number, number];
  stagger: number;
  rowScale: number | string;
  wiggle: number;
  stretch: number;
  endBump: number;
  lock: number;
  glideW: [number, number];
  glideH: [number, number];
  flip: [number, number];
  flipKick: number;
  pop: [number, number];
  // Backwards compatibility with earlier Nook fields
  travel: [number, number];
  exit: number;
  squash: number;
  popStagger: number;
  bW: [number, number];
  bH: [number, number];
  wind: number;
  enterKick: number;
  exitSquash: number;
  side: [[number, number], [number, number], number];
}

export const MOTION_PRESETS: Record<MotionPresetKey, MotionPreset> & {
  1: MotionPreset;
  2: MotionPreset;
  3: MotionPreset;
} = {
  smooth: {
    shape: [0.34, 0.88],
    hl: [0.2, 0.9],
    rows: [0.5, 0.72],
    stagger: 45,
    rowScale: "0.96",
    wiggle: 0,
    stretch: 0.003,
    endBump: 60,
    lock: 380,
    glideW: [0.44, 0.78],
    glideH: [0.46, 0.8],
    flip: [0.46, 0.76],
    flipKick: 0,
    pop: [0.42, 0.6],
    // Nook compatibility
    travel: [16, 6],
    exit: 170,
    squash: 0,
    popStagger: 30,
    bW: [0.36, 0.55],
    bH: [0.42, 0.56],
    wind: 10,
    enterKick: 150,
    exitSquash: 70,
    side: [[0.5, 0.84], [0.46, 0.82], 560],
  },
  lively: {
    shape: [0.38, 0.7],
    hl: [0.22, 0.75],
    rows: [0.34, 0.55],
    stagger: 30,
    rowScale: "0.96",
    wiggle: 6,
    stretch: 0.008,
    endBump: 140,
    lock: 280,
    glideW: [0.34, 0.58],
    glideH: [0.36, 0.55],
    flip: [0.34, 0.58],
    flipKick: 0,
    pop: [0.32, 0.5],
    // Nook compatibility
    travel: [22, 8],
    exit: 120,
    squash: 150,
    popStagger: 22,
    bW: [0.3, 0.48],
    bH: [0.34, 0.46],
    wind: 12,
    enterKick: 220,
    exitSquash: 110,
    side: [[0.4, 0.66], [0.36, 0.62], 480],
  },
  bouncy: {
    shape: [0.42, 0.55],
    hl: [0.26, 0.6],
    rows: [0.28, 0.4],
    stagger: 22,
    rowScale: "0.92 1.14",
    wiggle: 12,
    stretch: 0.015,
    endBump: 230,
    lock: 220,
    glideW: [0.28, 0.42],
    glideH: [0.3, 0.38],
    flip: [0.28, 0.42],
    flipKick: 140,
    pop: [0.26, 0.38],
    // Nook compatibility
    travel: [26, 10],
    exit: 90,
    squash: 260,
    popStagger: 16,
    bW: [0.26, 0.38],
    bH: [0.28, 0.34],
    wind: 16,
    enterKick: 300,
    exitSquash: 160,
    side: [[0.32, 0.5], [0.3, 0.45], 420],
  },
  get 1() {
    return this.smooth;
  },
  get 2() {
    return this.lively;
  },
  get 3() {
    return this.bouncy;
  },
};

/** Prototype's playful-specific values from editor-design-mode-blocks-dark.html */
export const PLAYFUL_PRESETS = {
  smooth: {
    shape: [0.34, 0.88] as [number, number],
    hl: [0.2, 0.9] as [number, number],
    rows: [0.3, 0.9] as [number, number],
    stagger: 6,
    rowScale: 0.97,
    wiggle: 0,
    stretch: 0.003,
    endBump: 100,
    lock: 380,
    glideW: [0.44, 0.78] as [number, number],
    glideH: [0.46, 0.8] as [number, number],
    flip: [0.46, 0.76] as [number, number],
    flipKick: 0,
    pop: [0.42, 0.6] as [number, number],
  },
  lively: {
    shape: [0.38, 0.7] as [number, number],
    hl: [0.22, 0.75] as [number, number],
    rows: [0.3, 0.7] as [number, number],
    stagger: 12,
    rowScale: 0.94,
    wiggle: 6,
    stretch: 0.008,
    endBump: 240,
    lock: 320,
    glideW: [0.34, 0.58] as [number, number],
    glideH: [0.36, 0.55] as [number, number],
    flip: [0.34, 0.58] as [number, number],
    flipKick: 0,
    pop: [0.32, 0.5] as [number, number],
  },
  bouncy: {
    shape: [0.42, 0.55] as [number, number],
    hl: [0.26, 0.6] as [number, number],
    rows: [0.32, 0.55] as [number, number],
    stagger: 18,
    rowScale: 0.9,
    wiggle: 12,
    stretch: 0.015,
    endBump: 420,
    lock: 350,
    glideW: [0.28, 0.42] as [number, number],
    glideH: [0.3, 0.38] as [number, number],
    flip: [0.28, 0.42] as [number, number],
    flipKick: 140,
    pop: [0.26, 0.38] as [number, number],
  },
};

/** Named fallback constants for overlay geometry when tokens are not yet loaded */
export const MENU_FALLBACKS = {
  viewportPadding: 8,         // --ll-spacing-2
  edgeGap: 4,                 // --ll-submenu-gap
  verticalOffset: 4,          // --ll-submenu-gap
  menuRadius: 6,              // --ll-radius-md
  popoverRadius: 8,           // --ll-radius-lg
  menuWidthDefault: 200,      // --ll-size-menu-w
  menuWidthContext: 248,      // --ll-size-menu-ctx-w
  menuWidthWide: 320,         // --ll-size-menu-wide-w
  reducedMotionDuration: 120, // MOT / reduced motion standard
  defaultMenuHeight: 240,
};

/** Default shape springs for island / surface overlays */
export const SP = {
  width: [0.32, 0.7] as [number, number],
  height: [0.36, 0.8] as [number, number],
  press: [0.18, 0.6] as [number, number],
};

/** Motion physics & timing constants */
export const MOT = {
  pressScale: 0.97,
  blurMs: 160,
  blur: [6, 7] as [number, number],
  exitMs: 240,
  exitDelay: 120,
  edge: 4,
  slide: 10,
  maxStep: 0.032,
  substeps: 4,
  // compatibility
  windUpMs: 70,
  windUpH: 2,
  entryBouncyMs: 1000,
  exitBouncyMs: 600,
};

/** Exit blur/scale transition */
export const EXIT = {
  ms: 160,
  blur: 7,
  scale: 0.95,
  easing: "ease-out",
};
