/**
 * The pages list closes when a press lands outside it. A press inside the row menu or the settings popover (separate
 * surfaces drawn beside it) is inside the manager, so those presses are noted here and the close that follows is skipped.
 */
let pressedInLayer = false;

/** Starts noting presses; returns the stop function. */
export function trackLayerPresses(): () => void {
  const mark = (e: MouseEvent) => {
    pressedInLayer = e.target instanceof Element && e.target.closest(".ll-menu") !== null;
    setTimeout(() => {
      pressedInLayer = false;
    }, 0);
  };
  document.addEventListener("mousedown", mark, true);
  return () => document.removeEventListener("mousedown", mark, true);
}

/** True once when the press that is closing the list landed in one of those surfaces. */
export function takeLayerPress(): boolean {
  const v = pressedInLayer;
  pressedInLayer = false;
  return v;
}
