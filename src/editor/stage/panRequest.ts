import { create } from "zustand";

/**
 * The stage lays its artboard out itself (centred in the viewport, then moved by a pan offset that lives in the Stage),
 * so a camera action that wants a particular spot on screen (zoom to selection) asks for a pan here instead of through
 * the camera's x / y. Each request is a new object, so asking twice for the same pan still re-applies it.
 */
interface PanRequestState {
  req: { pan: { x: number; y: number } } | null;
}

export const usePanRequestStore = create<PanRequestState>(() => ({ req: null }));

export function requestStagePan(pan: { x: number; y: number }): void {
  usePanRequestStore.setState({ req: { pan } });
}

/** The pan the Stage is showing now, so a request can be worked out from where things are on screen. */
let currentPan = { x: 0, y: 0 };
export const reportStagePan = (pan: { x: number; y: number }): void => {
  currentPan = pan;
};
export const getStagePan = (): { x: number; y: number } => currentPan;

/**
 * The pan that puts the middle of the `ids` boxes at the middle of the stage's free area when the zoom goes from
 * `fromZoom` to `toZoom`, worked out from what is on screen (so it holds for any page, frame offset or panel width).
 * Null when the selection or the artboard isn't drawn.
 */
export function panToCentre(ids: readonly string[], fromZoom: number, toZoom: number, bottomInset: number): { x: number; y: number } | null {
  const view = document.querySelector<HTMLElement>('[data-testid="stage-viewport"]');
  const art = document.querySelector<HTMLElement>('[data-testid="stage-artboard"]');
  if (!view || !art || fromZoom <= 0) return null;
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const id of ids) {
    const el = art.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    if (!el) continue;
    const q = el.getBoundingClientRect();
    l = Math.min(l, q.left);
    t = Math.min(t, q.top);
    r = Math.max(r, q.right);
    b = Math.max(b, q.bottom);
  }
  if (!Number.isFinite(l)) return null;
  const a = art.getBoundingClientRect();
  const v = view.getBoundingClientRect();
  const ratio = toZoom / fromZoom;
  const pan = getStagePan();
  const baseX = a.left + a.width / 2 - pan.x; // the artboard's middle with no pan
  const baseY = a.top + a.height / 2 - pan.y;
  const selX = (l + r) / 2;
  const selY = (t + b) / 2;
  const targetX = v.left + v.width / 2;
  const targetY = v.top + (v.height - bottomInset) / 2;
  return {
    x: Math.round(targetX - baseX - (selX - (a.left + a.width / 2)) * ratio),
    y: Math.round(targetY - baseY - (selY - (a.top + a.height / 2)) * ratio),
  };
}
