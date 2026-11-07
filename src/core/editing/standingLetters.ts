/**
 * ============================================================================
 * 3D STANDING LETTERS & THICKNESS EXTRUSION (Task F)
 * ============================================================================
 * Turns a letters group (created by "Split into letters") into upright 3D text
 * standing on a perspective ground plane, and gives each letter solid thickness
 * by generating stacked depth copies in CSS 3D space.
 *
 * 1. `standLetters`: Tilts the letters group container as a ground plane
 *    (perspective 900, rotateX 55deg, preserve-3d) and tilts each letter upright
 *    around its bottom base (rotateX -55deg, origin "bottom center").
 *
 * 2. `extrudeLetters`: For every letter, adds N (8) depth copies behind it
 *    with translateZ = -i * depth / N and 35% darker colour, organized in a
 *    collapsed "<letter> depth" sub-group so the letters remain clean and on top.
 *
 * 3. `removeDepth`: Cleanly removes all depth sub-groups and restores the letters.
 * ============================================================================
 */

import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { transaction } from "./editOps";
import { useLayersUiStore } from "../store/useLayersUiStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { isLettersGroup } from "./splitText";
import { getDefaultProps, type PropValue } from "../document/registry";
import { parseCss, toCssHex } from "../paint/color";
import type { Layer } from "../document/schema";

/**
 * Pure helper: Computes translateZ offsets for N depth copies behind a letter.
 * Each copy sits at `translateZ = -i * depth / count`.
 */
export function computeDepthOffsets(depth: number, count = 8): number[] {
  if (count <= 0) return [];
  const safeDepth = Math.max(0, depth);
  const offsets: number[] = [];
  for (let i = 1; i <= count; i++) {
    const raw = (-i * safeDepth) / count;
    offsets.push(Math.round(raw * 100) / 100);
  }
  return offsets;
}

/**
 * Pure helper: Mixes a CSS color string with black by the given weight (default 0.35 = 35% black).
 * Returns the mixed color formatted as a CSS hex string.
 */
export function mixWithBlack(colorStr: string, weight = 0.35): string {
  const w = Math.max(0, Math.min(1, weight));
  const parsed = parseCss(colorStr);
  if (!parsed) {
    // Fallback if unparseable
    return "#000000";
  }
  const r = parsed.r * (1 - w);
  const g = parsed.g * (1 - w);
  const b = parsed.b * (1 - w);
  return toCssHex({ r, g, b, a: parsed.a });
}

/** Finds the letters group layer given an id, or the current selection. */
export function resolveLettersGroup(targetId?: string): Layer | null {
  const doc = getDocument();
  const id = targetId ?? useSelectionStore.getState().selectedIds[0];
  if (!id) return null;
  const layer = doc.layers[id];
  if (!layer) return null;

  if (isLettersGroup(layer, doc.layers)) {
    return layer;
  }
  if (layer.parentId) {
    const parent = doc.layers[layer.parentId];
    if (isLettersGroup(parent, doc.layers)) {
      return parent;
    }
  }
  return null;
}

/** Measures the current extruded depth of a letters group, or null if flat. */
export function getLettersDepth(groupId: string): number | null {
  const group = getDocument().layers[groupId];
  if (!group) return null;
  const docLayers = getDocument().layers;

  for (const cid of group.children) {
    const child = docLayers[cid];
    if (child && child.archetype === "container" && child.name.endsWith(" depth") && child.children.length > 0) {
      const lastCopyId = child.children[child.children.length - 1];
      const lastCopy = docLayers[lastCopyId];
      if (lastCopy) {
        const tz = lastCopy.properties["transform.translateZ"];
        if (typeof tz === "number" && tz < 0) {
          return Math.round(Math.abs(tz));
        }
      }
    }
  }
  return null;
}

/**
 * Turns a letters group into a 3D stage tilted like a ground plane
 * and stands every letter layer upright on its base. One undo step.
 */
export function standLetters(targetId?: string): string | null {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return null;
  const groupId = groupLayer.id;

  transaction("Stand letters up", () => {
    // 1. Tilt the group container as a 3D ground plane
    documentCommands.updateProps(groupId, {
      "transform.perspective": 900,
      "transform.rotateX": 55,
      "transform.style3d": "preserve3d",
    });

    const currentDoc = getDocument();
    const curGroup = currentDoc.layers[groupId];
    if (!curGroup) return;

    // 2. Stand each letter upright around its base
    const letterIds = curGroup.children.filter((id) => currentDoc.layers[id]?.archetype === "text");
    for (const letterId of letterIds) {
      documentCommands.updateProps(letterId, {
        "transform.rotateX": -55,
        "transform.origin": "bottom center",
      });
    }

    // 3. Keep any existing depth groups and copies aligned in the same 3D coordinate space
    const depthGroupIds = curGroup.children.filter((id) => {
      const child = currentDoc.layers[id];
      return child && child.archetype === "container" && child.name.endsWith(" depth");
    });
    for (const dgId of depthGroupIds) {
      documentCommands.updateProps(dgId, {
        "transform.style3d": "preserve3d",
      });
      const dg = getDocument().layers[dgId];
      if (dg) {
        for (const copyId of dg.children) {
          documentCommands.updateProps(copyId, {
            "transform.rotateX": -55,
            "transform.origin": "bottom center",
          });
        }
      }
    }
  });

  return groupId;
}

/**
 * Internal cleanup: deletes all "<letter> depth" sub-groups in the letters group.
 */
function removeDepthInternal(groupId: string): number {
  const currentDoc = getDocument();
  const group = currentDoc.layers[groupId];
  if (!group) return 0;

  const depthGroupIds = group.children.filter((id) => {
    const child = currentDoc.layers[id];
    return child && child.archetype === "container" && child.name.endsWith(" depth");
  });

  for (const dgId of depthGroupIds) {
    if (getDocument().layers[dgId]) {
      documentCommands.removeLayer(dgId, "Remove depth");
    }
  }

  return depthGroupIds.length;
}

/**
 * Removes all 3D thickness copies and sub-groups from a letters group. One undo step.
 */
export function removeDepth(targetId?: string): number {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return 0;
  const groupId = groupLayer.id;

  let removed = 0;
  transaction("Remove letters depth", () => {
    removed = removeDepthInternal(groupId);
  });
  return removed;
}

/**
 * Gives each letter in a letters group 3D thickness by creating N (8) stacked
 * depth copies behind it, nested inside collapsed "<letter> depth" sub-groups.
 * One undo step.
 */
export function extrudeLetters(targetId?: string, depth = 24, count = 8): number {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return 0;
  const groupId = groupLayer.id;

  if (depth <= 0) {
    return removeDepth(groupId);
  }

  let totalCopies = 0;

  transaction("Give letters depth", () => {
    // 1. Remove previous depth sub-groups if any
    removeDepthInternal(groupId);

    const currentDoc = getDocument();
    const curGroup = currentDoc.layers[groupId];
    if (!curGroup) return;

    const letterIds = curGroup.children.filter((id) => currentDoc.layers[id]?.archetype === "text");
    if (letterIds.length === 0) return;

    const offsets = computeDepthOffsets(depth, count);

    for (const letterId of letterIds) {
      const letter = getDocument().layers[letterId];
      if (!letter) continue;

      const p = letter.properties;
      const rawColor = p["typography.color"];
      const letterColor = typeof rawColor === "string" ? rawColor : "#0f172a";
      const darkerColor = mixWithBlack(letterColor, 0.35);

      // Create collapsed depth sub-group: "<letter> depth"
      const depthGroupName = `${letter.name} depth`;
      const depthGroupId = documentCommands.addLayer(
        {
          archetype: "container",
          parentId: groupId,
          name: depthGroupName,
          properties: {
            ...getDefaultProps("container"),
            "frame.kind": "group",
            positioning: "absolute",
            "frame.x": 0,
            "frame.y": 0,
            "frame.width": p["frame.width"] ?? 0,
            "frame.height": p["frame.height"] ?? 0,
            "layout.padding": 0,
            "layout.gap": 0,
            "appearance.radius": 0,
            "appearance.background.color": "transparent",
            "appearance.pointerEvents": "none",
            "transform.style3d": "preserve3d",
          },
        },
        "Depth group",
      );

      // Reorder depth group immediately before the letter so the letter paints on top
      const parentAfterAdd = getDocument().layers[groupId];
      if (parentAfterAdd) {
        const letterIdx = parentAfterAdd.children.indexOf(letterId);
        const dgIdx = parentAfterAdd.children.indexOf(depthGroupId);
        if (letterIdx !== -1 && dgIdx !== -1 && dgIdx > letterIdx) {
          documentCommands.moveLayer(depthGroupId, groupId, letterIdx, "Order depth group");
        }
      }

      // Add N (8) depth copies behind the letter
      for (let i = 1; i <= count; i++) {
        const tz = offsets[i - 1];
        const copyProps: Record<string, PropValue> = {
          ...p,
          "content.text": p["content.text"] ?? letter.name,
          "typography.color": darkerColor,
          "transform.translateZ": tz,
          "appearance.pointerEvents": "none",
        };

        documentCommands.addLayer(
          {
            archetype: "text",
            parentId: depthGroupId,
            name: `${letter.name} depth ${i}`,
            properties: copyProps,
          },
          "Depth copy",
        );
        totalCopies++;
      }

      // Keep depth sub-group collapsed in the Layers panel
      useLayersUiStore.getState().setExpanded(depthGroupId, false);
    }
  });

  return totalCopies;
}
