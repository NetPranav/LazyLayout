import { documentCommands, getDocument } from "../store/useDocumentStore";
import { transaction } from "../editing/editOps";
import { importFiles, placeImage } from "./assetImport";
import type { AssetEntry } from "../document/schema";

/**
 * Surfaces S1: a reference image. A picture to copy from, placed behind everything on its page, half transparent,
 * locked, and a helper (never exported, hidden in Preview: `isEditorOnlyLayer`). One undo step.
 */
export function placeReferenceEntry(entry: AssetEntry, at?: Parameters<typeof placeImage>[1]): string | null {
  return transaction("Place reference image", () => {
    const id = placeImage(entry, at);
    if (!id) return null;
    documentCommands.updateProps(id, { "render.role": "helper", "appearance.opacity": 0.5 });
    const layer = getDocument().layers[id];
    if (layer?.parentId) documentCommands.moveLayer(id, layer.parentId, 0, "Place reference image");
    documentCommands.setLayerFlags(id, { locked: true }, "Place reference image");
    return id;
  });
}

/** Places each picture file as a reference; returns the new layers. */
export async function placeReferenceFiles(files: File[], at?: Parameters<typeof placeImage>[1]): Promise<string[]> {
  const outcomes = await importFiles(files);
  const ids: string[] = [];
  outcomes.forEach((o, i) => {
    if (!o.entry || o.entry.kind === "font") return;
    const id = placeReferenceEntry(o.entry, at ? { ...at, x: at.x + i * 24, y: at.y + i * 24 } : undefined);
    if (id) ids.push(id);
  });
  return ids;
}

/** Asks for pictures (a file dialog) and places them as references. Browser only. */
export function pickReferenceImage(): void {
  if (typeof document === "undefined") return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) void placeReferenceFiles(files);
  };
  input.click();
}
