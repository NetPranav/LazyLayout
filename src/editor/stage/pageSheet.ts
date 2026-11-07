/**
 * Page sheet visibility logic (Task E):
 * The page sheet (white fill, border, shadow, size label, title strip) must be drawn
 * only when the page has at least one direct child that is NOT a frame (a loose shape/text/image
 * placed straight on the page).
 *
 * When every direct child of the page is a frame (archetype "container") and when the page is empty,
 * draw NO page sheet: the frames are the screens and sit on the grey canvas.
 */

export interface LayerLike {
  id?: string;
  archetype?: string;
  parentId?: string | null;
  children?: readonly string[];
}

export interface ElementLike {
  id?: string;
  type?: string;
}

/**
 * Determines whether the page sheet (white artboard surface, border, shadow, title bar)
 * should be drawn.
 */
export function shouldDrawPageSheet(
  layers: Record<string, LayerLike> | undefined | null,
  rootId?: string | null,
  elements?: Record<string, ElementLike> | null
): boolean {
  if (!layers || !rootId) {
    if (elements && Object.keys(elements).length > 0) {
      return Object.values(elements).some((el) => el.type !== "container");
    }
    return false;
  }

  const root = layers[rootId];
  if (!root) {
    if (elements && Object.keys(elements).length > 0) {
      return Object.values(elements).some((el) => el.type !== "container");
    }
    return false;
  }

  const childIds = root.children ?? [];
  if (childIds.length === 0) return false;

  // Check if at least one direct child is NOT an archetype "container" (i.e. loose shape/text/image)
  return childIds.some((childId) => {
    const child = layers[childId];
    return child && child.archetype !== "container";
  });
}
