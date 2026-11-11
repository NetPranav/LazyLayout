// Reduced motion preference detection ported from Nook (the owner's own product)
// plus the user's "Disable animations" toggle (logo menu). Editor chrome only:
// the user's own design playback (timeline, canvas preview) never reads this.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** localStorage key for the "Disable animations" choice ("1" = off). */
export const ANIMATIONS_OFF_KEY = "ll-animations-off";

let userOff: boolean | null = null;
const userListeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(ANIMATIONS_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when the user switched "Disable animations" on (ignores the OS setting). */
export function isUserMotionOff(): boolean {
  if (typeof window === "undefined") return false;
  if (userOff === null) userOff = readStored();
  return userOff;
}

/** Turn the user toggle on/off: persists, sets data-motion on <html>, notifies subscribers. */
export function setUserMotionOff(off: boolean): void {
  userOff = off;
  if (typeof document !== "undefined") {
    if (off) document.documentElement.setAttribute("data-motion", "off");
    else document.documentElement.removeAttribute("data-motion");
  }
  try {
    localStorage.setItem(ANIMATIONS_OFF_KEY, off ? "1" : "0");
  } catch {
    // ignore storage errors
  }
  userListeners.forEach((l) => l());
}

/** Subscribe to the user toggle (useSyncExternalStore-compatible). */
export function subscribeUserMotionOff(callback: () => void): () => void {
  userListeners.add(callback);
  return () => {
    userListeners.delete(callback);
  };
}

function osPrefersReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Single shared check: true if the user toggle is on OR the OS asks for reduced motion. */
export function isMotionOff(): boolean {
  return isUserMotionOff() || osPrefersReduced();
}

/** Check if reduced motion is preferred (user toggle or system setting). */
export function prefersReducedMotion(): boolean {
  return isMotionOff();
}

/** Server snapshot for reduced motion (defaults to false on server). */
export function getServerReducedMotion(): boolean {
  return false;
}

/** Subscribe to changes of the reduced-motion preference (OS media query and user toggle). */
export function subscribeReducedMotion(callback: () => void): () => void {
  const offUser = subscribeUserMotionOff(callback);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return offUser;
  }
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  const handler = () => callback();
  mq.addEventListener?.("change", handler);
  return () => {
    offUser();
    mq.removeEventListener?.("change", handler);
  };
}
