import { activePageRootId } from "@/editor/stage/activePage";
import { insertSection } from "@/core/templates/templateOps";
import { getDocument } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
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

/** The cards that are whole sections: each one inserts the engine's section template. */
const SECTION_BY_ITEM: Record<string, string> = {
  "Hero split": "hero",
  "Hero centered": "hero",
  "Hero image": "hero",
  "Pricing table": "pricing",
  "Pricing cards": "pricing",
  Comparison: "pricing",
  "Footer simple": "footer",
  "Footer links": "footer",
  "Footer large": "footer",
  Navbar: "navbar",
};

export function canInsertCatalogItem(name: string): boolean {
  return name === "Frame" || name in ARCHETYPE_BY_ITEM || name in SECTION_BY_ITEM;
}

/** Creates the card's element in the document (one undo step) and selects it. */
export function insertCatalogItem(name: string): void {
  if (SECTION_BY_ITEM[name]) {
    // on the page being looked at (a project's page is its top-level layer, whether or not it has a route yet)
    const page = activePageRootId();
    insertSection(SECTION_BY_ITEM[name], page ? { pageId: page } : {});
    return;
  }
  if (name === "Frame") {
    // a frame on the page being looked at, in the middle of it
    const parent = activePageRootId();
    const root = parent ? getDocument().layers[parent] : undefined;
    const px = (v: unknown, fallback: number) => (typeof v === "number" && v > 100 ? v : fallback);
    const id = documentCommands.addLayer(
      {
        archetype: "container",
        parentId: parent,
        name: "Frame",
        properties: {
          ...getDefaultProps("container"),
          positioning: "absolute",
          "frame.x": Math.round((px(root?.properties["frame.width"], 1440) - 640) / 2),
          "frame.y": Math.round((px(root?.properties["frame.height"], 900) - 400) / 2),
          "frame.width": 640,
          "frame.height": 400,
          "appearance.background.color": "#ffffff",
        },
      },
      "Insert frame",
    );
    useSelectionStore.getState().select(id, "element");
    return;
  }
  const archetype = ARCHETYPE_BY_ITEM[name];
  if (!archetype) return;
  const parentId = activePageRootId();
  const defaultWidth = archetype === "button" ? 120 : archetype === "text" ? 200 : archetype === "image" ? 200 : 160;
  const defaultHeight = archetype === "button" ? 36 : archetype === "text" ? 40 : archetype === "image" ? 150 : 80;
  const properties = {
    ...getDefaultProps(archetype),
    positioning: "absolute",
    "frame.x": 50,
    "frame.y": 50,
    "frame.width": defaultWidth,
    "frame.height": defaultHeight,
    ...(archetype === "text" ? { "content.text": "New Text" } : {}),
  };
  const id = documentCommands.addLayer(
    { archetype, parentId, name, properties },
    `Insert ${name}`,
  );
  useSelectionStore.getState().select(id, "element");
}
