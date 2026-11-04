import { addFrame } from "@/core/frames/frameCommands";
import { listFrames } from "@/core/frames/frames";
import { getDocument } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getDefaultProps, type ArchetypeId } from "@/core/document/registry";

/** Basics cards that map one to one onto an engine archetype. Everything else has no engine command yet. */
const ARCHETYPE_BY_ITEM: Record<string, ArchetypeId> = {
  Text: "text",
  Button: "button",
  Image: "image",
  Divider: "divider",
  Input: "input",
  Toggle: "toggle",
  Icon: "icon",
  Background: "background",
};

export function canInsertCatalogItem(name: string): boolean {
  return name === "Frame" || name in ARCHETYPE_BY_ITEM;
}

/** Creates the card's element in the document (one undo step) and selects it. */
export function insertCatalogItem(name: string): void {
  if (name === "Frame") {
    const id = addFrame();
    useSelectionStore.getState().select(id, "element");
    return;
  }
  const archetype = ARCHETYPE_BY_ITEM[name];
  if (!archetype) return;
  const layers = getDocument().layers;
  const active = useCanvasViewStore.getState().activeFrameId;
  const parentId = active && layers[active] ? active : (listFrames(layers)[0]?.id ?? null);
  const id = documentCommands.addLayer(
    { archetype, parentId, name, properties: getDefaultProps(archetype) },
    `Insert ${name}`,
  );
  useSelectionStore.getState().select(id, "element");
}
