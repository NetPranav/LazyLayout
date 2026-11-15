/**
 * @file interactiveBackgroundSlice.ts
 * @module core/gpu/interactiveBackgroundSlice
 * @description Phase 176: Focused-frame live surface scheduling (non-focused frames
 * and breakpoint copies freeze on their last cached frame), selectable behind-sibling
 * `background` role placement, and the Phase 176 cursor-reactive shader background
 * vertical slice with GLSL source, reduced-motion freeze, touch behavior, and
 * deterministic tape checkpoint pixel sampling.
 */

export interface EditorSurfaceFrameDescriptor {
  readonly frameId: string;
  readonly surfaceId: string;
  readonly role: "background" | "foreground";
  readonly isBreakpointCopy: boolean;
}

export interface ScheduledEditorSurface {
  readonly frameId: string;
  readonly surfaceId: string;
  readonly mode: "live" | "frozen_last_frame";
  readonly behindSiblings: boolean;
  readonly selectableInDesignMode: boolean;
}

/**
 * Only the focused primary frame runs live GPU surfaces; non-focused frames and
 * breakpoint mirror copies freeze at their last rendered frame. `background` surfaces
 * always sit behind siblings while remaining selectable in Design mode.
 */
export function resolveEditorSurfaceScheduling(
  frames: readonly EditorSurfaceFrameDescriptor[],
  focusedFrameId: string
): readonly ScheduledEditorSurface[] {
  return frames.map((f) => ({
    frameId: f.frameId,
    surfaceId: f.surfaceId,
    mode: f.frameId === focusedFrameId && !f.isBreakpointCopy ? "live" : "frozen_last_frame",
    behindSiblings: f.role === "background",
    selectableInDesignMode: true,
  }));
}

export interface BackgroundSliceUniforms {
  readonly uTime: number;
  readonly uPointerU: number;
  readonly uPointerV: number;
  readonly bendStrength: number;
  readonly reducedMotion: boolean;
  readonly inputDevice: "mouse" | "pen" | "touch";
}

export const PHASE_176_BACKGROUND_FRAGMENT_GLSL = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uBendStrength;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 delta = uv - uPointer;
  float dist = length(delta);
  float warp = exp(-dist * 3.5) * uBendStrength;
  vec2 warpedUv = uv - normalize(delta + vec2(1e-4)) * warp * 0.14;
  float wave = 0.5 + 0.5 * sin(warpedUv.x * 6.28318 + uTime * 1.2 + warpedUv.y * 3.14159);
  vec3 col = mix(vec3(0.08, 0.11, 0.22), vec3(0.32, 0.56, 0.94), wave);
  col += vec3(0.18, 0.22, 0.32) * exp(-dist * 4.5);
  fragColor = vec4(col, 1.0);
}
`;

/**
 * Deterministic CPU reference evaluator matching `PHASE_176_BACKGROUND_FRAGMENT_GLSL`
 * for tape checkpoints, Reduced Motion static freeze, and Touch calm fallback.
 */
export function evaluateCursorReactiveBackgroundSlice(
  width: number,
  height: number,
  uniforms: BackgroundSliceUniforms
): Uint8ClampedArray {
  const effectiveTime = uniforms.reducedMotion ? 0 : uniforms.uTime;
  const effectiveBend = uniforms.reducedMotion
    ? 0
    : uniforms.inputDevice === "touch"
      ? uniforms.bendStrength * 0.65
      : uniforms.bendStrength;
  const px = Math.max(0, Math.min(1, uniforms.uPointerU));
  const py = Math.max(0, Math.min(1, uniforms.uPointerV));

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / Math.max(1, height);
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / Math.max(1, width);
      const dx = u - px;
      const dy = v - py;
      const dist = Math.hypot(dx, dy);
      const warp = Math.exp(-dist * 3.5) * effectiveBend;
      const nx = (dx + 1e-4) / Math.hypot(dx + 1e-4, dy);
      const ny = dy / Math.hypot(dx + 1e-4, dy);
      const wu = u - nx * warp * 0.14;
      const wv = v - ny * warp * 0.14;
      const wave = 0.5 + 0.5 * Math.sin(wu * 6.28318 + effectiveTime * 1.2 + wv * 3.14159);
      const glow = Math.exp(-dist * 4.5);

      const r = Math.max(0, Math.min(255, Math.round((0.08 + (0.32 - 0.08) * wave + 0.18 * glow) * 255)));
      const g = Math.max(0, Math.min(255, Math.round((0.11 + (0.56 - 0.11) * wave + 0.22 * glow) * 255)));
      const b = Math.max(0, Math.min(255, Math.round((0.22 + (0.94 - 0.22) * wave + 0.32 * glow) * 255)));

      const idx = (y * width + x) * 4;
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = 255;
    }
  }
  return out;
}
