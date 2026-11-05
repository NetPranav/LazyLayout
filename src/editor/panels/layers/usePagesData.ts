"use client";

import { useMemo, useCallback } from "react";
import { useProjectStore, type PageDefinition } from "@/core/store/useProjectStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getDocument, setDocument } from "@/core/store/documentState";
import { createLayer } from "@/core/document/factories";
import type { UsePagesDataReturn } from "./types";

interface ExtendedProjectStoreState {
  addPage?: (pageData: Partial<PageDefinition>, rootElement?: unknown, actionLabel?: string) => string;
  updatePage?: (pageId: string, updates: Partial<PageDefinition>, actionLabel?: string) => void;
  deletePage?: (pageId: string, actionLabel?: string) => void;
  duplicatePage?: (pageId: string, actionLabel?: string) => string;
}

function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function uniqueSlug(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function syncActiveFrame(): void {
  const st = useProjectStore.getState();
  const root = st.pages[st.activePageId]?.rootElementId;
  if (!root) return;
  useCanvasViewStore.getState().setActiveFrame(root);
  useSelectionStore.getState().select(root, "element");
}

export function usePagesData(): UsePagesDataReturn {
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useProjectStore((s) => s.activePageId);

  // Array of page names for PageSwitcher
  const pageNames = useMemo(() => {
    const list = Object.values(pages);
    if (list.length === 0) return ["Home"];
    return list.map((p) => p.name || p.id);
  }, [pages]);

  const activePage = pages[activePageId];
  const currentPage = activePage ? activePage.name || activePage.id : pageNames[0] || "Home";

  const onSelectPage = useCallback(
    (pageName: string) => {
      const state = useProjectStore.getState();
      const target = Object.values(state.pages).find(
        (p) => p.name === pageName || p.id === pageName
      );
      if (!target) return;

      state.setActivePage(target.id);

      if (target.rootElementId) {
        useCanvasViewStore.getState().setActiveFrame(target.rootElementId);
        useSelectionStore.getState().select(target.rootElementId, "element");
      }
    },
    []
  );

  const onNewPage = useCallback(() => {
    const state = useProjectStore.getState() as unknown as ExtendedProjectStoreState;
    const currentPages = useProjectStore.getState().pages;
    const list = Object.values(currentPages);
    const newName = uniqueName(`Page ${list.length + 1}`, list.map((p) => p.name));
    const newSlug = uniqueSlug(
      `/${newName.toLowerCase().replace(/\s+/g, "-")}`,
      list.map((p) => p.slug)
    );

    if (typeof state.addPage === "function") {
      state.addPage({ name: newName, slug: newSlug });
      syncActiveFrame();
      return;
    }

    // Direct fallback if After-track pagesActions is not loaded
    const pageId = `page_${Math.random().toString(36).substring(2, 9)}`;
    const rootElId = `root_${pageId}`;

    const newRoot = createLayer({
      id: rootElId,
      archetype: "container",
      name: `${newName} Container`,
      properties: {
        "layout.display": "flex",
        "layout.flexDirection": "column",
        "layout.padding": 24,
        "layout.minHeight": "100vh",
      },
    });

    const doc = getDocument();
    setDocument({ ...doc, layers: { ...doc.layers, [newRoot.id]: newRoot } });

    const newPage: PageDefinition = {
      id: pageId,
      name: newName,
      slug: newSlug,
      rootElementId: rootElId,
      order: Object.keys(currentPages).length,
    };

    useProjectStore.setState((s) => ({
      pages: { ...s.pages, [pageId]: newPage },
      activePageId: pageId,
    }));

    useCanvasViewStore.getState().setActiveFrame(rootElId);
    useSelectionStore.getState().select(rootElId, "element");
  }, []);

  const onRenamePage = useCallback(
    (pageName: string, explicitNewName: string) => {
      const state = useProjectStore.getState() as unknown as ExtendedProjectStoreState;
      const currentPages = useProjectStore.getState().pages;
      const target = Object.values(currentPages).find(
        (p) => p.name === pageName || p.id === pageName
      );
      if (!target) return;

      if (!explicitNewName.trim() || explicitNewName.trim() === target.name) return;
      const trimmed = uniqueName(
        explicitNewName.trim(),
        Object.values(currentPages)
          .filter((p) => p.id !== target.id)
          .map((p) => p.name)
      );

      if (typeof state.updatePage === "function") {
        state.updatePage(target.id, { name: trimmed });
        return;
      }

      useProjectStore.setState((s) => ({
        pages: {
          ...s.pages,
          [target.id]: { ...s.pages[target.id], name: trimmed },
        },
      }));
    },
    []
  );

  const onDuplicatePage = useCallback((pageName: string) => {
    const state = useProjectStore.getState() as unknown as ExtendedProjectStoreState;
    const currentPages = useProjectStore.getState().pages;
    const target = Object.values(currentPages).find(
      (p) => p.name === pageName || p.id === pageName
    );
    if (!target) return;

    if (typeof state.duplicatePage === "function") {
      state.duplicatePage(target.id);
      syncActiveFrame();
      return;
    }

    const newPageId = `page_${Math.random().toString(36).substring(2, 9)}`;
    const newRootId = `root_${newPageId}`;

    const newRoot = createLayer({
      id: newRootId,
      archetype: "container",
      name: `${target.name} Copy Container`,
      properties: {
        "layout.display": "flex",
        "layout.flexDirection": "column",
        "layout.padding": 24,
        "layout.minHeight": "100vh",
      },
    });

    const doc = getDocument();
    setDocument({ ...doc, layers: { ...doc.layers, [newRoot.id]: newRoot } });

    const newPage: PageDefinition = {
      ...target,
      id: newPageId,
      name: uniqueName(`${target.name} Copy`, Object.values(currentPages).map((p) => p.name)),
      slug: uniqueSlug(`${target.slug}-copy`, Object.values(currentPages).map((p) => p.slug)),
      rootElementId: newRootId,
      order: Object.keys(currentPages).length,
    };

    useProjectStore.setState((s) => ({
      pages: { ...s.pages, [newPageId]: newPage },
      activePageId: newPageId,
    }));

    useCanvasViewStore.getState().setActiveFrame(newRootId);
    useSelectionStore.getState().select(newRootId, "element");
  }, []);

  const onDeletePage = useCallback((pageName: string) => {
    const state = useProjectStore.getState() as unknown as ExtendedProjectStoreState;
    const currentPages = useProjectStore.getState().pages;
    if (Object.keys(currentPages).length <= 1) {
      console.warn("[usePagesData] Cannot delete the only remaining page.");
      return;
    }

    const target = Object.values(currentPages).find(
      (p) => p.name === pageName || p.id === pageName
    );
    if (!target) return;

    if (typeof state.deletePage === "function") {
      state.deletePage(target.id);
      syncActiveFrame();
      return;
    }

    const nextPages = { ...currentPages };
    delete nextPages[target.id];

    let nextActiveId = useProjectStore.getState().activePageId;
    if (nextActiveId === target.id) {
      nextActiveId = Object.keys(nextPages)[0] || "";
    }

    useProjectStore.setState({
      pages: nextPages,
      activePageId: nextActiveId,
    });
    syncActiveFrame();
  }, []);

  return {
    pages: pageNames,
    currentPage,
    activePageId,
    onSelectPage,
    onNewPage,
    onRenamePage,
    onDuplicatePage,
    onDeletePage,
    rawPages: pages,
  };
}
