import { activePageRootId } from "@/editor/stage/activePage";
import { NEW_FRAME_FILL } from "@/editor/stage/frameFill";
import { insertSection } from "@/core/templates/templateOps";
import { getDocument } from "@/core/store/documentState";
import { documentCommands } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { getDefaultProps, type ArchetypeId, type PropValue } from "@/core/document/registry";

/** Basics cards that map one to one onto an engine archetype. */
const ARCHETYPE_BY_ITEM: Record<string, ArchetypeId> = {
  Text: "text",
  Button: "button",
  Image: "image",
  Divider: "divider",
  Input: "input",
  Toggle: "toggle",
  Icon: "icon",
  Background: "background",
  "3D object": "object3D",
  Counter: "text",
  Form: "form",
  Card: "container",
  Modal: "container",
  Tabs: "container",
  Accordion: "container",
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
          "appearance.background.color": NEW_FRAME_FILL,
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
  let defaultWidth = 160;
  let defaultHeight = 80;
  if (archetype === "button") {
    defaultWidth = 120;
    defaultHeight = 36;
  } else if (archetype === "text") {
    defaultWidth = name === "Counter" ? 140 : 200;
    defaultHeight = name === "Counter" ? 44 : 40;
  } else if (archetype === "image") {
    defaultWidth = 200;
    defaultHeight = 150;
  } else if (archetype === "object3D") {
    defaultWidth = 240;
    defaultHeight = 240;
  } else if (name === "Card" || name === "Tabs" || name === "Accordion") {
    defaultWidth = 320;
    defaultHeight = 200;
  } else if (name === "Modal" || name === "Form") {
    defaultWidth = 380;
    defaultHeight = 280;
  }

  const properties: Record<string, PropValue> = {
    ...getDefaultProps(archetype),
    positioning: "absolute",
    "frame.x": 50,
    "frame.y": 50,
    "frame.width": defaultWidth,
    "frame.height": defaultHeight,
    ...(archetype === "text"
      ? name === "Counter"
        ? { "content.text": "100", "content.counter.value": 100 }
        : { "content.text": "New Text" }
      : {}),
    ...(archetype === "container"
      ? { "appearance.background.color": "#ffffff", "appearance.radius": 12 }
      : {}),
  };
  const id = documentCommands.addLayer(
    { archetype, parentId, name, properties },
    `Insert ${name}`,
  );
  useSelectionStore.getState().select(id, "element");
}
