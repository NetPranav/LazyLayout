/**
 * Loading pages: the screen shown between two pages while the page change happens.
 *
 * A loading page is a page of the project (it has its own root frame and layers) with `kind: "loading"`. It is listed
 * between the two pages it sits between, and remembers which pages to show beside it while it is designed (`transition`):
 * any page, the same one twice too. It is not a route; the Next export writes it as the `loading.tsx` of the page it leads to.
 */

import { recordProjectChange, useProjectStore } from "@/core/store/useProjectStore";
import type { PageDefinition } from "@/core/store/projectTypes";
import { getDocument, setDocument } from "@/core/store/documentState";
import { createLayer } from "@/core/document/factories";

export const isLoadingPage = (p: Pick<PageDefinition, "kind"> | undefined | null): boolean => p?.kind === "loading";

/** The pages in the order they are listed: by `order`, then as they were added. */
export function orderedPages(pages: Record<string, PageDefinition>): PageDefinition[] {
  return Object.values(pages)
    .map((page, i) => ({ page, i }))
    .sort((a, b) => (a.page.order ?? a.i) - (b.page.order ?? b.i) || a.i - b.i)
    .map((x) => x.page);
}

/** `ids` with `id` placed straight after `afterId` (at the end when `afterId` is not there). */
export function insertAfter(ids: readonly string[], afterId: string, id: string): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(afterId);
  rest.splice(at < 0 ? rest.length : at + 1, 0, id);
  return rest;
}

function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** Pages that can sit beside a loading page: every page that is not itself a loading page. */
export const referencePages = (pages: Record<string, PageDefinition>): PageDefinition[] => orderedPages(pages).filter((p) => !isLoadingPage(p));

/**
 * Adds a loading page between two pages (`fromId` then `toId`) and makes it the active page. One undo step.
 * Returns its id, or null when either page is missing or is a loading page itself.
 */
export function addLoadingPage(fromId: string, toId: string): string | null {
  const state = useProjectStore.getState();
  const from = state.pages[fromId];
  const to = state.pages[toId];
  if (!from || !to || isLoadingPage(from) || isLoadingPage(to)) return null;

  recordProjectChange("Add loading page", state.getSnapshot(), { includesDocument: true });

  const id = `page_loading_${Math.random().toString(36).substring(2, 9)}`;
  const rootId = `root_${id}`;
  const name = uniqueName("Loading", Object.values(state.pages).map((p) => p.name));
  const root = createLayer({
    id: rootId,
    archetype: "container",
    name: `${name} Container`,
    properties: { "layout.display": "flex", "layout.flexDirection": "column", "layout.minHeight": "100vh", "layout.padding": 24, "appearance.background.color": "#FFFFFF" },
  });
  const doc = getDocument();
  setDocument({ ...doc, layers: { ...doc.layers, [rootId]: root } });

  const page: PageDefinition = { id, name, slug: "", rootElementId: rootId, kind: "loading", transition: { from: fromId, to: toId } };
  const ids = insertAfter(orderedPages(state.pages).map((p) => p.id), fromId, id);
  useProjectStore.setState((s) => {
    const pages = { ...s.pages, [id]: page };
    ids.forEach((pid, i) => {
      pages[pid] = { ...pages[pid], order: i };
    });
    return { pages, activePageId: id };
  });
  return id;
}

/** Chooses which page is shown on one side of a loading page while it is designed. */
export function setTransitionPage(loadingId: string, side: "from" | "to", pageId: string | null): void {
  const state = useProjectStore.getState();
  const page = state.pages[loadingId];
  if (!page || !isLoadingPage(page)) return;
  if (pageId !== null && (!state.pages[pageId] || isLoadingPage(state.pages[pageId]))) return;
  recordProjectChange("Change reference page", state.getSnapshot());
  useProjectStore.setState((s) => ({
    pages: { ...s.pages, [loadingId]: { ...s.pages[loadingId], transition: { from: null, to: null, ...s.pages[loadingId].transition, [side]: pageId } } },
  }));
}
