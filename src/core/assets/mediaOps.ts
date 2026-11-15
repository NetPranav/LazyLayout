/**
 * Inserting icons and stock photos (ROADMAP Phase 126): each goes into the asset store with where it came from and its
 * licence (`AssetEntry.source`), then onto the canvas. An icon becomes editable vectors (recolour it like any shape);
 * a photo an image layer, named and described after its title. The layers keep the asset they came from
 * (`asset.source`), so their licence can always be found.
 */

import type { AssetSource } from "../document/schema";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import { setLayerProps } from "../editing/editOps";
import { importFiles, placeAsVectors, placeImage } from "./assetImport";
import { iconSource, iconSvg, type IconNode, type StockPhoto } from "./mediaLibrary";

type At = Parameters<typeof placeImage>[1];

/** Records where an asset came from and its licence. */
export function setAssetSource(id: string, source: AssetSource): boolean {
  if (!getDocument().assets?.[id]) return false;
  documentCommands.mutate("Asset source", (d) => {
    const a = d.assets?.[id];
    if (a) a.source = source;
  });
  return true;
}

/** Puts an icon into the asset store (with its set's licence) and on the canvas as editable vectors. Returns the new layers. */
export async function insertIcon(name: string, node: IconNode, at?: At): Promise<string[]> {
  const svg = iconSvg(node);
  const [outcome] = await importFiles([new File([svg], `${name}.svg`, { type: "image/svg+xml" })]);
  if (!outcome?.entry) return [];
  setAssetSource(outcome.entry.id, iconSource(name));
  const ids = await placeAsVectors(getDocument().assets?.[outcome.entry.id] ?? outcome.entry, at);
  if (ids.length) setLayerProps(ids, { "asset.source": outcome.entry.id }, "Icon source");
  return ids;
}

/**
 * Puts a stock photo into the asset store (its bytes fetched from the provider, its licence and credit kept) and on
 * the canvas as an image layer. Returns the layer's id, or null when the picture couldn't be fetched.
 */
export async function insertPhoto(photo: StockPhoto, at?: At, fetchFn: typeof fetch = fetch): Promise<string | null> {
  let blob: Blob | null = null;
  for (const url of [photo.url, photo.thumbnail]) {
    try {
      const r = await fetchFn(url, { mode: "cors" });
      if (r.ok) {
        blob = await r.blob();
        break;
      }
    } catch {
      /* try the smaller one */
    }
  }
  if (!blob) return null;
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const ext = type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const [outcome] = await importFiles([new File([blob], `${photo.title.slice(0, 80).replace(/[\/:*?"<>|]+/g, " ").trim() || "Photo"}.${ext}`, { type })]);
  if (!outcome?.entry) return null;
  setAssetSource(outcome.entry.id, photo.source);
  const id = placeImage(getDocument().assets?.[outcome.entry.id] ?? outcome.entry, at);
  if (id) setLayerProps([id], { "asset.source": outcome.entry.id, "media.alt": photo.title }, "Photo source");
  return id;
}
