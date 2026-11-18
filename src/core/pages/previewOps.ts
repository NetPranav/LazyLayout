/**
 * Preview navigation (ROADMAP Phase 48): clicking a layer with a link in Preview goes where the link says: another
 * page or frame (the Preview shows that frame), a section (the frame scrolls to it), or a web address (a new tab).
 * Back and forward walk the history like a browser. The frame being shown, and the history, are in `usePreviewStore`.
 */

import { getDocument } from "../store/documentState";
import { useCanvasViewStore } from "../store/useCanvasViewStore";
import { usePreviewStore, type PreviewEntry } from "../store/usePreviewStore";
import { addressOf, linkOf, pagesOf, resolveLink, type Destination } from "./pages";
import { pageTransitionOf, runPageTransition, sharedPairs, type NavDirection } from "./pageTransitions";
import { reducedMotionNow } from "../store/useMotionPreferenceStore";

const frameEl = (id: string | undefined): HTMLElement | null => (id && typeof document !== "undefined" ? document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(id)}"]`) : null);
const layerEl = (frame: string | undefined, id: string): HTMLElement | null => frameEl(frame)?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`) ?? null;

/** Changes the frame Preview shows with `update`, moving to `toFrame` the way that page says (`pageTransition.*`), shared elements travelling between the two. */
function transitionTo(toFrame: string, direction: NavDirection, update: () => void): void {
  const from = usePreviewStore.getState().current()?.frameId;
  const doc = getDocument();
  const spec = pageTransitionOf(doc.layers[toFrame]);
  if (spec.type === "none" || !from || from === toFrame || typeof document === "undefined") return update();
  const pairs = sharedPairs(doc, from, toFrame);
  void runPageTransition({
    spec, direction, update, reduced: reducedMotionNow(),
    sharedBefore: Object.fromEntries(pairs.map(([k, a]) => [k, layerEl(from, a)])),
    sharedAfter: () => Object.fromEntries(pairs.map(([k, , b]) => [k, layerEl(toFrame, b)])),
    pages: () => ({ out: frameEl(from), in: frameEl(toFrame) }),
  });
}

/** Shows another frame going forward. */
export function previewShow(entry: PreviewEntry): void {
  transitionTo(entry.frameId, "forward", () => usePreviewStore.getState().go(entry));
}

/** Back or forward in the history, with the transition of the page arrived at. Returns false at the end of the history. */
export function previewStep(direction: NavDirection): boolean {
  const s = usePreviewStore.getState();
  const target = s.entries[s.index + (direction === "back" ? -1 : 1)];
  if (!target) return false;
  transitionTo(target.frameId, direction, () => void (direction === "back" ? s.back() : s.forward()));
  return true;
}

/** Goes to a destination. Returns false when there is nowhere to go (a link to something that is gone). */
export function previewGoTo(dest: Destination): boolean {
  if (!dest) return false;
  const store = usePreviewStore.getState();
  switch (dest.kind) {
    case "page":
      previewShow({ frameId: dest.pageId });
      return true;
    case "anchor":
      previewShow({ frameId: dest.pageId, anchor: dest.anchor });
      return true;
    case "frame":
      previewShow({ frameId: dest.frameId });
      return true;
    case "url":
      if (typeof window !== "undefined") window.open(dest.url, "_blank", "noopener,noreferrer");
      return true;
  }
}

/** A click on a layer in Preview: follows the link of the layer or the nearest one above it that has one. Returns whether it went anywhere. */
export function previewFollow(layerId: string): boolean {
  const doc = getDocument();
  const found = linkOf(doc.layers, layerId);
  return found ? previewGoTo(resolveLink(doc, found.link)) : false;
}

/** Opens a page by its route (`/pricing`), optionally at an anchor. */
export function previewOpenRoute(route: string, anchor?: string): boolean {
  const page = pagesOf(getDocument()).find((p) => p.route === route);
  if (!page) return false;
  previewShow({ frameId: page.id, ...(anchor ? { anchor } : {}) });
  return true;
}

/** Called when Preview starts: shows the frame being worked in (or the home page, or the first frame), with a fresh history. */
export function previewStart(): void {
  const doc = getDocument();
  const frames = Object.values(doc.layers).filter((l) => l.parentId === null);
  if (frames.length === 0) return usePreviewStore.getState().reset(null);
  const active = useCanvasViewStore.getState().activeFrameId;
  const home = pagesOf(doc).find((p) => p.home)?.id;
  const pick = (active && doc.layers[active]?.parentId === null ? active : undefined) ?? home ?? frames[0].id;
  usePreviewStore.getState().reset({ frameId: pick });
}

/** The address Preview shows: the page's route and anchor, or the frame's name when it isn't a page. */
export function previewAddress(): string {
  const doc = getDocument();
  const cur = usePreviewStore.getState().current();
  if (!cur) return "";
  const layer = doc.layers[cur.frameId];
  if (!layer) return "";
  return layer.page ? addressOf({ route: layer.page.route }, cur.anchor) : layer.name;
}
