import type { Layer } from "@/core/document/schema";
import { createLayer } from "@/core/document/factories";
import { getDefaultProps, type PropValue } from "@/core/document/registry";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";

/**
 * Checks whether the document is the initial untouched blank project that needs
 * prototype page seeding.
 */
export function isUntouchedSeed(layers: Record<string, Layer> | undefined | null): boolean {
  if (!layers || Object.keys(layers).length === 0) return true;
  // If headline already exists, the project has already been seeded or edited
  if (layers["headline"]) return false;

  const entries = Object.values(layers);
  // If only root container exists with 0 children
  if (entries.length === 1 && (entries[0].id === "elem_canvas_root" || entries[0].id === "el_root_container")) {
    return entries[0].children.length === 0;
  }

  // Check if any layer is positioned
  let hasPositioned = false;
  entries.forEach((l) => {
    if (typeof l.properties["frame.x"] === "number" || typeof l.properties["frame.y"] === "number") {
      hasPositioned = true;
    }
  });

  return !hasPositioned;
}

/**
 * Returns the prototype page's 16 real layers matching the prototype names, order and values:
 * Hero (Headline, Subtitle, Get started, Hero image), Features, Footer, and Other elements.
 */
export function getPrototypeSeedLayers(rootContainerId: string | null = "elem_canvas_root"): Layer[] {
  // Ordered in internal document storage order (back-to-front).
  // When buildLayerTree or painter iterates in reverse, the top-most sections will be Hero, Features, Footer, Others.
  const seedDef: Array<{
    id: string;
    archetype: Layer["archetype"];
    name: string;
    parentId: string | null;
    children?: string[];
    properties: Record<string, PropValue>;
  }> = [
    // 1. Other elements group (lowest in tree)
    {
      id: "others",
      archetype: "container",
      name: "Other elements",
      parentId: rootContainerId,
      // Painter's order: back to front
      children: ["object3d", "counter", "shape", "icon", "background", "divider", "toggle", "input"],
      properties: {
        "frame.x": 0,
        "frame.y": 960,
        "frame.width": 600,
        "frame.height": 400,
        "appearance.background.color": "#1E1E1E",
        "appearance.opacity": 1,
      },
    },
    // Other elements children
    {
      id: "input",
      archetype: "input",
      name: "Email input",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 420,
        "frame.width": 240,
        "frame.height": 36,
        "appearance.radius": 6,
        "appearance.background.color": "#383838",
        "typography.fontSize": 13,
      },
    },
    {
      id: "toggle",
      archetype: "toggle",
      name: "Newsletter toggle",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 470,
        "frame.width": 44,
        "frame.height": 24,
        "appearance.radius": 12,
        "appearance.background.color": "#FFFFFF",
      },
    },
    {
      id: "divider",
      archetype: "divider",
      name: "Section divider",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 510,
        "frame.width": 528,
        "frame.height": 1,
        "appearance.background.color": "#444444",
      },
    },
    {
      id: "background",
      archetype: "background",
      name: "Page background",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 1440,
        "frame.height": 900,
        "appearance.background.color": "#1E1E1E",
      },
    },
    {
      id: "icon",
      archetype: "icon",
      name: "Menu icon",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 530,
        "frame.width": 24,
        "frame.height": 24,
        "appearance.background.color": "#FFFFFF",
      },
    },
    {
      id: "shape",
      archetype: "star",
      name: "Star shape",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 80,
        "frame.y": 530,
        "frame.width": 48,
        "frame.height": 48,
        "appearance.background.color": "#FFD60A",
        "shape.points": 5,
      },
    },
    {
      id: "counter",
      archetype: "text",
      name: "Visitors counter",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 160,
        "frame.y": 530,
        "frame.width": 120,
        "frame.height": 48,
        "content.text": "12,480",
        "typography.fontFamily": "Geist Mono",
        "typography.fontWeight": 600,
        "typography.fontSize": 32,
        "typography.lineHeight": 1,
        "appearance.background.color": "#FFFFFF",
      },
    },
    {
      id: "object3d",
      archetype: "object3D",
      name: "3D model",
      parentId: "others",
      children: [],
      properties: {
        "frame.x": 320,
        "frame.y": 520,
        "frame.width": 160,
        "frame.height": 160,
        "appearance.background.color": "#2C2C2C",
        "appearance.radius": 0,
      },
    },

    // 2. Footer section
    {
      id: "footer",
      archetype: "container",
      name: "Footer",
      parentId: rootContainerId,
      children: [],
      properties: {
        "frame.x": 0,
        "frame.y": 840,
        "frame.width": 600,
        "frame.height": 80,
        "appearance.background.color": "#1E1E1E",
        "appearance.opacity": 1,
      },
    },

    // 3. Features section
    {
      id: "features",
      archetype: "container",
      name: "Features",
      parentId: rootContainerId,
      children: [],
      properties: {
        "frame.x": 0,
        "frame.y": 420,
        "frame.width": 600,
        "frame.height": 380,
        "appearance.background.color": "#242424",
        "appearance.opacity": 1,
      },
    },

    // 4. Hero section (top-most in tree)
    {
      id: "hero",
      archetype: "container",
      name: "Hero",
      parentId: rootContainerId,
      // Painter's order: back to front (image in back, headline in front)
      children: ["image", "button", "subtitle", "headline"],
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 600,
        "frame.height": 380,
        "appearance.background.color": "#2C2C2C",
        "appearance.opacity": 1,
      },
    },
    // Hero children
    {
      id: "headline",
      archetype: "text",
      name: "Headline",
      parentId: "hero",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 70,
        "frame.width": 340,
        "frame.height": 82,
        "content.text": "Design it once. Ship it lazily.",
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 600,
        "typography.fontSize": 30,
        "typography.lineHeight": 1.05,
        "typography.letterSpacing": -0.03,
        "typography.textAlign": "left",
        "typography.color": "#FFFFFF",
        "appearance.opacity": 1,
      },
    },
    {
      id: "subtitle",
      archetype: "text",
      name: "Subtitle",
      parentId: "hero",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 160,
        "frame.width": 340,
        "frame.height": 36,
        "content.text": "Build pages visually and get production code out.",
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 400,
        "typography.fontSize": 13,
        "typography.lineHeight": 1.4,
        "typography.letterSpacing": 0,
        "typography.textAlign": "left",
        "typography.color": "#BFBFBF",
        "appearance.opacity": 1,
      },
    },
    {
      id: "button",
      archetype: "button",
      name: "Get started",
      parentId: "hero",
      children: [],
      properties: {
        "frame.x": 36,
        "frame.y": 226,
        "frame.width": 112,
        "frame.height": 34,
        "content.label": "Get started",
        "content.text": "Get started",
        "appearance.radius": 6,
        "appearance.background.color": "#FFFFFF",
        "appearance.opacity": 1,
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 500,
        "typography.fontSize": 15,
        "typography.lineHeight": 1.2,
        "typography.letterSpacing": 0,
        "typography.color": "#000000",
      },
    },
    {
      id: "image",
      archetype: "image",
      name: "Hero image",
      parentId: "hero",
      children: [],
      properties: {
        "frame.x": 420,
        "frame.y": 70,
        "frame.width": 150,
        "frame.height": 170,
        "appearance.radius": 0,
        "appearance.background.color": "#2C2C2C",
        "appearance.opacity": 1,
      },
    },
  ];

  return seedDef.map((def) =>
    createLayer({
      id: def.id,
      archetype: def.archetype,
      name: def.name,
      parentId: def.parentId,
      children: def.children ?? [],
      properties: {
        ...getDefaultProps(def.archetype),
        ...def.properties,
      },
    })
  );
}

/**
 * Seeds the document with the prototype page layers using engine commands.
 */
export function seedPrototypeDocument(): void {
  const doc = getDocument();
  const rootId = doc.layers["elem_canvas_root"]
    ? "elem_canvas_root"
    : doc.layers["el_root_container"]
    ? "el_root_container"
    : null;

  const seedLayers = getPrototypeSeedLayers(rootId);

  // Insert complete layers in one command transaction
  documentCommands.insertLayers(seedLayers, [], "Seed prototype document");
  // The page is as big as the desktop artboard, so aligning a layer to its page (centre, edges) means the page the designer sees.
  if (rootId) documentCommands.updateProps(rootId, { "frame.width": 1440, "frame.height": 900 });

  // Also ensure the active page rootElementId points to root container or hero
  const projectState = useProjectStore.getState();
  const activePage = projectState.pages[projectState.activePageId];
  if (activePage && !activePage.rootElementId) {
    useProjectStore.setState((s) => ({
      pages: {
        ...s.pages,
        [s.activePageId]: {
          ...activePage,
          rootElementId: rootId || "hero",
        },
      },
    }));
  }
}
