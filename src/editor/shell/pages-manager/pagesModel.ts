/**
 * Page operations for the Pages manager. A page is a `PageDefinition` in the project store (the stage and the
 * export read it) that names a top-level frame of the document. The engine only has the multi-page actions in the
 * full edition's After-track module, which the new editor must not import, so each operation here records one
 * project history step with `recordProjectChange` (the engine's own undo hook) and then writes the store. One
 * Ctrl+Z undoes one operation, document layers included.
 */

import { produce } from "immer";
import { recordProjectChange, useProjectStore } from "@/core/store/useProjectStore";
import type { PageDefinition } from "@/core/store/projectTypes";
import { getDocument, setDocument } from "@/core/store/documentState";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { createLayer } from "@/core/document/factories";
import { syncCompositions } from "@/core/document/compositions";
import { removeLayerDependents } from "@/core/document/migrations";
import { cloneLayers, subtreeIds } from "@/core/editing/cloneLayers";
import { createUniqueId } from "@/core/ids";
import { isLoadingPage, orderedPages } from "@/core/pages/loadingPages";
import type { MotionDocument } from "@/core/document/schema";

export interface PageItem {
  id: string;
  name: string;
  route: string;
  isHome: boolean;
  isCurrent: boolean;
  title: string;
  description: string;
}

/** The pages as listed (loading pages are not routes, so they are not listed here). */
export function listPages(pages: Record<string, PageDefinition>, activeId: string): PageItem[] {
  return orderedPages(pages)
    .filter((p) => !isLoadingPage(p))
    .map((p) => ({
      id: p.id,
      name: p.name || p.id,
      route: p.slug || "/",
      isHome: p.slug === "/",
      isCurrent: p.id === activeId,
      title: p.metaTitle ?? "",
      description: p.metaDescription ?? "",
    }));
}

export function slugOf(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s ? `/${s}` : "/page";
}

/** Normalises what a person types as a route: leading slash, lowercase words and dashes between slashes. */
export function normaliseRoute(input: string): string {
  const parts = input
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .split("/")
    .map((p) => p.replace(/[^a-z0-9_[\]-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return `/${parts.join("/")}`;
}

function unique(base: string, taken: readonly string[], join: string): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}${join}${n}`)) n += 1;
  return `${base}${join}${n}`;
}

const state = () => useProjectStore.getState();
const randomId = () => `page_${Math.random().toString(36).slice(2, 9)}`;

function showRoot(rootId: string | undefined): void {
  if (!rootId) return;
  useCanvasViewStore.getState().setActiveFrame(rootId);
  useSelectionStore.getState().select(rootId, "element");
}

/** Switches the canvas to a page. Looking at a page is not an edit, so it is not an undo step. */
export function selectPage(id: string): void {
  const page = state().pages[id];
  if (!page) return;
  state().setActivePage(id);
  showRoot(page.rootElementId);
}

function renumber(ids: readonly string[], pages: Record<string, PageDefinition>): Record<string, PageDefinition> {
  const next = { ...pages };
  ids.forEach((pid, i) => {
    if (next[pid]) next[pid] = { ...next[pid], order: i };
  });
  return next;
}

/** Adds an empty page after the last one and opens it. Returns its id. */
export function addPage(): string {
  const st = state();
  const all = Object.values(st.pages);
  const name = unique(`Page ${listPages(st.pages, st.activePageId).length + 1}`, all.map((p) => p.name), " ");
  const slug = unique(slugOf(name), all.map((p) => p.slug), "-");
  const id = randomId();
  const rootId = `root_${id}`;
  const activeRoot = getDocument().layers[st.pages[st.activePageId]?.rootElementId ?? ""];
  const bg = activeRoot?.properties["appearance.background.color"];
  const root = createLayer({
    id: rootId,
    archetype: "container",
    name,
    properties: {
      "frame.width": 1440,
      "frame.widthUnit": "px",
      "frame.height": 900,
      "frame.heightUnit": "px",
      "appearance.background.color": typeof bg === "string" ? bg : "#FFFFFF",
      "layout.display": "flex",
      "layout.flexDirection": "column",
    },
  });
  recordProjectChange("Add page", st.getSnapshot(), { includesDocument: true });
  const doc = getDocument();
  setDocument({ ...doc, layers: { ...doc.layers, [rootId]: root } });
  const ids = [...orderedPages(st.pages).map((p) => p.id), id];
  useProjectStore.setState((s) => ({
    pages: { ...renumber(ids, s.pages), [id]: { id, name, slug, rootElementId: rootId, order: ids.length - 1, metaTitle: name, metaDescription: "" } },
    activePageId: id,
  }));
  showRoot(rootId);
  return id;
}

export function renamePage(id: string, name: string): boolean {
  const st = state();
  const page = st.pages[id];
  const next = name.trim().slice(0, 120);
  if (!page || !next || next === page.name) return false;
  const taken = Object.values(st.pages).filter((p) => p.id !== id).map((p) => p.name);
  const finalName = unique(next, taken, " ");
  // the page's frame carries its name in the layers panel: it follows, unless it was named on its own
  const doc = getDocument();
  const root = doc.layers[page.rootElementId];
  const renameRoot = !!root && root.name === page.name && !Object.values(st.pages).some((p) => p.id !== id && p.rootElementId === page.rootElementId);
  recordProjectChange("Rename page", st.getSnapshot(), { includesDocument: renameRoot });
  if (renameRoot) {
    setDocument(
      produce(doc, (draft) => {
        draft.layers[page.rootElementId].name = finalName;
      }),
    );
  }
  useProjectStore.setState((s) => ({ pages: { ...s.pages, [id]: { ...s.pages[id], name: finalName } } }));
  return true;
}

/** Copies the page with all its layers (and their animations) and opens the copy right after the original. */
export function duplicatePage(id: string): string | null {
  const st = state();
  const page = st.pages[id];
  if (!page) return null;
  const doc = getDocument();
  if (!doc.layers[page.rootElementId]) return null;
  const all = Object.values(st.pages);
  const name = unique(`${page.name} copy`, all.map((p) => p.name), " ");
  const slug = unique(`${page.slug === "/" ? "/home" : page.slug}-copy`, all.map((p) => p.slug), "-");
  const bundle = cloneLayers(doc.layers, doc.clips, [page.rootElementId], { layers: doc.layers, clips: doc.clips });
  const root = bundle.layers[0];
  root.name = name;
  recordProjectChange("Duplicate page", st.getSnapshot(), { includesDocument: true });
  setDocument(
    produce(doc, (draft) => {
      for (const l of bundle.layers) draft.layers[l.id] = l;
      for (const c of bundle.clips) draft.clips[c.id] = c;
      syncCompositions(draft as MotionDocument);
    }),
  );
  const newId = createUniqueId("page", new Set(Object.keys(st.pages)));
  const ids = orderedPages(st.pages).map((p) => p.id);
  ids.splice(ids.indexOf(id) + 1, 0, newId);
  useProjectStore.setState((s) => ({
    pages: { ...renumber(ids, s.pages), [newId]: { ...page, id: newId, name, slug, rootElementId: root.id, order: ids.indexOf(newId) } },
    activePageId: newId,
  }));
  showRoot(root.id);
  return newId;
}

/** Deletes a page and the layers it owns. The last page cannot be deleted. */
export function deletePage(id: string): boolean {
  const st = state();
  const page = st.pages[id];
  if (!page || listPages(st.pages, st.activePageId).length <= 1) return false;
  const shared = Object.values(st.pages).some((p) => p.id !== id && p.rootElementId === page.rootElementId);
  const rest = orderedPages(st.pages).filter((p) => p.id !== id);
  const wasHome = page.slug === "/";
  recordProjectChange("Delete page", st.getSnapshot(), { includesDocument: true });
  const doc = getDocument();
  if (!shared && doc.layers[page.rootElementId]) {
    setDocument(
      produce(doc, (draft) => {
        const doomed = new Set(subtreeIds(draft.layers as never, page.rootElementId));
        removeLayerDependents(draft as MotionDocument, doomed);
        doomed.forEach((lid) => delete draft.layers[lid]);
        syncCompositions(draft as MotionDocument);
      }),
    );
  }
  const nextActive = st.activePageId === id ? (rest.find((p) => !isLoadingPage(p)) ?? rest[0]).id : st.activePageId;
  useProjectStore.setState((s) => {
    const pages = { ...s.pages };
    delete pages[id];
    const ordered = renumber(rest.map((p) => p.id), pages);
    if (wasHome) {
      const first = rest.find((p) => !isLoadingPage(p));
      if (first) ordered[first.id] = { ...ordered[first.id], slug: "/" };
    }
    return { pages: ordered, activePageId: nextActive };
  });
  showRoot(state().pages[nextActive]?.rootElementId);
  return true;
}

/** Makes a page the home page (`/`). The page that was home gets a route from its name. */
export function setHomePage(id: string): boolean {
  const st = state();
  const page = st.pages[id];
  if (!page || page.slug === "/") return false;
  const old = Object.values(st.pages).find((p) => p.slug === "/" && p.id !== id);
  const taken = Object.values(st.pages).map((p) => p.slug).filter((s) => s !== "/");
  recordProjectChange("Set home page", st.getSnapshot());
  useProjectStore.setState((s) => {
    const pages = { ...s.pages, [id]: { ...s.pages[id], slug: "/" } };
    if (old) pages[old.id] = { ...pages[old.id], slug: unique(slugOf(old.name), taken, "-") };
    return { pages };
  });
  return true;
}

/** Moves a page to `index` in the list of pages (as listed, without loading pages). */
export function movePage(id: string, index: number): boolean {
  const st = state();
  const listed = listPages(st.pages, st.activePageId).map((p) => p.id);
  const from = listed.indexOf(id);
  if (from < 0) return false;
  const to = Math.max(0, Math.min(listed.length - 1, index));
  if (to === from) return false;
  listed.splice(from, 1);
  listed.splice(to, 0, id);
  const loading = orderedPages(st.pages).filter((p) => isLoadingPage(p)).map((p) => p.id);
  recordProjectChange("Reorder pages", st.getSnapshot());
  useProjectStore.setState((s) => ({ pages: renumber([...listed, ...loading], s.pages) }));
  return true;
}

export interface PageSettings {
  title: string;
  route: string;
  description: string;
}

/** Applies the settings popover's fields as one undo step. Returns an error line for a route that is taken. */
export function updatePageSettings(id: string, next: PageSettings): string | null {
  const st = state();
  const page = st.pages[id];
  if (!page) return "That page is gone.";
  const route = normaliseRoute(next.route);
  if (Object.values(st.pages).some((p) => p.id !== id && p.slug === route)) return "Another page already has that route.";
  if (page.slug === "/" && route !== "/") return "The home page keeps the route /. Set another page as home first.";
  if (page.slug !== "/" && route === "/") return "Use Set as home to give a page the route /.";
  const changed = route !== page.slug || next.title !== (page.metaTitle ?? "") || next.description !== (page.metaDescription ?? "");
  if (!changed) return null;
  recordProjectChange("Change page settings", st.getSnapshot());
  useProjectStore.setState((s) => ({
    pages: { ...s.pages, [id]: { ...s.pages[id], slug: route, metaTitle: next.title, metaDescription: next.description } },
  }));
  return null;
}
