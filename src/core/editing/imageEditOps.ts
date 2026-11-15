/**
 * Image adjustments and looks (ROADMAP Phase 122), each one undo step, on an image layer (`media.adjust`,
 * `media.look`) or on a layer's image fill (the paint's `adjust` and `look`). Only these settings change: the picture's
 * file (`media.src`, the paint's `src`) is never touched.
 */

import { getDocument } from "../store/documentState";
import { isIdentityAdjustment, sanitizeAdjustments, type ImageAdjustments } from "../paint/color";
import { imageEditOf, isIdentityLook, sanitizeLook, type ImageLook } from "../paint/imageLook";
import { fillsOf, setFills } from "../paint/paintOps";
import { updatePaint } from "../paint/paintEdits";
import { setLayerProps } from "./editOps";

export interface ImageEdit {
  adjust?: Partial<ImageAdjustments> | null;
  look?: ImageLook | null;
}

/** The adjustments and look an image layer or image fill has now. */
export function imageEditFor(id: string, fill?: number): { adjust: ImageAdjustments | null; look: ImageLook | null } {
  const l = getDocument().layers[id];
  if (!l) return { adjust: null, look: null };
  if (l.archetype === "image" && fill === undefined) {
    const e = imageEditOf(l.properties["media.adjust"], l.properties["media.look"]);
    return { adjust: e.adjust, look: e.look };
  }
  const p = fillsOf(id)[fill ?? firstImage(id)];
  return p && p.type === "image" ? { adjust: p.adjust ?? null, look: p.look ?? null } : { adjust: null, look: null };
}

const firstImage = (id: string) => Math.max(0, fillsOf(id).findIndex((p) => p.type === "image"));

/**
 * Sets the adjustments and/or look (a null clears it; absent keeps it) on each layer: an image layer's own, or the
 * image fill at `fill` (default: its first image fill). Returns how many layers changed.
 */
export function setImageEdit(ids: readonly string[], edit: ImageEdit, fill?: number): number {
  let changed = 0;
  const adjust = edit.adjust === undefined ? undefined : edit.adjust ? sanitizeAdjustments(edit.adjust) : null;
  const look = edit.look === undefined ? undefined : edit.look ? sanitizeLook(edit.look) : null;
  for (const id of ids) {
    const l = getDocument().layers[id];
    if (!l || l.locked === true) continue;
    if (l.archetype === "image" && fill === undefined) {
      const props: Record<string, string | null> = {};
      if (adjust !== undefined) props["media.adjust"] = adjust && !isIdentityAdjustment(adjust) ? JSON.stringify(adjust) : null;
      if (look !== undefined) props["media.look"] = look && (!isIdentityLook(look) || look.bypass) ? JSON.stringify(look) : null;
      changed += setLayerProps([id], props, "Adjust image");
      continue;
    }
    const fills = fillsOf(id);
    const i = fill ?? firstImage(id);
    if (fills[i]?.type !== "image") continue;
    changed += setFills(
      [id],
      updatePaint(fills, i, (p) => {
        if (p.type !== "image") return p;
        const next = { ...p };
        if (adjust !== undefined) {
          if (adjust && !isIdentityAdjustment(adjust)) next.adjust = adjust;
          else delete next.adjust;
        }
        if (look !== undefined) {
          if (look && (!isIdentityLook(look) || look.bypass)) next.look = look;
          else delete next.look;
        }
        return next;
      }),
    );
  }
  return changed;
}
