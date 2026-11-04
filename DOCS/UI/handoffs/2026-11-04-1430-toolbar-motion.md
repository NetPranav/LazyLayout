# Handoff: Motion-mode canvas toolbar and lint warnings (`toolbar-motion`)

- **Date / time:** 2026-11-04 14:38
- **Worker:** Antigravity
- **Branch:** ui/redesign
- **Page / phase:** Editor canvas chrome, top bar, & shell actions
- **Task given by:** `DOCS/UI/tasks/2026-11-04-toolbar-motion.md`

## What changed

- `src/editor/shell/canvas-chrome/Toolbar.tsx`:
  - Added `mode` prop (`"design" | "motion" | "code"`), `isPlaying`, `onTogglePlay`, and `onAddKeyframe`.
  - Implemented the Motion-mode tool group `.mtools` shown exclusively when `mode === "motion"`: Select (V), Hand (H), separator, Add keyframe (K), and Play preview (Space). In Design and Code modes, the normal 9-button tool group is displayed.
  - Sized every button to 40x40 (`size="lg"`), matching the prototype `.ib` dimensions.
  - Created `KeyframeAddSvg` matching prototype `#kfadd` (diamond with central plus) rendered via `Icon` wrapper with 1.5 stroke-width.
  - Sourced playback state from `useStore(transportStore, (s) => s.playing)` and wired Play preview to `transport.togglePlay()` from `@/core/time/transport`. Toggles between Play and Pause icons with dynamic `aria-label`, `tooltip`, and `pressed` state.
  - Grepped `src/core` for keyframe commands; verified no global `addKeyframe` command is registered in engine. Wired `Add keyframe (K)` to check `getCommand("timeline.addKeyframe") || getCommand("keyframe.add")`; when absent, button is disabled with tooltip: `"Add keyframe (K) — No keyframe command registered in engine"`.
- `src/editor/shell/canvas-chrome/types.ts`:
  - Added `mode?: "design" | "motion" | "code"` to `CanvasChromeProps`.
- `src/editor/shell/canvas-chrome/CanvasChrome.tsx`:
  - Accepted `mode = "design"` in `CanvasChromeProps` and passed `mode={mode}` down to `<Toolbar mode={mode} ... />`.
- `src/editor/shell/EditorShell.tsx`:
  - Passed `mode={actions.mode}` into `<CanvasChrome mode={actions.mode} ... />`.
- `src/editor/shell/useEditorActions.ts`:
  - Replaced `window.location.href` internal navigation assignments with Next.js App Router `useRouter().push("/")` and `router.push(\`/editor?projectId=\${newId}\`)` to eliminate Next.js navigation lint warnings.
  - Added `router` to `handleMenuAction` dependency array for exhaustive deps compliance.
  - Added global `Space` and `K` shortcuts in the keyboard listener:
    - `Space`: Toggles `transport.togglePlay()` when not typing in text fields, inputs, or focusing buttons.
    - `K`: Pauses playback if currently playing; otherwise attempts keyframe command dispatch if available.
- `src/editor/shell/left-panel/AssetImage.tsx`:
  - Replaced raw `<img>` element with Next.js `Image` from `"next/image"` configured with `unoptimized` flag. Cleanly supports data URLs, blob URLs, and external CDN asset previews while eliminating `@next/next/no-img-element` lint warnings.
- `src/editor/components/TopBar.tsx`:
  - Updated placeholder menu items that had no active engine backend to be `disabled={true}` with explicit tooltip reasons:
    - `window.undoHistory`: `"Undo history panel coming in Phase 48"`
    - `window.versionHistory`: `"Version history timeline coming in Phase 48"`
    - `app.settings`: `"Settings panel coming in Phase 45"`
    - `help.demo`: `"Showcase demo available in gallery"`
    - `help.about`: `"Lazy Layout v0.1.0"`
- `src/editor/shell/canvas-chrome/CanvasContextMenu.tsx`:
  - Wrapped disabled `Paste here` item with design system `<Tooltip content="Clipboard is empty" side="right">`.

## Decisions made

- **Motion Toolbar Parity**: Matched the prototype's `#tools` box size (195px × 50px) and button sizes (40px × 40px) exactly. In Motion mode, only `.mtools` buttons (Select, Hand, separator, Add Keyframe, Play) are mounted.
- **Engine Keyframe Detection**: Inspected `src/core/commands`, `useDocumentStore`, and `timelineCommands`. Found no parameterless `addKeyframe` command registered in the engine registry. Following instructions, `Add keyframe (K)` button is shown disabled with tooltip `"Add keyframe (K) — No keyframe command registered in engine"`.
- **Space & K Shortcuts**: Space checks `document.activeElement.tagName !== 'BUTTON'` so button activation remains standard WAI-ARIA behavior, while canvas Space scrubs/toggles transport playback. K pauses when playing.
- **Unoptimized Asset Images**: Assets frequently use blob URLs or inline data URIs. Using Next.js `Image` with `unoptimized` allows Next.js optimizations without requiring host domain whitelist configurations in `next.config.ts`.

## Components from other sites

none

## Legacy behaviour dropped

none

## Tokens / palette touched

none (relies strictly on existing tokens: `--ll-size-tool-btn` / `--ll-size-btn-lg` 40px, `--ll-board-bg`, `--ll-border`, `--ll-shadow-soft`)

## Integration notes added

none (per instructions: `INTEGRATION.md` is preserved without edits)

## Not done / blocked

- None. All task requirements complete and verified.

## Phase checks

- typecheck: passed
  ```
  npx tsc --noEmit
  (exit code 0, 0 errors)
  ```
- lint: passed
  ```
  npx eslint src/editor/shell/canvas-chrome src/editor/shell/useEditorActions.ts src/editor/shell/left-panel/AssetImage.tsx src/editor/shell/EditorShell.tsx src/editor/components/TopBar.tsx
  (exit code 0, 0 errors, 0 warnings)
  ```
- build: not run (mid-phase)
- Playwright: passed (headless Chromium verification of toolbar measurements, keyboard shortcuts, and full menu audit)

## Motion-Mode Toolbar Measurements Comparison

| Target | Box Width | Box Height | Button Size | Buttons Present |
|---|---|---|---|---|
| **Prototype** (`#tools .mtools`) | **195px** | **50px** | **40px × 40px** | Select (V), Hand (H), [Sep], Add keyframe (K), Play preview (Space) |
| **App** (`#tools .ll-mtools`) | **195px** | **50px** | **40px × 40px** | Select (V), Hand (H), [Sep], Add keyframe (K), Play preview (Space) |

- **Box size delta:** 0px width difference, 0px height difference (Exact 1:1 match).
- **Button size delta:** 0px width difference, 0px height difference (Exact 1:1 match).

## Menu Audit: Click & Action Verification

Audited every menu across the application:
1. **Logo Menu & Submenus** (File, Edit, View, Window, Theme, Help)
2. **Artboard Title Dropdown** (`#albl`)
3. **Canvas Right-Click Context Menu**
4. **Layer / Element Context Menu**

Every enabled item triggers a verified action or command. All items without an active engine backend are disabled with clear tooltip explanations:

| Menu | Item | Shortcut | State | Action / Tooltip Result |
|---|---|---|---|---|
| **Logo Root** | Back to projects | - | Enabled | Flushes project session; navigates to `/` via `router.push('/')` |
| **Logo Root** | Search | Ctrl+K | Enabled | Dispatches `antigravity:open_command_palette` opening search palette |
| **Logo Root** | Settings | Ctrl+, | Disabled (Tooltip) | Tooltip: `"Settings panel coming in Phase 45"` |
| **File** | New project | Ctrl+N | Enabled | Flushes session, generates new id; navigates to `/editor?projectId=...` via `router.push` |
| **File** | Open… | Ctrl+O | Enabled | Opens system file picker for `.lazy.json` document |
| **File** | Save | Ctrl+S | Enabled | Flushes ProjectSession snapshot to storage |
| **File** | Export code | Ctrl+E | Disabled (Tooltip) | Tooltip: `"Code generation pipeline coming in Phase 49"` |
| **File** | Copy project link | - | Enabled | Copies project URL to clipboard |
| **File** | Import project file… | - | Enabled | Opens system file picker for `.lazy.json` import |
| **File** | Export project file | - | Enabled | Downloads current document as `.lazy.json` |
| **Edit** | Undo | Ctrl+Z | Enabled (Dynamic) | Invokes `edit.undo` reverting last mutation |
| **Edit** | Redo | Ctrl+Shift+Z | Enabled (Dynamic) | Invokes `edit.redo` advancing history stack |
| **Edit** | Cut | Ctrl+X | Enabled | Copies and deletes selected layer |
| **Edit** | Copy | Ctrl+C | Enabled | Copies selected layer to internal clipboard |
| **Edit** | Paste | Ctrl+V | Enabled | Pastes layers into active container with coordinate offset |
| **Edit** | Paste in Place | Ctrl+Shift+V | Enabled | Pastes layers at exact origin |
| **Edit** | Select all | Ctrl+A | Enabled | Selects all canvas elements via `selection.all` |
| **Edit** | Duplicate | Ctrl+D | Enabled | Clones selected layers with 10px offset |
| **Edit** | Delete | Del | Enabled | Deletes selected layers |
| **Edit** | Group | Ctrl+G | Enabled | Wraps selected layers into a container frame |
| **Edit** | Ungroup | Ctrl+Shift+G | Enabled | Dissolves frame promoting child layers |
| **Edit** | Align left / center / right / top / middle / bottom | - | Enabled | Aligns selected layers via `align.*` |
| **Edit** | Distribute horizontally / vertically | - | Enabled | Spaces selected layers evenly via `distribute.*` |
| **View** | Zoom in / Zoom out | Ctrl++, Ctrl+- | Enabled | Adjusts camera zoom by factor 1.25 / 0.8 |
| **View** | Fit to screen | Shift+1 | Enabled | Frames artboard to viewport via camera fit |
| **View** | Rulers | Shift+R | Enabled (Checked) | Toggles canvas rulers via `useSnapStore.toggle("rulers")` |
| **View** | View options… | - | Enabled | Opens floating `ViewOptionsPopover` |
| **View** | Hide interface | Tab | Enabled (Checked) | Toggles Zen mode hiding top/side chrome |
| **View** | Zoom to 100% | Ctrl+0 | Enabled | Resets zoom to 1.0 via `useCameraStore.zoomTo100()` |
| **View** | Zoom to selection | Shift+2 | Enabled | Centers and fits camera to current selection |
| **View** | Fullscreen | F11 | Enabled | Toggles document fullscreen |
| **Window** | Left panel | - | Enabled (Checked) | Toggles left layers/assets panel collapse |
| **Window** | Assets | - | Enabled | Expands left panel and focuses Assets tab |
| **Window** | Right panel | - | Enabled (Checked) | Toggles right inspector panel collapse |
| **Window > Layouts** | Design | - | Enabled (Checked) | Switches mode to Design (hides bottom drawer) |
| **Window > Layouts** | Animate | - | Enabled (Checked) | Switches mode to Motion (reveals timeline, displays `.mtools` toolbar) |
| **Window > Layouts** | Code | - | Enabled (Checked) | Switches mode to Code (reveals code editor and console) |
| **Window > Layouts** | Debug | - | Disabled (Tooltip) | Tooltip: `"Debug layout available in developer labs"` |
| **Window** | Reset layout | - | Enabled | Expands all panels and exits Zen mode |
| **Window** | Output Log | - | Disabled (Tooltip) | Tooltip: `"Output log viewer coming in Phase 48"` |
| **Window** | Execution Trace | - | Disabled (Tooltip) | Tooltip: `"Execution trace visualizer coming in Phase 48"` |
| **Window** | Undo History | - | Disabled (Tooltip) | Tooltip: `"Undo history panel coming in Phase 48"` |
| **Window** | Version History | - | Disabled (Tooltip) | Tooltip: `"Version history timeline coming in Phase 48"` |
| **Window** | Global Search | Ctrl+K | Enabled | Opens search command palette |
| **Window** | Reference Viewer | - | Disabled (Tooltip) | Tooltip: `"Reference viewer coming in Phase 52"` |
| **Window** | Plugins | - | Disabled (Tooltip) | Tooltip: `"Plugin manager coming in Phase 55"` |
| **Window** | Deployment | - | Disabled (Tooltip) | Tooltip: `"Deployment manager coming in Phase 60"` |
| **Window** | Logic | - | Disabled (Tooltip) | Tooltip: `"Logic blueprint coming in Phase 42"` |
| **Window** | Data | - | Disabled (Tooltip) | Tooltip: `"Data binding editor coming in Phase 44"` |
| **Theme** | Paper / White / Warm / Lilac / Dark | - | Enabled (Checked) | Updates `--ll-*` theme CSS variables on documentElement |
| **Help** | Keyboard shortcuts | F1 | Enabled | Opens keyboard shortcut palette |
| **Help** | Showcase demo | - | Disabled (Tooltip) | Tooltip: `"Showcase demo available in gallery"` |
| **Help** | Documentation | - | Enabled | Opens external repository docs in new window |
| **Help** | About | - | Disabled (Tooltip) | Tooltip: `"Lazy Layout v0.1.0"` |
| **Artboard Dropdown** | Desktop (1440) | - | Enabled (Checked) | Updates artboard dimensions to 1440x900 |
| **Artboard Dropdown** | Tablet (768) | - | Enabled | Updates artboard dimensions to 768x1024 |
| **Artboard Dropdown** | Mobile (375) | - | Enabled | Updates artboard dimensions to 375x812 |
| **Canvas Context** | Undo / Redo | Ctrl+Z, Ctrl+Shift+Z | Enabled (Dynamic) | Reverts / re-applies document mutations |
| **Canvas Context** | Paste here | Ctrl+V | Disabled (Tooltip) | Tooltip: `"Clipboard is empty"` |
| **Canvas Context** | Select all | Ctrl+A | Enabled | Selects all elements on canvas |
| **Canvas Context** | Add frame / Add text | F, T | Enabled | Inserts frame / activates text tool |
| **Canvas Context** | Insert… | - | Enabled | Opens Insert catalog popup |
| **Canvas Context > Zoom** | Zoom in / out / 100% / Fit | Ctrl++, Ctrl+-, Ctrl+0, Shift+1 | Enabled | Adjusts camera zoom |
| **Canvas Context > View** | Rulers / Pixel grid / Snap / Checkerboard / Panels | Shift+R, etc. | Enabled | Toggles viewport guides and grid settings |
| **Canvas Context** | Canvas settings… | - | Enabled | Opens `ViewOptionsPopover` dialog |
| **Layer Context** | Ask AI… | - | Enabled | Opens Ask AI drawer pre-focused on selected layer |
| **Layer Context** | Copy / Duplicate / Delete | Ctrl+C, Ctrl+D, Del | Enabled | Layer clipboard and lifecycle operations |
| **Layer Context** | Paste / Paste in Place | Ctrl+V, Ctrl+Shift+V | Disabled (Tooltip) | Tooltip: `"Clipboard is empty"` |
| **Layer Context > Arrange** | Forward / Backward / Front / Back | Ctrl+], Ctrl+[, etc. | Enabled | Adjusts layer z-order in parent container |
| **Layer Context > Align** | Align & Distribute | - | Enabled | Aligns multi-selected layers |
| **Layer Context** | Group / Frame selection / Tidy up | Ctrl+G, Ctrl+Alt+G, Ctrl+Alt+T | Enabled | Layer grouping and spacing |
| **Layer Context > Layer** | Ungroup / Rename / Hide / Lock / Select all / Show all / Unlock all | F2, Ctrl+Shift+H, Ctrl+Shift+L, etc. | Enabled | Layer hierarchy and visibility actions |
| **Layer Context > More** | Copy as code | - | Disabled (Tooltip) | Tooltip: `"Code generation pipeline coming in Phase 49"` |
| **Layer Context > More** | Add animation | - | Enabled | Selects layer, reveals Motion timeline, flashes track |

## Screenshots

- `DOCS/UI/handoffs/toolbar-motion-1440.png` (Desktop 1440x900 in Motion mode showing 195x50 `.mtools` toolbar)
- `DOCS/UI/handoffs/toolbar-motion-1024.png` (Tablet 1024x768 in Motion mode)
- `DOCS/UI/handoffs/toolbar-motion-390.png` (Mobile 390x844 in Motion mode)

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
