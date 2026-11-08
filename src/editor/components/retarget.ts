"use client";

import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";

export type OverlayFamily =
  | "menu"
  | "context-menu"
  | "inspector-options"
  | "color-picker"
  | "font-picker"
  | "select"
  | "toolbar"
  | "timeline"
  | "timeline-easing"
  | "page-selector"
  | "ship";

export interface ActiveOverlayRecord {
  id: string;
  family: OverlayFamily;
  element: HTMLElement;
  anchor?: HTMLElement | null;
  close: (immediate?: boolean) => void;
  rect: DOMRect;
  timestamp: number;
}

export interface RetargetGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: number;
}

// Global active registry
const activeOverlays = new Map<string, ActiveOverlayRecord>();
const recentHandoffs = new Map<OverlayFamily, { rect: DOMRect; timestamp: number }>();

const HANDOFF_EXPIRY_MS = 450;
const CROSSFADE_DURATION_MS = 160;

/**
 * Register an active overlay surface. Supports record object or family/element/close parameters.
 * Closes overlays of differing families per P rules.
 */
export function registerOverlay(
  recordOrFamily: ActiveOverlayRecord | OverlayFamily,
  element?: HTMLElement | null,
  close?: (immediate?: boolean) => void,
  anchor?: HTMLElement | null
): (() => void) | void {
  if (typeof recordOrFamily === "string") {
    if (!element || !close) return;
    const id = `${recordOrFamily}-${Math.random().toString(36).substring(2, 9)}`;
    const rect = element.getBoundingClientRect();
    const record: ActiveOverlayRecord = {
      id,
      family: recordOrFamily,
      element,
      close,
      anchor,
      rect,
      timestamp: performance.now(),
    };
    registerOverlay(record);
    return () => unregisterOverlay(id);
  } else {
    const record = recordOrFamily;
    activeOverlays.forEach((active, id) => {
      // If a context menu opens, close any other open overlay immediately.
      // If another family opens, close overlays of differing families.
      const shouldClose =
        record.family === "context-menu" ||
        active.family === "context-menu" ||
        active.family !== record.family;
      if (shouldClose && id !== record.id) {
        try {
          active.close(true);
        } catch (_) {}
      }
    });
    activeOverlays.set(record.id, record);
  }
}

/**
 * Unregister an overlay, recording its last known geometry for same-family retargeting handoff.
 * Context menus do NOT record handoff history per prototype rules.
 */
export function unregisterOverlay(id: string): void {
  const existing = activeOverlays.get(id);
  if (existing) {
    if (existing.family !== "context-menu") {
      try {
        const rect = existing.element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          recentHandoffs.set(existing.family, {
            rect,
            timestamp: performance.now(),
          });
        }
      } catch (_) {}
    }
    activeOverlays.delete(id);
  }
}

/**
 * Look up the handoff geometry for the same overlay family.
 * If another active overlay of the same family is currently open, it captures its live rect
 * and closes it immediately without duplicate exit animation, transferring ownership.
 * Context menus NEVER accept handoffs (always open fresh).
 */
export function getFamilyHandoff(
  family: OverlayFamily,
  currentId?: string
): DOMRect | null {
  if (family === "context-menu") return null;

  // First check if an overlay of this family is currently open (and not the current one)
  for (const [id, record] of activeOverlays.entries()) {
    if (record.family === family && id !== currentId) {
      try {
        const r = record.element.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          // Close previous overlay immediately without exit animation since this one is adopting its geometry
          record.close(true);
          activeOverlays.delete(id);
          return r;
        }
      } catch (_) {}
    }
  }

  // Next check recent handoffs
  const recent = recentHandoffs.get(family);
  if (recent) {
    if (performance.now() - recent.timestamp < HANDOFF_EXPIRY_MS) {
      recentHandoffs.delete(family);
      return recent.rect;
    }
    recentHandoffs.delete(family);
  }

  return null;
}

/**
 * Notify all other families to close immediately (e.g. on Spotlight, modal, or escape).
 */
export function closeAllFamilies(exceptFamily?: OverlayFamily): void {
  activeOverlays.forEach((record) => {
    if (!exceptFamily || record.family !== exceptFamily) {
      try {
        record.close();
      } catch (_) {}
    }
  });
}

/**
 * Execute a retarget slide/spring animation from an old geometry to the new geometry.
 * Preserves momentum, crossfades content with blur, and handles reduced-motion.
 */
export function animateRetarget(
  element: HTMLElement,
  fromRect: DOMRect,
  toRect: DOMRect,
  contentElement?: HTMLElement | null
): Animation | null {
  const reduced = prefersReducedMotion();

  if (reduced) {
    element.style.left = `${toRect.left}px`;
    element.style.top = `${toRect.top}px`;
    element.style.width = `${toRect.width}px`;
    element.style.height = `${toRect.height}px`;

    if (contentElement) {
      contentElement.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: "ease-out",
        fill: "backwards",
      });
    }
    return null;
  }

  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  const dw = fromRect.width;
  const dh = fromRect.height;

  const preset = getActivePreset();
  const spring = preset.glideH || preset.shape || [0.42, 0.55];
  const e = springEase(spring[0], spring[1]);

  // Cancel any running animations on element before retargeting
  if (typeof element.getAnimations === "function") {
    element.getAnimations().forEach((a) => a.cancel());
  }

  // Outer container springs from old position & dimensions to new
  const anim = element.animate(
    [
      {
        transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`,
        width: `${dw.toFixed(2)}px`,
        height: `${dh.toFixed(2)}px`,
      },
      {
        transform: "translate3d(0, 0, 0)",
        width: `${toRect.width.toFixed(2)}px`,
        height: `${toRect.height.toFixed(2)}px`,
      },
    ],
    {
      duration: e.duration,
      easing: e.easing,
      fill: "backwards",
    }
  );

  // Content crossfades with 4px blur into crisp focus
  if (contentElement && typeof contentElement.animate === "function") {
    contentElement.animate(
      [
        { opacity: 0, filter: "blur(4px)" },
        { opacity: 1, filter: "blur(0px)" },
      ],
      {
        duration: CROSSFADE_DURATION_MS,
        easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
        fill: "backwards",
      }
    );
  }

  return anim;
}

export const retargetPosition = animateRetarget;

