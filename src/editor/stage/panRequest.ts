import { create } from "zustand";
import { useCameraStore } from "@/core/store/useCameraStore";
import { stepZoom } from "@/core/viewport/camera";

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

/** Where the mouse last was over the stage (client px), or null once it left. Zoom steps zoom around it. */
let stagePointer: { x: number; y: number } | null = null;
export const reportStagePointer = (point: { x: number; y: number } | null): void => {
  stagePointer = point;
};
export const getStagePointer = (): { x: number; y: number } | null => stagePointer;

/**
 * The pan that keeps the screen point `anchor` over the same spot of the page when the zoom goes from `fromZoom` to
 * `toZoom`, starting from `pan`. `base` is where the artboard's middle sits with no pan. All in client px.
 */
export function panKeeping(
  anchor: { x: number; y: number },
  base: { x: number; y: number },
  pan: { x: number; y: number },
  fromZoom: number,
  toZoom: number,
): { x: number; y: number } {
  if (fromZoom <= 0 || toZoom === fromZoom) return pan;
  const ratio = toZoom / fromZoom;
  return {
    x: anchor.x - base.x - (anchor.x - base.x - pan.x) * ratio,
    y: anchor.y - base.y - (anchor.y - base.y - pan.y) * ratio,
  };
}

/**
 * Where the artboard's middle sits on screen with no pan: its layout box (left / top as a percentage of the stage, then
 * translate(-50%, -50%)), which the pan and zoom transform do not move.
 */
export function stageArtboardBase(art: HTMLElement | null): { x: number; y: number } | null {
  const parent = art?.offsetParent;
  if (!art || !(parent instanceof HTMLElement)) return null;
  const p = parent.getBoundingClientRect();
  return { x: p.left + parent.clientLeft + art.offsetLeft, y: p.top + parent.clientTop + art.offsetTop };
}

/**
 * One zoom step (Cmd/Ctrl + / -, the zoom buttons) around the mouse when it is over the stage, otherwise around the
 * middle of the stage. Only the zoom changes on the camera (a camera x / y change re-centres the stage), and the pan
 * that keeps the anchor in place is asked for here.
 */
export function stepStageZoom(direction: 1 | -1): void {
  const cam = useCameraStore.getState();
  const from = cam.camera.zoom;
  const to = stepZoom(from, direction);
  if (to === from) return;
  const view = document.querySelector<HTMLElement>('[data-testid="stage-viewport"]');
  const base = stageArtboardBase(document.querySelector<HTMLElement>('[data-testid="stage-artboard"]'));
  cam.setCamera({ ...cam.camera, zoom: to });
  if (!view || !base) return;
  const v = view.getBoundingClientRect();
  const anchor = stagePointer ?? { x: v.left + v.width / 2, y: v.top + v.height / 2 };
  const pan = panKeeping(anchor, base, currentPan, from, to);
  currentPan = pan; // a second step before the stage re-renders starts from this one
  requestStagePan(pan);
}
