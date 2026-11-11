import { insertSection } from "@/core/templates/templateOps";
import { templateById } from "@/core/templates/sections";
import { transaction } from "@/core/editing/editOps";
import { activePageRootId } from "@/core/frames/pageRoots";
import { getDocument } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getActivePreset } from "@/editor/motion/feel";
import { springAnim } from "@/editor/motion/ease";
import { defaultHost } from "@/editor/motion/loop";

/** The direct child of the page that holds a selected layer: the block "below the selection" means. */
function selectedBlock(pageId: string): string | null {
  const layers = getDocument().layers;
  for (const id of useSelectionStore.getState().selectedIds) {
    let cur: string | null = id;
    for (let guard = 0; cur && guard < 10_000; guard++) {
      const parent: string | null | undefined = layers[cur]?.parentId;
      if (parent === pageId) return cur;
      cur = parent ?? null;
    }
  }
  return null;
}

/**
 * Adds a section template to the page being looked at: right below the selected block, else at the end (the page's own
 * rules still hold: a navbar goes first, a footer last). One engine transaction, so one Ctrl+Z removes it.
 */
export function insertSectionBelowSelection(templateId: string): string | null {
  const template = templateById(templateId);
  const pageId = activePageRootId();
  if (!template || !pageId) return null;
  const after = template.place === "middle" ? selectedBlock(pageId) : null;
  let id: string | null = null;
  transaction(`Insert ${template.name}`, () => {
    id = insertSection(templateId, { pageId });
    if (!id || !after) return;
    const rest = getDocument().layers[pageId].children.filter((k) => k !== id);
    const at = rest.indexOf(after);
    if (at >= 0) documentCommands.moveLayer(id, pageId, at + 1);
  });
  if (id) popIn(id);
  return id;
}

/** The new section settles in with a short spring once the stage has drawn it. */
function popIn(id: string): void {
  let tries = 0;
  const unregister = defaultHost.register(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-element-id="${id}"]`);
    if (!el) {
      if (tries++ > 20) unregister();
      return;
    }
    unregister();
    const p = getActivePreset();
    springAnim(el, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], p.pop[0], p.pop[1]);
  });
}
