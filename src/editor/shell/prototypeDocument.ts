import type { Layer } from "@/core/document/schema";
import { createLayer } from "@/core/document/factories";
import { getDefaultProps, type PropValue } from "@/core/document/registry";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { useProjectStore } from "@/core/store/useProjectStore";
import { setKeyframeAt } from "@/core/timeline/keyframeOps";
import { isAutoLayout, isGrid } from "@/core/editing/layoutOps";

/**
 * Checks whether the document is the initial untouched blank project that needs
 * prototype page seeding.
 */
export function isUntouchedSeed(layers: Record<string, Layer> | undefined | null): boolean {
  if (!layers) return true;
  const entries = Object.values(layers);
  if (entries.length === 0) return true;
  // Only a brand-new project: nothing but a page that has never been given a size. A seeded page has one in pixels, so a
  // page the designer emptied stays empty, after a reload too.
  if (entries.length !== 1) return false;
  const root = entries[0];
  return root.parentId === null && root.children.length === 0 && root.properties["frame.widthUnit"] === "%" && root.properties["frame.width"] === 100;
}

/**
 * A project saved by an earlier version: its page size may read 1440% (the size was written without its unit), and the
 * sample page's layers were placed by x and y without saying so, which the old stage assumed. Puts both right so the page
 * draws as it was designed. Does nothing to a project that is already right.
 */
export function upgradeSavedProject(): void {
  const layers = getDocument().layers;
  const root = Object.values(layers).find((l) => l.parentId === null);
  if (!root) return;
  // Only older builds kept the page size in `%`; newer ones write px, so this runs once and never touches later work.
  if (root.properties["frame.widthUnit"] !== "%" && root.properties["frame.heightUnit"] !== "%") return;
  const patches: Array<[string, Record<string, PropValue>]> = [];
  const w = root.properties["frame.width"];
  const h = root.properties["frame.height"];
  if (root.properties["frame.widthUnit"] === "%" && typeof w === "number" && w > 100) patches.push([root.id, { "frame.widthUnit": "px" }]);
  if (root.properties["frame.heightUnit"] === "%" && typeof h === "number" && h > 100) patches.push([root.id, { "frame.heightUnit": "px" }]);
  for (const id of ["hero", "features", "footer", "others", "headline", "subtitle", "button", "image", "input", "toggle", "divider", "background", "icon", "shape", "counter"]) {
    const l = layers[id];
    const parent = l?.parentId ? layers[l.parentId] : null;
    if (parent && (isAutoLayout(parent) || isGrid(parent))) continue; // the designer chose to lay these out
    if (l && l.properties.positioning !== "absolute" && typeof l.properties["frame.x"] === "number") patches.push([id, { positioning: "absolute" }]);
  }
  if (patches.length === 0) return;
  const tx = documentCommands.begin("Upgrade project");
  for (const [id, props] of patches) documentCommands.updateProps(id, props);
  tx.commit();
}

/** The sample page at the size of a real page, in the editor's light look. */
const SAMPLE_PAGE: Record<string, Record<string, PropValue>> = {
  hero: { "frame.width": 1440, "frame.height": 560, "appearance.background.color": "#FFFFFF" },
  features: { "frame.y": 560, "frame.width": 1440, "frame.height": 220, "appearance.background.color": "#F4F3EF" },
  footer: { "frame.y": 780, "frame.width": 1440, "frame.height": 120, "appearance.background.color": "#E7E6E1" },
  headline: { "frame.x": 120, "frame.y": 130, "frame.width": 720, "frame.height": 150, "typography.fontSize": 64, "typography.lineHeight": 1.1, "typography.color": "#22231E" },
  subtitle: { "frame.x": 120, "frame.y": 300, "frame.width": 640, "frame.height": 36, "typography.fontSize": 20, "typography.color": "#55554F" },
  button: { "frame.x": 120, "frame.y": 370, "frame.width": 180, "frame.height": 52, "appearance.background.color": "#22231E", "typography.color": "#FFFFFF", "typography.fontSize": 16 },
  image: { "frame.x": 900, "frame.y": 100, "frame.width": 420, "frame.height": 360, "appearance.background.color": "#E7E6E1", "appearance.radius": 8 },
};

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

  return seedDef.map((def) => {
    const layer = createLayer({
      id: def.id,
      archetype: def.archetype,
      name: def.name,
      parentId: def.parentId,
      children: def.children ?? [],
      properties: {
        ...getDefaultProps(def.archetype),
        ...def.properties,
        ...(typeof def.properties["frame.x"] === "number" ? { positioning: "absolute" as const } : {}),
        ...(SAMPLE_PAGE[def.id] ?? {}),
      },
    });
    // the catalog of other elements stays in the Layers panel, out of the sample page
    return def.id === "others" ? { ...layer, visible: false } : layer;
  });
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
  if (rootId) documentCommands.updateProps(rootId, { "frame.width": 1440, "frame.widthUnit": "px", "frame.height": 900, "frame.heightUnit": "px", "appearance.background.color": "#FFFFFF" });

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

  // Seed canonical initial keyframes for prototype elements
  try {
    setKeyframeAt("headline", "appearance.opacity", 0, { value: 0 });
    setKeyframeAt("headline", "appearance.opacity", 0.6, { value: 1 });
    setKeyframeAt("headline", "transform.y", 0, { value: 24 });
    setKeyframeAt("headline", "transform.y", 0.6, { value: 0 });

    setKeyframeAt("subtitle", "appearance.opacity", 0.3, { value: 0 });
    setKeyframeAt("subtitle", "appearance.opacity", 1.0, { value: 1 });
    setKeyframeAt("subtitle", "transform.y", 0.3, { value: 16 });
    setKeyframeAt("subtitle", "transform.y", 1.0, { value: 0 });

    setKeyframeAt("button", "appearance.opacity", 0.8, { value: 0 });
    setKeyframeAt("button", "appearance.opacity", 1.2, { value: 1 });
    setKeyframeAt("button", "transform.scale", 0.8, { value: 0.86, ease: "back-out" });
    setKeyframeAt("button", "transform.scale", 1.4, { value: 1.0 });

    setKeyframeAt("image", "appearance.opacity", 0.2, { value: 0 });
    setKeyframeAt("image", "appearance.opacity", 1.0, { value: 1 });
    setKeyframeAt("image", "transform.x", 0.2, { value: 40 });
    setKeyframeAt("image", "transform.x", 1.1, { value: 0 });
    setKeyframeAt("image", "transform.rotate", 0.2, { value: 4 });
    setKeyframeAt("image", "transform.rotate", 1.1, { value: 0 });
  } catch {
    // ignore
  }
}
