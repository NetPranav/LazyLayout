# Task: Motion inspector and export (`L6`), Wave 1

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md`. **L6 runs in parallel with six other lanes** in the same working tree. Only edit your lane paths.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes: read them, they are the rules), `DOCS/UI/PALETTE.md`, then the prototype lines listed below. Source of truth: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P). Copy its layout, values and motion exactly. P is 7137 lines: open it with line ranges, never read it whole.
- **What exists today:** a first rebuild of every area already exists in `src/editor` (committed). It was built from an older version of P. **Treat it as a draft: bring it to P's current look and behaviour.** Keep exports and props that other lanes or `EditorShell.tsx` use (check with grep before renaming anything); wire to the real engine stores where the draft already does (`src/core`, read-only), and keep that wiring.
- **Wave 0 is done** before you start: eight themes (Paper default, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom; no Plum), tokens and a block for your lane in `tokens.css` and `tailwind.css` (`/* === lane: L6 ... === */`), shared components already fixed to the field spec.

## What to build (from P)

Read: CSS `845-869` (inspector accordion rows for motion and code), `928-953` (**the one slider**, **easing editor**), `642-675` (Motion and Code on the Design surface: same panel, hairlines, 32px rows, segmented control); JS `1898-1959` (the one slider: 2px track, filled part in the text colour, 6x14 thumb), `4146-4358` (**inspector: never empty**: nothing selected shows the composition, a layer shows its clip, keys show the easing editor; the Effect Controls style row: stopwatch, name, live value (drag to change), keyframe navigator, delete; the Test square), `5441-5634` (**easing editor**: 240px plot, Curve = bezier with two draggable handles and click-to-add points, Spring tab = the real spring over its settle, Save as preset, preview strip), `4407-4659` (**Motion export** panel: CSS, WAAPI, Framer Motion, GSAP code generated from the model; one channel per CSS property; syntax colouring with text tokens only). HTML `#ins-key` (`1438`).

1. **Composition** inspector (nothing selected): fps, duration, work area, defaults.
2. **Layer clip** inspector (a layer selected): Trigger (and scroll start/end, scrub, pin), Clip (delay, duration, easing select, "Split at playhead" button), Repeat (Once / Number / Forever, yoyo), Stagger (frame layers), **Properties** grouped, each with a stopwatch, name, value (drag to change), `◀ ◆ ▶` keyframe navigator, an easing chip, delete; **Add property**; presets.
3. **Keyframe** inspector (keys selected): the big **easing editor** (Curve and Spring tabs, 240px plot, multi-point curve, x1/y1/x2/y2 fields, easing select, Save as preset, preview strip with a small square travelling on the spring), the timing fields.
4. **Export panel:** the four flavours generated from the motion model.
5. All of it reads and writes the shared **motion model** (`@/editor/motion-model`, see the contract below; L5 implements it in parallel: until its files appear, write against the contract text and a local stub **outside** `motion-model/**`, and delete the stub when the real one lands). Replace the draft `KeyframeInspector` with the three states. Replace the sequencer bridge only if P has the matching UI; otherwise leave the bridge and say so.
6. The slider (P `928-937`) is a shared control: build it as `src/editor/panels/inspectors/Slider.tsx` for now and list it under "Needs from other lanes" so Wave 2 can promote it to `components/`.
Mount: `RightPanelConnected` (in `shell/`, not yours) renders `KeyframeInspector` today. Keep a default export object so it can render your inspector: export `MotionInspector` (chooses Composition / Layer / Keyframe by selection) from `panels/inspectors/index.ts` and say in the handoff how to mount it.

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

- `src/editor/panels/inspectors/**`
- `src/editor/panels/sequencer/**` (replace the bridge `TimelineSequencer.tsx` re-export)
- `src/editor/design-system/demos/MotionInspectorDemos.tsx` (new)

Tokens: add them only inside your lane block in `src/editor/styles/tokens.css` and `src/editor/styles/tailwind.css`, re-reading the file right before each edit. Never edit other shared files (`animations.css`, `globals.css`, `components/index.ts`, `design-system/DesignSystemPage.tsx`, `ComponentDemos.tsx`, `shell/EditorShell.tsx` belong to other lanes in this wave). A shared component (`Menu`, `Select`, `Button`, `NumberField`...) that needs a change is not yours: list it under "Needs from other lanes" and work around it with props or classes.

## Demos

Put every demo of what you built, with all its states, in `src/editor/design-system/demos/MotionInspectorDemos.tsx` (create it; export one component per demo). Do not edit `DesignSystemPage.tsx` or `ComponentDemos.tsx`: Wave 2 wires your file into the page. Sample props only, never a store.

## Rules that matter here

Everything in `.claude/agents/ui-worker.md`, in particular: `ll:` prefix and variant order `ll:hover:`; no arbitrary values, hex, px or ms literals (tokens, or named constants in `motion/presets.ts`); React never owns classes or styles the motion engine writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on global classes; icons through `Icon`; no pills (radii 4/6/8); no glass; menus use the shared `Menu`; the field spec (28px, 11px mono values, prefixes inside); small targeted edits only, never rewrite or reformat whole files; no commits, no pushes, no `git add`/`stash`/`checkout`/`reset`.

## Done

1. **Compare, then fix.** For every state you build, open P and the app side by side in headless Playwright at 1440x900 (`executablePath`: the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `chrome-win64\chrome.exe`; P via `pathToFileURL`; the app at `http://localhost:3000/editor`, already running: never start `next dev` or `next build`). Measure boxes, fonts and colours of both (`getBoundingClientRect`, `getComputedStyle`) and fix until they match within 1px. Put a measured table in the handoff.
2. `npx tsc --noEmit` once at the end. Fix errors in your own files. List errors in other lanes' files without touching them. Do not run lint, build or e2e.
3. Screenshots of what you built, Paper and Dark, 1440, in `DOCS/UI/handoffs/screenshots/L6/`, prototype next to app.
4. Handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L6.md` from `TEMPLATE.md`: what you built, the real `tsc` output, the measured table, "Needs from other lanes", "Decisions", "Not done / blocked". Say what you did not verify. Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`.
5. Run every check in the foreground. **Never wait on a background task** (a worker that waits hangs). Finish when the handoff is written.
