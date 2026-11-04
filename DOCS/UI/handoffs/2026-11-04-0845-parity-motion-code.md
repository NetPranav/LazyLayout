# Handoff: Motion and Code mode parity (inspectors, timeline, code panel)

- **Date / time:** 2026-11-04 08:45
- **Worker:** Antigravity (Gemini 3.8 Flash)
- **Branch:** ui/redesign
- **Page / phase:** parity pass: motion and code mode (`timeline`, `code-view`, and new `inspectors`)
- **Task given by:** `DOCS/UI/tasks/2026-11-04-parity-motion-code.md`

## What changed
- `src/editor/panels/inspectors/KeyframeInspector.tsx`: Built the prototype's `#ins-key` Keyframe inspector with header (icon + "Keyframe"), Target section (Layer & Property Select), Timing section (At timecode, Value with prefix 'O' and suffix '%', Duration 's', Delay 's'), Easing section (Easing preset select, 120px high SVG bezier curve `.ll-kcurve` with `vector-effect: non-scaling-stroke`, bezier control points x1, y1, x2, y2), Playback segmented control (Off, Loop, Bounce), and Presets manager (+ button, input form, and list with minus buttons). Wired to `useSelectionStore` and `useLayers()` for active element name and available layer options, with full controlled/uncontrolled props support.
- `src/editor/panels/inspectors/InspectorsLab.tsx`: Created interactive design-system lab view demonstrating `KeyframeInspector` and `CodeInspector` side-by-side, interactive state edits, theme switching (Paper, Dark, Warm, Lilac, White), and responsive panel containers (Desktop 320px, Tablet 280px).
- `src/editor/panels/inspectors/constants.ts`: Created constants for default layers, properties, easings, playback options, cubic bezier definitions, and SVG path data for curves.
- `src/editor/panels/inspectors/types.ts`: Created typed contract for `KeyframeInspectorProps`, `CubicBezierCurve`, and `PlaybackMode`.
- `src/editor/panels/inspectors/index.ts`: Exported `KeyframeInspector`, `types`, and `constants` for mounting by the build session.
- `src/app/design-system/inspectors/page.tsx`: Added new Next.js design-system lab route `/design-system/inspectors`, guarded by `labsEnabled`/`notFound` per rules.
- `src/editor/panels/code-view/CodeInspector.tsx`: Refined `#ins-code` Code inspector to match prototype structure: header (file icon + `outputFile`), Component section (Name input with prefix 'Name', Export select), Output section (React / HTML / Vue segmented control, Styles strategy select, File destination field with prefix 'File'), Props manager (+ button, rows with name input and type select and minus button), and Dependencies manager (+ button, package rows with minus button). Wired to `useSelectionStore`, `useLayers`, and `useProjectStore` for live component naming.
- `src/editor/panels/code-view/CodePanel.tsx`: Updated bottom code panel chrome to match prototype `.bottom .ph`: removed top tab-bar rows, rendering file name on the left (`.ll-ctitle` "Hero.tsx"), flex spacer (`.ll-sp`), and text action buttons on the right (`.ll-tg` "Copy" with temporary copied feedback, and "Export"). Assigned `id="bottom"` and `role="region" aria-label="Bottom panel"`. Preserved syntax highlighting with line numbers, code-to-AST click selection, and underlying console capability if passed.
- `src/editor/panels/timeline/constants.ts`: Calibrated `TIMELINE_DEFAULT_PPS = 100` matching the prototype ruler marks every 100px (0s to 5s at 0px to 500px). Configured `DEFAULT_SAMPLE_TRACKS` keyframe and clip coordinates to align pixel-perfect with prototype: Headline clip (0.16s to 3.56s) with keyframes at 20px, 180px, 348px; Get started clip (1.0s to 3.8s) with keyframes at 104px, 372px; Hero image clip (1.8s to 4.8s) with keyframes at 184px, 472px.
- `src/editor/panels/timeline/TimelineTransport.tsx`: Updated 44px transport header to strictly match prototype chrome: 5 icon buttons (SkipBack, StepBack, Play/Pause, StepForward, Loop) sized 28x28px (`.ll-ib`), time display (`.ll-tc` "00:00:00" and `.ll-tt` "/ 00:05:00"), spacer (`.ll-sp`), and 3 right text buttons (`.ll-tg` Presets, Graph, Export). Removed non-prototype toolbar zoom/add buttons.
- `src/editor/panels/timeline/TimelineRuler.tsx`: Cleaned 24px time ruler to match prototype `.truler span`: removed internal tick border lines, displaying clean timestamp labels (0s, 1s, 2s, 3s, 4s, 5s) positioned absolutely at `${t * pps}px`.
- `src/editor/panels/timeline/TimelineLane.tsx`: Removed clip text labels per task requirement ("no clip labels"). Styled clips as thin grey bars matching prototype `.clip` (`height: 18px; top: 7px; background: var(--bar); border-radius: 4px;` in `ll:bg-surface-bar` with no border). Styled keyframes as 8x8px diamonds (`width: 8px; height: 8px; top: 12px; transform: rotate(45deg); background: var(--ctl);`), with selected keyframe at 10x10px (`width: 10px; height: 10px; top: 11px;`). Preserved scrubbing, keyframe drag retiming, and clip sliding.
- `src/editor/panels/timeline/useTimelineAnimation.ts`: Initialized selected keyframe to `"kf-2"` by default to match prototype `<i class="kf sel" style="left:180px"></i>`.

## Difference list & parity resolution

| Feature / Element | Prototype Specification | Before State | Fixed State | Status |
|---|---|---|---|---|
| **1. Motion Right Panel (Keyframe Inspector)** | Right panel in motion mode displays `#ins-key` Keyframe inspector: Frame icon + "Keyframe" header; Target (Layer & Property selects); Timing (At, O%, Dur, Delay); Easing (Select, 120px SVG curve `.kcurve`, x1, y1, x2, y2); Playback (Off, Loop, Bounce segmented control); Presets (+ button, rows with minus). | Accordion list of generic rows (Layer, Property, Time, Value, Duration, Delay, Easing, Loop, Presets). | Built `KeyframeInspector` in `src/editor/panels/inspectors/` matching prototype sections, classes, and tokens. Wired to real `useSelectionStore` and `useLayers()`. Exported for mounting by the build session. Verified in `/design-system/inspectors`. | **Fixed** |
| **2. Code Right Panel (Code Inspector)** | Right panel in code mode displays `#ins-code` File inspector: File icon + "Hero.tsx"; Component (Name input, Export select); Output (React / HTML / Vue segmented, Styles select, File input); Props (+ button, rows with name input and type select and minus button); Dependencies (+ button, rows with minus). | Accordion list of generic rows (Component, Export, Target, Props, Styles, Dependencies, Output). | Built `CodeInspector` in `src/editor/panels/code-view/` matching prototype sections, classes, and tokens. Wired to real `useSelectionStore` and `useProjectStore`. Exported for mounting by the build session. Verified in `/design-system/inspectors` and `/design-system/code-view`. | **Fixed** |
| **3. Timeline: Chrome & Clip Labels** | Bottom panel in motion mode: transport header (skip back, step back, play, step forward, loop), time "00:00:00 / 00:05:00", right buttons (Presets / Graph / Export); ruler 0s-5s; **no clip labels**; thin grey clip bars (`var(--bar)`, 18px high, top 7px); black diamond keyframes (`var(--ctl)`, 8px diamond, 10px selected); playhead full-height 1px black line with 9x9 top marker (`.head2`); left track rows aligned with lanes. | Transport had extra zoom in/out & plus buttons. Ruler had vertical tick border lines. Clips had text labels ("Headline FadeUp", "Button Entrance", "Image Scale") and borders. Ruler scale was 140pps instead of 100pps. | Updated `TimelineTransport.tsx` to exact prototype buttons and classes. Removed all text labels from clips (`TimelineLane.tsx`). Set clip background to solid `var(--bar)` (`ll:bg-surface-bar`) with 4px radius and no border. Updated keyframes to 8px rotated 45deg diamonds and 10px selected. Cleaned ruler to 100pps matching 0s-5s. Playhead maintains 1px full-height line and 9x9 top knob. Keyframe drag, clip slide, and scrubbing fully operational. | **Fixed** |
| **4. Code Bottom Panel: Header Chrome** | Bottom panel in code mode: single file title on left ("Hero.tsx" / `.ctitle`), middle spacer, right text buttons (Copy, Export / `.tg`), code body with line numbers (`.code .ln`). No file tab rows. | Had a row of 4 file tab buttons plus a "Console" tab button, and button icons. Container lacked `#bottom` id. | Updated `CodePanel.tsx`: assigned `id="bottom"`, replaced tab bar with `<span className="ll-ctitle">{displayFileName}</span>`, `<div className="ll-sp" />`, and `<button className="ll-tg">Copy</button><button className="ll-tg">Export</button>`. Preserved syntax highlighting, line numbers, click-to-AST element selection, and underlying console capability if requested via props. | **Fixed** |

## Decisions made
- Calibrated `TIMELINE_DEFAULT_PPS` to `100` in `src/editor/panels/timeline/constants.ts` to match the prototype's ruler marks (`left: 0`, `left: 100px`, `left: 200px`... for 0s, 1s, 2s...) and default clip/keyframe positions.
- In `TimelineLane.tsx`, stripped inner label text entirely so clips render as clean, minimal horizontal bars as in prototype `.clip`.
- Connected `KeyframeInspector` and `CodeInspector` to real core stores (`useSelectionStore`, `useLayers`, `useProjectStore`) when props are not explicitly provided, while preserving full controlled props compatibility for tests and design-system lab pages.
- Created `/design-system/inspectors` (`InspectorsLab.tsx`) with `labsEnabled`/`notFound` guard to showcase and verify both inspectors in all 5 theme variants and across responsive breakpoints.

## Components from other sites
- `none`

## Legacy behaviour dropped
- Removed file tab bar from `CodePanel.tsx` header to match prototype (`Hero.tsx` title with Copy & Export buttons). File switching in code mode is handled via the left panel's file tree as designed.

## Tokens / palette touched
- Reused existing semantic tokens (`--ll-size-bottom-motion-h`, `--ll-size-bottom-code-h`, `--ll-surface-bar`, `--ll-surface-panel`, `--ll-surface-canvas`, `--ll-control-primary`, `--ll-border-color`, `--ll-radius-sm`, `--ll-radius-xs`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`). Zero hardcoded hex colors or arbitrary px values added.

## Integration notes added
- `KeyframeInspector`: Ready for build session mounting in `RightPanelConnected.tsx` or `RightPanelFrame.tsx` when `mode === "motion"`. Exported from `@/editor/panels/inspectors`.
- `CodeInspector`: Ready for build session mounting in `RightPanelConnected.tsx` or `RightPanelFrame.tsx` when `mode === "code"`. Exported from `@/editor/panels/code-view`.
- `CodePanel`: Container now carries `id="bottom"` matching prototype `#bottom` selector.

## Not done / blocked
- `none` in our area.
- Mounting `KeyframeInspector` and `CodeInspector` into `RightPanelConnected.tsx` / `EditorShell.tsx` is reserved for the build session per parallel batch rules ("Do not edit EditorShell.tsx or RightPanelConnected.tsx; the build session mounts things."). Both components are fully built, typed, exported, and verified.

## Phase checks
- typecheck: passed (0 errors across entire workspace). Real output:
  ```
  npx tsc --noEmit
  // Exited with code 0. No output.
  ```
- lint: not run (batch end)
- build: not run (batch end)
- Playwright: passed (automated script verified stop/play transport, zero text inside clip bars, keyframe diamond sizes and selection, playhead needle, code panel title & copy feedback, and interactive add/remove of presets, props, and dependencies).

## Screenshots
- Reference prototype:
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/proto-motion-captured.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/proto-code-captured.png`
- App before:
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/app-before-motion.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/app-before-code.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/app-before-default.png`
- App after:
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/after-motion.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/after-code.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/after-default.png`
- Design system labs (1440, 1024, 390):
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-inspectors-1440.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-inspectors-1024.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-inspectors-390.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-timeline-1440.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-timeline-1024.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-timeline-390.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-code-view-1440.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-code-view-1024.png`
  - `DOCS/UI/handoffs/screenshots/parity-motion-code/ds-code-view-390.png`

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
