# Binding plan: prototype (2026-11-07 blocks) to `src/editor`

Written by Claude (build session), 2026-11-08. Branch `ui/redesign`. P = `DOCS/UI/design/editor-design-mode-blocks-dark.html`.

## Reconcile result
Checked every CHANGELOG "not built" row against `src/editor` (grep + file list). Stale rows (already built, only the status text is old): Code mode, Motion timeline, Trace logo, Default themes, most of Canvas editing. **None of the 2026-11-07 rows exist in `src/editor`** (no ColorPicker, FontPicker, FramePresets, Spotlight, options popover, canvas cursor, format bar, `--syn-*`, per-theme `--lbl-*`, `LLMotion` table, Preview button, Auto-key/Onion). `CommandPalette.tsx` exists (old palette, replaced by Spotlight). `ColorSwatchField` exists (will open the new ColorPicker).

## Map
| Prototype feature | P block | Lane | src/editor files | Engine binding | Status |
|---|---|---|---|---|---|
| `--syn-*`, per-theme `--lbl-1..6`, tints (8 themes) | theme blocks, `.ct` | A (L0b) | styles/tokens.css, tailwind.css | none | todo |
| Shared spring table + feel (`LLMotion`) | main script | A (L0b) | motion/presets.ts, feel.ts | existing feel store | todo |
| Colour picker | ll-cpick | B1 | components/ColorPicker.tsx | inspector fill commands via `ColorSwatchField` onChange | todo |
| Font picker (304px, no weight) | ll-fpick | B1 | components/FontPicker.tsx | `src/core/fonts` read-only list | todo |
| Frame presets panel | ll-frames | B1 | components/FramePresetsPanel.tsx | frame insert via documentCommands (consumer: B5) | todo |
| Options popover | ll-more | B1 | components/OptionsPopover.tsx | none (container) | todo |
| Layers rows, search, page selector | Layers CSS/JS, ll-more | B2 | shell/left-panel/**, panels/layers/** | useDocumentStore, useLayers, useSelectionStore, useLayersUiStore, usePagesData | todo |
| Sliders button, Mixed, multi header, hairline fields, Canvas settings layout | dsec(), typoSec, renderIns, #vpop | B3 | panels/details/**, shell/right-panel/** | core/inspector proModel/proRead/simpleOps | todo |
| Canvas cursor, text format bar, blank page | ll-cursors, `.ftxb`, `.app.blank` | B4 | stage/** | useToolStore, useCameraStore, useSnapStore, selection | todo |
| Per-mode toolbars, Spotlight | ll-tbar, ll-spot | B5 | shell/canvas-chrome/**, components/CommandPalette.tsx (replace) | core/commands getAllCommands/runCommand | todo |
| Code colours, console filter, find bar, Run, one hairline | `.ct`, `.ctool`, `#cfseg` | B6 | panels/code-view/**, panels/console/** | src/compiler output stays generated | todo |
| Label colours, Auto-key, Onion, Easing popover, Split | per-theme lbl, timeline footer | B7 | panels/timeline/**, motion-model/**, panels/inspectors/** | core/timeline model/timelineCommands/timelineOps | todo |
| Preview button, trace loader back and forth | `.logo .tro` | B8 | components/TopBar.tsx, LogoMark.tsx | save-status state (keep testid) | todo |
| Demos, exports, mounts | n/a | B9 | design-system/**, components/index.ts, shell/EditorShell.tsx | none | todo |

## Engine gaps (adapter in lane, request in INTEGRATION.md)
No Add keyframe command; no undo for page create/rename/delete; no collaborator presence; Preview mode and Pages manager are not designed.

## Not in scope (not designed yet)
Preview mode, Pages manager, image Replace, gradient handles, transform-origin, data binding, Logic/Data, window panels, Settings, crash states, Home parts 2–8.
