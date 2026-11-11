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

/** The sample page: a warm off-white page (the user's design, so it stays fixed in every editor theme). */
const PAGE_BG = "#F9F7F2";
const INK = "#1C1B18";

/** The Hero image: a quiet two-tone composition (an arch and a circle on soft sand), inline so it needs no file or URL. */
const HERO_VISUAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ECE7DC"/><stop offset="1" stop-color="#D8D0BF"/></linearGradient></defs>' +
  '<rect width="600" height="600" fill="url(#g)"/>' +
  '<circle cx="390" cy="190" r="86" fill="#F9F7F2"/>' +
  '<path d="M150 600V340a150 150 0 0 1 300 0V600Z" fill="#1C1B18"/>' +
  "</svg>";
const HERO_VISUAL_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(HERO_VISUAL_SVG)}`;

/**
 * Returns the simple starting page: one Hero (Headline, Subtitle, Get started, Hero image).
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
    // Hero section: the one simple block the page opens with
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
        "frame.width": 1440,
        "frame.height": 900,
        "appearance.background.color": PAGE_BG,
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
        "frame.x": 96,
        "frame.y": 286,
        "frame.width": 600,
        "frame.height": 148,
        "content.text": "Design it once. Ship it lazily.",
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 600,
        "typography.fontSize": 68,
        "typography.lineHeight": 1.04,
        "typography.letterSpacing": -0.03,
        "typography.textAlign": "left",
        "typography.color": INK,
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
        "frame.x": 96,
        "frame.y": 462,
        "frame.width": 480,
        "frame.height": 60,
        "content.text": "Build pages visually and get production code out.",
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 400,
        "typography.fontSize": 20,
        "typography.lineHeight": 1.5,
        "typography.letterSpacing": 0,
        "typography.textAlign": "left",
        "typography.color": "#6B6860",
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
        "frame.x": 96,
        "frame.y": 562,
        "frame.width": 172,
        "frame.height": 52,
        "content.label": "Get started",
        "content.text": "Get started",
        "appearance.radius": 6,
        "appearance.background.color": INK,
        "appearance.opacity": 1,
        "typography.fontFamily": "Geist",
        "typography.fontWeight": 500,
        "typography.fontSize": 16,
        "typography.lineHeight": 1.2,
        "typography.letterSpacing": 0,
        "typography.color": PAGE_BG,
      },
    },
    {
      id: "image",
      archetype: "image",
      name: "Hero image",
      parentId: "hero",
      children: [],
      properties: {
        "frame.x": 744,
        "frame.y": 150,
        "frame.width": 600,
        "frame.height": 600,
        "media.src": HERO_VISUAL_SRC,
        "media.alt": "Abstract composition of an arch and a circle on sand",
        "appearance.radius": 8,
        "appearance.background.color": "#E4DDCF",
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
  if (rootId) documentCommands.updateProps(rootId, { "frame.width": 1440, "frame.widthUnit": "px", "frame.height": 900, "frame.heightUnit": "px", "appearance.background.color": PAGE_BG });

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
