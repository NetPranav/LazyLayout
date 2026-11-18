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
  halftone: { backend: "svg", reason: "CSS has no halftone, so it runs on the SVG backend: a tiled field of dots thresholded against a soft spot that the pointer moves, kept only on the layer's own pixels." },
} as const satisfies Record<string, EffectRoute>;

export type RoutedEffect = keyof typeof EFFECT_ROUTES;

/** The route and the reason for an effect type. */
export const routeEffect = (type: RoutedEffect): EffectRoute => EFFECT_ROUTES[type];

/** The route of every effect in a stack, in order, each with its reason (what the inspector shows beside the effect). */
export function routeStack(types: readonly RoutedEffect[]): Array<EffectRoute & { type: RoutedEffect }> {
  return types.map((type) => ({ type, ...EFFECT_ROUTES[type] }));
}

/**
 * The performance class of an effect while it animates (ROADMAP Phase 86: "with a performance class each"), by where
 * it is drawn. The inspector shows it beside the route, so the cost of animating an effect is known before it is keyed.
 * - `compositor`: a CSS filter function. The browser re-applies it on the compositor; animating it costs no layout and
 *   no repaint of the layer's content.
 * - `repaint`: an SVG filter. The layer is drawn again through the filter on the main thread on every frame a
 *   parameter changes, and the cost grows with the layer's area.
 */
export type EffectPerformance = "compositor" | "repaint";
export const PERFORMANCE_NOTES: Record<EffectPerformance, string> = {
  compositor: "Cheap to animate: the browser re-applies it without redrawing the layer.",
  repaint: "Costly to animate: the layer is redrawn through the filter on every frame it changes, more so the bigger the layer.",
};
export const performanceOf = (route: Pick<EffectRoute, "backend">): EffectPerformance => (route.backend === "css" ? "compositor" : "repaint");
/** The performance class of an effect type. */
export const effectPerformance = (type: RoutedEffect): EffectPerformance => performanceOf(EFFECT_ROUTES[type]);

/** Motion blur is an SVG Gaussian blur along the layer's velocity: CSS blur() can't blur in one direction. */
export const MOTION_BLUR_ROUTE: EffectRoute = { backend: "svg", reason: "Motion blur blurs only along the way the layer is moving, which CSS blur() can't do (it blurs every way), so it runs on the SVG backend as feGaussianBlur with a different amount across and down." };
