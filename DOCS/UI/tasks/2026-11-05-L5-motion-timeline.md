# Task: Motion timeline and the motion model (`L5`), Wave 1

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md`. **L5 runs in parallel with six other lanes** in the same working tree. Only edit your lane paths.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes: read them, they are the rules), `DOCS/UI/PALETTE.md`, then the prototype lines listed below. Source of truth: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P). Copy its layout, values and motion exactly. P is 7137 lines: open it with line ranges, never read it whole.
- **What exists today:** a first rebuild of every area already exists in `src/editor` (committed). It was built from an older version of P. **Treat it as a draft: bring it to P's current look and behaviour.** Keep exports and props that other lanes or `EditorShell.tsx` use (check with grep before renaming anything); wire to the real engine stores where the draft already does (`src/core`, read-only), and keep that wiring.
- **Wave 0 is done** before you start: eight themes (Paper default, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom; no Plum), tokens and a block for your lane in `tokens.css` and `tailwind.css` (`/* === lane: L5 ... === */`), shared components already fixed to the field spec.

## What to build (from P)

Read: CSS `442-641` (bottom block, **the combined timeline**: one vertical scroller where the header column and the lanes are rows), `870-950` (label colours, mode tabs not yours, **timeline rows, headers and clips, footer**), `4863-4958` (label colours per layer type, **timeline mirrors Layers**: same order, a frame with children is a group track; shared spring panel transition: `--bh` and `--fw` full-width timeline); JS `3216-4145` (the whole model and behaviour: `FPS`, `DUR`, `PROPS`, `TL`, `M`, helpers, `bez`, snapping, ruler labels, Graph view, springs on things that just changed, playhead and playback, J/K/L shuttle, editing keys/tracks/clips, rescale, pointer work, drag helper, graph drags, value readout drag, hover line with time tooltip, **splitter drag + double click to 40%**, buttons, Layers badge hooks, drop zone, `U` reveal, hover/click triggers, keyboard `4359-4406`), `5069-5440` (**Timeline HTML**: header, rows, focus dimming 45%, footer with selection summary, mini-map and draggable window, zoom, frame rate, snapping, work area; model helpers for menus; **context menus on the timeline**: clip, keyframe, track, lane, ruler).

1. **Model first.** Create `src/editor/motion-model/` with `types.ts` and `index.ts` exactly per the contract below in your **first ten minutes** (L6 imports it while you work), then `model.ts` (pure functions), `store.ts` (zustand store behind `useMotionModel`/`motionActions`). Default composition = P's `TL`.
2. **Timeline panel** (`panels/timeline/`): replace the draft with P's: 40px header (timecode, transport with previous/next keyframe, Timeline/Graph tabs, tools, speed, full width, export, `...`), **264px resizable track column** (drag 200-420, double click 264, remembered), label-colour strips and tints (`--ll-label-1..6`, only here), groups mirroring Layers, clips (move, trim, split), keyframes (add, select, marquee, drag, duplicate, delete), ruler + work area + markers, **Graph view**, all five right-click menus, 28px footer with the mini-map, focus on the selected layer (others at 45%), drop zone ("Drag a layer here to animate it"), every shortcut of P `4359-4406`. Playhead spring, 60fps, reduced motion honoured.
3. The panel keeps the props/exports `EditorShell` uses (`TimelinePanel`). Full-width layout and the height splitter state belong to L8 (shell); expose what L8 needs (height value, a `fullWidth` prop) and list it in the handoff.
4. Selection: layers of the timeline are the same ids as the layers tree and use `useSelectionStore`.

## The motion model contract (shared by L5 and L6: both start now, so code against this text)

L5 **owns** `src/editor/motion-model/**` and must publish `types.ts` and `index.ts` exactly as below **in its first ten minutes**, before anything else. L6 only **imports** from `@/editor/motion-model` and never edits it. The model is a port of P's `TL`, `M`, `PROPS`, `EZ` and helpers (P lines 3216-3345: `FPS`, `DUR`, `PROPS`, `PORD`, `EZ`, `mkk`, `mkt`, `mkl`, `TL`, `M`, `bez`). Times are whole frames at the composition frame rate.

```ts
// src/editor/motion-model/types.ts
export type PropId = "opacity" | "x" | "y" | "scale" | "rot";
export type EaseName = "Linear" | "Ease in" | "Ease out" | "Ease in out" | "Back out" | "Anticipate" | "Spring" | "Custom";
export type Bezier = readonly [number, number, number, number];
export interface SpringParams { response: number; damping: number }
export interface Keyframe { id: string; t: number; v: number; ease: EaseName; bz?: Bezier; spring?: SpringParams }
export interface PropTrack { p: PropId; keys: Keyframe[] }
export interface Clip { s: number; e: number }
export type Trigger = "On load" | "On hover" | "On click" | "On scroll into view" | "While scrolling";
export type RepeatMode = "Once" | "Number" | "Forever";
export interface MotionLayer {
  id: string; lbl: number; gopen: boolean; clips: Clip[]; open: boolean; mute: boolean; lock: boolean; solo: boolean;
  trig: Trigger; ease: EaseName; rep: RepeatMode; rn: number; yoyo: boolean; ss: string; se: string;
  scrub: boolean; pin: boolean; sprev: number; stag: number; sfrom: "Start" | "End" | "Center"; tr: PropTrack[];
}
export interface Marker { id: string; t: number; name: string }
export interface Composition { fps: number; dur: number; layers: MotionLayer[]; markers: Marker[] }
export interface PropSpec { n: string; u: string; d: number; lo: number; hi: number }
```

```ts
// src/editor/motion-model/index.ts (what L6 may import; L5 implements every name)
export * from "./types";
export const PROPS: Record<PropId, PropSpec>;            // P PROPS
export const PORD: readonly PropId[];                      // P PORD
export const EZ: Record<string, Bezier>;                   // P EZ (named curves)
export const EZL: readonly EaseName[];                     // P EZL
export function bezierOf(k: Keyframe): Bezier;             // P bzOf
export function bez(x1: number, y1: number, x2: number, y2: number, u: number): number; // P bez
export function valueAt(layer: MotionLayer, p: PropId, t: number): number;               // value of a property at frame t
export function useMotionModel<T>(selector: (s: MotionState) => T): T; // zustand-style store hook
export interface MotionState {
  comp: Composition; playhead: number; playing: boolean;
  selectedKeys: Record<string, true>; selectedClip: number; fps: number;
}
export const motionActions: {
  setPlayhead(t: number): void;
  addKey(layerId: string, p: PropId, t: number, v?: number): string;      // returns the key id
  setKeyValue(keyId: string, v: number): void;
  setKeyTime(keyId: string, t: number): void;
  setKeyEase(keyId: string, ease: EaseName, bz?: Bezier, spring?: SpringParams): void;
  deleteKeys(ids: string[]): void;
  selectKeys(ids: string[], additive?: boolean): void;
  setLayer(layerId: string, patch: Partial<MotionLayer>): void;
  addProperty(layerId: string, p: PropId): void;
  removeProperty(layerId: string, p: PropId): void;
  applyPreset(layerId: string, preset: "Fade in" | "Slide up" | "Pop" | "Stagger" | string): void;
};
```

Layers in the model are keyed by the **same ids as the layers of the document/selection** (the ids of the layers tree: `headline`, `subtitle`, `button`, `image`, plus frames `hero`, `features`, `footer`, `others`), so the timeline and the inspector share the selection store (`useSelectionStore`). The default composition is P's `TL` (four layers, 60 fps, 300 frames). Persist nothing yet. L5 documents any addition to this API in its handoff; L6 lists anything it still needs under "Needs from other lanes".

## Lane paths (the only files you may edit)

- `src/editor/panels/timeline/**`
- `src/editor/motion-model/**` (new, you own it)
- `src/editor/design-system/demos/TimelineDemos.tsx` (new)

Tokens: add them only inside your lane block in `src/editor/styles/tokens.css` and `src/editor/styles/tailwind.css`, re-reading the file right before each edit. Never edit other shared files (`animations.css`, `globals.css`, `components/index.ts`, `design-system/DesignSystemPage.tsx`, `ComponentDemos.tsx`, `shell/EditorShell.tsx` belong to other lanes in this wave). A shared component (`Menu`, `Select`, `Button`, `NumberField`...) that needs a change is not yours: list it under "Needs from other lanes" and work around it with props or classes.

## Demos

Put every demo of what you built, with all its states, in `src/editor/design-system/demos/TimelineDemos.tsx` (create it; export one component per demo). Do not edit `DesignSystemPage.tsx` or `ComponentDemos.tsx`: Wave 2 wires your file into the page. Sample props only, never a store.

## Rules that matter here

Everything in `.claude/agents/ui-worker.md`, in particular: `ll:` prefix and variant order `ll:hover:`; no arbitrary values, hex, px or ms literals (tokens, or named constants in `motion/presets.ts`); React never owns classes or styles the motion engine writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on global classes; icons through `Icon`; no pills (radii 4/6/8); no glass; menus use the shared `Menu`; the field spec (28px, 11px mono values, prefixes inside); small targeted edits only, never rewrite or reformat whole files; no commits, no pushes, no `git add`/`stash`/`checkout`/`reset`.

## Done

1. **Compare, then fix.** For every state you build, open P and the app side by side in headless Playwright at 1440x900 (`executablePath`: the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `chrome-win64\chrome.exe`; P via `pathToFileURL`; the app at `http://localhost:3000/editor`, already running: never start `next dev` or `next build`). Measure boxes, fonts and colours of both (`getBoundingClientRect`, `getComputedStyle`) and fix until they match within 1px. Put a measured table in the handoff.
2. `npx tsc --noEmit` once at the end. Fix errors in your own files. List errors in other lanes' files without touching them. Do not run lint, build or e2e.
3. Screenshots of what you built, Paper and Dark, 1440, in `DOCS/UI/handoffs/screenshots/L5/`, prototype next to app.
4. Handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L5.md` from `TEMPLATE.md`: what you built, the real `tsc` output, the measured table, "Needs from other lanes", "Decisions", "Not done / blocked". Say what you did not verify. Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`.
5. Run every check in the foreground. **Never wait on a background task** (a worker that waits hangs). Finish when the handoff is written.

## Retry 1 (automatic review, 2026-11-05 02:35:59)

The review failed. Fix these first:

- FAIL: arbitrary values: src/editor/panels/timeline/TimelineTransport.tsx:93:      className="ll-ph ll-mh ll:h-11 ll:grid ll:grid-cols-[auto_1fr_auto] ll:items-center ll:gap-2 ll:px-3 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0 ll:min-w-0 ll:overflow-hidden"
- FAIL: raw requestAnimationFrame: src/editor/panels/timeline/TimelineLab.tsx:270:            Playhead needle is updated via the single requestAnimationFrame FrameScheduler loop (render phase) without React re-renders.
