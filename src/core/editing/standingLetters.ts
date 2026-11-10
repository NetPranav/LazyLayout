/**
 * 3D standing letters and depth.
 *
 * Works on a letters group (made by "Split into letters", marked `group.role: "letters"`).
 *
 * 1. `standLetters`: tilts the group as a ground plane (perspective 900, rotateX 55deg, preserve-3d) and stands each
 *    letter upright on its base (rotateX -55deg about its bottom centre).
 * 2. `extrudeLetters`: gives every letter depth. Depth is a property of the letter (`text.depth`, `text.depthSteps`)
 *    that the renderer draws as copies behind the glyphs, so it follows the letter's colour, text, position and
 *    animations, and a word with depth is still one layer per letter (not nine).
 * 3. `removeDepth`: takes the depth away.
 *
 * Documents made before depth was a property hold depth as "<letter> depth" groups of copies; those are recognised by
 * their structure (not only their name), turned into the property on the next extrude, and removed by removeDepth.
 */

import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { transaction } from "./editOps";
import { useSelectionStore } from "../store/useSelectionStore";
import { isLettersGroup } from "./splitText";
import type { Layer } from "../document/schema";

export { mixWithBlack } from "../paint/shade";

/** The translateZ of each of `count` copies spread over `depth` px behind the text (the first nearest). */
export function computeDepthOffsets(depth: number, count = 8): number[] {
  if (count <= 0) return [];
  const safeDepth = Math.max(0, depth);
  const offsets: number[] = [];
  for (let i = 1; i <= count; i++) offsets.push(Math.round(((-i * safeDepth) / count) * 100) / 100);
  return offsets;
}

/** The letters group a layer is (or the one it is in), from the selection when no id is given. */
export function resolveLettersGroup(targetId?: string): Layer | null {
  const doc = getDocument();
  const id = targetId ?? useSelectionStore.getState().selectedIds[0];
  const layer = id ? doc.layers[id] : undefined;
  if (!layer) return null;
  if (isLettersGroup(layer, doc.layers)) return layer;
  const parent = layer.parentId ? doc.layers[layer.parentId] : undefined;
  return isLettersGroup(parent, doc.layers) ? parent! : null;
}

const lettersOf = (group: Layer, layers: Record<string, Layer>): string[] => group.children.filter((id) => layers[id]?.archetype === "text");

/**
 * A depth group made before depth was a property: a container whose every child is a text copy pushed back in Z and
 * not hit-testable. Its name alone is not enough: a group the user named "Sky depth" is not one.
 */
export function isLegacyDepthGroup(layer: Layer | undefined, layers: Record<string, Layer>): boolean {
  if (!layer || layer.archetype !== "container" || !layer.name.endsWith(" depth") || layer.children.length === 0) return false;
  return layer.children.every((id) => {
    const c = layers[id];
    const z = c?.properties["transform.translateZ"];
    return !!c && c.archetype === "text" && typeof z === "number" && z < 0 && c.properties["appearance.pointerEvents"] === "none";
  });
}

const legacyDepthGroups = (group: Layer, layers: Record<string, Layer>): string[] => group.children.filter((id) => isLegacyDepthGroup(layers[id], layers));

/** The group's depth in px (the first letter's), or null when it has none. */
export function getLettersDepth(groupId: string): number | null {
  const layers = getDocument().layers;
  const group = layers[groupId];
  if (!group) return null;
  for (const id of lettersOf(group, layers)) {
    const d = layers[id].properties["text.depth"];
    if (typeof d === "number" && d > 0) return Math.round(d);
  }
  for (const id of legacyDepthGroups(group, layers)) {
    const last = layers[layers[id].children[layers[id].children.length - 1]];
    const z = last?.properties["transform.translateZ"];
    if (typeof z === "number" && z < 0) return Math.round(Math.abs(z));
  }
  return null;
}

export function standLetters(targetId?: string): string | null {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return null;
  const groupId = groupLayer.id;
  transaction("Stand letters up", () => {
    // the group is the ground plane, tilted away; each letter stands up on its base
    documentCommands.updateProps(groupId, { "transform.perspective": 900, "transform.rotateX": 55, "transform.style3d": "preserve3d" });
    const layers = getDocument().layers;
    const group = layers[groupId];
    if (!group) return;
    for (const id of lettersOf(group, layers)) {
      documentCommands.updateProps(id, { "transform.rotateX": -55, "transform.origin": "bottom center" });
    }
  });
  return groupId;
}

function removeLegacyDepth(groupId: string): number {
  const layers = getDocument().layers;
  const group = layers[groupId];
  if (!group) return 0;
  const ids = legacyDepthGroups(group, layers);
  for (const id of ids) if (getDocument().layers[id]) documentCommands.removeLayer(id, "Remove depth");
  return ids.length;
}

/** Takes the depth off every letter of the group. Returns how many letters had some. */
export function removeDepth(targetId?: string): number {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return 0;
  let removed = 0;
  transaction("Remove letters depth", () => {
    const layers = getDocument().layers;
    for (const id of lettersOf(groupLayer, layers)) {
      const d = layers[id].properties["text.depth"];
      if (typeof d === "number" && d > 0) {
        documentCommands.updateProps(id, { "text.depth": undefined, "text.depthSteps": undefined });
        removed++;
      }
    }
    removed += removeLegacyDepth(groupLayer.id);
  });
  return removed;
}

/** Gives every letter of the group `depth` px of depth made of `count` copies. Returns how many letters got it. */
export function extrudeLetters(targetId?: string, depth = 24, count = 8): number {
  const groupLayer = resolveLettersGroup(targetId);
  if (!groupLayer) return 0;
  if (depth <= 0) return removeDepth(groupLayer.id);
  let letters = 0;
  transaction("Give letters depth", () => {
    removeLegacyDepth(groupLayer.id);
    const layers = getDocument().layers;
    const group = layers[groupLayer.id];
    if (!group) return;
    const steps = Math.max(1, Math.min(24, Math.round(count)));
    for (const id of lettersOf(group, layers)) {
      documentCommands.updateProps(id, { "text.depth": depth, "text.depthSteps": steps });
      letters++;
    }
  });
  return letters;
}
