// Reduced motion preference detection ported from Nook (the owner's own product)

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Check if reduced motion is preferred by the user system settings. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Server snapshot for reduced motion (defaults to false on server). */
export function getServerReducedMotion(): boolean {
  return false;
}

/** Subscribe to media query changes for reduced motion preference. */
export function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  const handler = () => callback();
  mq.addEventListener?.("change", handler);
  return () => {
    mq.removeEventListener?.("change", handler);
  };
}

