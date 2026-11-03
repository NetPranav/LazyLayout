// Active motion feel and reduced motion support ported from Nook (the owner's own product)

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MOTION_PRESETS, type MotionPresetKey, type MotionPreset } from "./presets";
import { springEase } from "./ease";
import { prefersReducedMotion, subscribeReducedMotion, getServerReducedMotion } from "./reducedMotion";

export { prefersReducedMotion } from "./reducedMotion";

const STORAGE_KEY = "lazy-layout-motion-feel";

let currentFeel: MotionPresetKey = "smooth";
const feelListeners = new Set<() => void>();

function notifyFeelListeners(): void {
  feelListeners.forEach((fn) => fn());
}

/** Subscribe to feel changes for useSyncExternalStore. */
export function subscribeFeel(callback: () => void): () => void {
  feelListeners.add(callback);
  return () => {
    feelListeners.delete(callback);
  };
}

// Initialize feel from localStorage if in browser
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as MotionPresetKey | null;
    if (stored && stored in MOTION_PRESETS) {
      currentFeel = stored;
    }
  } catch {
    // ignore localStorage errors
  }

  window.addEventListener("ll-feel-change", (e: Event) => {
    const customEvent = e as CustomEvent<MotionPresetKey>;
    if (customEvent.detail && customEvent.detail in MOTION_PRESETS && customEvent.detail !== currentFeel) {
      currentFeel = customEvent.detail;
      notifyFeelListeners();
    }
  });
}

/** Return the active feel key ('smooth' | 'lively' | 'bouncy'). */
export function getFeel(): MotionPresetKey {
  return currentFeel;
}

/** Server snapshot for feel (defaults to 'smooth' on server). */
export function getServerFeel(): MotionPresetKey {
  return "smooth";
}

/** Return the MotionPreset object for the active feel. */
export function getActivePreset(): MotionPreset {
  return MOTION_PRESETS[currentFeel];
}

/**
 * Apply the active feel: updates document CSS properties (--ll-ease-pop, --ll-dur-pop),
 * stores to localStorage, and dispatches a custom event.
 */
export function applyFeel(feel: MotionPresetKey): void {
  if (!(feel in MOTION_PRESETS)) {
    feel = "smooth";
  }
  currentFeel = feel;

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, feel);
    }
  } catch {
    // ignore storage errors
  }

  if (typeof document !== "undefined") {
    const preset = MOTION_PRESETS[feel];
    const e = springEase(preset.pop[0], preset.pop[1]);
    document.documentElement.style.setProperty("--ll-ease-pop", e.easing);
    document.documentElement.style.setProperty("--ll-dur-pop", `${e.duration}ms`);
  }

  notifyFeelListeners();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<MotionPresetKey>("ll-feel-change", { detail: feel }));
  }
}

/** Change the active feel. */
export function setFeel(feel: MotionPresetKey): void {
  applyFeel(feel);
}

/** React hook for active feel and reduced motion with server snapshots. */
export function useFeel() {
  const feel = useSyncExternalStore(subscribeFeel, getFeel, getServerFeel);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, getServerReducedMotion);

  useEffect(() => {
    // Apply document tokens on mount
    if (typeof document !== "undefined") {
      const preset = MOTION_PRESETS[currentFeel];
      const e = springEase(preset.pop[0], preset.pop[1]);
      document.documentElement.style.setProperty("--ll-ease-pop", e.easing);
      document.documentElement.style.setProperty("--ll-dur-pop", `${e.duration}ms`);
    }
  }, []);

  const changeFeel = useCallback((nextFeel: MotionPresetKey) => {
    setFeel(nextFeel);
  }, []);

  return {
    feel,
    setFeel: changeFeel,
    preset: MOTION_PRESETS[feel],
    reducedMotion: reduced,
  };
}

