import type { Layer } from "@/core/document/schema";
import type { MotionSummary } from "@/core/timeline/model";
import { parsePathNodes } from "@/core/paths/pathLayer";
import { rootIdsOf } from "@/core/layers/layerTree";
import type { LayerItem } from "@/editor/shell/left-panel/types";

export function mapArchetypeToLayerType(archetype: string): LayerItem["type"] {
  switch (archetype) {
    case "container":
      return "container";
    case "text":
    case "svgText":
      return "text";
    case "button":
    case "fab":
      return "button";
    case "image":
    case "background":
      return "image";
    case "rectangle":
      return "box";
    case "ellipse":
      return "circle";
    case "polygon":
      return "poly";
    case "star":
    case "icon":
      return "star";
    case "svgPath":
      return "path";
    case "svgGroup":
    case "svgUse":
    case "effectSurface":
      return "shape";
    case "object3D":
    case "camera3D":
    case "light3D":
      return "object3d";
    case "badge":
      return "button";
    case "line":
    case "arrow":
    case "divider":
      return "line";
    case "input":
      return "input";
    case "toggle":
      return "toggle";
    case "frame":
    default:
      return "frame";
  }
}

/**
 * Converts a layer from the store into a LayerItem representation.
 * In LazyLayout / Figma conventions, child rows are presented front-most first,
 * which is the reverse of internal storage order (children[0] is back, children[N-1] is front).
 */
export function layerToItem(
  layerId: string,
  layers: Record<string, Layer>,
  motionMap?: Map<string, MotionSummary>,
  level = 0
): LayerItem {
  const layer = layers[layerId];
  if (!layer) {
    return {
      id: layerId,
      name: layerId,
      level,
    };
  }

  const motion = motionMap?.get(layerId);
  const hasMotion = motion ? motion.clips > 0 || motion.states > 0 : false;
  const kids = layer.children.filter((cid) => Boolean(layers[cid]));

  const children: LayerItem[] = [];
  for (let i = kids.length - 1; i >= 0; i--) {
    children.push(layerToItem(kids[i], layers, motionMap, level + 1));
  }

  return {
    id: layer.id,
    name: layer.name,
    type: mapArchetypeToLayerType(layer.archetype),
    level,
    hasChildren: kids.length > 0,
    ...(layer.archetype === "container" && layer.properties["layout.display"] === "grid"
      ? { layout: "grid" as const }
      : layer.archetype === "container" && layer.properties["layout.auto"] === true
        ? { layout: layer.properties["layout.flexDirection"] === "row" ? ("row" as const) : ("column" as const) }
        : {}),
    ...(layer.archetype === "svgPath" ? { pointCount: parsePathNodes(layer.properties["svg.nodes"])?.nodes.length } : {}),
    hasMotion,
    hidden: layer.visible === false,
    locked: layer.locked === true,
    parentId: layer.parentId,
    children,
  };
}

/**
 * Builds the complete tree of LayerItems from document layers.
 * Roots run back-to-front in storage, so we reverse to place the front-most root on top.
 */
export function buildLayerTree(
  layers: Record<string, Layer>,
  motionMap?: Map<string, MotionSummary>,
  filterRootId?: string | null
): LayerItem[] {
  if (filterRootId && layers[filterRootId]) {
    const rootLayer = layers[filterRootId];
    if (rootLayer.id === "elem_canvas_root" || rootLayer.id === "el_root_container") {
      const kids = rootLayer.children.filter((cid) => Boolean(layers[cid]));
      const items: LayerItem[] = [];
      for (let i = kids.length - 1; i >= 0; i--) {
        items.push(layerToItem(kids[i], layers, motionMap, 0));
      }
      return items;
    }
    return [layerToItem(filterRootId, layers, motionMap, 0)];
  }

  const roots = rootIdsOf(layers);
  const items: LayerItem[] = [];
  for (let i = roots.length - 1; i >= 0; i--) {
    const rootId = roots[i];
    if (rootId === "elem_canvas_root" || rootId === "el_root_container") {
      const kids = layers[rootId]?.children?.filter((cid) => Boolean(layers[cid])) ?? [];
      for (let j = kids.length - 1; j >= 0; j--) {
        items.push(layerToItem(kids[j], layers, motionMap, 0));
      }
    } else {
      items.push(layerToItem(rootId, layers, motionMap, 0));
    }
  }
  return items;
}
