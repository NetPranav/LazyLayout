/**
 * ============================================================================
 * 3D OUTLINER TREE MODEL (ROADMAP_3D Phase 3D-021)
 * ============================================================================
 * Pure data model for the 3D Outliner (scene hierarchy).
 *
 * Rules:
 *   - Inside a scene, collections group objects; objects in no collection sit at scene root.
 *   - Objects nest by `parent` (`parentId`).
 *   - An object's data block (mesh/light/camera/armature), material slots, and modifiers
 *     are leaf children.
 *   - Hiding a collection hides what is in it for display (effective flags).
 *   - Pure: no DOM, no React, no external state.
 * ============================================================================
 */

import type { MotionDocument, Object3d } from "../../document/schema";

export type OutlinerNodeKind =
  | "collection"
  | "object"
  | "data"
  | "material"
  | "modifier";

export interface OutlinerFlags {
  visible: boolean;
  selectable: boolean;
  renderVisible: boolean;
}

export interface OutlinerNode {
  id: string;
  kind: OutlinerNodeKind;
  label: string;
  icon: string;
  children: OutlinerNode[];
  flags: OutlinerFlags;
  storedFlags?: OutlinerFlags;
  depth: number;
  objectId?: string;
  dataId?: string;
  slot?: number;
}

function objectIcon(type: string | undefined): string {
  switch (type) {
    case "mesh":
      return "mesh";
    case "light":
      return "light";
    case "camera":
      return "camera";
    case "armature":
      return "armature";
    case "empty":
      return "empty";
    default:
      return "object";
  }
}

function dataBlockLabel(doc: MotionDocument, type: string | undefined, dataId: string): string {
  switch (type) {
    case "mesh":
      return doc.meshes?.[dataId]?.name ?? dataId;
    case "light":
      return doc.lights?.[dataId]?.name ?? dataId;
    case "camera":
      return doc.cameras?.[dataId]?.name ?? dataId;
    case "armature":
      return doc.armatures?.[dataId]?.name ?? dataId;
    default:
      return dataId;
  }
}

/**
 * Builds the hierarchical outliner tree for a given 3D scene in the document.
 */
export function buildOutliner(doc: MotionDocument, sceneId: string): OutlinerNode[] {
  const scene = doc.scenes?.[sceneId];
  if (!scene) return [];

  const collections = scene.collections ?? {};
  const sceneObjectIds = scene.objects ?? [];
  const sceneObjectSet = new Set(sceneObjectIds);

  // Map of child objects by parentId
  const objectsByParent = new Map<string, Object3d[]>();
  // Map of top-level objects by collectionId (or null for root objects)
  const objectsByCollection = new Map<string | null, Object3d[]>();

  for (const objId of sceneObjectIds) {
    const obj = doc.objects?.[objId];
    if (!obj) continue;

    const parentId = obj.parentId;
    if (parentId && sceneObjectSet.has(parentId)) {
      const list = objectsByParent.get(parentId) ?? [];
      list.push(obj);
      objectsByParent.set(parentId, list);
    } else {
      const colId = obj.collection && collections[obj.collection] ? obj.collection : null;
      const list = objectsByCollection.get(colId) ?? [];
      list.push(obj);
      objectsByCollection.set(colId, list);
    }
  }

  // Helper to build object node and its subtree
  function buildObjectNode(obj: Object3d, depth: number, parentFlags: OutlinerFlags): OutlinerNode {
    const storedVisible = obj.visible ?? true;
    const storedSelectable = obj.selectable ?? true;
    const storedRenderVisible = obj.renderVisible ?? true;

    const flags: OutlinerFlags = {
      visible: parentFlags.visible && storedVisible,
      selectable: parentFlags.selectable && storedSelectable,
      renderVisible: parentFlags.renderVisible && storedRenderVisible,
    };

    const storedFlags: OutlinerFlags = {
      visible: storedVisible,
      selectable: storedSelectable,
      renderVisible: storedRenderVisible,
    };

    const children: OutlinerNode[] = [];
    const childDepth = depth + 1;

    // 1. Data block child (mesh/light/camera/armature)
    if (obj.dataId) {
      children.push({
        id: obj.dataId,
        kind: "data",
        label: dataBlockLabel(doc, obj.type, obj.dataId),
        icon: objectIcon(obj.type),
        children: [],
        flags: { ...flags },
        depth: childDepth,
        objectId: obj.id,
        dataId: obj.dataId,
      });
    }

    // 2. Material slots
    const matSlots = obj.materialSlots ?? obj.materials ?? [];
    matSlots.forEach((matId, slotIdx) => {
      const mat = doc.materials?.[matId];
      children.push({
        id: matId,
        kind: "material",
        label: mat?.name ?? matId,
        icon: "material",
        children: [],
        flags: { ...flags },
        depth: childDepth,
        objectId: obj.id,
        dataId: matId,
        slot: slotIdx,
      });
    });

    // 3. Modifiers (read defensively)
    const rawModifiers = (obj as Record<string, unknown>).modifiers;
    if (Array.isArray(rawModifiers)) {
      rawModifiers.forEach((mod, idx) => {
        const modObj = mod as Record<string, unknown>;
        const modId = (typeof modObj.id === "string" ? modObj.id : `${obj.id}_mod_${idx}`);
        const modLabel =
          (typeof modObj.name === "string" ? modObj.name : null) ??
          (typeof modObj.type === "string" ? modObj.type : null) ??
          `Modifier ${idx + 1}`;

        children.push({
          id: modId,
          kind: "modifier",
          label: modLabel,
          icon: "modifier",
          children: [],
          flags: { ...flags },
          depth: childDepth,
          objectId: obj.id,
        });
      });
    }

    // 4. Nested child objects
    const childObjects = objectsByParent.get(obj.id) ?? [];
    for (const childObj of childObjects) {
      children.push(buildObjectNode(childObj, childDepth, flags));
    }

    return {
      id: obj.id,
      kind: "object",
      label: obj.name ?? obj.id,
      icon: objectIcon(obj.type),
      children,
      flags,
      storedFlags,
      depth,
      objectId: obj.id,
    };
  }

  // Map of child collections by parent collection ID
  const collectionsByParent = new Map<string | null, string[]>();
  for (const [colId, col] of Object.entries(collections)) {
    const p = col.parent && collections[col.parent] ? col.parent : null;
    const list = collectionsByParent.get(p) ?? [];
    list.push(colId);
    collectionsByParent.set(p, list);
  }

  // Helper to build collection node and its subtree
  function buildCollectionNode(
    colId: string,
    depth: number,
    parentFlags: OutlinerFlags
  ): OutlinerNode {
    const col = collections[colId];
    const storedVisible = col?.visible ?? true;
    const storedSelectable = col?.selectable ?? true;
    const storedRenderVisible = col?.renderVisible ?? true;

    const flags: OutlinerFlags = {
      visible: parentFlags.visible && storedVisible,
      selectable: parentFlags.selectable && storedSelectable,
      renderVisible: parentFlags.renderVisible && storedRenderVisible,
    };

    const storedFlags: OutlinerFlags = {
      visible: storedVisible,
      selectable: storedSelectable,
      renderVisible: storedRenderVisible,
    };

    const children: OutlinerNode[] = [];
    const childDepth = depth + 1;

    // Sub-collections
    const childColIds = collectionsByParent.get(colId) ?? [];
    for (const childColId of childColIds) {
      children.push(buildCollectionNode(childColId, childDepth, flags));
    }

    // Objects in this collection
    const colObjects = objectsByCollection.get(colId) ?? [];
    for (const obj of colObjects) {
      children.push(buildObjectNode(obj, childDepth, flags));
    }

    return {
      id: colId,
      kind: "collection",
      label: col?.name ?? colId,
      icon: "collection",
      children,
      flags,
      storedFlags,
      depth,
    };
  }

  const rootNodes: OutlinerNode[] = [];
  const rootFlags: OutlinerFlags = { visible: true, selectable: true, renderVisible: true };

  // 1. Root collections
  const rootColIds = collectionsByParent.get(null) ?? [];
  for (const colId of rootColIds) {
    rootNodes.push(buildCollectionNode(colId, 0, rootFlags));
  }

  // 2. Root objects (objects not in any valid collection)
  const rootObjects = objectsByCollection.get(null) ?? [];
  for (const obj of rootObjects) {
    rootNodes.push(buildObjectNode(obj, 0, rootFlags));
  }

  return rootNodes;
}

/**
 * Flattens visible rows based on which parent nodes are expanded.
 */
export function flattenVisible(
  tree: OutlinerNode[],
  expandedIds: Iterable<string>
): OutlinerNode[] {
  const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds);
  const result: OutlinerNode[] = [];

  function visit(nodes: OutlinerNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) {
        visit(node.children);
      }
    }
  }

  visit(tree);
  return result;
}

/**
 * Finds a node anywhere in the tree by its ID.
 */
export function findNode(tree: OutlinerNode[], id: string): OutlinerNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns the path of OutlinerNode elements from the root down to the target node.
 * Returns null if the target node is not found in the tree.
 */
export function pathTo(tree: OutlinerNode[], id: string): OutlinerNode[] | null {
  for (const node of tree) {
    if (node.id === id) {
      return [node];
    }
    if (node.children.length > 0) {
      const sub = pathTo(node.children, id);
      if (sub) {
        return [node, ...sub];
      }
    }
  }
  return null;
}

/**
 * Returns the array of node IDs along the path from root to the target node.
 */
export function pathIdsTo(tree: OutlinerNode[], id: string): string[] | null {
  const path = pathTo(tree, id);
  return path ? path.map((n) => n.id) : null;
}
