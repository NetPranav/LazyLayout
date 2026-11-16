/**
 * The page the Phase 130 gate exports: every feature of Stage 3 (Design depth, Phases 103–129) on one page, made
 * with the same operations the editor's commands call. The export harness builds it for Next and Vite; the browser
 * gate (`tests/e2e/design-depth-export.spec.ts`) checks its plain HTML against the canvas at five widths.
 */
import { PNG } from "pngjs";
import { createDocumentFromLayers, createLayer } from "../../src/core/document/factories";
import type { Layer, MotionDocument } from "../../src/core/document/schema";
import { getDocument } from "../../src/core/store/documentState";
import { setDocument } from "../../src/core/store/documentState";
import { documentCommands } from "../../src/core/store/useDocumentStore";
import { makeBooleanGroup } from "../../src/core/editing/booleanGroups";
import { addModifier } from "../../src/core/editing/modifierOps";
import { attachToPath, fillShape } from "../../src/core/text/textOps";
import { arrange3d } from "../../src/core/editing/arrange3d";
import { setCamera, setSpace } from "../../src/core/editing/spaceOps";
import { frostedGlassProps } from "../../src/core/paint/effectsII";
import { makePage } from "../../src/core/pages/pageOps";

export const PAGE = "dd_page";

const at = (x: number, y: number, w: number, h: number) => ({ positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h });

/** A small picture (a colour ramp) as a data URL, so the page needs no asset store. */
function picture(): string {
  const p = new PNG({ width: 48, height: 32 });
  for (let y = 0; y < 32; y++) for (let x = 0; x < 48; x++) p.data.set([Math.round((x / 47) * 255), Math.round((y / 31) * 255), 160, 255], (y * 48 + x) * 4);
  return `data:image/png;base64,${PNG.sync.write(p).toString("base64")}`;
}

/** The layers, made on their own document; `buildDesignDepthDocument` makes the page a page of the site. */
export function buildDesignDepthLayers(): Record<string, Layer> {
  const L = (id: string, archetype: string, props: Record<string, unknown>, name = id, children: string[] = []) =>
    createLayer({ id, archetype: archetype as Layer["archetype"], parentId: PAGE, name, children, properties: props as never }) as Layer;
  const kids = (id: string, archetype: string, parentId: string, props: Record<string, unknown>) => createLayer({ id, archetype: archetype as Layer["archetype"], parentId, name: id, children: [], properties: props as never }) as Layer;
  const fills = (list: unknown[]) => JSON.stringify(list);
  const layers: Layer[] = [
    createLayer({ id: PAGE, archetype: "container", parentId: null, name: "Design depth", children: [], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 1500, "appearance.background.color": "#ffffff" } }) as Layer,
    // 103–108: booleans, corners
    L("dd_bool_a", "rectangle", { ...at(40, 40, 120, 90), "svg.fill": "#2563eb" }),
    L("dd_bool_b", "ellipse", { ...at(110, 70, 110, 110), "svg.fill": "#2563eb" }),
    L("dd_corner", "rectangle", { ...at(280, 40, 160, 120), "svg.fill": "#f59e0b", "shape.cornerRadius": 28, "shape.cornerStyle": "scoop" }),
    // 109–112: modifiers and a generator
    L("dd_mod", "star", { ...at(480, 40, 120, 120), "svg.fill": "#10b981" }),
    L("dd_gen", "rectangle", { ...at(640, 40, 200, 140), "svg.fill": "#e2e8f0" }),
    // 113–116: fill stacks, procedural, mesh and live fills
    L("dd_fills", "rectangle", { ...at(880, 40, 160, 120), "paint.fills": fills([{ type: "solid", color: "#0000ff", blend: "multiply", mask: { type: "linear", start: 0, end: 1, angle: 0 } }, { type: "conic", stops: [{ at: 0, color: "#ff3366" }, { at: 1, color: "#33ccff" }], center: { x: 0.5, y: 0.5 }, angle: 0 }]) }),
    L("dd_noise", "rectangle", { ...at(1080, 40, 140, 120), "paint.fills": fills([{ type: "noise", kind: "grain", scale: 2, contrast: 0.7, color: "#000000", seed: 11, opacity: 0.5 }, { type: "solid", color: "#fde68a" }]) }),
    L("dd_pattern", "rectangle", { ...at(1260, 40, 140, 120), "paint.fills": fills([{ type: "pattern", tile: { w: 20, h: 20, shapes: [{ d: "M10 4A6 6 0 1 1 10 16A6 6 0 1 1 10 4Z", color: "#ffffff" }] }, scale: 1, spacing: 4, offset: { x: 0, y: 0 }, rotation: 20 }, { type: "solid", color: "#7c3aed" }]) }),
    L("dd_mesh", "rectangle", { ...at(40, 220, 200, 140), "paint.fills": fills([{ type: "mesh", cols: 3, rows: 3, smooth: true, points: [{ x: 0, y: 0, color: "#ff7a59" }, { x: 0.5, y: 0, color: "#f59e0b" }, { x: 1, y: 0, color: "#ec4899" }, { x: 0, y: 0.5, color: "#10b981" }, { x: 0.35, y: 0.6, color: "#ffffff" }, { x: 1, y: 0.5, color: "#7c3aed" }, { x: 0, y: 1, color: "#0ea5e9" }, { x: 0.5, y: 1, color: "#4f46e5" }, { x: 1, y: 1, color: "#111827" }] }]) }),
    L("dd_badge", "container", { ...at(280, 220, 120, 60), "appearance.background.color": "#ffcc00" }, "Badge", ["dd_badge_text"]),
    kids("dd_badge_text", "text", "dd_badge", { "content.text": "SALE", "typography.fontSize": 20 }),
    L("dd_live", "ellipse", { ...at(420, 220, 160, 100), "paint.fills": fills([{ type: "live", source: "dd_badge" }]) }),
    // 117–120: strokes, variable widths, brushes
    L("dd_text_stroke", "text", { ...at(620, 220, 260, 60), "content.text": "Outlined", "typography.fontSize": 44, "typography.color": "#fde047", "paint.strokes": JSON.stringify([{ type: "solid", color: "#111111", weight: 3 }]) }),
    L("dd_strokes", "rectangle", { ...at(920, 220, 140, 100), "svg.fill": "#f1f5f9", "paint.strokes": JSON.stringify([{ type: "solid", color: "#ff0000", weight: 6, align: "outside" }, { type: "solid", color: "#0000ff", weight: 3, align: "inside" }]) }),
    L("dd_taper", "line", { ...at(1100, 250, 280, 24), "svg.stroke": "#111827", "svg.strokeWidth": 14, "stroke.widthProfile": JSON.stringify([{ t: 0, scale: 0 }, { t: 0.2, scale: 1 }, { t: 0.8, scale: 1 }, { t: 1, scale: 0 }]) }),
    L("dd_brush", "svgPath", { ...at(1100, 300, 280, 80), "svg.path": "M10 150 C60 20 140 20 190 150", "svg.fill": "none", "svg.stroke": "#be185d", "svg.strokeWidth": 10, "stroke.brush": JSON.stringify({ preset: "ink" }) }),
    // 121: glow, progressive blur, grain, frosted glass (over a striped backdrop)
    L("dd_glow", "container", { ...at(40, 420, 180, 110), "appearance.background.color": "#1e293b", "appearance.radius": 14, "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 0, blur: 18, spread: 2, color: "rgba(255, 210, 74, 0.8)", glow: true }]) }),
    L("dd_backdrop", "star", { ...at(260, 400, 420, 200), "svg.fill": "#2563eb", "svg.stroke": "#ec4899", "svg.strokeWidth": 10 }),
    L("dd_pblur", "container", { ...at(280, 420, 180, 160), "appearance.background.color": "rgba(255, 255, 255, 0.15)", "paint.effects": JSON.stringify([{ type: "backgroundBlur", blurType: "progressive", radius: 14, startRadius: 0, start: [0.5, 1], end: [0.5, 0] }]) }),
    L("dd_glass", "container", { ...at(490, 420, 180, 160), "appearance.radius": 16 }),
    L("dd_grain", "container", { ...at(720, 420, 160, 110), "appearance.background.color": "#e2e8f0", "paint.effects": JSON.stringify([{ type: "noise", mode: "mono", size: 0.75, density: 0.5, color: "rgba(0, 0, 0, 0.3)" }]) }),
    // 122: an image with a duotone
    L("dd_image", "image", { ...at(920, 420, 192, 128), "media.src": picture(), "media.objectFit": "fill", "media.look": JSON.stringify({ map: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ff5c8a" }] }) }),
    // 124–125: text on a path, in a shape, in columns, OpenType
    L("dd_ring", "ellipse", { ...at(40, 640, 220, 220), "svg.fill": "#f1f5f9" }),
    L("dd_tpath", "text", { ...at(0, 0, 100, 30), "content.text": "Text that runs around a circle", "typography.fontSize": 18 }),
    L("dd_blob", "ellipse", { ...at(300, 640, 300, 240), "svg.fill": "#ecfeff" }),
    L("dd_tshape", "text", { ...at(0, 0, 100, 30), "content.text": "A paragraph poured into an ellipse wraps on every line where the shape says, with no hand placed breaks at all, and keeps flowing as you edit it.", "typography.fontSize": 15, "typography.lineHeight": 22, "typography.lineHeightUnit": "px" }),
    L("dd_cols", "text", { ...at(640, 640, 360, 160), "text.sizing": "fixed", "content.text": "Columns of text flow from one to the next, the way a magazine sets a long article, with a gap between them that you choose.", "typography.fontSize": 14, "typography.columns": 2, "typography.columnGap": 24 }),
    L("dd_ot", "text", { ...at(1040, 640, 360, 60), "content.text": "Office 1/2 0123 ffi", "typography.fontSize": 26, "typography.smallCaps": true, "typography.fontFeatures": JSON.stringify({ tnum: true, frac: true }) }),
    // 127–129: a 2.5D space, arranged in a ring, with a depth camera
    L("dd_space", "container", { ...at(520, 920, 620, 420), "appearance.background.color": "#0f172a" }, "Space", ["dd_c1", "dd_c2", "dd_c3", "dd_c4", "dd_c5", "dd_c6"]),
    ...["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"].map((c, i) => kids(`dd_c${i + 1}`, "rectangle", "dd_space", { "frame.width": 110, "frame.height": 80, "svg.fill": c, "svg.strokeWidth": 0 })),
  ];
  for (const l of layers) if (l.parentId === PAGE) layers[0].children.push(l.id);
  setDocument(createDocumentFromLayers(layers));
  makeBooleanGroup(["dd_bool_a", "dd_bool_b"], "union");
  addModifier("dd_mod", "repeat", { mode: "circle", count: 5 });
  addModifier("dd_mod", "wiggle", { size: 6, detail: 4, seed: 3 });
  addModifier("dd_gen", "scatter", { count: 120, shape: "star", size: 6, seed: 2 });
  attachToPath("dd_tpath", "dd_ring", { start: 0.1 });
  fillShape("dd_tshape", "dd_blob", 10);
  documentCommands.updateProps("dd_glass", frostedGlassProps(getDocument().layers.dd_glass.properties));
  arrange3d("dd_space", "ring", { radius: 200, facing: "outward" });
  setSpace("dd_space", { perspective: 1100, viewX: -8, viewY: 12 });
  setCamera("dd_space", { x: 20, y: -10, z: 60, focus: 120, aperture: 0.8 });
  return getDocument().layers;
}

/** The whole document, the page made a page of the site (`/`). */
export function buildDesignDepthDocument(): MotionDocument {
  buildDesignDepthLayers();
  makePage(PAGE, "/");
  return getDocument();
}
