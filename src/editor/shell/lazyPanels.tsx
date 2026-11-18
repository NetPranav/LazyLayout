"use client";

/**
 * Panels that aren't needed to start designing, split out of the editor's first download and loaded in a queue.
 *
 * Why (performance, 2026-11-18): the /editor route downloaded and compiled ~4.5 MB of script up front, including the
 * Motion timeline, the Code panel and the 3D panels, before anything could be clicked. Now the Design editor loads
 * first; then, while the browser is idle, `startPanelPreloadQueue` fetches and compiles the rest in the order people
 * usually need them (Motion, then Code, then 3D). Pointing at a mode tab starts that panel's download at once, so it is
 * normally ready before the click lands. If a panel is opened before it arrives, a same-sized placeholder shows for
 * that moment.
 */
import React, { Suspense, useState, type ComponentType } from "react";

type Loader<P> = () => Promise<ComponentType<P>>;

export interface PreloadablePanel<P> {
  (props: P): React.ReactElement;
  /** Starts (or joins) the download; resolves when the panel's code is loaded and compiled. */
  preload(): Promise<void>;
  readonly loaded: () => boolean;
}

/** A lazily loaded component whose download can also be started ahead of time with `preload()`. */
export function preloadablePanel<P extends object>(name: string, load: Loader<P>, fallback?: React.ReactNode): PreloadablePanel<P> {
  let promise: Promise<{ default: ComponentType<P> }> | null = null;
  let done = false;
  // Once loaded, the component itself: rendered directly (no Suspense, no extra tick), so a preloaded panel mounts in
  // the same commit as before it was split out (a shortcut pressed right after opening it finds it there).
  let Loaded: ComponentType<P> | null = null;
  const start = () =>
    (promise ??= load().then(
      (component) => {
        done = true;
        Loaded = component;
        return { default: component };
      },
      (error: unknown) => {
        promise = null; // a failed download (offline) is tried again next time
        throw error;
      },
    ));
  const Lazy = React.lazy(start);
  const Panel = (props: P) => {
    // Chosen once per mounted panel, so it never switches between the two (which would remount it and lose its state).
    const [Direct] = useState<ComponentType<P> | null>(() => Loaded);
    if (Direct) return <Direct {...props} />;
    return (
      <Suspense fallback={fallback ?? <div data-testid={`panel-loading-${name}`} aria-busy="true" className="ll:w-full ll:h-full ll:bg-surface-panel" />}>
        <Lazy {...props} />
      </Suspense>
    );
  };
  Panel.displayName = `Lazy(${name})`;
  return Object.assign(Panel, {
    preload: () => start().then(() => undefined),
    loaded: () => done,
  });
}

export const LazyTimelinePanel = preloadablePanel("timeline", () =>
  import("@/editor/panels/timeline/TimelinePanel").then((m) => m.TimelinePanel),
);

export const LazyCodePanel = preloadablePanel("code", () => import("@/editor/panels/code-view/CodePanel").then((m) => m.CodePanel));

export const LazyProperties3d = preloadablePanel("properties3d", () =>
  import("@/editor/panels/details/properties3d/Properties3d").then((m) => m.Properties3d),
);

export const LazyViewportInteraction = preloadablePanel(
  "viewport3d",
  () => import("@/editor/viewport3d/ViewportInteraction").then((m) => m.ViewportInteraction),
  null,
);

/** The order the queue loads in: what people open most, first. */
const QUEUE: readonly { preload(): Promise<void> }[] = [LazyTimelinePanel, LazyCodePanel, LazyProperties3d, LazyViewportInteraction];

let queueStarted = false;

/**
 * After the Design editor is up, load the other panels one at a time, each in its own idle moment, so the downloads
 * and compiles never compete with someone already working. Safe to call more than once.
 */
export function startPanelPreloadQueue(): void {
  if (queueStarted || typeof window === "undefined") return;
  queueStarted = true;
  const idle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 4000 });
    else window.setTimeout(cb, 200);
  };
  let i = 0;
  const next = () => {
    const item = QUEUE[i++];
    if (!item) return;
    idle(() => {
      item.preload().then(next, next);
    });
  };
  // let the first paint and the first interactions settle before starting
  idle(next);
}
