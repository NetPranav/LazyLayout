import { getDocument } from "@/core/store/documentState";
import { useProjectStore } from "@/core/store/useProjectStore";

/** The top-level layer of the page being looked at: the active page's own root, else the document's first. */
export function activePageRootId(): string | null {
  const { pages, activePageId } = useProjectStore.getState();
  const layers = getDocument().layers;
  const own = pages[activePageId]?.rootElementId;
  if (own && layers[own]) return own;
  return Object.values(layers).find((l) => l.parentId === null)?.id ?? null;
}
