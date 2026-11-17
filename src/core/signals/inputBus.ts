/**
 * Phase 132 — Unified Input Bus & Coordinate Spaces (`src/core/signals/inputBus.ts`).
 *
 * Centralises passive host listeners per preview/frame root, samples them once per
 * scheduler `input` tick into an immutable snapshot (Law 12), and resolves pointer
 * coordinates into `local` (`layer-local`), `parent`, `frame`, and `page` spaces in
 * `px`, `uv` (`0..1`), and `ndc` (`-1..1`) using measurement rectangles rather than
 * ad-hoc DOM reads inside evaluators.
 */
import type { POINTER_SPACES } from "../document/motion";

type PointerSpace = (typeof POINTER_SPACES)[number];
import type { FrameTask } from "../time/scheduler";
import type { Vec2 } from "../bindings/evaluate";
import {
  busFrame,
  distanceToRect,
  EDGE_TAU,
  insideRect,
  newBusState,
  signalsOf,
  unservedSignals,
  viewOf,
  type BusState,
  type InputSource,
} from "../bindings/inputBus";

export {
  busFrame,
  distanceToRect,
  EDGE_TAU,
  insideRect,
  newBusState,
  signalsOf,
  unservedSignals,
  viewOf,
  type BusState,
  type InputSource,
};

export type SignalCoordSpace = PointerSpace | "layer-local";
export type SignalCoordUnit = "px" | "uv" | "ndc";

export interface SpaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional clockwise rotation around rect centre in degrees. */
  rotationDeg?: number;
}

export interface MeasurementSpaces {
  page: { width: number; height: number };
  frame?: SpaceRect | null;
  parent?: SpaceRect | null;
  local?: SpaceRect | null;
}

/** Rotate `(px, py)` around `(cx, cy)` by `deg` degrees clockwise in page Y-down coordinates. */
function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): Vec2 {
  if (!deg) return [px, py];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/** Pick the reference rectangle for `space` from measured bounds, falling back safely to `page`. */
export function resolveSpaceRect(space: SignalCoordSpace, spaces: MeasurementSpaces): SpaceRect {
  if (space === "local" || space === "layer-local") {
    if (spaces.local) return spaces.local;
    if (spaces.parent) return spaces.parent;
    if (spaces.frame) return spaces.frame;
  } else if (space === "parent") {
    if (spaces.parent) return spaces.parent;
    if (spaces.frame) return spaces.frame;
  } else if (space === "frame") {
    if (spaces.frame) return spaces.frame;
  }
  return { x: 0, y: 0, width: spaces.page.width, height: spaces.page.height };
}

/**
 * Convert a point in page `px` into `space` (`local` / `parent` / `frame` / `page`)
 * and `unit` (`px` / `uv` / `ndc`). Handles rotated bounds and 0-size containers safely.
 */
export function convertPagePoint(
  pagePoint: Vec2,
  unit: SignalCoordUnit,
  space: SignalCoordSpace,
  spaces: MeasurementSpaces
): Vec2 {
  const rect = resolveSpaceRect(space, spaces);
  let [px, py] = pagePoint;
  if (rect.rotationDeg) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    [px, py] = rotatePoint(px, py, cx, cy, -rect.rotationDeg);
  }
  const localX = px - rect.x;
  const localY = py - rect.y;
  if (unit === "px") return [localX, localY];
  const u = rect.width > 0 ? localX / rect.width : 0;
  const v = rect.height > 0 ? localY / rect.height : 0;
  if (unit === "uv") return [u, v];
  return [u * 2 - 1, v * 2 - 1];
}

export interface KeyStateSnapshot {
  down: ReadonlySet<string>;
  lastPressed: string | null;
  focusedLayerId: string | null;
  focusVisible: boolean;
}

export interface OrientationSnapshot {
  alpha: number;
  beta: number;
  gamma: number;
  available: boolean;
}

export interface InputSnapshot {
  readonly frame: number;
  readonly timestampMs: number;
  readonly hidden: boolean;
  readonly pointer: { x: number; y: number; down: boolean; coarse: boolean; pressure: number; type: "mouse" | "pen" | "touch" } | null;
  readonly scroll: { y: number; max: number; viewport: number; wheelDeltaY: number };
  readonly pageSize: { width: number; height: number };
  readonly keys: KeyStateSnapshot;
  readonly orientation: OrientationSnapshot;
}

export interface HostEventTargetLike {
  addEventListener(type: string, listener: (event: unknown) => void, options?: AddEventListenerOptions | boolean): void;
  removeEventListener(type: string, listener: (event: unknown) => void, options?: AddEventListenerOptions | boolean): void;
}

export interface HostInputBusOptions {
  target: HostEventTargetLike;
  windowTarget?: HostEventTargetLike | null;
  /**
   * Where `visibilitychange` fires (the document, not the window). Optional; when absent and a global `document`
   * exists, that is used.
   */
  documentTarget?: HostEventTargetLike | null;
  scheduler?: { register(phase: "input", task: FrameTask): () => void };
  measurePageSize: () => { width: number; height: number };
  measureScroll: () => { y: number; max: number; viewport?: number };
  measureLayerRect?: (layerId: string) => SpaceRect | null;
  measureLayerBox?: (layerId: string) => { top: number; height: number } | null;
  measureParentRect?: (layerId: string) => SpaceRect | null;
  measureFrameRect?: (layerId?: string) => SpaceRect | null;
  pageClientOrigin?: () => { left: number; top: number; scaleX: number; scaleY: number };
  ownerLayerId?: string;
}

export interface HostInputBus {
  readonly inputSource: InputSource;
  readonly listenerCount: number;
  sample(nowMs?: number): InputSnapshot;
  snapshot(): InputSnapshot;
  dispose(): void;
}

interface PendingMutableState {
  pointer: { x: number; y: number; down: boolean; coarse: boolean; pressure: number; type: "mouse" | "pen" | "touch" } | null;
  wheelDeltaY: number;
  downKeys: Set<string>;
  lastPressedKey: string | null;
  focusedLayerId: string | null;
  focusVisible: boolean;
  hidden: boolean;
  orientation: OrientationSnapshot;
  sawKeyboardNav: boolean;
}

function normalizeCode(e: { code?: string; key?: string }): string {
  if (typeof e.code === "string" && e.code.length > 0) return e.code;
  if (typeof e.key === "string" && e.key.length > 0) return e.key;
  return "Unknown";
}

/**
 * Registers one passive listener set on the host root and latches inputs once per
 * scheduler `input` tick into an immutable `InputSnapshot`.
 */
export function createHostInputBus(options: HostInputBusOptions): HostInputBus {
  const pending: PendingMutableState = {
    pointer: null,
    wheelDeltaY: 0,
    downKeys: new Set<string>(),
    lastPressedKey: null,
    focusedLayerId: null,
    focusVisible: false,
    hidden: false,
    orientation: { alpha: 0, beta: 0, gamma: 0, available: false },
    sawKeyboardNav: false,
  };

  let frameCounter = 0;
  let currentSnapshot: InputSnapshot = {
    frame: 0,
    timestampMs: 0,
    hidden: false,
    pointer: null,
    scroll: { y: 0, max: 0, viewport: 0, wheelDeltaY: 0 },
    pageSize: options.measurePageSize(),
    keys: { down: new Set<string>(), lastPressed: null, focusedLayerId: null, focusVisible: false },
    orientation: { alpha: 0, beta: 0, gamma: 0, available: false },
  };

  const toPagePoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const origin = options.pageClientOrigin?.();
    if (!origin) return { x: clientX, y: clientY };
    const sx = origin.scaleX || 1;
    const sy = origin.scaleY || 1;
    return { x: (clientX - origin.left) / sx, y: (clientY - origin.top) / sy };
  };

  const registrations: { target: HostEventTargetLike; type: string; listener: (ev: unknown) => void; passive: boolean }[] = [];

  const listen = (target: HostEventTargetLike, type: string, listener: (ev: unknown) => void) => {
    target.addEventListener(type, listener, { passive: true });
    registrations.push({ target, type, listener, passive: true });
  };

  const onPointer = (ev: unknown) => {
    const e = ev as { clientX?: number; clientY?: number; buttons?: number; pressure?: number; pointerType?: string };
    const pt = toPagePoint(e.clientX ?? 0, e.clientY ?? 0);
    const pType: "mouse" | "pen" | "touch" = e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse";
    pending.pointer = {
      x: pt.x,
      y: pt.y,
      down: (e.buttons ?? 0) !== 0,
      coarse: pType === "touch",
      pressure: e.pressure ?? 0,
      type: pType,
    };
    if (e.buttons) pending.sawKeyboardNav = false;
  };

  const onWheel = (ev: unknown) => {
    const e = ev as { deltaY?: number };
    pending.wheelDeltaY += Number.isFinite(e.deltaY) ? Number(e.deltaY) : 0;
  };

  const onKeyDown = (ev: unknown) => {
    const e = ev as { code?: string; key?: string };
    const code = normalizeCode(e);
    pending.downKeys.add(code);
    pending.lastPressedKey = code;
    pending.sawKeyboardNav = true;
    if (pending.focusedLayerId) pending.focusVisible = true;
  };

  const onKeyUp = (ev: unknown) => {
    const e = ev as { code?: string; key?: string };
    pending.downKeys.delete(normalizeCode(e));
  };

  const onFocusIn = (ev: unknown) => {
    const e = ev as { target?: { getAttribute?: (k: string) => string | null; closest?: (sel: string) => { getAttribute?: (k: string) => string | null } | null } | null };
    const node = e.target?.closest?.("[data-element-id]") ?? e.target;
    const layerId = node?.getAttribute?.("data-element-id") ?? null;
    pending.focusedLayerId = layerId;
    pending.focusVisible = pending.sawKeyboardNav && layerId !== null;
  };

  const onFocusOut = () => {
    pending.focusedLayerId = null;
    pending.focusVisible = false;
  };

  /** Keys released while the page wasn't listening (alt-tab, a hidden tab) would otherwise stay "held". */
  const releaseAllKeys = () => {
    pending.downKeys.clear();
  };

  const onVisibility = () => {
    if (typeof document !== "undefined" && typeof document.hidden === "boolean") {
      pending.hidden = document.hidden;
      if (document.hidden) releaseAllKeys();
    }
  };

  const onOrientation = (ev: unknown) => {
    const e = ev as { alpha?: number | null; beta?: number | null; gamma?: number | null };
    pending.orientation = {
      alpha: e.alpha ?? 0,
      beta: e.beta ?? 0,
      gamma: e.gamma ?? 0,
      available: true,
    };
  };

  listen(options.target, "pointermove", onPointer);
  listen(options.target, "pointerdown", onPointer);
  listen(options.target, "pointerup", onPointer);
  listen(options.target, "pointercancel", onPointer);
  listen(options.target, "wheel", onWheel);
  listen(options.target, "keydown", onKeyDown);
  listen(options.target, "keyup", onKeyUp);
  listen(options.target, "focusin", onFocusIn);
  listen(options.target, "focusout", onFocusOut);

  if (options.windowTarget) {
    listen(options.windowTarget, "blur", releaseAllKeys);
    listen(options.windowTarget, "deviceorientation", onOrientation);
  }
  // `visibilitychange` fires on the document, never on the window (it used to be listened for on the window, so
  // `hidden` never changed). Scroll and size are measured each sample, so no listeners are needed for them.
  const docTarget =
    options.documentTarget ?? (typeof document !== "undefined" ? (document as unknown as HostEventTargetLike) : null);
  if (docTarget) listen(docTarget, "visibilitychange", onVisibility);

  const sample = (nowMs = 0): InputSnapshot => {
    frameCounter += 1;
    const sc = options.measureScroll();
    const snap: InputSnapshot = {
      frame: frameCounter,
      timestampMs: nowMs,
      hidden: pending.hidden,
      pointer: pending.pointer ? { ...pending.pointer } : null,
      scroll: { y: sc.y, max: sc.max, viewport: sc.viewport ?? 0, wheelDeltaY: pending.wheelDeltaY },
      pageSize: options.measurePageSize(),
      keys: {
        down: new Set(pending.downKeys),
        lastPressed: pending.lastPressedKey,
        focusedLayerId: pending.focusedLayerId,
        focusVisible: pending.focusVisible,
      },
      orientation: { ...pending.orientation },
    };
    pending.wheelDeltaY = 0;
    currentSnapshot = snap;
    return snap;
  };

  const unregisterTask = options.scheduler ? options.scheduler.register("input", (info) => sample(info.now)) : null;

  const inputSource: InputSource = {
    pointer: () => currentSnapshot.pointer,
    pageSize: () => currentSnapshot.pageSize,
    scroll: () => currentSnapshot.scroll,
    layerRect: options.measureLayerRect ? (id) => options.measureLayerRect!(id) : undefined,
    layerBox: options.measureLayerBox ? (id) => options.measureLayerBox!(id) : undefined,
    parentRect: options.measureParentRect ? (id) => options.measureParentRect!(id) : undefined,
    frameRect: options.measureFrameRect ? (id) => options.measureFrameRect!(id) : undefined,
    ownerLayerId: options.ownerLayerId,
    keysDown: () => currentSnapshot.keys.down,
    lastPressedKey: () => currentSnapshot.keys.lastPressed,
    focusedLayerId: () => currentSnapshot.keys.focusedLayerId,
    focusVisible: () => currentSnapshot.keys.focusVisible,
  };

  return {
    inputSource,
    get listenerCount() {
      return registrations.length;
    },
    sample,
    snapshot: () => currentSnapshot,
    dispose() {
      unregisterTask?.();
      for (const r of registrations) r.target.removeEventListener(r.type, r.listener, { passive: r.passive });
      registrations.length = 0;
    },
  };
}
