/**
 * Width profiles on strokes (ROADMAP Phase 119), each one undo step: save the profile a stroke has under a name, apply
 * a saved one, rename or delete one, and work out a calligraphic profile from a layer's own path. Saved profiles live
 * in the document (`widthProfiles`), so they travel with the file.
 */

import { createId } from "../ids";
import { getDocument } from "../store/documentState";
import { documentCommands } from "../store/useDocumentStore";
import type { MotionDocument } from "../document/schema";
import { isPropertyLegalFor } from "../document/properties";
import { parseWidthProfile, sanitizeProfile, type WidthPoint } from "../paths/strokes";
import { calligraphicProfile, MAX_SAVED_PROFILES, savedProfilesOf, storedPoints, type SavedWidthProfile } from "../paths/widthProfiles";
import { layerSpine } from "./layerOutline";
import { setStrokeSettings } from "../paint/paintOps";

type Doc = MotionDocument & { widthProfiles?: SavedWidthProfile[] };

export const savedProfiles = (): SavedWidthProfile[] => savedProfilesOf(getDocument() as Doc);

/** The width profile a layer's stroke has (null: uniform). */
export function profileOf(id: string): WidthPoint[] | null {
  const l = getDocument().layers[id];
  return l ? parseWidthProfile(l.properties["stroke.widthProfile"]) : null;
}

/** Saves `points` (or the profile of layer `fromId`) under `name`. Returns the new profile's id. */
export function saveWidthProfile(name: string, from: { points?: readonly Partial<WidthPoint>[]; layerId?: string }): string | null {
  const n = name.trim().slice(0, 60);
  const pts = from.points ? sanitizeProfile(from.points) : from.layerId ? profileOf(from.layerId) : null;
  const list = savedProfiles();
  if (!n || !pts || pts.length === 0 || list.length >= MAX_SAVED_PROFILES) return null;
  const id = createId("wp");
  documentCommands.mutate("Save width profile", (d) => {
    (d as Doc).widthProfiles = [...savedProfilesOf(d as Doc), { id, name: n, points: storedPoints(pts) }];
  });
  return id;
}

export function renameWidthProfile(id: string, name: string): boolean {
  const n = name.trim().slice(0, 60);
  if (!n || !savedProfiles().some((p) => p.id === id)) return false;
  documentCommands.mutate("Rename width profile", (d) => {
    (d as Doc).widthProfiles = savedProfilesOf(d as Doc).map((p) => (p.id === id ? { ...p, name: n } : p));
  });
  return true;
}

/** Deletes a saved profile; strokes that use its points keep them. */
export function removeWidthProfile(id: string): boolean {
  if (!savedProfiles().some((p) => p.id === id)) return false;
  documentCommands.mutate("Delete width profile", (d) => {
    const left = savedProfilesOf(d as Doc).filter((p) => p.id !== id);
    if (left.length) (d as Doc).widthProfiles = left;
    else delete (d as Doc).widthProfiles;
  });
  return true;
}

/** Gives the layers' strokes a saved profile. Returns how many changed. */
export function applyWidthProfile(ids: readonly string[], profileId: string): number {
  const p = savedProfiles().find((x) => x.id === profileId);
  return p ? setStrokeSettings(ids, { widthProfile: sanitizeProfile(p.points) }) : 0;
}

/** Gives each layer the calligraphic profile its own path draws with a nib at `angle` degrees. Returns how many changed. */
export function applyCalligraphic(ids: readonly string[], angle: number, thin = 0.15): number {
  const doc = getDocument();
  let changed = 0;
  for (const id of ids) {
    const l = doc.layers[id];
    if (!l || !isPropertyLegalFor("stroke.widthProfile", l.archetype)) continue;
    const spine = layerSpine(l, doc.layers);
    const pts = spine ? calligraphicProfile(spine, angle, thin) : null;
    if (pts) changed += setStrokeSettings([id], { widthProfile: pts });
  }
  return changed;
}
