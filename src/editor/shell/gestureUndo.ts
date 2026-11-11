import { documentCommands } from "@/core/store/useDocumentStore";

/**
 * One undo step per drag. The inspector writes through `setLayerProps`, which opens (and commits) its own
 * transaction on every call, so the core's pointer-press coalescer never gets to join them. A press on a slider,
 * a scrub label or a colour area opens one outer transaction here; the writes made while the pointer is down join
 * it, and it commits on release (or cancel, or window blur). A press that changes nothing leaves no history entry.
 */
const DRAGGABLE = '[role="slider"], [data-scrub], [data-gesture]';

export function installGestureUndo(target: Window): () => void {
  let tx: ReturnType<typeof documentCommands.begin> | null = null;

  const end = () => {
    const open = tx;
    tx = null;
    open?.commit();
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || tx) return;
    const el = e.target instanceof Element ? e.target.closest(DRAGGABLE) : null;
    if (!el) return;
    const handle = documentCommands.begin(el.getAttribute("aria-label") ?? el.getAttribute("title")?.split(" Drag")[0] ?? "Adjust value");
    // someone else's transaction is already open (a canvas drag): leave it alone
    tx = handle.isOwner ? handle : null;
  };

  target.addEventListener("pointerdown", onDown, true);
  target.addEventListener("pointerup", end, true);
  target.addEventListener("pointercancel", end, true);
  target.addEventListener("blur", end);
  return () => {
    target.removeEventListener("pointerdown", onDown, true);
    target.removeEventListener("pointerup", end, true);
    target.removeEventListener("pointercancel", end, true);
    target.removeEventListener("blur", end);
    end();
  };
}
