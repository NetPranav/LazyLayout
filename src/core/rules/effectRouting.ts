import type { RouteBackend } from "./types";

/**
 * Where each effect in a layer's stack is drawn, and why (ROADMAP Phase 75: "the rules explain each effect's route").
 * A CSS `filter` function is the cheapest and runs off the main thread, so it is used whenever it can say the effect;
 * the rest need an SVG filter, which CSS has no function for. From Stage 4 a shader backend takes the effects neither
 * can draw well. The same table is the one `fxStack.ts` follows when it draws, so the explanation can't drift from what
 * happens (a test checks both).
 */
export interface EffectRoute {
  backend: Extract<RouteBackend, "css" | "svg">;
  reason: string;
}

export const EFFECT_ROUTES = {
  blur: { backend: "css", reason: "A blur is the CSS filter blur(), which the browser composites without touching the main thread." },
  glow: { backend: "css", reason: "A glow is a drop-shadow() with no offset (stacked once per step of intensity): a CSS filter, so it follows the layer's shape and runs on the compositor." },
  dropShadow: { backend: "css", reason: "A drop shadow is the CSS filter drop-shadow(), which follows the layer's shape, not its box." },
  colorAdjust: { backend: "css", reason: "Brightness, contrast, saturation and hue are CSS filter functions (brightness(), contrast(), saturate(), hue-rotate())." },
  displacement: { backend: "svg", reason: "CSS has no function that pushes pixels around, so displacement runs on the SVG backend: feTurbulence makes the noise and feDisplacementMap moves the pixels by it." },
  noise: { backend: "svg", reason: "CSS has no grain function, so noise runs on the SVG backend (feTurbulence over the layer's own pixels). A shader would draw it faster; that backend arrives in Stage 4." },
} as const satisfies Record<string, EffectRoute>;

export type RoutedEffect = keyof typeof EFFECT_ROUTES;

/** The route and the reason for an effect type. */
export const routeEffect = (type: RoutedEffect): EffectRoute => EFFECT_ROUTES[type];

/** The route of every effect in a stack, in order, each with its reason (what the inspector shows beside the effect). */
export function routeStack(types: readonly RoutedEffect[]): Array<EffectRoute & { type: RoutedEffect }> {
  return types.map((type) => ({ type, ...EFFECT_ROUTES[type] }));
}

/** Motion blur is an SVG Gaussian blur along the layer's velocity: CSS blur() can't blur in one direction. */
export const MOTION_BLUR_ROUTE: EffectRoute = { backend: "svg", reason: "Motion blur blurs only along the way the layer is moving, which CSS blur() can't do (it blurs every way), so it runs on the SVG backend as feGaussianBlur with a different amount across and down." };
